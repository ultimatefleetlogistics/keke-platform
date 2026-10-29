"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { writeAuditLog } from "@/lib/audit";
import { findEarliestUnpaidScheduleEntry } from "@/lib/payments/webhook-handler";
import { sendNotification, sendUntrackedSms } from "@/lib/notifications/send-notification";
import { buildAlertSms, shortRef, type AlertDetails } from "@/lib/notifications/templates";
import { formatNaira } from "@/lib/utils";
import { isAgentDriverRemittanceAlertEnabled } from "@/lib/config/portal-access";

type Subject = "AGENT" | "DRIVER";

function revalidateSubject(subjectType: Subject, subjectId: string, vehicleId?: string | null) {
  if (subjectType === "AGENT") {
    revalidatePath("/admin/agents");
    revalidatePath(`/admin/agents/${subjectId}`);
  } else {
    revalidatePath("/admin/drivers");
    revalidatePath(`/admin/drivers/${subjectId}`);
  }
  revalidatePath("/admin/payments/reconciliation");
  revalidatePath("/admin/dashboard");
  if (vehicleId) revalidatePath(`/admin/fleet/${vehicleId}`);
}

/**
 * Module 59: staff recording a cash remittance or deposit that arrived
 * outside Paystack — a real, direct gap the project owner's own
 * missing-features-agent-driver-restructure.md flagged (item 2): "not all
 * money will arrive as a clean transfer... cash handoffs are common in
 * informal fleet operations... otherwise cash payments either go
 * untracked or get handled as an off-system workaround." Before this
 * module, `PaymentSource.MANUAL_ADJUSTMENT` existed on the schema but was
 * never actually set by any Server Action anywhere in this app, on either
 * the agent/driver payment side or the investor wallet side (confirmed by
 * grep before writing this) — this is the first real use of it.
 *
 * Deliberately reuses `payments.reconciliation.view` rather than a new
 * permission key: matchProviderTransaction and dismissProviderTransaction
 * (lib/actions/reconciliation.ts) already gate a real, mutating,
 * ledger-changing action behind that same "view" permission, this is the
 * same shape of action (staff manually placing a payment onto the
 * ledger), so reusing it avoids a permission that would need its own
 * database reseed (`npx prisma db seed`, see this module's README/
 * CURRENT_STATE.md entry for why) for a feature this narrow.
 *
 * The vehicle allocation is optional and best-effort, exactly like an
 * automatic charge.success webhook (handleChargeSuccess) or a manually
 * matched one (matchProviderTransaction): when a vehicle is chosen, this
 * applies the amount to that vehicle's earliest unpaid schedule entry
 * using the exact same shared helper both of those already use, so a
 * manually recorded cash payment lands on a contract identically to an
 * electronic one. Left unchosen, the row is simply RECORDED, unallocated,
 * same "Not yet allocated" UI the agent/driver detail pages already show
 * for any remittance with no allocations, staff can leave it that way or
 * come back to it once they know which vehicle it belongs to.
 *
 * `providerTransactionId` is left null on purpose: there is no
 * ProviderTransaction behind a cash payment, nothing from Paystack to
 * point at, that column being null is exactly what distinguishes a manual
 * entry from an electronic one at the database level, on top of
 * `source: MANUAL_ADJUSTMENT` itself.
 */
