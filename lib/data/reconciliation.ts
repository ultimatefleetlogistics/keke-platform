import { prisma } from "@/lib/prisma";
import { koboToNaira } from "@/lib/payments/paystack-client";

type RawChargeData = {
  reference?: string;
  amount?: number;
  channel?: string;
  customer?: { email?: string; customer_code?: string };
};

/**
 * Pulls the handful of fields worth showing out of a stored webhook's
 * rawPayload without assuming its exact shape holds, Paystack's payload is
 * untyped JSON as far as Prisma is concerned, and this reads it the same
 * defensive way lib/payments/webhook-handler.ts does (customer.customer_code,
 * amount in kobo), just for display instead of for matching logic.
 */
function summarizeRawPayload(rawPayload: unknown) {
  const payload = rawPayload as { event?: string; data?: RawChargeData } | null;
  const data = payload?.data;
  return {
    reference: data?.reference ?? null,
    amountNaira: typeof data?.amount === "number" ? koboToNaira(data.amount) : null,
    channel: data?.channel ?? null,
    customerEmail: data?.customer?.email ?? null,
    customerCode: data?.customer?.customer_code ?? null,
  };
}

/** Just the count, for the small badge next to the "Reconciliation" link on /admin/payments/batches, cheaper than loading the full list when all that's needed is whether there's anything to look at. */
export async function getUnmatchedCount() {
  return prisma.providerTransaction.count({ where: { status: "UNMATCHED" } });
}

/**
 * Every ProviderTransaction stuck at UNMATCHED: a charge.success whose
 * customer code didn't resolve to any agent or driver (or had none at
 * all), or a transfer.success/failed/reversed whose reference didn't
 * resolve to any PaymentBatchItem or WalletWithdrawal, see
 * lib/payments/webhook-handler.ts. Money already moved for every one of
 * these, this queue exists purely to record which contract it should
 * count toward, or to confirm it doesn't belong to this app at all.
 */
export async function getUnmatchedTransactions() {
  const transactions = await prisma.providerTransaction.findMany({
    where: { status: "UNMATCHED" },
    orderBy: { receivedAt: "desc" },
  });

  return transactions.map((t) => ({
    id: t.id,
    eventType: t.eventType,
    receivedAt: t.receivedAt.toISOString(),
    rawPayloadPretty: JSON.stringify(t.rawPayload, null, 2),
    ...summarizeRawPayload(t.rawPayload),
  }));
}

/**
 * The last several transactions staff have already resolved one way or
 * another (matched to a vehicle, or otherwise marked processed), so the
 * reconciliation screen can show recent activity, not just an empty queue
 * once everything's cleared.
 *
 * Caught by a real `next build`'s type check, this sandbox's `npm run
 * lint`/`next dev` never caught it (see "Known gaps"): `PaymentTransaction.
 * agentId`/`.driverId` (`prisma/schema.prisma`) are plain `String?`
 * columns, never real Prisma relations named `agent`/`driver`, unlike
 * `providerTransaction`, `batchItem`, and `allocations` on the same
 * model, which are. The exact same "column, not a relation" shape as
 * `KycDocument.reviewedById` (Module 29's fix). `include: { agent: ...,
 * driver: ... }` was invalid the whole time, invalid enough that
 * TypeScript's overload resolution for `findMany` fell back to a
 * different signature entirely rather than just rejecting those two keys,
 * which is why the type error also showed up as `paymentTransaction`
 * itself supposedly not existing. Fixed the same way Module 29 was: two
 * follow-up lookup queries instead of a Prisma `include`.
 */
export async function getRecentlyProcessedTransactions() {
  const transactions = await prisma.providerTransaction.findMany({
    where: { status: "PROCESSED", eventType: "charge.success" },
    orderBy: { processedAt: "desc" },
    take: 15,
    include: {
      paymentTransaction: {
        include: {
          allocations: { include: { scheduleEntry: { include: { contract: { include: { vehicle: true } } } } } },
        },
      },
    },
  });

  const agentIds = Array.from(
    new Set(transactions.map((t) => t.paymentTransaction?.agentId).filter((id): id is string => Boolean(id)))
  );
  const driverIds = Array.from(
    new Set(transactions.map((t) => t.paymentTransaction?.driverId).filter((id): id is string => Boolean(id)))
  );

  const [agents, drivers] = await Promise.all([
    agentIds.length > 0 ? prisma.agent.findMany({ where: { id: { in: agentIds } }, include: { user: true } }) : [],
    driverIds.length > 0 ? prisma.driver.findMany({ where: { id: { in: driverIds } } }) : [],
  ]);
  const agentNameById = new Map(agents.map((agent) => [agent.id, agent.user.fullName]));
  const driverNameById = new Map(drivers.map((driver) => [driver.id, driver.fullName]));

  return transactions.map((t) => {
    const allocation = t.paymentTransaction?.allocations[0];
    return {
      id: t.id,
      processedAt: t.processedAt?.toISOString() ?? t.receivedAt.toISOString(),
      amount: t.paymentTransaction ? Number(t.paymentTransaction.amount) : summarizeRawPayload(t.rawPayload).amountNaira,
      agentName: t.paymentTransaction?.agentId ? (agentNameById.get(t.paymentTransaction.agentId) ?? null) : null,
      driverName: t.paymentTransaction?.driverId ? (driverNameById.get(t.paymentTransaction.driverId) ?? null) : null,
      vehicle: allocation?.scheduleEntry.contract.vehicle.assetTag ?? null,
    };
  });
}

/**
 * Every vehicle with an active contract, for the "which vehicle does this
 * payment belong to" picker on the manual match form. Unlike
 * getAvailableVehicleOptions (lib/data/onboarding.ts, vehicles with no
 * active contract, for starting a brand new one), reconciliation is the
 * opposite case: a vehicle that already has an agent collecting weekly
 * installments toward it.
 */
export async function getVehicleOptionsForReconciliation() {
  const vehicles = await prisma.vehicle.findMany({
    where: { contracts: { some: { status: "ACTIVE" } } },
    include: { agent: { include: { user: true } }, currentDriver: true },
    orderBy: { assetTag: "asc" },
  });

  return vehicles.map((vehicle) => {
    const details = [
      vehicle.agent ? `Agent: ${vehicle.agent.user.fullName}` : null,
      vehicle.currentDriver ? `Driver: ${vehicle.currentDriver.fullName}` : null,
    ].filter(Boolean);
    return {
      id: vehicle.id,
      label: details.length > 0 ? `${vehicle.assetTag} (${details.join(", ")})` : vehicle.assetTag,
    };
  });
}
