"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission, assertDifferentActor, ForbiddenError } from "@/lib/rbac/check-permission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getPaymentProvider } from "@/lib/payments/provider";
import { applyTransferOutcome, applyWalletHold } from "@/lib/payments/batch-processor";
import { writeAuditLog } from "@/lib/audit";

/**
 * Creates a payment batch from a set of due schedule entries. The batch
 * starts in PENDING_APPROVAL, nothing is sent to Paystack yet, that only
 * happens once a different staff member approves it, see
 * approvePaymentBatch below.
 *
 * Module 26: each item's payoutDestination is copied from the investor's
 * own InvestorProfile.defaultPayoutDestination at the moment the batch is
 * created, staff no longer pick it per row here. Staff picking it by hand
 * on every batch, for every investor, every time, was exactly the kind of
 * repetitive manual step a mistake slips into, one missed tick sends
 * someone's payout to the wrong place. The investor's own standing
 * preference (set at onboarding in createInvestor, editable anytime after
 * on /investor/payout-details) is the single source of truth now, this
 * just reads it. PaymentBatchItem.payoutDestination is still a real,
 * separate column, a snapshot taken here, not a live reference, so an
 * investor changing their preference later never silently rewrites a
 * batch that's already pending approval or already paid.
 *
 * Module 27: converted from throwing to a `{error?}` return (the "New
 * batch" page is now a Client Component that calls this directly instead
 * of a plain form action), and re-filters the submitted entries against
 * each contract's live status. getDueScheduleEntriesForBatch already
 * excludes non-ACTIVE contracts from the list staff pick from, so this
 * should never actually drop anything in normal use, it exists purely as
 * a second layer in case a "New batch" page was left open in a browser
 * tab across a contract hitting its target, so a stale form submission
 * can never create a PaymentBatchItem for a contract that isn't ACTIVE
 * anymore and risk overpaying it, see getDueScheduleEntriesForBatch's own
 * doc comment in lib/data/payments.ts for the full reasoning.
 */
export async function createPaymentBatch(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!user.staff || !user.permissions.has(PERMISSIONS.PAYMENT_BATCH_CREATE)) {
    return { error: "Your role doesn't include permission to create a payment batch." };
  }

  const scheduleEntryIds = formData.getAll("scheduleEntryId").map(String);
  if (scheduleEntryIds.length === 0) {
    return { error: "Select at least one investor to include in this batch." };
  }

  const submittedEntries = await prisma.paymentScheduleEntry.findMany({
    where: { id: { in: scheduleEntryIds } },
    include: { contract: { include: { investor: true } } },
  });

  // Defense in depth, see the doc comment above: only entries whose
  // contract is still ACTIVE ever become PaymentBatchItems.
  const entries = submittedEntries.filter((e) => e.contract.status === "ACTIVE");
  if (entries.length === 0) {
    return {
      error: "None of the selected entries are still eligible, their contracts have already reached their target. Refresh the page.",
    };
  }

  const totalAmount = entries.reduce((sum, e) => sum + (Number(e.expectedAmount) - Number(e.amountPaid)), 0);

  const batch = await prisma.paymentBatch.create({
    data: {
      periodLabel: `Batch created ${new Date().toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric" })}`,
      status: "PENDING_APPROVAL",
      totalAmount,
      createdById: user.staff.id,
      items: {
        create: entries.map((e) => ({
          contractId: e.contractId,
          investorId: e.contract.investorId,
          amount: Number(e.expectedAmount) - Number(e.amountPaid),
          payoutDestination: e.contract.investor.defaultPayoutDestination,
        })),
      },
    },
  });

  revalidatePath("/admin/payments/batches");
  redirect(`/admin/payments/batches/${batch.id}`);
}

/**
 * Approves a batch and actually sends the money: creates a Paystack
 * transfer recipient for any investor who doesn't have one yet, then
 * calls initiateTransfer for every item. Enforces segregation of duties,
 * the approver can never be the same person who created the batch, even
 * if they hold a role with both permissions.
 *
 * Module 43: the "already decided" status-guard throw below converted to
 * a `{ error?: string }` return, this is bound to a plain
 * `<form action={approvePaymentBatch}>` on
 * `/admin/payments/batches/[id]`, see `components/ui/action-form.tsx`'s
 * doc comment. The per-item throw further down (missing bank account on
 * file) is left as a real throw, it's already caught by its own
 * surrounding try/catch and turned into a per-item FAILED status, it
 * never reaches this action's caller.
 */
