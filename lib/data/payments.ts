import { prisma } from "@/lib/prisma";

/**
 * Schedule entries eligible to go into a new payment batch: due or
 * partially paid, and not already sitting inside a batch that is still
 * open (pending approval, approved, or processing). A completed or
 * rejected batch does not block the entry from being picked up again.
 *
 * Module 27 bug fix: this used to have no `contract.status` filter at
 * all, so a schedule entry belonging to a contract that had already hit
 * TARGET_ACHIEVED (see the "targetJustAchieved" logic in
 * lib/payments/batch-processor.ts) could still show up here and be
 * picked into a brand new batch if its own dueDate simply hadn't arrived
 * yet when the contract's target was reached early. `recordPayout`
 * increments `totalPaidToInvestor` unconditionally for whatever amount a
 * PaymentBatchItem carries, it does not re-check the contract's status
 * before doing so, so that stale entry reaching a batch would have meant
 * genuinely overpaying an investor past their contract's target, exactly
 * the "I hope is not going to continue even after the target has
 * reached" scenario. `status: "ACTIVE"` here is the fix: once a contract
 * leaves ACTIVE, none of its remaining schedule entries can ever be
 * offered for a new batch again, regardless of what status they're
 * individually sitting in. createPaymentBatch re-checks this again at
 * creation time as a second layer, in case a batch is submitted from a
 * page that was left open before a contract's status changed under it.
 */
export async function getDueScheduleEntriesForBatch() {
  const entries = await prisma.paymentScheduleEntry.findMany({
    where: {
      status: { in: ["DUE", "PARTIALLY_PAID"] },
      contract: {
        status: "ACTIVE",
        batchItems: {
          none: {
            batch: { status: { in: ["PENDING_APPROVAL", "APPROVED", "PROCESSING"] } },
          },
        },
      },
    },
    include: {
      contract: { include: { investor: { include: { user: true } }, vehicle: true } },
    },
    orderBy: { dueDate: "asc" },
  });

  return entries.map((e) => ({
    scheduleEntryId: e.id,
    contractId: e.contractId,
    investorName: e.contract.investor.user.fullName,
    vehicle: e.contract.vehicle.assetTag,
    amount: Number(e.expectedAmount) - Number(e.amountPaid),
    dueDate: e.dueDate.toISOString(),
    // Module 26: read-only now, the investor's own standing preference,
    // not something staff pick per row anymore, see createPaymentBatch's
    // doc comment. Shown on the New batch screen so staff can see where
    // each payout is actually headed, not choose it.
    payoutDestination: e.contract.investor.defaultPayoutDestination,
    // Shown alongside it, so staff can see at a glance how much this
    // investor is already sitting on in their wallet.
    walletBalance: Number(e.contract.investor.walletBalance),
  }));
}

export async function getPaymentBatches() {
  const batches = await prisma.paymentBatch.findMany({
    include: { createdBy: { include: { user: true } }, items: true },
    orderBy: { createdAt: "desc" },
  });

  return batches.map((b) => ({
    id: b.id,
    periodLabel: b.periodLabel,
    status: b.status,
    totalAmount: Number(b.totalAmount),
    itemCount: b.items.length,
    createdBy: b.createdBy.user.fullName,
    createdAt: b.createdAt.toISOString(),
  }));
}

export async function getPaymentBatchDetail(batchId: string) {
  const batch = await prisma.paymentBatch.findUnique({
    where: { id: batchId },
    include: {
      createdBy: { include: { user: true } },
      approvals: { include: { approvedBy: { include: { user: true } } } },
      items: {
        include: {
          investor: { include: { user: true } },
          contract: { include: { vehicle: true } },
        },
      },
    },
  });
  if (!batch) return null;

  return {
    id: batch.id,
    periodLabel: batch.periodLabel,
    status: batch.status,
    totalAmount: Number(batch.totalAmount),
    createdBy: batch.createdBy.user.fullName,
    createdById: batch.createdById,
    createdAt: batch.createdAt.toISOString(),
    approvals: batch.approvals.map((a) => ({
      by: a.approvedBy.user.fullName,
      decision: a.decision,
      note: a.note,
      createdAt: a.createdAt.toISOString(),
    })),
    items: batch.items.map((item) => ({
      id: item.id,
      investor: item.investor.user.fullName,
      vehicle: item.contract.vehicle.assetTag,
      amount: Number(item.amount),
      transferStatus: item.transferStatus,
      failureReason: item.failureReason,
      payoutDestination: item.payoutDestination,
    })),
  };
}
