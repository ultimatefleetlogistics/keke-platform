import { prisma } from "@/lib/prisma";
import { buildWeeklyTrend, weeksAgoStart } from "@/lib/data/chart-helpers";
import { getMonthToDateFlowSummary } from "@/lib/data/reports";
import { isDelinquent } from "@/lib/delinquency";

/**
 * Real data for the operations dashboard. Every number here comes from the
 * database, so on a freshly seeded project (no vehicles, no contracts yet)
 * this will legitimately show zeros, that is correct, not a bug, see
 * app/admin/dashboard/page.tsx for how the empty state is presented.
 */
export async function getAdminDashboardData() {
  const [totalVehicles, statusCounts, contractAggregate, weeklyPayments, investorsDueToday, attention, moneyFlow] =
    await Promise.all([
      prisma.vehicle.count(),
      getFleetStatusCounts(),
      prisma.investmentContract.aggregate({ _sum: { principalAmount: true } }),
      getWeeklyPayments(),
      getInvestorsDueToday(),
      getNeedsAttention(),
      // Module 32: month-to-date inflow/outflow, the same figures the
      // Reports tab shows for "this month", reused here (not
      // recalculated separately) so the dashboard cards and the Reports
      // tab can never disagree about the same period.
      getMonthToDateFlowSummary(),
    ]);

  return {
    stats: {
      totalVehicles,
      activeFleet: statusCounts.active,
      inMaintenance: statusCounts.maintenance,
      investmentValue: Number(contractAggregate._sum.principalAmount ?? 0),
      monthToDateInflow: moneyFlow.totalInflow,
      monthToDateOutflow: moneyFlow.totalOutflow,
    },
    fleetStatusCounts: statusCounts,
    weeklyPayments,
    investorsDueToday,
    needsAttention: attention,
  };
}

export async function getFleetStatusCounts() {
  const [active, maintenance, unassigned, pending, retired] = await Promise.all([
    prisma.vehicle.count({ where: { status: "ACTIVE" } }),
    prisma.vehicle.count({ where: { status: "MAINTENANCE" } }),
    prisma.vehicle.count({ where: { status: "UNASSIGNED" } }),
    prisma.vehicle.count({ where: { status: "PENDING_ONBOARDING" } }),
    prisma.vehicle.count({ where: { status: "RETIRED" } }),
  ]);
  return {
    all: active + maintenance + unassigned + pending + retired,
    active,
    maintenance,
    unassigned,
    pending,
    retired,
  };
}

async function getWeeklyPayments() {
  const transactions = await prisma.paymentTransaction.findMany({
    where: {
      direction: "OUTBOUND",
      source: "INVESTOR_PAYOUT",
      createdAt: { gte: weeksAgoStart(8) },
    },
    select: { amount: true, createdAt: true },
  });

  return buildWeeklyTrend(transactions.map((tx) => ({ amount: Number(tx.amount), createdAt: tx.createdAt })));
}

async function getInvestorsDueToday() {
  const today = new Date();
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const entries = await prisma.paymentScheduleEntry.findMany({
    where: {
      status: { in: ["DUE", "PARTIALLY_PAID"] },
      dueDate: { gte: todayStart, lt: todayEnd },
    },
    include: {
      contract: {
        include: {
          investor: { include: { user: true } },
          vehicle: true,
        },
      },
    },
    take: 20,
  });

  return entries.map((entry) => ({
    contractId: entry.contractId,
    investor: entry.contract.investor.user.fullName,
    vehicle: entry.contract.vehicle.assetTag,
    amount: Number(entry.expectedAmount) - Number(entry.amountPaid),
    status: entry.status,
  }));
}

async function getNeedsAttention() {
  const [unmatched, deferred, targetAchieved, delinquentAgents, delinquentDrivers] = await Promise.all([
    prisma.providerTransaction.count({ where: { status: "UNMATCHED" } }),
    prisma.paymentScheduleEntry.count({ where: { status: "DEFERRED" } }),
    prisma.investmentContract.count({ where: { status: "TARGET_ACHIEVED" } }),
    getDelinquentAgentCount(),
    getDelinquentDriverCount(),
  ]);

  const items: { tone: "bad" | "warn" | "accent"; text: string; href?: string }[] = [];
  if (unmatched > 0) {
    items.push({
      tone: "bad",
      text: `${unmatched} unmatched Paystack transaction${unmatched === 1 ? "" : "s"} awaiting reconciliation`,
      href: "/admin/payments/reconciliation",
    });
  }
  if (deferred > 0) {
    items.push({
      tone: "warn",
      text: `${deferred} payment${deferred === 1 ? "" : "s"} deferred: approval needed`,
    });
  }
  if (targetAchieved > 0) {
    items.push({
      tone: "accent",
      text: `${targetAchieved} contract${targetAchieved === 1 ? "" : "s"} at target: ready for ownership transfer`,
      href: "/admin/transfers",
    });
  }
  // Module 59: staff-facing delinquency alerts (missing-features-agent-
  // driver-restructure.md item 3, "proactive alerts... so staff notice a
  // lapse before an investor complains"). Computed live off the same
  // isDelinquent() threshold the agent/driver list and detail pages use,
  // not a separate notion of "late" — one definition, several surfaces.
  if (delinquentAgents > 0) {
    items.push({
      tone: "bad",
      text: `${delinquentAgents} agent${delinquentAgents === 1 ? "" : "s"} hasn't remitted in over a week`,
      href: "/admin/agents",
    });
  }
  if (delinquentDrivers > 0) {
    items.push({
      tone: "bad",
      text: `${delinquentDrivers} driver${delinquentDrivers === 1 ? "" : "s"} hasn't deposited in over a week`,
      href: "/admin/drivers",
    });
  }
  return items;
}

async function getDelinquentAgentCount() {
  const agents = await prisma.agent.findMany({ select: { id: true } });
  if (agents.length === 0) return 0;
  const lastRemittances = await prisma.paymentTransaction.groupBy({
    by: ["agentId"],
    where: { agentId: { in: agents.map((agent) => agent.id) }, direction: "INBOUND" },
    _max: { createdAt: true },
  });
  return lastRemittances.filter((row) => isDelinquent(row._max.createdAt)).length;
}

async function getDelinquentDriverCount() {
  const drivers = await prisma.driver.findMany({ select: { id: true } });
  if (drivers.length === 0) return 0;
  const lastDeposits = await prisma.paymentTransaction.groupBy({
    by: ["driverId"],
    where: { driverId: { in: drivers.map((driver) => driver.id) }, direction: "INBOUND" },
    _max: { createdAt: true },
  });
  return lastDeposits.filter((row) => isDelinquent(row._max.createdAt)).length;
}
