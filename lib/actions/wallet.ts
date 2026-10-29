"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission, ForbiddenError } from "@/lib/rbac/check-permission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getPaymentProvider } from "@/lib/payments/provider";
import { sendNotification } from "@/lib/notifications/send-notification";
import { shortRef, type AlertDetails } from "@/lib/notifications/templates";
import { formatNaira } from "@/lib/utils";
import { generateScheduleDates, type Frequency } from "@/lib/schedule";
import { writeAuditLog } from "@/lib/audit";

/**
 * Module 43: every real, user-reachable validation failure below (a bad
 * amount, missing bank details, an over-balance request, a status that's
 * already been decided) was converted from `throw new Error(...)` to a
 * `{ error?: string }` return. Each of these used to be bound to a plain
 * `<form action={fn}>` on a Server Component page (`/investor/wallet`,
 * `/admin/wallet/withdrawals`, `/admin/wallet/funding/[investorId]`), so a
 * thrown validation error crashed straight to Next's generic error boundary
 * instead of showing the person what to fix, the exact bug shape already
 * found and fixed reactively six times before this module (see
 * CURRENT_STATE.md's "Known gaps"). See `components/ui/action-form.tsx`'s
 * doc comment for the full reasoning and the shared Client Component that
 * now displays these. The plain `if (!user) throw ...` /
 * `ForbiddenError`/role-check guards right after each function's
 * `getCurrentUser()` call are left throwing on purpose, matching this
 * codebase's existing convention: a signed-out, wrong-role, or
 * unauthorized account reaching one of these actions at all needs a
 * tampered request, not something the real, permission-gated UI can ever
 * produce.
 */

/**
 * An investor asking staff to move some of their wallet balance to their
 * bank account. This never moves any money by itself, it only creates a
 * PENDING_APPROVAL request, see approveWalletWithdrawal below for the
 * actual, staff-triggered transfer. Only one outstanding request is
 * allowed at a time, so two approvals can never both draw against the
 * same balance.
 */
export async function requestWalletWithdrawal(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  if (!user.investor) throw new Error("Only investor accounts can request a wallet withdrawal.");

  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "Enter a valid withdrawal amount." };
  }

  const investor = await prisma.investorProfile.findUniqueOrThrow({ where: { id: user.investor.id } });

  if (!investor.bankAccountNumber || !investor.bankCode) {
    return { error: "Add your bank details on the Payout details page before requesting a withdrawal." };
  }
  if (amount > Number(investor.walletBalance)) {
    return { error: "You can't withdraw more than your current wallet balance." };
  }

  const existingOpenRequest = await prisma.walletWithdrawal.findFirst({
    where: { investorId: investor.id, status: { in: ["PENDING_APPROVAL", "APPROVED"] } },
  });
  if (existingOpenRequest) {
    return { error: "You already have a withdrawal request in progress, wait for it to be settled before requesting another." };
  }

  await prisma.walletWithdrawal.create({
    data: { investorId: investor.id, amount, status: "PENDING_APPROVAL" },
  });

  revalidatePath("/investor/wallet");
  revalidatePath("/admin/wallet/withdrawals");
}

/**
 * An investor cancelling their own withdrawal request (Module 23). Only
 * reachable while the request is still PENDING_APPROVAL, nothing has been
 * debited from the wallet at that point, see requestWalletWithdrawal above,
 * so this is a pure status change with nothing to reverse, the same reason
 * rejectWalletWithdrawal below is a pure status change too. Once staff have
 * moved a request to APPROVED, the wallet has already been debited and a
 * real Paystack transfer may already be in flight, so cancelling from here
 * stops being available, the investor would need to ask staff instead.
 * This is intentionally a separate status from REJECTED: REJECTED is
 * always a staff decision, CANCELLED is always the investor's own.
 */
export async function cancelWalletWithdrawal(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  if (!user.investor) throw new Error("Only investor accounts can cancel a wallet withdrawal.");

  const withdrawalId = String(formData.get("withdrawalId") ?? "").trim();
  if (!withdrawalId) throw new Error("Missing withdrawal request.");

  const withdrawal = await prisma.walletWithdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });
  if (withdrawal.investorId !== user.investor.id) {
    return { error: "This isn't your withdrawal request." };
  }
  if (withdrawal.status !== "PENDING_APPROVAL") {
    return {
      error: `This request is already ${withdrawal.status.toLowerCase().replaceAll("_", " ")}, it can no longer be cancelled here.`,
    };
  }

  await prisma.walletWithdrawal.update({
    where: { id: withdrawalId },
    data: { status: "CANCELLED" },
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: "wallet_withdrawal.cancel",
    entityType: "WalletWithdrawal",
    entityId: withdrawalId,
    beforeState: { status: withdrawal.status },
    afterState: { status: "CANCELLED" },
  });

  revalidatePath("/investor/wallet");
  revalidatePath("/admin/wallet/withdrawals");
}

