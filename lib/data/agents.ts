import { prisma } from "@/lib/prisma";
import { daysSince, isDelinquent } from "@/lib/delinquency";
import { getSubjectDocuments } from "@/lib/data/agent-driver-documents";

/**
 * Admin-side agent data, split out from lib/data/staff.ts (Module 51:
 * direct feedback, "separate staff and agent" — a combined list mixed two
 * very different kinds of record: a staff account has no fleet, no
 * drivers, no remittances behind it, an agent has all three, and burying
 * that behind one shared table meant there was nowhere to actually show
 * it). Named `agents.ts` (plural), not `agent.ts`: that file already
 * exists and is the AGENT PORTAL's own self-service data (dashboard,
 * /agent/vehicles, /agent/remittances), every function there takes the
 * signed-in agent's own `Agent` row as a parameter. This file is the
 * admin side, looking at any agent by id, same "singular = that person's
 * own portal, plural = admin managing everyone" split already used for
 * drivers (lib/data/driver.ts vs lib/data/drivers.ts). Some of the
 * per-agent query shape below (vehicles, remittances) is deliberately
 * similar to lib/data/agent.ts's own getAgentVehicles/getAgentRemittances
 * rather than imported from it, since importing an agent-portal file
 * into an admin one would blur that same split for no real gain, this is
 * only two straightforward queries.
 *
 * Every function here is keyed by USER id, not Agent id, same as
 * lib/data/staff.ts's getStaffById and the /admin/settings/staff/[id]
 * route it backs: updateStaffOrAgentAccount, resetStaffOrAgentPassword,
 * and every route param in this app already key an account by its User
 * id, not the id of whichever profile (StaffProfile/Agent) hangs off it.
 * Agent.id only shows up internally, to query Driver/Vehicle/
 * PaymentTransaction rows (which point at Agent.id, not User.id), and on
 * the list as a separate `agentId` field purely for
 * retryAgentCollectionAccount's own hidden form field, which has always
 * taken an agentId, not a userId.
 */

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  MAINTENANCE: "Maintenance",
  UNASSIGNED: "Unassigned",
  PENDING_ONBOARDING: "Pending onboarding",
  RETIRED: "Retired",
};

const STATUS_VARIANT: Record<string, "good" | "warn" | "bad" | "pending" | "neutral"> = {
  ACTIVE: "good",
  MAINTENANCE: "warn",
  UNASSIGNED: "bad",
  PENDING_ONBOARDING: "pending",
  RETIRED: "neutral",
};

export function vehicleStatusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

export function vehicleStatusVariant(status: string): "good" | "warn" | "bad" | "pending" | "neutral" {
  return STATUS_VARIANT[status] ?? "neutral";
}

/** Every agent, for /admin/agents. */
export async function getAgents() {
  const agents = await prisma.agent.findMany({
    include: {
      user: { include: { roleAssignments: { include: { role: true } } } },
      drivers: true,
      vehicles: true,
    },
    orderBy: { user: { fullName: "asc" } },
  });

  // Module 59: one more groupBy alongside the existing remittanceTotals
  // one below, _max(createdAt) rather than a second round trip, this is
  // what /admin/agents' new "Standing" column and the dashboard's "Needs
  // attention" card (lib/data/admin.ts) are built from — see
  // lib/delinquency.ts's own doc comment for why this is always computed
  // live rather than read off a denormalized column.
  const [remittanceTotals, lastRemittances] =
    agents.length === 0
      ? [[], []]
      : await Promise.all([
          prisma.paymentTransaction.groupBy({
            by: ["agentId"],
            where: { agentId: { in: agents.map((agent) => agent.id) }, direction: "INBOUND" },
            _sum: { amount: true },
          }),
          prisma.paymentTransaction.groupBy({
            by: ["agentId"],
            where: { agentId: { in: agents.map((agent) => agent.id) }, direction: "INBOUND" },
            _max: { createdAt: true },
          }),
        ]);
  const totalByAgent = new Map(remittanceTotals.map((row) => [row.agentId, Number(row._sum.amount ?? 0)]));
  const lastRemittanceByAgent = new Map(lastRemittances.map((row) => [row.agentId, row._max.createdAt ?? null]));

  return agents.map((agent) => {
    const lastRemittanceAt = lastRemittanceByAgent.get(agent.id) ?? null;
    return {
      id: agent.userId, // route param for /admin/agents/[id]
      agentId: agent.id, // for retryAgentCollectionAccount's own hidden field
      fullName: agent.user.fullName,
      email: agent.user.email,
      region: agent.region ?? "No region set",
      joinedAt: agent.createdAt.toISOString(),
      driverCount: agent.drivers.length,
      vehicleCount: agent.vehicles.length,
      totalRemitted: totalByAgent.get(agent.id) ?? 0,
      roles: agent.user.roleAssignments.map((assignment) => assignment.role.name),
      collectionAccount: agent.paystackDvaAccountNumber
        ? { accountNumber: agent.paystackDvaAccountNumber, bankName: agent.paystackDvaBankName }
        : null,
      kycStatus: agent.kycStatus,
      lastRemittanceAt: lastRemittanceAt ? lastRemittanceAt.toISOString() : null,
      daysSinceLastRemittance: daysSince(lastRemittanceAt),
      isDelinquent: isDelinquent(lastRemittanceAt),
    };
  });
}

