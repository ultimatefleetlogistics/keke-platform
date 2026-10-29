import { prisma } from "@/lib/prisma";

/**
 * Everything needed for a single investment contract's detail page: the
 * agreement terms, running totals, the full payment schedule, and whether
 * an ownership transfer has been triggered for it yet.
 */
export async function getContractDetail(id: string) {
  const contract = await prisma.investmentContract.findUnique({
    where: { id },
    include: {
      investor: { include: { user: true } },
      vehicle: true,
      scheduleEntries: { orderBy: { dueDate: "asc" } },
      ownershipTransfers: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!contract) return null;

  const totalPaidToInvestor = Number(contract.totalPaidToInvestor);
  const targetPayoutAmount = Number(contract.targetPayoutAmount);
  const paidEntries = contract.scheduleEntries.filter((e) => e.status === "PAID").length;

  return {
    id: contract.id,
    status: contract.status,
    principalAmount: Number(contract.principalAmount),
    targetPayoutAmount,
    installmentAmount: Number(contract.installmentAmount),
    paymentFrequency: contract.paymentFrequency,
    termMonths: contract.termMonths,
    startDate: contract.startDate ? contract.startDate.toISOString() : null,
    totalPaidToInvestor,
    progressPercent: targetPayoutAmount > 0 ? Math.min(100, (totalPaidToInvestor / targetPayoutAmount) * 100) : 0,
    investor: { id: contract.investor.id, fullName: contract.investor.user.fullName, email: contract.investor.user.email },
    vehicle: { id: contract.vehicle.id, type: contract.vehicle.type, assetTag: contract.vehicle.assetTag, location: contract.vehicle.location },
    scheduleEntries: contract.scheduleEntries.map((e) => ({
      id: e.id,
      dueDate: e.dueDate.toISOString(),
      expectedAmount: Number(e.expectedAmount),
      amountPaid: Number(e.amountPaid),
      status: e.status,
    })),
    scheduleSummary: { paid: paidEntries, total: contract.scheduleEntries.length },
    ownershipTransferId: contract.ownershipTransfers[0]?.id ?? null,
  };
}