/**
 * Staff approving a withdrawal is the moment the money actually moves:
 * the wallet ledger is debited immediately (inside the same transaction as
 * the status change, so the balance can never be double-spent by a second
 * request), then a real Paystack transfer is attempted the same way a
 * payment batch item's transfer is, see lib/payments/batch-processor.ts.
 * If Paystack doesn't confirm success right away, the request stays
 * APPROVED with whatever detail is known, and a staff member can use
 * markWalletWithdrawalPaid below once they've confirmed the money actually
 * arrived, since, same as batch payouts, a transfer settling is not
 * something this app decides on its own.
 */
export async function approveWalletWithdrawal(formData: FormData): Promise<{ error?: string } | void> {
  const withdrawalId = String(formData.get("withdrawalId"));

  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.WALLET_WITHDRAWAL_APPROVE);
  if (!user.staff) throw new ForbiddenError(PERMISSIONS.WALLET_WITHDRAWAL_APPROVE);

  const withdrawal = await prisma.walletWithdrawal.findUniqueOrThrow({
    where: { id: withdrawalId },
    include: { investor: { include: { user: true } } },
  });

  if (withdrawal.status !== "PENDING_APPROVAL") {
    return { error: `This request is already ${withdrawal.status.toLowerCase().replaceAll("_", " ")}.` };
  }
  if (Number(withdrawal.amount) > Number(withdrawal.investor.walletBalance)) {
    return { error: "This investor's wallet balance no longer covers this request." };
  }

  const newBalance = Number(withdrawal.investor.walletBalance) - Number(withdrawal.amount);

  await prisma.$transaction(async (tx) => {
    await tx.investorProfile.update({
      where: { id: withdrawal.investorId },
      data: { walletBalance: newBalance },
    });
    await tx.walletTransaction.create({
      data: {
        investorId: withdrawal.investorId,
        type: "DEBIT",
        source: "WITHDRAWAL",
        amount: withdrawal.amount,
        balanceAfter: newBalance,
        withdrawalId: withdrawal.id,
        createdById: user.staff!.id,
      },
    });
    await tx.walletWithdrawal.update({
      where: { id: withdrawal.id },
      data: { status: "APPROVED", reviewedById: user.staff!.id, reviewedAt: new Date() },
    });
    await writeAuditLog(
      {
        actorUserId: user.id,
        action: "wallet_withdrawal.approve",
        entityType: "WalletWithdrawal",
        entityId: withdrawal.id,
        beforeState: { status: withdrawal.status, investorWalletBalance: Number(withdrawal.investor.walletBalance) },
        afterState: { status: "APPROVED", amount: Number(withdrawal.amount), investorWalletBalance: newBalance },
      },
      tx
    );
  });

  // Attempt the real transfer outside the transaction above, this is a
  // network call, it must never hold the ledger update's row locks open.
  try {
    const provider = await getPaymentProvider();
    let recipientCode = withdrawal.investor.paystackRecipientCode;
    if (!recipientCode) {
      if (!withdrawal.investor.bankAccountNumber || !withdrawal.investor.bankCode) {
        throw new Error("This investor has no bank account on file.");
      }
      const recipient = await provider.createTransferRecipient({
        accountName: withdrawal.investor.bankAccountName ?? withdrawal.investor.user.fullName,
        accountNumber: withdrawal.investor.bankAccountNumber,
        bankCode: withdrawal.investor.bankCode,
      });
      recipientCode = recipient.recipientCode;
      await prisma.investorProfile.update({
        where: { id: withdrawal.investorId },
        data: { paystackRecipientCode: recipientCode },
      });
    }

    const result = await provider.initiateTransfer({
      amountNaira: Number(withdrawal.amount),
      recipientCode,
      reason: "Wallet withdrawal",
      reference: withdrawal.id,
    });

    // Stays APPROVED either way, whether Paystack is still processing it
    // or reported failure, the wallet debit already happened and does not
    // reverse itself here, a staff member decides what to do next
    // (retrying outside the app, or confirming via markWalletWithdrawalPaid
    // once the money is actually confirmed sent).
    await prisma.walletWithdrawal.update({
      where: { id: withdrawal.id },
      data: {
        status: result.status === "success" ? "PAID" : "APPROVED",
        paystackTransferCode: result.transferCode,
        failureReason: result.status === "failed" ? "Transfer failed" : null,
      },
    });
  } catch (error) {
    // The wallet debit already happened and stands, staff can confirm the
    // transfer manually and mark it paid once the money is actually sent,
    // this only records that the automatic attempt didn't go through.
    await prisma.walletWithdrawal.update({
      where: { id: withdrawal.id },
      data: { failureReason: error instanceof Error ? error.message : "Transfer could not be initiated automatically" },
    });
  }

  await sendNotification({
    userId: withdrawal.investor.userId,
    type: "wallet_withdrawal_approved",
    title: "Your withdrawal was approved",
    body: `${formatNaira(Number(withdrawal.amount))} is on its way to your bank account.`,
    channels: ["EMAIL", "SMS"],
    alert: {
      kind: "DEBIT",
      amount: Number(withdrawal.amount),
      reference: shortRef(withdrawal.id, "WD-"),
      desc: "Withdrawal to bank account",
      balance: newBalance,
      balanceLabel: "Wallet balance now",
    },
  });

  revalidatePath("/admin/wallet/withdrawals");
  revalidatePath("/investor/wallet");
}