export async function recordManualPayment(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!user.staff || !user.permissions.has(PERMISSIONS.RECONCILIATION_VIEW)) {
    return { error: "Your role doesn't include permission to record a manual payment." };
  }

  const subjectType = String(formData.get("subjectType") ?? "") as Subject;
  if (subjectType !== "AGENT" && subjectType !== "DRIVER") {
    return { error: "Unknown subject type." };
  }
  const subjectId = String(formData.get("subjectId") ?? "").trim();
  if (!subjectId) return { error: "Missing agent or driver." };

  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid amount greater than zero." };
  }

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) {
    return { error: "A reason is required for a manually recorded payment, this becomes the audit trail for it." };
  }

  const vehicleId = String(formData.get("vehicleId") ?? "").trim() || null;

  if (subjectType === "AGENT") {
    const agent = await prisma.agent.findUnique({ where: { id: subjectId } });
    if (!agent) return { error: "That agent no longer exists." };
  } else {
    const driver = await prisma.driver.findUnique({ where: { id: subjectId } });
    if (!driver) return { error: "That driver no longer exists." };
  }

  if (vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle) return { error: "That vehicle no longer exists." };
  }

  const scheduleEntry = vehicleId ? await findEarliestUnpaidScheduleEntry(vehicleId) : null;

  let paymentTransactionId = "";
  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const paymentTransaction = await tx.paymentTransaction.create({
      data: {
        direction: "INBOUND",
        source: "MANUAL_ADJUSTMENT",
        amount,
        status: scheduleEntry ? "ALLOCATED" : "RECORDED",
        agentId: subjectType === "AGENT" ? subjectId : undefined,
        driverId: subjectType === "DRIVER" ? subjectId : undefined,
        note: reason,
        recordedById: user.staff!.id,
      },
    });
    paymentTransactionId = paymentTransaction.id;

    if (scheduleEntry) {
      await tx.paymentAllocation.create({
        data: { paymentTransactionId: paymentTransaction.id, scheduleEntryId: scheduleEntry.id, amount },
      });
      const newAmountPaid = Number(scheduleEntry.amountPaid) + amount;
      await tx.paymentScheduleEntry.update({
        where: { id: scheduleEntry.id },
        data: {
          amountPaid: newAmountPaid,
          status: newAmountPaid >= Number(scheduleEntry.expectedAmount) ? "PAID" : "PARTIALLY_PAID",
        },
      });
      await tx.investmentContract.update({
        where: { id: scheduleEntry.contractId },
        data: { totalPaidToInvestor: { increment: amount } },
      });
    }

    await writeAuditLog(
      {
        actorUserId: user.id,
        action: "payment_transaction.manual_record",
        entityType: "PaymentTransaction",
        entityId: paymentTransaction.id,
        afterState: { subjectType, subjectId, amount, reason, vehicleId, allocated: Boolean(scheduleEntry) },
      },
      tx
    );
  });

  // Deliberately outside the transaction above, same reasoning as
  // handleChargeSuccess's own notification in lib/payments/webhook-handler.ts:
  // sendNotification/sendUntrackedSms never throw, a failed alert must
  // never make an otherwise-successfully-recorded payment look
  // unrecorded. This also fulfills a specific promise already made in
  // missing-features-agent-driver-restructure.md item 7: "an agent or
  // driver gets an automatic SMS... whenever a remittance (electronic OR
  // cash-recorded-by-staff) lands against their account" — before this
  // module that promise only held for the electronic half.
  const alert: AlertDetails = {
    kind: "CREDIT",
    amount,
    reference: shortRef(paymentTransactionId, "RMT-"),
    desc: reason,
  };
  if (isAgentDriverRemittanceAlertEnabled()) {
    if (subjectType === "AGENT") {
      const agent = await prisma.agent.findUniqueOrThrow({ where: { id: subjectId } });
      await sendNotification({
        userId: agent.userId,
        type: "remittance_received",
        title: "Remittance received",
        body: `${formatNaira(amount)} was recorded against your collection account.`,
        channels: ["EMAIL", "SMS"],
        alert,
      });
    } else {
      const driver = await prisma.driver.findUniqueOrThrow({ where: { id: subjectId } });
      if (driver.userId) {
        await sendNotification({
          userId: driver.userId,
          type: "remittance_received",
          title: "Deposit received",
          body: `${formatNaira(amount)} was recorded against your collection account.`,
          channels: ["SMS"],
          alert,
        });
      } else if (driver.phone) {
        await sendUntrackedSms(driver.phone, buildAlertSms(alert));
      }
    }
  }

  revalidateSubject(subjectType, subjectId, vehicleId);
  return {};
}

