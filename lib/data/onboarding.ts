import type { VehicleType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { mapScheduleStatus } from "@/lib/data/investor";
import {
  VEHICLE_TYPE_DEFAULT_TERMS,
  VEHICLE_TYPE_LABELS,
  VEHICLE_TYPES,
  contractTermsSettingKey,
  type DefaultContractTerms,
} from "@/lib/vehicle-types";

/**
 * Every investor, for the admin investors list and for the "who is this
 * contract for" dropdown when creating a new contract.
 */
export async function getInvestorsList() {
  const investors = await prisma.investorProfile.findMany({
    include: { user: true, contracts: true },
    orderBy: { createdAt: "desc" },
  });

  return investors.map((inv) => ({
    id: inv.id,
    fullName: inv.user.fullName,
    email: inv.user.email,
    kycStatus: inv.kycStatus,
    activeContracts: inv.contracts.filter((c) => c.status === "ACTIVE").length,
    totalContracts: inv.contracts.length,
    hasBankAccount: Boolean(inv.bankAccountNumber),
  }));
}

/**
 * One investor's complete record, for /admin/investors/[id]. Originally
 * just the fields InvestorEditForm/InvestorBankForm needed to edit; direct
 * feedback after the admin search feature shipped: clicking an investor's
 * name "leads to no where, it should lead to that investor entire history
 * with the company, his/her investment, payment history, his bank account
 * and other details literally everything about him/her," this now also
 * returns every contract they hold (with the vehicle behind it, progress,
 * and status, mirroring the investor-facing dashboard's own vehicle cards)
 * and their complete payment schedule history (every schedule entry
 * across every contract, newest first), not just the editable account
 * fields that were here before.
 */
export async function getInvestorById(id: string) {
  const now = new Date();
  const investor = await prisma.investorProfile.findUnique({
    where: { id },
    include: {
      user: true,
      contracts: {
        include: { vehicle: true, scheduleEntries: { orderBy: { dueDate: "desc" } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!investor) return null;

  const investments = investor.contracts.map((c) => {
    const target = Number(c.targetPayoutAmount);
    const realized = Number(c.totalPaidToInvestor);
    const progressPercent = target > 0 ? Math.min(100, Math.round((realized / target) * 100)) : 0;
    return {
      id: c.id,
      vehicleId: c.vehicle.id,
      vehicleAssetTag: c.vehicle.assetTag,
      vehicleType: c.vehicle.type,
      contractStatus: c.status,
      principal: Number(c.principalAmount),
      target,
      realized,
      progressPercent,
      installment: Number(c.installmentAmount),
      frequency: c.paymentFrequency,
      termMonths: c.termMonths,
      startDate: c.startDate ? c.startDate.toISOString() : null,
    };
  });

  // Every schedule entry across every contract, newest due date first,
  // same OVERDUE/PAID/DEFERRED/UPCOMING labeling
  // getInvestorDashboardData uses on the investor's own dashboard
  // (mapScheduleStatus, lib/data/investor.ts), so a payment reads the
  // same way here as it does to the investor themselves.
  const paymentHistory = investor.contracts
    .flatMap((c) =>
      c.scheduleEntries.map((entry) => ({
        vehicleAssetTag: c.vehicle.assetTag,
        amount: Number(entry.amountPaid) > 0 ? Number(entry.amountPaid) : Number(entry.expectedAmount),
        date: entry.dueDate.toISOString(),
        status: mapScheduleStatus(entry.status, entry.dueDate, now),
      }))
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalInvested = investor.contracts.reduce((sum, c) => sum + Number(c.principalAmount), 0);
  const totalRealized = investor.contracts.reduce((sum, c) => sum + Number(c.totalPaidToInvestor), 0);
  const totalOutstanding = investor.contracts.reduce(
    (sum, c) => sum + Math.max(Number(c.targetPayoutAmount) - Number(c.totalPaidToInvestor), 0),
    0
  );

  return {
    id: investor.id,
    fullName: investor.user.fullName,
    email: investor.user.email,
    phone: investor.user.phone,
    kycStatus: investor.kycStatus,
    memberSince: investor.createdAt.toISOString(),
    defaultPayoutDestination: investor.defaultPayoutDestination,
    activeContracts: investor.contracts.filter((c) => c.status === "ACTIVE").length,
    totalContracts: investor.contracts.length,
    walletBalance: Number(investor.walletBalance),
    totalInvested,
    totalRealized,
    totalOutstanding,
    investments,
    paymentHistory,
    bankCode: investor.bankCode,
    bankAccountNumber: investor.bankAccountNumber,
    bankAccountName: investor.bankAccountName,
    // Module 41: the investor's own deposit account, the opposite
    // direction from the bank fields above, see
    // provisionInvestorCollectionAccount in lib/payments/collection-account.ts.
    paystackCustomerCode: investor.paystackCustomerCode,
    depositAccountNumber: investor.paystackDvaAccountNumber,
    depositAccountBankName: investor.paystackDvaBankName,
  };
}

/**
 * Every investor bank change request, newest first, for the staff review
 * queue at /admin/investors/bank-change-requests (Module 41). Includes
 * already-decided requests too (not just PENDING_APPROVAL), same "review
 * history" pattern as getWalletWithdrawalQueue in lib/data/wallet.ts.
 */
export async function getBankChangeRequestQueue() {
  const requests = await prisma.investorBankChangeRequest.findMany({
    include: {
      investor: { include: { user: true } },
      reviewedBy: { include: { user: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return requests.map((r) => ({
    id: r.id,
    investorId: r.investorId,
    investorName: r.investor.user.fullName,
    currentAccountNumber: r.investor.bankAccountNumber,
    currentAccountName: r.investor.bankAccountName,
    requestedBankName: r.bankName,
    requestedAccountNumber: r.accountNumber,
    requestedAccountName: r.accountName,
    status: r.status,
    reviewedBy: r.reviewedBy?.user.fullName ?? null,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    reviewNote: r.reviewNote,
    createdAt: r.createdAt.toISOString(),
  }));
}

/**
 * The signed-in investor's own most recent bank change request, if any,
 * for /investor/payout-details to show its status (or an empty result if
 * they've never made one, or their last one was already fully decided and
 * they're free to request again). Only ever the latest one, an investor
 * can never have more than one PENDING_APPROVAL request at a time, see
 * requestPayoutDetailsChange in lib/actions/investor-profile.ts.
 */
export async function getLatestBankChangeRequest(investorId: string) {
  const request = await prisma.investorBankChangeRequest.findFirst({
    where: { investorId },
    orderBy: { createdAt: "desc" },
  });
  if (!request) return null;

  return {
    id: request.id,
    bankName: request.bankName,
    accountNumber: request.accountNumber,
    accountName: request.accountName,
    status: request.status,
    reviewNote: request.reviewNote,
    createdAt: request.createdAt.toISOString(),
  };
}

export async function getInvestorOptions() {
  const investors = await prisma.investorProfile.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
  return investors.map((inv) => ({ id: inv.id, label: `${inv.user.fullName} (${inv.user.email})` }));
}

export async function getAgentOptions() {
  const agents = await prisma.agent.findMany({
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });
  return agents.map((agent) => ({ id: agent.id, label: `${agent.user.fullName}${agent.region ? ` (${agent.region})` : ""}` }));
}

/** Vehicles that don't already have an active investment contract on them, labeled with their type so staff can tell a car from a bike from a keke while picking one for a new contract. */
export async function getAvailableVehicleOptions() {
  const vehicles = await prisma.vehicle.findMany({
    where: { contracts: { none: { status: "ACTIVE" } } },
    orderBy: { assetTag: "asc" },
  });
  return vehicles.map((vehicle) => ({
    id: vehicle.id,
    type: vehicle.type,
    label: `${vehicle.assetTag} (${VEHICLE_TYPE_LABELS[vehicle.type]}${vehicle.location ? `, ${vehicle.location}` : ""})`,
  }));
}

/**
 * Every vehicle type's default contract terms, an admin's saved override
 * from /admin/settings/contract-terms if one exists, otherwise the
 * hard-coded fallback in lib/vehicle-types.ts. This is what
 * /admin/contracts/new actually pre-fills from, so an admin changing a
 * default there takes effect on the very next contract, no code change or
 * deploy needed.
 */
export async function getEffectiveVehicleTypeDefaults(): Promise<Record<VehicleType, DefaultContractTerms>> {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: VEHICLE_TYPES.map((type) => contractTermsSettingKey(type)) } },
  });
  const overrideByKey = new Map(settings.map((setting) => [setting.key, setting.value as unknown as DefaultContractTerms]));

  const result = {} as Record<VehicleType, DefaultContractTerms>;
  for (const type of VEHICLE_TYPES) {
    result[type] = overrideByKey.get(contractTermsSettingKey(type)) ?? VEHICLE_TYPE_DEFAULT_TERMS[type];
  }
  return result;
}

/**
 * Same as getEffectiveVehicleTypeDefaults, plus whether each type's value
 * is an admin's saved override or still the code fallback, for
 * /admin/settings/contract-terms to show which is which.
 */
export async function getVehicleTypeDefaultsForSettings(): Promise<
  Record<VehicleType, DefaultContractTerms & { isOverridden: boolean }>
> {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: VEHICLE_TYPES.map((type) => contractTermsSettingKey(type)) } },
  });
  const overrideByKey = new Map(settings.map((setting) => [setting.key, setting.value as unknown as DefaultContractTerms]));

  const result = {} as Record<VehicleType, DefaultContractTerms & { isOverridden: boolean }>;
  for (const type of VEHICLE_TYPES) {
    const override = overrideByKey.get(contractTermsSettingKey(type));
    result[type] = override ? { ...override, isOverridden: true } : { ...VEHICLE_TYPE_DEFAULT_TERMS[type], isOverridden: false };
  }
  return result;
}

/**
 * Single-type lookup, kept for any future caller that only needs one
 * type's terms rather than the full record.
 */
export async function getDefaultContractTerms(vehicleType: VehicleType = "KEKE") {
  const all = await getEffectiveVehicleTypeDefaults();
  return all[vehicleType];
}