/**
 * Staff declining a request. Nothing was ever debited from the wallet for
 * a request that hasn't been approved, so this is a pure status change.
 */
export async function rejectWalletWithdrawal(formData: FormData): Promise<{ error?: string } | void> {
  const withdrawalId = String(formData.get("withdrawalId"));
  const reason = String(formData.get("reason") ?? "").trim();

  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.WALLET_WITHDRAWAL_APPROVE);
  if (!user.staff) throw new ForbiddenError(PERMISSIONS.WALLET_WITHDRAWAL_APPROVE);

  const withdrawal = await prisma.walletWithdrawal.findUniqueOrThrow({
    where: { id: withdrawalId },
    include: { investor: true },
  });

  if (withdrawal.status !== "PENDING_APPROVAL") {
    return { error: `This request is already ${withdrawal.status.toLowerCase().replaceAll("_", " ")}.` };
  }

  await prisma.walletWithdrawal.update({
    where: { id: withdrawalId },
    data: {
      status: "REJECTED",
      reviewedById: user.staff.id,
      reviewedAt: new Date(),
      rejectionReason: reason || null,
    },
  });
  await writeAuditLog({
    actorUserId: user.id,
    action: "wallet_withdrawal.reject",
    entityType: "WalletWithdrawal",
    entityId: withdrawalId,
    beforeState: { status: withdrawal.status },
    afterState: { status: "REJECTED", rejectionReason: reason || null },
  });

  await sendNotification({
    userId: withdrawal.investor.userId,
    type: "wallet_withdrawal_rejected",
    title: "Your withdrawal request was declined",
    body: reason
      ? `Your request for ${formatNaira(Number(withdrawal.amount))} was declined: "${reason}". The amount is still available in your wallet.`
      : `Your request for ${formatNaira(Number(withdrawal.amount))} was declined. The amount is still available in your wallet.`,
    channels: ["EMAIL", "SMS"],
    alert: {
      kind: "DECLINED",
      amount: Number(withdrawal.amount),
      reference: shortRef(withdrawalId, "WD-"),
      // reason is staff-typed free text; buildAlertEmailHtml escapes it and
      // buildAlertSms truncates it, neither trusts it as pre-sanitized.
      desc: reason || "No reason given",
      balance: Number(withdrawal.investor.walletBalance),
      // Not "Returned to wallet": rejectWalletWithdrawal never debited the
      // wallet in the first place (see this function's doc comment), so
      // nothing was ever returned — it simply never left.
      balanceLabel: "Still in your wallet",
    } satisfies AlertDetails,
  });

  revalidatePath("/admin/wallet/withdrawals");
  revalidatePath("/investor/wallet");
}

/**
 * Manual fallback for an APPROVED request whose automatic Paystack
 * transfer didn't confirm success, or wherever a staff member simply
 * chose to send the money themselves. This never touches the wallet
 * ledger again, that already happened at approval time, it only records
 * that the transfer is now confirmed complete.
 */
export async function markWalletWithdrawalPaid(formData: FormData): Promise<{ error?: string } | void> {
  const withdrawalId = String(formData.get("withdrawalId"));

  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.WALLET_WITHDRAWAL_APPROVE);
  if (!user.staff) throw new ForbiddenError(PERMISSIONS.WALLET_WITHDRAWAL_APPROVE);

  const withdrawal = await prisma.walletWithdrawal.findUniqueOrThrow({ where: { id: withdrawalId } });
  if (withdrawal.status !== "APPROVED") {
    return { error: "Only an approved request awaiting confirmation can be marked as paid." };
  }

  await prisma.walletWithdrawal.update({
    where: { id: withdrawalId },
    data: { status: "PAID", failureReason: null },
  });
  await writeAuditLog({
    actorUserId: user.id,
    action: "wallet_withdrawal.mark_paid",
    entityType: "WalletWithdrawal",
    entityId: withdrawalId,
    beforeState: { status: withdrawal.status },
    afterState: { status: "PAID" },
  });

  revalidatePath("/admin/wallet/withdrawals");
  revalidatePath("/investor/wallet");
}

