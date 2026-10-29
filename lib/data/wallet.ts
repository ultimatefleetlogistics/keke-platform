import { prisma } from "@/lib/prisma";
import type { InvestorProfile } from "@prisma/client";

/**
 * Read side of the investor wallet. This is a ledger, not a real
 * money-holding account, see prisma/schema.prisma's comment on
 * InvestorProfile.walletBalance and docs/architecture for the full design.
 * Every number returned here traces back to a WalletTransaction row, there
 * is no separate source of truth this could drift from.
 */
export async function getInvestorWalletData(investor: InvestorProfile) {
  const [transactions, openWithdrawal] = await Promise.all([
    prisma.walletTransaction.findMany({
      where: { investorId: investor.id },
      include: {
        fundedContract: { include: { vehicle: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.walletWithdrawal.findFirst({
      where: { investorId: investor.id, status: { in: ["PENDING_APPROVAL", "APPROVED"] } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    balance: Number(investor.walletBalance),
    hasBankDetails: Boolean(investor.bankAccountNumber && investor.bankCode),
    // Module 41: where THIS investor's own deposits come in from, the
    // opposite direction from hasBankDetails above (where their payouts go
    // OUT to). Null until provisionInvestorCollectionAccount has run, see
    // lib/payments/collection-account.ts.
    depositAccountNumber: investor.paystackDvaAccountNumber,
    depositAccountBankName: investor.paystackDvaBankName,
    depositIntent: investor.depositIntent,
    depositIntentVehicleType: investor.depositIntentVehicleType,
    openWithdrawal: openWithdrawal
      ? {
          id: openWithdrawal.id,
          amount: Number(openWithdrawal.amount),
          status: openWithdrawal.status,
          createdAt: openWithdrawal.createdAt.toISOString(),
        }
      : null,
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      source: t.source,
      amount: Number(t.amount),
      balanceAfter: Number(t.balanceAfter),
      note: t.note,
      fundedVehicle: t.fundedContract?.vehicle.assetTag ?? null,
      createdAt: t.createdAt.toISOString(),
    })),
  };
}

/**
 * Every wallet withdrawal request, newest first, for the staff review
 * queue at /admin/wallet/withdrawals. Includes already-decided requests
 * too (not just PENDING_APPROVAL) so the page can show a review history
 * the same way the payment batch detail page does.
 */
export async function getWalletWithdrawalQueue() {
  const withdrawals = await prisma.walletWithdrawal.findMany({
    include: {
      investor: { include: { user: true } },
      reviewedBy: { include: { user: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return withdrawals.map((w) => ({
    id: w.id,
    investorId: w.investorId,
    investorName: w.investor.user.fullName,
    amount: Number(w.amount),
    status: w.status,
    walletBalance: Number(w.investor.walletBalance),
    hasBankDetails: Boolean(w.investor.bankAccountNumber && w.investor.bankCode),
    reviewedBy: w.reviewedBy?.user.fullName ?? null,
    reviewedAt: w.reviewedAt?.toISOString() ?? null,
    rejectionReason: w.rejectionReason,
    failureReason: w.failureReason,
    createdAt: w.createdAt.toISOString(),
  }));
}

/**
 * Every investor currently sitting on a wallet balance, for the staff
 * "ready to fund a vehicle" queue at /admin/wallet/funding. Ordered
 * highest balance first, purely so whoever is closest to affording a new
 * vehicle shows up at the top, this has no other effect, funding is
 * always a deliberate staff decision, never automatic just because a
 * balance is large.
 */
export async function getWalletFundingCandidates() {
  const investors = await prisma.investorProfile.findMany({
    where: { walletBalance: { gt: 0 } },
    include: {
      user: true,
      contracts: { where: { status: "ACTIVE" } },
      // Module 41: an investor's most recent deposit, if it was flagged
      // as intended toward a new vehicle (see updateDepositIntent in
      // lib/actions/investor-profile.ts and handleInvestorDeposit in
      // lib/payments/webhook-handler.ts). Surfaced here as a badge so
      // staff can prioritize a "wants to buy a vehicle" balance over one
      // that's just sitting there, never anything more automatic than
      // that, funding a vehicle is still always the deliberate decision
      // made on this page.
      walletTransactions: {
        where: { source: "DEPOSIT", depositIntent: "VEHICLE_PURCHASE" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { walletBalance: "desc" },
  });

  return investors.map((investor) => ({
    id: investor.id,
    fullName: investor.user.fullName,
    email: investor.user.email,
    walletBalance: Number(investor.walletBalance),
    activeContracts: investor.contracts.length,
    wantsVehicleType: investor.walletTransactions[0]?.depositIntentVehicleType ?? null,
  }));
}

export async function getWalletFundingInvestor(investorId: string) {
  const investor = await prisma.investorProfile.findUnique({
    where: { id: investorId },
    include: { user: true },
  });
  if (!investor) return null;

  return {
    id: investor.id,
    fullName: investor.user.fullName,
    email: investor.user.email,
    walletBalance: Number(investor.walletBalance),
  };
}
