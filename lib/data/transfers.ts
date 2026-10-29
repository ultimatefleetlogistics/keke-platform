import { prisma } from "@/lib/prisma";

/**
 * Every ownership transfer, most recent first. A transfer row appears the
 * moment a contract's totalPaidToInvestor crosses its target payout amount
 * (see lib/payments/batch-processor.ts), this just lists what staff still
 * need to act on.
 */
export async function getOwnershipTransfers() {
  const transfers = await prisma.ownershipTransfer.findMany({
    include: {
      contract: true,
      vehicle: true,
      fromInvestor: { include: { user: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return transfers.map((t) => ({
    id: t.id,
    vehicleAssetTag: t.vehicle.assetTag,
    investorName: t.fromInvestor.user.fullName,
    target: t.target,
    status: t.status,
    targetPayoutAmount: Number(t.contract.targetPayoutAmount),
    totalPaidToInvestor: Number(t.contract.totalPaidToInvestor),
    createdAt: t.createdAt.toISOString(),
  }));
}

export async function getOwnershipTransferDetail(id: string) {
  const t = await prisma.ownershipTransfer.findUnique({
    where: { id },
    include: {
      contract: true,
      vehicle: true,
      fromInvestor: { include: { user: true } },
      toInvestor: { include: { user: true } },
      verifiedBy: { include: { user: true } },
      approvedBy: { include: { user: true } },
    },
  });
  if (!t) return null;

  return {
    id: t.id,
    status: t.status,
    target: t.target,
    notes: t.notes,
    vehicle: { id: t.vehicle.id, assetTag: t.vehicle.assetTag, location: t.vehicle.location },
    contract: {
      id: t.contract.id,
      principalAmount: Number(t.contract.principalAmount),
      targetPayoutAmount: Number(t.contract.targetPayoutAmount),
      totalPaidToInvestor: Number(t.contract.totalPaidToInvestor),
      startDate: t.contract.startDate ? t.contract.startDate.toISOString() : null,
    },
    fromInvestor: { id: t.fromInvestor.id, fullName: t.fromInvestor.user.fullName, email: t.fromInvestor.user.email },
    toInvestor: t.toInvestor ? { id: t.toInvestor.id, fullName: t.toInvestor.user.fullName } : null,
    verifiedBy: t.verifiedBy ? t.verifiedBy.user.fullName : null,
    verifiedById: t.verifiedById,
    verifiedAt: t.verifiedAt ? t.verifiedAt.toISOString() : null,
    approvedBy: t.approvedBy ? t.approvedBy.user.fullName : null,
    approvedAt: t.approvedAt ? t.approvedAt.toISOString() : null,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
  };
}