/**
 * One agent's full profile, for /admin/agents/[id]: their own editable
 * details, every driver reporting to them, every vehicle assigned to
 * them, and their complete remittance history, everything a staff member
 * asked to look up "what has this agent got going on" needs on one
 * screen instead of piecing it together from the drivers list, the fleet
 * list, and the payments ledger separately.
 */
export async function getAgentById(userId: string) {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      agent: {
        include: {
          drivers: { include: { currentVehicle: true }, orderBy: { fullName: "asc" } },
          vehicles: { include: { currentDriver: true }, orderBy: { assetTag: "asc" } },
        },
      },
      roleAssignments: { include: { role: true } },
    },
  });
  if (!account || !account.agent) return null;
  const agent = account.agent;

  const [totalRemittedAgg, lastRemittanceAgg, remittances, documents] = await Promise.all([
    prisma.paymentTransaction.aggregate({
      where: { agentId: agent.id, direction: "INBOUND" },
      _sum: { amount: true },
    }),
    // Module 59: same live "days since last remittance" signal as
    // getAgents' own list-level groupBy above, see lib/delinquency.ts.
    prisma.paymentTransaction.aggregate({
      where: { agentId: agent.id, direction: "INBOUND" },
      _max: { createdAt: true },
    }),
    prisma.paymentTransaction.findMany({
      where: { agentId: agent.id, direction: "INBOUND" },
      include: {
        allocations: {
          include: { scheduleEntry: { include: { contract: { include: { vehicle: true } } } } },
        },
      },
      orderBy: { createdAt: "desc" },
      // Capped rather than the agent's complete lifetime ledger: this page
      // is "get oriented on this agent," not a reconciliation tool, that's
      // what /admin/payments/reconciliation is for.
      take: 50,
    }),
    // Module 59: staff-entered KYC documents, see
    // lib/data/agent-driver-documents.ts.
    getSubjectDocuments({ agentId: agent.id }),
  ]);
  const lastRemittanceAt = lastRemittanceAgg._max.createdAt ?? null;

  return {
    id: account.id,
    agentId: agent.id,
    fullName: account.fullName,
    email: account.email,
    phone: account.phone,
    region: agent.region ?? "",
    joinedAt: agent.createdAt.toISOString(),
    roles: account.roleAssignments.map((assignment) => assignment.role.name),
    collectionAccount: agent.paystackDvaAccountNumber
      ? { accountNumber: agent.paystackDvaAccountNumber, bankName: agent.paystackDvaBankName }
      : null,
    totalRemitted: Number(totalRemittedAgg._sum.amount ?? 0),
    lastRemittanceAt: lastRemittanceAt ? lastRemittanceAt.toISOString() : null,
    daysSinceLastRemittance: daysSince(lastRemittanceAt),
    isDelinquent: isDelinquent(lastRemittanceAt),
    kycStatus: agent.kycStatus,
    documents,
    drivers: agent.drivers.map((driver) => ({
      id: driver.id,
      fullName: driver.fullName,
      phone: driver.phone,
      hasAppAccess: Boolean(driver.userId),
      vehicle: driver.currentVehicle
        ? { id: driver.currentVehicle.id, assetTag: driver.currentVehicle.assetTag }
        : null,
    })),
    vehicles: agent.vehicles.map((vehicle) => ({
      id: vehicle.id,
      assetTag: vehicle.assetTag,
      type: vehicle.type,
      status: vehicle.status,
      location: vehicle.location ?? "Not set",
      driver: vehicle.currentDriver?.fullName ?? null,
    })),
    remittances: remittances.map((transaction) => {
      const vehicleTags = Array.from(
        new Set(transaction.allocations.map((allocation) => allocation.scheduleEntry.contract.vehicle.assetTag))
      );
      return {
        id: transaction.id,
        amount: Number(transaction.amount),
        status: transaction.status,
        source: transaction.source,
        note: transaction.note,
        vehicleTags,
        createdAt: transaction.createdAt.toISOString(),
      };
    }),
  };
}
