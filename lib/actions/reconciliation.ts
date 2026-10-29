"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { koboToNaira } from "@/lib/payments/paystack-client";
import { findEarliestUnpaidScheduleEntry } from "@/lib/payments/webhook-handler";
import { writeAuditLog } from "@/lib/audit";

/**
 * Resolves an UNMATCHED ProviderTransaction by hand: staff pick which
 * vehicle this collection actually belongs to, and this applies it the
 * exact same way the automatic charge.success handler would have, had it
 * been able to identify the payer itself (see findEarliestUnpaidSchedule
 * Entry in lib/payments/webhook-handler.ts, reused here on purpose so a
 * manually matched payment lands on a contract identically to an
 * automatically matched one). The vehicle's own agent and current driver,
 * if any, are recorded on the resulting PaymentTransaction, staff only
 * ever choose the vehicle, not the agent/driver separately.
 *
 * Module 27 bug fix: this used to `throw new Error(...)` on every failure
 * path (no permission, transaction already resolved, missing amount on
 * the stored payload), and it was bound directly to a plain
 * `<form action={matchProviderTransaction}>` on the reconciliation page
 * with no Client Component wrapping it, so any of those throws crashed
 * straight to Next's generic error boundary with no real message shown.
 * This is the same shape of bug fixed in bootstrapFirstAdmin,
 * retryAgentCollectionAccount, and updatePayoutDetails earlier (see
 * README's Module 25/26 entries and CURRENT_STATE.md's Known gaps), and
 * very likely exactly what was meant by "reconciliation is throwing an
 * error": this page had never actually been reachable, let alone
 * exercised end to end, until Module 26 added a sidebar link to it.
 * Converted to a `{error?: string}` return, the page's forms are now
 * Client Components that display whatever comes back instead of crashing.
 */
export async function matchProviderTransaction(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!user.staff || !user.permissions.has(PERMISSIONS.RECONCILIATION_VIEW)) {
    return { error: "Your role doesn't include permission to resolve reconciliation." };
  }

  const providerTransactionId = String(formData.get("providerTransactionId") ?? "");
  const vehicleId = String(formData.get("vehicleId") ?? "");
  if (!providerTransactionId || !vehicleId) {
    return { error: "Select a vehicle to match this transaction to." };
  }

  const providerTransaction = await prisma.providerTransaction.findUnique({
    where: { id: providerTransactionId },
  });
  if (!providerTransaction) return { error: "That transaction no longer exists." };
  if (providerTransaction.status !== "UNMATCHED") {
    return { error: "This transaction has already been resolved." };
  }

  const rawData = (providerTransaction.rawPayload as { data?: { amount?: number } } | null)?.data;
  const amountKobo = rawData?.amount;
  if (typeof amountKobo !== "number") {
    return { error: "This transaction's stored payload has no amount, it can't be matched automatically." };
  }
  const amountNaira = koboToNaira(amountKobo);

  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    select: { agentId: true, currentDriverId: true },
  });
  if (!vehicle) return { error: "That vehicle no longer exists." };

  const scheduleEntry = await findEarliestUnpaidScheduleEntry(vehicleId);

  await prisma.$transaction(async (tx) => {
    const paymentTransaction = await tx.paymentTransaction.create({
      data: {
        direction: "INBOUND",
        source: "AGENT_REMITTANCE",
        amount: amountNaira,
        status: scheduleEntry ? "ALLOCATED" : "RECORDED",
        providerTransactionId,
        agentId: vehicle.agentId,
        driverId: vehicle.currentDriverId,
      },
    });

    if (scheduleEntry) {
      await tx.paymentAllocation.create({
        data: {
          paymentTransactionId: paymentTransaction.id,
          scheduleEntryId: scheduleEntry.id,
          amount: amountNaira,
        },
      });

      const newAmountPaid = Number(scheduleEntry.amountPaid) + amountNaira;
      await tx.paymentScheduleEntry.update({
        where: { id: scheduleEntry.id },
        data: {
          amountPaid: newAmountPaid,
          status: newAmountPaid >= Number(scheduleEntry.expectedAmount) ? "PAID" : "PARTIALLY_PAID",
        },
      });

      await tx.investmentContract.update({
        where: { id: scheduleEntry.contractId },
        data: { totalPaidToInvestor: { increment: amountNaira } },
      });
    }

    await tx.providerTransaction.update({
      where: { id: providerTransactionId },
      data: { status: "PROCESSED", processedAt: new Date() },
    });

    await writeAuditLog(
      {
        actorUserId: user.id,
        action: "provider_transaction.match",
        entityType: "ProviderTransaction",
        entityId: providerTransactionId,
        beforeState: { status: "UNMATCHED" },
        afterState: { status: "PROCESSED", vehicleId, amount: amountNaira },
      },
      tx
    );
  });

  revalidatePath("/admin/payments/reconciliation");
  revalidatePath("/admin/dashboard");
  return {};
}

/**
 * For a transaction that genuinely isn't a remittance for this app at
 * all (a stray charge, a test payment, a transfer for something outside
 * the platform) rather than one that just failed to auto-match. This
 * closes it out without creating any PaymentTransaction, there is
 * nothing to allocate.
 *
 * Module 27 bug fix: same throw-in-a-plain-form-action shape as
 * matchProviderTransaction above, converted the same way.
 */
export async function dismissProviderTransaction(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!user.staff || !user.permissions.has(PERMISSIONS.RECONCILIATION_VIEW)) {
    return { error: "Your role doesn't include permission to resolve reconciliation." };
  }

  const providerTransactionId = String(formData.get("providerTransactionId") ?? "");

  const providerTransaction = await prisma.providerTransaction.findUnique({
    where: { id: providerTransactionId },
  });
  if (!providerTransaction) return { error: "That transaction no longer exists." };
  if (providerTransaction.status !== "UNMATCHED") {
    return { error: "This transaction has already been resolved." };
  }

  await prisma.providerTransaction.update({
    where: { id: providerTransactionId },
    data: { status: "PROCESSED", processedAt: new Date() },
  });
  await writeAuditLog({
    actorUserId: user.id,
    action: "provider_transaction.dismiss",
    entityType: "ProviderTransaction",
    entityId: providerTransactionId,
    beforeState: { status: "UNMATCHED" },
    afterState: { status: "PROCESSED", dismissed: true },
  });

  revalidatePath("/admin/payments/reconciliation");
  revalidatePath("/admin/dashboard");
  return {};
}