export async function approvePaymentBatch(formData: FormData): Promise<{ error?: string } | void> {
  const batchId = String(formData.get("batchId"));

  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.PAYMENT_BATCH_APPROVE);
  if (!user.staff) throw new ForbiddenError(PERMISSIONS.PAYMENT_BATCH_APPROVE);

  const batch = await prisma.paymentBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: { items: { include: { investor: { include: { user: true } } } } },
  });

  assertDifferentActor(batch.createdById, user.staff.id, "Approve payment batch");

  if (batch.status !== "PENDING_APPROVAL") {
    return { error: `This batch is already ${batch.status.toLowerCase().replaceAll("_", " ")}.` };
  }

  await prisma.paymentBatchApproval.create({
    data: { batchId, approvedById: user.staff.id, decision: "APPROVED" },
  });
  await prisma.paymentBatch.update({ where: { id: batchId }, data: { status: "PROCESSING" } });
  await writeAuditLog({
    actorUserId: user.id,
    action: "payment_batch.approve",
    entityType: "PaymentBatch",
    entityId: batchId,
    beforeState: { status: batch.status },
    afterState: { status: "PROCESSING", itemCount: batch.items.length, totalAmount: Number(batch.totalAmount) },
  });

  const provider = await getPaymentProvider();

  for (const item of batch.items) {
    // Wallet-routed items never touch Paystack at all, there is no bank
    // transfer to initiate, this only credits the investor's in-app
    // wallet ledger. Staff chose this per item back when the batch was
    // created, see createPaymentBatch above.
    if (item.payoutDestination === "WALLET") {
      try {
        await applyWalletHold(item.id);
      } catch (error) {
        await prisma.paymentBatchItem.update({
          where: { id: item.id },
          data: {
            transferStatus: "FAILED",
            failureReason: error instanceof Error ? error.message : "Could not credit wallet",
          },
        });
      }
      continue;
    }

    try {
      let recipientCode = item.investor.paystackRecipientCode;
      if (!recipientCode) {
        if (!item.investor.bankAccountNumber || !item.investor.bankCode) {
          throw new Error("This investor has no bank account on file yet.");
        }
        const recipient = await provider.createTransferRecipient({
          accountName: item.investor.bankAccountName ?? item.investor.user.fullName,
          accountNumber: item.investor.bankAccountNumber,
          bankCode: item.investor.bankCode,
        });
        recipientCode = recipient.recipientCode;
        await prisma.investorProfile.update({
          where: { id: item.investor.id },
          data: { paystackRecipientCode: recipientCode },
        });
      }

      const result = await provider.initiateTransfer({
        amountNaira: Number(item.amount),
        recipientCode,
        reason: `Investment payout - ${batch.periodLabel}`,
        reference: item.id,
      });

      await applyTransferOutcome(item.id, {
        status: result.status === "success" ? "SUCCESS" : result.status === "failed" ? "FAILED" : "PENDING",
        transferCode: result.transferCode,
      });
    } catch (error) {
      await applyTransferOutcome(item.id, {
        status: "FAILED",
        failureReason: error instanceof Error ? error.message : "Transfer failed",
      });
    }
  }

  const refreshedItems = await prisma.paymentBatchItem.findMany({ where: { batchId } });
  const allSucceeded = refreshedItems.every((i) => i.transferStatus === "SUCCESS");
  await prisma.paymentBatch.update({
    where: { id: batchId },
    data: { status: allSucceeded ? "COMPLETED" : "PARTIALLY_FAILED" },
  });

  revalidatePath(`/admin/payments/batches/${batchId}`);
  revalidatePath("/admin/payments/batches");
  revalidatePath("/admin/dashboard");
}

/**
 * Rejects a batch before anything is sent to Paystack. Same segregation
 * of duties rule as approval, whoever created the batch cannot also be
 * the one who rejects it.
 *
 * Module 43: the "already decided" status-guard throw below converted to
 * a `{ error?: string }` return, same reasoning as approvePaymentBatch
 * above, this is bound to a plain `<form action={rejectPaymentBatch}>`
 * on `/admin/payments/batches/[id]`.
 */
export async function rejectPaymentBatch(formData: FormData): Promise<{ error?: string } | void> {
  const batchId = String(formData.get("batchId"));
  const note = String(formData.get("note") ?? "").trim();

  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.PAYMENT_BATCH_APPROVE);
  if (!user.staff) throw new ForbiddenError(PERMISSIONS.PAYMENT_BATCH_APPROVE);

  const batch = await prisma.paymentBatch.findUniqueOrThrow({ where: { id: batchId } });
  assertDifferentActor(batch.createdById, user.staff.id, "Reject payment batch");

  if (batch.status !== "PENDING_APPROVAL") {
    return { error: `This batch is already ${batch.status.toLowerCase().replaceAll("_", " ")}.` };
  }

  await prisma.paymentBatchApproval.create({
    data: { batchId, approvedById: user.staff.id, decision: "REJECTED", note: note || null },
  });
  await prisma.paymentBatch.update({ where: { id: batchId }, data: { status: "REJECTED" } });
  await writeAuditLog({
    actorUserId: user.id,
    action: "payment_batch.reject",
    entityType: "PaymentBatch",
    entityId: batchId,
    beforeState: { status: batch.status },
    afterState: { status: "REJECTED", note: note || null },
  });

  revalidatePath(`/admin/payments/batches/${batchId}`);
  revalidatePath("/admin/payments/batches");
}
