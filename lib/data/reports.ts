import { prisma } from "@/lib/prisma";
import { dayLabel, startOfDay } from "@/lib/utils";

export type ReportsRange = {
  from: Date;
  to: Date;
};

/** Default window for /admin/reports when no from/to searchParams are given: the last 30 days, inclusive of today. */
export function defaultReportsRange(): ReportsRange {
  const to = startOfDay(new Date());
  const from = startOfDay(new Date(to));
  from.setDate(from.getDate() - 29);
  return { from, to };
}

export type DailyFlow = {
  days: string[];
  inflow: number[];
  outflow: number[];
  latestLabel: string;
  latestInflow: number;
  latestOutflow: number;
};

/** Lowercase, URL-safe partner kind, used in /admin/reports/partner/[kind]/[id] and its export route. */
export type PartnerKind = "agent" | "driver" | "investor";

export type PartnerBreakdownRow = {
  key: string;
  id: string;
  kindPath: PartnerKind;
  name: string;
  kind: "Agent" | "Driver" | "Investor";
  inflow: number;
  outflow: number;
  net: number;
};

export type ReportsData = {
  range: ReportsRange;
  summary: {
    totalInflow: number;
    totalOutflow: number;
    net: number;
    transactionCount: number;
  };
  daily: DailyFlow;
  partners: PartnerBreakdownRow[];
};

/**
 * The single source of truth for every money-flow number on /admin/reports
 * and the dashboard's money-flow cards: every PaymentTransaction in the
 * given range, excluding REVERSED (defined on PaymentTransactionStatus but
 * never actually set by any code today, excluded anyway so a reversal
 * introduced later doesn't silently inflate totals here). INBOUND covers
 * AGENT_REMITTANCE (agent and driver collections, see
 * lib/payments/webhook-handler.ts handleChargeSuccess) and, if ever used,
 * INVESTOR_FUNDING. OUTBOUND covers INVESTOR_PAYOUT (both bank and wallet
 * destinations, see lib/payments/batch-processor.ts recordPayout) and, if
 * ever used, MANUAL_ADJUSTMENT. Everything below is derived from one query
 * in JS rather than several aggregate queries, so the daily trace and the
 * summary totals can never drift apart from each other.
 */