/**
 * The dispute/adjustment side of Module 59: "when a driver or agent
 * insists they remitted and it's not reflecting... staff needs a way to
 * investigate and, where justified, make a manual ledger adjustment with
 * a reason attached, inside the audit trail" (missing-features-agent-
 * driver-restructure.md item 5). This reverses a specific row staff have
 * already investigated and decided was wrong — entered in error, a
 * duplicate, a payment that never actually landed — undoing exactly the
 * schedule-entry/contract increment its own creation made (or the
 * equivalent webhook/reconciliation increment, this works on any INBOUND
 * agent/driver PaymentTransaction, not only a manually recorded one, a
 * real webhook remittance can be genuinely wrong too, e.g. matched to the
 * wrong vehicle by a since-corrected reconciliation decision). It does
 * NOT create a new row, "reverse" here means what
 * PaymentTransactionStatus.REVERSED already names on the schema (present
 * since the very first migration, never actually set by anything until
 * this module). A staff member who instead needs to ADD money that's
 * missing uses recordManualPayment above; the two are separate actions on
 * purpose, reversing and recording are different claims about reality and
 * this tool should never blur which one staff meant.
 *
 * Only ever reachable for a RECORDED or ALLOCATED row, never one already
 * REVERSED, so the same mistake can't be reversed twice and silently
 * double the correction.
 */
export async function reversePaymentTransaction(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!user.staff || !user.permissions.has(PERMISSIONS.RECONCILIATION_VIEW)) {
    return { error: "Your role doesn't include permission to reverse a payment." };
  }

  const paymentTransactionId = String(formData.get("paymentTransactionId") ?? "").trim();
  if (!paymentTransactionId) return { error: "Missing transaction." };

  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) return { error: "A reason is required to reverse a payment, this becomes the audit trail for it." };

  const transaction = await prisma.paymentTransaction.findUnique({
    where: { id: paymentTransactionId },
    include: { allocations: true },
  });
  if (!transaction) return { error: "That transaction no longer exists." };
  if (!transaction.agentId && !transaction.driverId) {
    return { error: "Only agent or driver remittances can be reversed here." };
  }
  if (transaction.status === "REVERSED") {
    return { error: "This transaction has already been reversed." };
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const allocation of transaction.allocations) {
      const scheduleEntry = await tx.paymentScheduleEntry.findUniqueOrThrow({ where: { id: allocation.scheduleEntryId } });
      const newAmountPaid = Math.max(0, Number(scheduleEntry.amountPaid) - Number(allocation.amount));
      await tx.paymentScheduleEntry.update({
        where: { id: scheduleEntry.id },
        data: {
          amountPaid: newAmountPaid,
          // Approximate on purpose: this cannot know whether the entry's
          // due date has already passed, so it lands on UPCOMING/
          // PARTIALLY_PAID rather than DUE/OVERDUE. Every overdue view in
          // this app (lib/data/reports.ts's arrears report, the investor
          // dashboard) already computes overdue-ness live from dueDate vs
          // today rather than trusting this status column alone, see
          // Known gaps in CURRENT_STATE.md, so a reversed entry that is
          // actually now overdue still shows correctly there even though
          // this column reads UPCOMING until something else touches it.
          status: newAmountPaid <= 0 ? "UPCOMING" : "PARTIALLY_PAID",
        },
      });
      await tx.investmentContract.update({
        where: { id: scheduleEntry.contractId },
        data: { totalPaidToInvestor: { decrement: Number(allocation.amount) } },
      });
    }
    await tx.paymentAllocation.deleteMany({ where: { paymentTransactionId } });

    await tx.paymentTransaction.update({
      where: { id: paymentTransactionId },
      data: { status: "REVERSED", note: reason },
    });

    await writeAuditLog(
      {
        actorUserId: user.id,
        action: "payment_transaction.reverse",
        entityType: "PaymentTransaction",
        entityId: paymentTransactionId,
        beforeState: { status: transaction.status, amount: Number(transaction.amount), note: transaction.note },
        afterState: { status: "REVERSED", reason },
      },
      tx
    );
  });

  const subjectType: Subject = transaction.agentId ? "AGENT" : "DRIVER";
  revalidateSubject(subjectType, (transaction.agentId ?? transaction.driverId)!);
  return {};
}
