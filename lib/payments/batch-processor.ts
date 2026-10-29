import { prisma } from "@/lib/prisma";
import type { Prisma, PaymentBatchItem } from "@prisma/client";
import { formatNaira } from "@/lib/utils";
import { sendNotification } from "@/lib/notifications/send-notification";
import { shortRef, type AlertDetails } from "@/lib/notifications/templates";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export type TransferOutcome = {
  status: "SUCCESS" | "FAILED" | "PENDING";
  transferCode?: string;
  failureReason?: string;
  providerTransactionId?: string;
};

type LedgerResult = {
  paymentTransactionId: string;
  targetJustAchieved: boolean;
};

/**
 * The part of "an investor payout succeeded" that is true no matter where
 * the money actually landed: record the PaymentTransaction, allocate it to
 * the earliest unpaid schedule entry, bump the contract's running total,
 * and flip the contract to TARGET_ACHIEVED if this payment just crossed
 * the target. applyTransferOutcome (money went to the bank) and
 * applyWalletHold (money was credited to the wallet instead) both call
 * this from inside their own $transaction, so the two payout destinations
 * never duplicate or drift apart on what "paid" means for a contract.
 */
async function recordPayout(
  tx: Prisma.TransactionClient,
  item: PaymentBatchItem,
  outcome: Pick<TransferOutcome, "providerTransactionId">
): Promise<LedgerResult> {
  const paymentTransaction = await tx.paymentTransaction.create({
    data: {
      direction: "OUTBOUND",
      source: "INVESTOR_PAYOUT",
      amount: item.amount,
      status: "ALLOCATED",
      investorId: item.investorId,
      batchItemId: item.id,
      providerTransactionId: outcome.providerTransactionId,
    },
  });

  const scheduleEntry = await tx.paymentScheduleEntry.findFirst({
    where: { contractId: item.contractId, status: { in: ["UPCOMING", "DUE", "PARTIALLY_PAID"] } },
    orderBy: { dueDate: "asc" },
  });

  if (scheduleEntry) {
    await tx.paymentAllocation.create({
      data: { paymentTransactionId: paymentTransaction.id, scheduleEntryId: scheduleEntry.id, amount: item.amount },
    });

    const newAmountPaid = Number(scheduleEntry.amountPaid) + Number(item.amount);
    await tx.paymentScheduleEntry.update({
      where: { id: scheduleEntry.id },
      data: {
        amountPaid: newAmountPaid,
        status: newAmountPaid >= Number(scheduleEntry.expectedAmount) ? "PAID" : "PARTIALLY_PAID",
      },
    });
  }

  const updatedContract = await tx.investmentContract.update({
    where: { id: item.contractId },
    data: { totalPaidToInvestor: { increment: Number(item.amount) } },
  });

  // The business rule this platform is built around: once total paid to
  // the investor reaches the contract's target, the vehicle's ownership
  // moves to the manager, regardless of how much of the term is left, and
  // regardless of whether this last payment went to the bank or the
  // wallet. This applies the same way whether the vehicle is a keke, car,
  // or bike. This only ever creates the OwnershipTransfer record and flips
  // the contract to TARGET_ACHIEVED, the actual verify/approve workflow
  // for completing the transfer is a later module, see docs/architecture.
  let targetJustAchieved = false;
  if (
    updatedContract.status === "ACTIVE" &&
    Number(updatedContract.totalPaidToInvestor) >= Number(updatedContract.targetPayoutAmount)
  ) {
    await tx.investmentContract.update({
      where: { id: item.contractId },
      data: { status: "TARGET_ACHIEVED" },
    });
    await tx.ownershipTransfer.create({
      data: {
        contractId: item.contractId,
        vehicleId: updatedContract.vehicleId,
        target: "MANAGER",
        status: "TARGET_ACHIEVED",
        fromInvestorId: updatedContract.investorId,
      },
    });
    targetJustAchieved = true;
  }

  return { paymentTransactionId: paymentTransaction.id, targetJustAchieved };
}

/**
 * Module 27: notifies every staff member who can act on a freshly
 * TARGET_ACHIEVED contract (holds TRANSFER_VERIFY, the permission
 * lib/actions/transfers.ts requires to move an OwnershipTransfer past
 * TARGET_ACHIEVED) that one just landed in their queue. Before this,
 * recordPayout already notified the investor a target was reached, but
 * nobody on staff was told at all, the only way to notice a transfer was
 * waiting was to happen to check /admin/transfers or the TARGET_ACHIEVED
 * count on the dashboard. Same never-throws discipline as
 * sendNotification itself: called outside the $transaction that flipped
 * the contract's status, a notification failing to send must never make
 * an otherwise-successful payout look like it failed, and a lookup
 * failure here is swallowed rather than bubbled, for the same reason.
 */