export async function getReportsData(range: ReportsRange): Promise<ReportsData> {
  const rangeEndExclusive = new Date(range.to);
  rangeEndExclusive.setDate(rangeEndExclusive.getDate() + 1);

  const transactions = await prisma.paymentTransaction.findMany({
    where: {
      status: { not: "REVERSED" },
      createdAt: { gte: range.from, lt: rangeEndExclusive },
    },
    select: {
      id: true,
      direction: true,
      amount: true,
      createdAt: true,
      agentId: true,
      driverId: true,
      investorId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const agentIds = Array.from(new Set(transactions.map((t) => t.agentId).filter((id): id is string => Boolean(id))));
  const driverIds = Array.from(new Set(transactions.map((t) => t.driverId).filter((id): id is string => Boolean(id))));
  const investorIds = Array.from(
    new Set(transactions.map((t) => t.investorId).filter((id): id is string => Boolean(id)))
  );

  const [agents, drivers, investors] = await Promise.all([
    agentIds.length > 0 ? prisma.agent.findMany({ where: { id: { in: agentIds } }, include: { user: true } }) : [],
    driverIds.length > 0 ? prisma.driver.findMany({ where: { id: { in: driverIds } } }) : [],
    investorIds.length > 0
      ? prisma.investorProfile.findMany({ where: { id: { in: investorIds } }, include: { user: true } })
      : [],
  ]);
  const agentNameById = new Map<string, string>(agents.map((agent) => [agent.id, agent.user.fullName]));
  const driverNameById = new Map<string, string>(drivers.map((driver) => [driver.id, driver.fullName]));
  const investorNameById = new Map<string, string>(
    investors.map((investor) => [investor.id, investor.user.fullName])
  );

  let totalInflow = 0;
  let totalOutflow = 0;

  const dayCount = Math.round((rangeEndExclusive.getTime() - range.from.getTime()) / 86_400_000);
  const dailyBuckets = new Map<string, { inflow: number; outflow: number }>();
  for (let i = 0; i < dayCount; i++) {
    const day = new Date(range.from);
    day.setDate(day.getDate() + i);
    dailyBuckets.set(day.toISOString().slice(0, 10), { inflow: 0, outflow: 0 });
  }

  const partnerRows = new Map<string, PartnerBreakdownRow>();

  for (const t of transactions) {
    const amount = Number(t.amount);
    const dayKey = startOfDay(t.createdAt).toISOString().slice(0, 10);
    const bucket = dailyBuckets.get(dayKey);

    if (t.direction === "INBOUND") {
      totalInflow += amount;
      if (bucket) bucket.inflow += amount;
    } else {
      totalOutflow += amount;
      if (bucket) bucket.outflow += amount;
    }

    let partnerKey: string | null = null;
    let partnerId: string | null = null;
    let partnerKindPath: PartnerKind | null = null;
    let partnerName: string | null = null;
    let partnerKind: PartnerBreakdownRow["kind"] | null = null;
    if (t.agentId) {
      partnerKey = `agent:${t.agentId}`;
      partnerId = t.agentId;
      partnerKindPath = "agent";
      partnerName = agentNameById.get(t.agentId) ?? "Unknown agent";
      partnerKind = "Agent";
    } else if (t.driverId) {
      partnerKey = `driver:${t.driverId}`;
      partnerId = t.driverId;
      partnerKindPath = "driver";
      partnerName = driverNameById.get(t.driverId) ?? "Unknown driver";
      partnerKind = "Driver";
    } else if (t.investorId) {
      partnerKey = `investor:${t.investorId}`;
      partnerId = t.investorId;
      partnerKindPath = "investor";
      partnerName = investorNameById.get(t.investorId) ?? "Unknown investor";
      partnerKind = "Investor";
    }

    if (partnerKey && partnerId && partnerKindPath && partnerName && partnerKind) {
      const row = partnerRows.get(partnerKey) ?? {
        key: partnerKey,
        id: partnerId,
        kindPath: partnerKindPath,
        name: partnerName,
        kind: partnerKind,
        inflow: 0,
        outflow: 0,
        net: 0,
      };
      if (t.direction === "INBOUND") row.inflow += amount;
      else row.outflow += amount;
      row.net = row.inflow - row.outflow;
      partnerRows.set(partnerKey, row);
    }
  }

  const dailyEntries = Array.from(dailyBuckets.entries());
  const days = dailyEntries.map(([iso]) => dayLabel(new Date(iso)));
  const inflow = dailyEntries.map(([, v]) => v.inflow);
  const outflow = dailyEntries.map(([, v]) => v.outflow);

  const partners = Array.from(partnerRows.values()).sort((a, b) => b.inflow + b.outflow - (a.inflow + a.outflow));

  return {
    range,
    summary: {
      totalInflow,
      totalOutflow,
      net: totalInflow - totalOutflow,
      transactionCount: transactions.length,
    },
    daily: {
      days,
      inflow,
      outflow,
      latestLabel: days[days.length - 1] ?? dayLabel(range.to),
      latestInflow: inflow[inflow.length - 1] ?? 0,
      latestOutflow: outflow[outflow.length - 1] ?? 0,
    },
    partners,
  };
}

/**
 * Just the headline totals for a fixed recent window (the current
 * calendar month so far), for the two new "Money flow" stat cards on
 * /admin/dashboard. Reuses getReportsData rather than a separate
 * aggregate query, so the dashboard cards and the Reports tab can never
 * show different numbers for the same period.
 */
export async function getMonthToDateFlowSummary() {
  const now = new Date();
  const from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = startOfDay(now);
  const { summary } = await getReportsData({ from, to });
  return summary;
}

const SOURCE_LABEL: Record<string, string> = {
  INVESTOR_FUNDING: "Investor funding",
  AGENT_REMITTANCE: "Remittance",
  INVESTOR_PAYOUT: "Investor payout",
  MANUAL_ADJUSTMENT: "Manual adjustment",
};

export type PartnerTransaction = {
  id: string;
  createdAt: string;
  direction: "INBOUND" | "OUTBOUND";
  sourceLabel: string;
  amount: number;
};

export type PartnerStatement = {
  kind: PartnerKind;
  id: string;
  name: string;
  subtitle: string | null;
  range: ReportsRange | null;
  summary: {
    totalInflow: number;
    totalOutflow: number;
    net: number;
    transactionCount: number;
  };
  transactions: PartnerTransaction[];
};

/**
 * One agent, driver, or investor's full payment history, "all the
 * payments to or from that user/account" (Module 33), the same drill-down
 * a row on the Reports "By partner" table links to. `range` is optional
 * and defaults to all-time when omitted, unlike getReportsData, this is
 * meant to double as a full account statement, not just a recent window,
 * though a caller (the page's own from/to filter) can still narrow it.
 * Returns null when the id doesn't resolve to a real agent/driver/investor,
 * so the page can render a 404 rather than an empty statement.
 */
export async function getPartnerStatement({
  kind,
  id,
  range,
}: {
  kind: PartnerKind;
  id: string;
  range?: ReportsRange;
}): Promise<PartnerStatement | null> {
  let name: string;
  let subtitle: string | null;

  if (kind === "agent") {
    const agent = await prisma.agent.findUnique({ where: { id }, include: { user: true } });
    if (!agent) return null;
    name = agent.user.fullName;
    subtitle = agent.region ? `Agent · ${agent.region}` : "Agent";
  } else if (kind === "driver") {
    const driver = await prisma.driver.findUnique({ where: { id } });
    if (!driver) return null;
    name = driver.fullName;
    subtitle = driver.phone ? `Driver · ${driver.phone}` : "Driver";
  } else {
    const investor = await prisma.investorProfile.findUnique({ where: { id }, include: { user: true } });
    if (!investor) return null;
    name = investor.user.fullName;
    subtitle = `Investor · ${investor.user.email}`;
  }

  const rangeEndExclusive = range ? new Date(range.to) : null;
  if (rangeEndExclusive) rangeEndExclusive.setDate(rangeEndExclusive.getDate() + 1);

  const rows = await prisma.paymentTransaction.findMany({
    where: {
      status: { not: "REVERSED" },
      ...(kind === "agent" ? { agentId: id } : kind === "driver" ? { driverId: id } : { investorId: id }),
      ...(range && rangeEndExclusive ? { createdAt: { gte: range.from, lt: rangeEndExclusive } } : {}),
    },
    select: { id: true, direction: true, source: true, amount: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  let totalInflow = 0;
  let totalOutflow = 0;
  const transactions: PartnerTransaction[] = rows.map((t) => {
    const amount = Number(t.amount);
    if (t.direction === "INBOUND") totalInflow += amount;
    else totalOutflow += amount;
    return {
      id: t.id,
      createdAt: t.createdAt.toISOString(),
      direction: t.direction,
      sourceLabel: SOURCE_LABEL[t.source] ?? t.source,
      amount,
    };
  });

  return {
    kind,
    id,
    name,
    subtitle,
    range: range ?? null,
    summary: {
      totalInflow,
      totalOutflow,
      net: totalInflow - totalOutflow,
      transactionCount: transactions.length,
    },
    transactions,
  };
}

// ---------------------------------------------------------------------------
// The four Module 33 reports, added alongside money flow: how each
// investor's contract is actually progressing (not just cash moved),
// which agents are behind on collections, which vehicles are actually
// paying for themselves, and where KYC review still needs attention.
// Each is intentionally its own small query, not squeezed into
// getReportsData, the underlying tables (InvestmentContract,
// PaymentScheduleEntry, Vehicle, MaintenanceRecord, InvestorProfile) are
// different enough from PaymentTransaction that sharing one function
// would make it harder to read, not easier.
// ---------------------------------------------------------------------------

export type PortfolioRow = {
  contractId: string;
  investorName: string;
  vehicleAssetTag: string;
  status: string;
  principalAmount: number;
  targetPayoutAmount: number;
  totalPaidToInvestor: number;
  percentComplete: number;
  overdueCount: number;
  startDate: string | null;
};

/**
 * One row per contract still open (ACTIVE, TARGET_ACHIEVED, or
 * TRANSFER_IN_PROGRESS, a completed or cancelled contract has nothing
 * left to track), how far toward its target payout it has actually
 * gotten, and how many of its schedule entries are currently overdue
 * (DUE/PARTIALLY_PAID/DEFERRED with a due date already in the past).
 * Sorted so contracts that need a look, overdue entries first, then
 * lowest percent complete, surface above contracts quietly on track.
 */
export async function getPortfolioProgressReport(): Promise<PortfolioRow[]> {
  const contracts = await prisma.investmentContract.findMany({
    where: { status: { in: ["ACTIVE", "TARGET_ACHIEVED", "TRANSFER_IN_PROGRESS"] } },
    include: {
      investor: { include: { user: true } },
      vehicle: true,
      scheduleEntries: { select: { status: true, dueDate: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Midnight, matching getArrearsReport's own boundary, so "overdue" means
  // the same thing (strictly before today, not just before this instant)
  // everywhere in the Reports section.
  const today = startOfDay(new Date());
  const rows = contracts.map((contract) => {
    const target = Number(contract.targetPayoutAmount);
    const paid = Number(contract.totalPaidToInvestor);
    const overdueCount = contract.scheduleEntries.filter(
      (entry) =>
        (entry.status === "DUE" || entry.status === "PARTIALLY_PAID" || entry.status === "DEFERRED") &&
        entry.dueDate < today
    ).length;
    return {
      contractId: contract.id,
      investorName: contract.investor.user.fullName,
      vehicleAssetTag: contract.vehicle.assetTag,
      status: contract.status,
      principalAmount: Number(contract.principalAmount),
      targetPayoutAmount: target,
      totalPaidToInvestor: paid,
      percentComplete: target > 0 ? Math.min(100, (paid / target) * 100) : 0,
      overdueCount,
      startDate: contract.startDate ? contract.startDate.toISOString() : null,
    };
  });

  return rows.sort((a, b) => b.overdueCount - a.overdueCount || a.percentComplete - b.percentComplete);
}

export type ArrearsRow = {
  scheduleEntryId: string;
  agentId: string | null;
  agentName: string | null;
  investorName: string;
  vehicleAssetTag: string;
  dueDate: string;
  daysOverdue: number;
  expectedAmount: number;
  amountPaid: number;
  amountOutstanding: number;
  status: string;
};

export type ArrearsAgentSummary = {
  agentKey: string;
  agentName: string;
  entryCount: number;
  totalOutstanding: number;
};

/**
 * Every schedule entry that is currently overdue, i.e. DUE, PARTIALLY_PAID,
 * or DEFERRED with a due date already in the past (UPCOMING and PAID
 * entries never appear here, "due today" isn't overdue yet). Distinct
 * from the dashboard's "investors due today" card, that shows only today;
 * this is the full backlog, attributed to whichever agent is currently
 * assigned to the vehicle (a vehicle with no agent on file shows as
 * "Unassigned" rather than being silently dropped), so a manager can see
 * which agent's collections are actually falling behind, not just which
 * investors are waiting on a payment.
 */
export async function getArrearsReport(): Promise<{ rows: ArrearsRow[]; byAgent: ArrearsAgentSummary[] }> {
  // Midnight, not the current instant: a schedule entry due earlier
  // today has dueDate at today's own midnight, `lt: new Date()` would
  // wrongly count it as overdue the moment the clock passes 00:00,
  // hours before staff have had the whole day to actually collect it.
  // Matches getInvestorsDueToday's own todayStart/todayEnd window
  // (lib/data/admin.ts) for what counts as "due today" versus overdue.
  const today = startOfDay(new Date());
  const entries = await prisma.paymentScheduleEntry.findMany({
    where: {
      status: { in: ["DUE", "PARTIALLY_PAID", "DEFERRED"] },
      dueDate: { lt: today },
    },
    include: {
      contract: {
        include: {
          investor: { include: { user: true } },
          vehicle: { include: { agent: { include: { user: true } } } },
        },
      },
    },
    orderBy: { dueDate: "asc" },
  });

  const rows: ArrearsRow[] = entries.map((entry) => {
    const expected = Number(entry.expectedAmount);
    const paid = Number(entry.amountPaid);
    const daysOverdue = Math.max(0, Math.floor((today.getTime() - entry.dueDate.getTime()) / 86_400_000));
    return {
      scheduleEntryId: entry.id,
      agentId: entry.contract.vehicle.agent?.id ?? null,
      agentName: entry.contract.vehicle.agent?.user.fullName ?? null,
      investorName: entry.contract.investor.user.fullName,
      vehicleAssetTag: entry.contract.vehicle.assetTag,
      dueDate: entry.dueDate.toISOString(),
      daysOverdue,
      expectedAmount: expected,
      amountPaid: paid,
      amountOutstanding: expected - paid,
      status: entry.status,
    };
  });

  // Keyed by agent id, not display name, two agents sharing the same
  // full name must not collapse into one summary row.
  const byAgentMap = new Map<string, ArrearsAgentSummary>();
  for (const row of rows) {
    const key = row.agentId ?? "unassigned";
    const summary = byAgentMap.get(key) ?? {
      agentKey: key,
      agentName: row.agentName ?? "Unassigned",
      entryCount: 0,
      totalOutstanding: 0,
    };
    summary.entryCount += 1;
    summary.totalOutstanding += row.amountOutstanding;
    byAgentMap.set(key, summary);
  }

  return {
    rows: rows.sort((a, b) => b.daysOverdue - a.daysOverdue),
    byAgent: Array.from(byAgentMap.values()).sort((a, b) => b.totalOutstanding - a.totalOutstanding),
  };
}

export type FleetProfitabilityRow = {
  vehicleId: string;
  assetTag: string;
  status: string;
  principalAmount: number;
  targetPayoutAmount: number;
  revenueCollected: number;
  payoutsMade: number;
  maintenanceCost: number;
  netMargin: number;
};

/**
 * One row per vehicle that has ever had a contract, how much has actually
 * been collected toward it (summed straight off PaymentScheduleEntry.
 * amountPaid, already kept in sync as allocations land, no need to
 * re-derive it from PaymentTransaction/PaymentAllocation), how much has
 * been paid out to its investor(s) (summed off PaymentBatchItem.amount
 * for items that actually transferred, status SUCCESS, across every
 * contract this vehicle has had), and what it has cost to maintain
 * (MaintenanceRecord.cost, optional, treated as 0 when not logged).
 * netMargin is what this vehicle has actually earned the business,
 * collections in minus payouts and upkeep out, not the investor's own
 * return (principalAmount/targetPayoutAmount are shown alongside for
 * context, but this is a company profitability view, not an investor
 * statement, see getPartnerStatement for that). Sorted best performer
 * first, but the point is to look at both ends of the list.
 */
export async function getFleetProfitabilityReport(): Promise<FleetProfitabilityRow[]> {
  const vehicles = await prisma.vehicle.findMany({
    where: { contracts: { some: {} } },
    include: {
      contracts: {
        include: {
          scheduleEntries: { select: { amountPaid: true } },
          batchItems: { where: { transferStatus: "SUCCESS" }, select: { amount: true } },
        },
      },
      maintenanceRecords: { select: { cost: true } },
    },
    orderBy: { assetTag: "asc" },
  });

  const rows = vehicles.map((vehicle) => {
    const principalAmount = vehicle.contracts.reduce((sum, contract) => sum + Number(contract.principalAmount), 0);
    const targetPayoutAmount = vehicle.contracts.reduce(
      (sum, contract) => sum + Number(contract.targetPayoutAmount),
      0
    );
    const revenueCollected = vehicle.contracts.reduce(
      (sum, contract) =>
        sum + contract.scheduleEntries.reduce((entrySum, entry) => entrySum + Number(entry.amountPaid), 0),
      0
    );
    const payoutsMade = vehicle.contracts.reduce(
      (sum, contract) => sum + contract.batchItems.reduce((itemSum, item) => itemSum + Number(item.amount), 0),
      0
    );
    const maintenanceCost = vehicle.maintenanceRecords.reduce(
      (sum, record) => sum + Number(record.cost ?? 0),
      0
    );
    return {
      vehicleId: vehicle.id,
      assetTag: vehicle.assetTag,
      status: vehicle.status,
      principalAmount,
      targetPayoutAmount,
      revenueCollected,
      payoutsMade,
      maintenanceCost,
      netMargin: revenueCollected - payoutsMade - maintenanceCost,
    };
  });

  return rows.sort((a, b) => b.netMargin - a.netMargin);
}

export type KycSnapshotCounts = Record<"NOT_STARTED" | "PENDING_REVIEW" | "VERIFIED" | "REJECTED", number>;

export type KycAttentionRow = {
  investorId: string;
  investorName: string;
  kycStatus: string;
  daysSinceCreated: number;
};

/**
 * Investor count by kycStatus platform-wide, plus a worklist of everyone
 * still NOT_STARTED or PENDING_REVIEW, oldest first, so it reads as "who
 * has been waiting the longest," not just a snapshot. Distinct from
 * /admin/kyc, that page is the actual review queue (documents to approve
 * or reject), this is a reporting rollup: how many investors are in each
 * state, useful before a compliance conversation even when nothing is
 * sitting in the review queue right now.
 */
export async function getKycSnapshotReport(): Promise<{ counts: KycSnapshotCounts; attention: KycAttentionRow[] }> {
  const investors = await prisma.investorProfile.findMany({
    include: { user: true },
    orderBy: { createdAt: "asc" },
  });

  const counts: KycSnapshotCounts = { NOT_STARTED: 0, PENDING_REVIEW: 0, VERIFIED: 0, REJECTED: 0 };
  const today = new Date();
  const attention: KycAttentionRow[] = [];

  for (const investor of investors) {
    counts[investor.kycStatus] += 1;
    if (investor.kycStatus === "NOT_STARTED" || investor.kycStatus === "PENDING_REVIEW") {
      attention.push({
        investorId: investor.id,
        investorName: investor.user.fullName,
        kycStatus: investor.kycStatus,
        daysSinceCreated: Math.max(0, Math.floor((today.getTime() - investor.createdAt.getTime()) / 86_400_000)),
      });
    }
  }

  return {
    counts,
    attention: attention.sort((a, b) => b.daysSinceCreated - a.daysSinceCreated),
  };
}