/**
 * Converts part or all of an investor's wallet balance into the principal
 * of a brand new investment contract on a specific vehicle, exactly the
 * way lib/actions/contracts.ts's createInvestmentContract creates one from
 * a fresh external investment, generating the same kind of payment
 * schedule up front. This is always a staff decision made from
 * /admin/wallet/funding/[investorId], the system never proposes or
 * triggers this on its own just because a balance got large enough.
 */
export async function fundVehicleFromWallet(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.WALLET_FUNDING_MANAGE);
  if (!user.staff) throw new ForbiddenError(PERMISSIONS.WALLET_FUNDING_MANAGE);

  const investorId = String(formData.get("investorId") ?? "");
  const vehicleId = String(formData.get("vehicleId") ?? "");
  const principalAmount = Number(formData.get("principalAmount"));
  const targetPayoutAmount = Number(formData.get("targetPayoutAmount"));
  const installmentAmount = Number(formData.get("installmentAmount"));
  const termMonths = Number(formData.get("termMonths"));
  const paymentFrequency = String(formData.get("paymentFrequency") ?? "WEEKLY") as Frequency;
  const startDateInput = String(formData.get("startDate") ?? "");

  if (!investorId || !vehicleId) {
    return { error: "Select both an investor and a vehicle." };
  }
  if (![principalAmount, targetPayoutAmount, installmentAmount, termMonths].every((n) => Number.isFinite(n) && n > 0)) {
    return { error: "Principal, target payout, installment, and term must all be positive numbers." };
  }

  const investor = await prisma.investorProfile.findUniqueOrThrow({ where: { id: investorId } });
  if (principalAmount > Number(investor.walletBalance)) {
    return { error: "The amount being converted can't exceed this investor's current wallet balance." };
  }

  const startDate = startDateInput ? new Date(startDateInput) : new Date();
  const newBalance = Number(investor.walletBalance) - principalAmount;

  const contract = await prisma.$transaction(async (tx) => {
    const contract = await tx.investmentContract.create({
      data: {
        investorId,
        vehicleId,
        principalAmount,
        targetPayoutAmount,
        installmentAmount,
        paymentFrequency,
        termMonths,
        status: "ACTIVE",
        startDate,
        createdById: user.staff!.id,
        scheduleEntries: {
          create: generateScheduleDates(startDate, paymentFrequency, termMonths).map((dueDate) => ({
            dueDate,
            expectedAmount: installmentAmount,
          })),
        },
      },
    });

    await tx.vehicle.update({ where: { id: vehicleId }, data: { status: "ACTIVE" } });

    await tx.investorProfile.update({
      where: { id: investorId },
      data: { walletBalance: newBalance },
    });

    await tx.walletTransaction.create({
      data: {
        investorId,
        type: "DEBIT",
        source: "VEHICLE_FUNDING",
        amount: principalAmount,
        balanceAfter: newBalance,
        fundedContractId: contract.id,
        createdById: user.staff!.id,
      },
    });

    await writeAuditLog(
      {
        actorUserId: user.id,
        action: "wallet.fund_vehicle",
        entityType: "InvestmentContract",
        entityId: contract.id,
        beforeState: { investorWalletBalance: Number(investor.walletBalance) },
        afterState: { investorWalletBalance: newBalance, vehicleId, principalAmount },
      },
      tx
    );

    return contract;
  });

  const investorUser = await prisma.investorProfile.findUnique({ where: { id: investorId }, select: { userId: true } });
  if (investorUser) {
    await sendNotification({
      userId: investorUser.userId,
      type: "wallet_vehicle_funded",
      title: "A new vehicle was funded from your wallet",
      body: `${formatNaira(principalAmount)} from your wallet balance has been put toward a new investment contract.`,
      channels: ["EMAIL", "SMS"],
      alert: {
        kind: "DEBIT",
        amount: principalAmount,
        reference: shortRef(contract.id, "INV-"),
        desc: "Vehicle funding from wallet",
        balance: newBalance,
        balanceLabel: "Wallet balance now",
      },
    });
  }

  revalidatePath("/admin/wallet/funding");
  revalidatePath("/investor/wallet");
  revalidatePath("/admin/investors");
  revalidatePath("/admin/fleet");
  revalidatePath("/admin/dashboard");
  redirect("/admin/wallet/funding");
}