async function notifyStaffOfTargetAchieved(contractId: string) {
  try {
    const contract = await prisma.investmentContract.findUnique({
      where: { id: contractId },
      include: { investor: { include: { user: true } }, vehicle: true },
    });
    if (!contract) return;

    const staffToNotify = await prisma.user.findMany({
      where: {
        staff: { isNot: null },
        roleAssignments: {
          some: { role: { permissions: { some: { permission: { key: PERMISSIONS.TRANSFER_VERIFY } } } } },
        },
      },
    });

    await Promise.all(
      staffToNotify.map((staffUser) =>
        sendNotification({
          userId: staffUser.id,
          type: "contract_target_achieved",
          title: "A contract just hit its target",
          body: `${contract.investor.user.fullName}'s contract on ${contract.vehicle.assetTag} just reached its target payout. Ownership transfer to the manager is waiting on verification.`,
          channels: ["EMAIL"],
        })
      )
    );
  } catch {
    // Never let a notification-side failure affect the payout that
    // triggered it, same contract as sendNotification's own callers.
  }
}

/**
 * Applies the outcome of a Paystack transfer to a PaymentBatchItem whose
 * payoutDestination is BANK. There are two callers: the approve action
 * calls this right after initiateTransfer returns, so local testing (no
 * public webhook URL) still completes the ledger; the transfer.success/
 * transfer.failed webhook calls this too, which is the authoritative
 * confirmation in production, since a transfer can settle after the
 * initial API call returned "pending". Idempotent by design: once an item
 * is already SUCCESS or FAILED, calling this again is a no-op, so
 * whichever of the two callers runs second never double-processes the
 * payment.
 */
export async function applyTransferOutcome(batchItemId: string, outcome: TransferOutcome) {
  const item = await prisma.paymentBatchItem.findUniqueOrThrow({
    where: { id: batchItemId },
  });

  if (item.transferStatus === "SUCCESS" || item.transferStatus === "FAILED") {
    return;
  }

  if (outcome.status === "PENDING") {
    await prisma.paymentBatchItem.update({
      where: { id: batchItemId },
      data: { transferStatus: "PENDING", paystackTransferCode: outcome.transferCode },
    });
    return;
  }

  if (outcome.status === "FAILED") {
    await prisma.paymentBatchItem.update({
      where: { id: batchItemId },
      data: {
        transferStatus: "FAILED",
        paystackTransferCode: outcome.transferCode,
        failureReason: outcome.failureReason ?? "Transfer failed",
      },
    });
    return;
  }

  // SUCCESS: complete the ledger in one transaction, so a crash partway
  // through never leaves the schedule entry and contract total out of
  // sync with the transaction record.
  let ledgerResult: LedgerResult | null = null;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.paymentBatchItem.update({
      where: { id: batchItemId },
      data: { transferStatus: "SUCCESS", paystackTransferCode: outcome.transferCode, failureReason: null },
    });

    ledgerResult = await recordPayout(tx, item, outcome);
  });

  // Deliberately outside the transaction above: this makes a network call
  // to Resend/Termii, and a $transaction callback must never do I/O that
  // isn't the database itself, that would hold the connection (and any
  // row locks) open for however long the network call takes.
  // sendNotification never throws, a notification failing to send must
  // never make an otherwise-successful payout look like it failed.
  const investor = await prisma.investorProfile.findUnique({ where: { id: item.investorId }, select: { userId: true } });
  if (investor && ledgerResult) {
    const targetJustAchieved = (ledgerResult as LedgerResult).targetJustAchieved;
    const alert: AlertDetails = {
      kind: "DEBIT",
      amount: Number(item.amount),
      reference: shortRef((ledgerResult as LedgerResult).paymentTransactionId, "PAY-"),
      // No balance field: this is a bank payout, the money left to the
      // investor's own bank account, there is no in-app running balance
      // to report alongside it the way a wallet credit/debit has.
      desc: targetJustAchieved ? "Contract payout — target reached" : "Contract payout",
    };
    await sendNotification({
      userId: investor.userId,
      type: "payment_received",
      title: "You've been paid",
      body: targetJustAchieved
        ? `${formatNaira(Number(item.amount))} was just transferred to your account. This payment also reached your contract's target payout, ownership of your vehicle is now moving to the manager.`
        : `${formatNaira(Number(item.amount))} was just transferred to your account.`,
      channels: ["EMAIL", "SMS"],
      alert,
    });
    if (targetJustAchieved) {
      await notifyStaffOfTargetAchieved(item.contractId);
    }
  }
}

