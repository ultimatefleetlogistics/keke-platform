import { prisma } from "@/lib/prisma";
import type { Agent, VehicleStatus } from "@prisma/client";
import { startOfWeek } from "@/lib/utils";
import { buildWeeklyTrend, weeksAgoStart } from "@/lib/data/chart-helpers";
import type { FleetCardStatus } from "@/lib/data/fleet";

// Same mapping lib/data/fleet.ts uses for the admin fleet list, duplicated
// here rather than imported since that one isn't exported and this is only
// five entries, VehicleStatus itself already only ever has these five
// values so there's nothing to keep in sync beyond what TypeScript already
// enforces.
const STATUS_MAP: Record<VehicleStatus, FleetCardStatus> = {
  ACTIVE: "ACTIVE",
  MAINTENANCE: "MAINTENANCE",
  UNASSIGNED: "UNASSIGNED",
  PENDING_ONBOARDING: "PENDING",
  RETIRED: "RETIRED",
};

/**
 * Real data for the agent dashboard. weeklyTarget is the sum of the
 * installment amount across every active contract on this agent's
 * vehicles (keke, car, or bike, doesn't matter which), paidThisWeek sums
 * the agent's inbound remittance transactions recorded so far this week.
 */
export async function getAgentDashboardData(agent: Agent) {
  const weekStart = startOfWeek(new Date());

  const [vehicles, paidThisWeekAgg, remittances] = await Promise.all([
    prisma.vehicle.findMany({
      where: { agentId: agent.id },
      include: {
        currentDriver: true,
        contracts: {
          where: { status: "ACTIVE" },
          include: { scheduleEntries: { orderBy: { dueDate: "desc" }, take: 1 } },
        },
      },
      orderBy: { assetTag: "asc" },
    }),
    prisma.paymentTransaction.aggregate({
      where: {
        agentId: agent.id,
        direction: "INBOUND",
        createdAt: { gte: weekStart },
      },
      _sum: { amount: true },
    }),
    // Same shape and window as the admin/investor dashboard charts, see
    // chart-helpers.ts, scoped to this agent's own inbound remittances.
    prisma.paymentTransaction.findMany({
      where: {
        agentId: agent.id,
        direction: "INBOUND",
        createdAt: { gte: weeksAgoStart(8) },
      },
      select: { amount: true, createdAt: true },
    }),
  ]);

  const weeklyTarget = vehicles.reduce((sum, vehicle) => {
    const activeContract = vehicle.contracts[0];
    return sum + (activeContract ? Number(activeContract.installmentAmount) : 0);
  }, 0);

  const assignedVehicles = vehicles.map((vehicle) => {
    const activeContract = vehicle.contracts[0];
    const latestEntry = activeContract?.scheduleEntries[0];
    return {
      assetTag: vehicle.assetTag,
      type: vehicle.type,
      driver: vehicle.currentDriver?.fullName ?? "Unassigned",
      amount: latestEntry ? Number(latestEntry.amountPaid || latestEntry.expectedAmount) : 0,
      date: (latestEntry?.dueDate ?? vehicle.updatedAt).toISOString(),
      status: latestEntry?.status === "PAID" ? ("PAID" as const) : ("PENDING" as const),
    };
  });

  const remittanceTrend = buildWeeklyTrend(
    remittances.map((tx) => ({ amount: Number(tx.amount), createdAt: tx.createdAt }))
  );

  return {
    region: agent.region ?? "Not set",
    virtualAccount: agent.paystackDvaAccountNumber
      ? { accountNumber: agent.paystackDvaAccountNumber, bankName: agent.paystackDvaBankName ?? "Unknown bank" }
      : null,
    weeklyTarget,
    paidThisWeek: Number(paidThisWeekAgg._sum.amount ?? 0),
    assignedVehicles,
    remittanceTrend,
  };
}

/**
 * Every vehicle currently assigned to this agent, in full, for
 * /agent/vehicles. The dashboard's own "vehicles this week" table only
 * shows the latest schedule entry per vehicle, this is the complete list
 * with whichever active contract and investor sit behind it, not just
 * this week's snapshot.
 */
export async function getAgentVehicles(agent: Agent) {
  const vehicles = await prisma.vehicle.findMany({
    where: { agentId: agent.id },
    include: {
      currentDriver: true,
      contracts: {
        where: { status: "ACTIVE" },
        include: { investor: { include: { user: true } } },
      },
    },
    orderBy: { assetTag: "asc" },
  });

  return vehicles.map((vehicle) => {
    const activeContract = vehicle.contracts[0];
    return {
      id: vehicle.id,
      assetTag: vehicle.assetTag,
      type: vehicle.type,
      status: STATUS_MAP[vehicle.status],
      location: vehicle.location ?? "Not set",
      driver: vehicle.currentDriver?.fullName ?? null,
      installmentAmount: activeContract ? Number(activeContract.installmentAmount) : null,
      paymentFrequency: activeContract?.paymentFrequency ?? null,
      investorName: activeContract?.investor.user.fullName ?? null,
    };
  });
}

/**
 * This agent's complete remittance history for /agent/remittances, not
 * just the current week's total the dashboard shows. A remittance doesn't
 * carry a vehicle reference directly, it's linked through its
 * allocations to whichever payment schedule entries it paid down, each of
 * which belongs to one contract on one vehicle, a single remittance can
 * cover more than one vehicle's installment if the agent paid a lump sum,
 * which is why vehicleTags below is a list, not a single value.
 */
export async function getAgentRemittances(agent: Agent) {
  const transactions = await prisma.paymentTransaction.findMany({
    where: { agentId: agent.id, direction: "INBOUND" },
    include: {
      allocations: {
        include: {
          scheduleEntry: {
            include: { contract: { include: { vehicle: true } } },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return transactions.map((transaction) => {
    const vehicleTags = Array.from(
      new Set(transaction.allocations.map((allocation) => allocation.scheduleEntry.contract.vehicle.assetTag))
    );
    return {
      id: transaction.id,
      amount: Number(transaction.amount),
      status: transaction.status,
      vehicleTags,
      createdAt: transaction.createdAt.toISOString(),
    };
  });
}