/**
 * Settles a PaymentBatchItem whose payoutDestination is WALLET. There is
 * no Paystack transfer to initiate here at all, no real money moves, this
 * only credits the investor's in-app wallet ledger by the same amount a
 * bank payout would have sent them. Everything downstream of "this
 * investor was just paid" (the schedule entry, the contract's running
 * total, target-achieved detection) goes through the exact same
 * recordPayout helper applyTransferOutcome uses, a wallet-held payout
 * counts toward the contract exactly the way a bank payout does. The only
 * difference is that instead of the money leaving the company account, it
 * moves into a ledger balance the investor can later ask staff to approve
 * a withdrawal from, or leave in place toward funding a new vehicle, see
 * lib/actions/wallet.ts. Idempotent, same as applyTransferOutcome, so it
 * can safely be called more than once for the same item.
 */
export async function applyWalletHold(batchItemId: string) {
  const item = await prisma.paymentBatchItem.findUniqueOrThrow({
    where: { id: batchItemId },
  });

  if (item.transferStatus === "SUCCESS" || item.transferStatus === "FAILED") {
    return;
  }

  let ledgerResult: LedgerResult | null = null;
  let newWalletBalance = 0;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.paymentBatchItem.update({
      where: { id: batchItemId },
      data: { transferStatus: "SUCCESS", failureReason: null },
    });

    const result = await recordPayout(tx, item, {});
    ledgerResult = result;

    const investor = await tx.investorProfile.findUniqueOrThrow({ where: { id: item.investorId } });
    newWalletBalance = Number(investor.walletBalance) + Number(item.amount);

    await tx.investorProfile.update({
      where: { id: item.investorId },
      data: { walletBalance: newWalletBalance },
    });

    await tx.walletTransaction.create({
      data: {
        investorId: item.investorId,
        type: "CREDIT",
        source: "PAYOUT_HELD",
        amount: item.amount,
        balanceAfter: newWalletBalance,
        paymentTransactionId: result.paymentTransactionId,
      },
    });
  });

  const investor = await prisma.investorProfile.findUnique({ where: { id: item.investorId }, select: { userId: true } });
  if (investor && ledgerResult) {
    const targetJustAchieved = (ledgerResult as LedgerResult).targetJustAchieved;
    const alert: AlertDetails = {
      kind: "CREDIT",
      amount: Number(item.amount),
      reference: shortRef((ledgerResult as LedgerResult).paymentTransactionId, "PAY-"),
      desc: targetJustAchieved ? "Contract payout — target reached" : "Contract payout to wallet",
      balance: newWalletBalance,
      balanceLabel: "Wallet balance now",
    };
    await sendNotification({
      userId: investor.userId,
      type: "payment_received",
      title: "Your wallet just grew",
      body: targetJustAchieved
        ? `${formatNaira(Number(item.amount))} was just added to your wallet, new balance ${formatNaira(newWalletBalance)}. This payment also reached your contract's target payout, ownership of your vehicle is now moving to the manager.`
        : `${formatNaira(Number(item.amount))} was just added to your wallet, new balance ${formatNaira(newWalletBalance)}.`,
      channels: ["EMAIL", "SMS"],
      alert,
    });
    if (targetJustAchieved) {
      await notifyStaffOfTargetAchieved(item.contractId);
    }
  }
}

/**
 * Applies a transfer.success/failed/reversed webhook to a wallet
 * withdrawal, the wallet equivalent of applyTransferOutcome above. The
 * wallet ledger is deliberately not touched here: approveWalletWithdrawal
 * (lib/actions/wallet.ts) already debits it synchronously the moment
 * staff approve, before any transfer is even attempted, this only
 * confirms whether the transfer itself went through. Idempotent the same
 * way, once a withdrawal is PAID this is a no-op, so a webhook arriving
 * after the synchronous approve-time result already confirmed success
 * never double-processes anything.
 */
export async function applyWalletWithdrawalTransferOutcome(withdrawalId: string, outcome: TransferOutcome) {
  const withdrawal = await prisma.walletWithdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });

  // PAID is terminal (already confirmed). REJECTED and PENDING_APPROVAL
  // mean no transfer should exist for this withdrawal at all, a transfer
  // is only ever initiated right after approval, so a stray webhook
  // referencing either of those is left alone rather than acted on.
  if (withdrawal.status !== "APPROVED") {
    return;
  }

  if (outcome.status === "PENDING") {
    await prisma.walletWithdrawal.update({
      where: { id: withdrawalId },
      data: { paystackTransferCode: outcome.transferCode },
    });
    return;
  }

  await prisma.walletWithdrawal.update({
    where: { id: withdrawalId },
    data: {
      status: outcome.status === "SUCCESS" ? "PAID" : "APPROVED",
      paystackTransferCode: outcome.transferCode,
      failureReason: outcome.status === "SUCCESS" ? null : (outcome.failureReason ?? "Transfer failed"),
    },
  });
}
