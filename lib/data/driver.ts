import { prisma } from "@/lib/prisma";
import type { Driver } from "@prisma/client";
import { buildWeeklyTrend, weeksAgoStart } from "@/lib/data/chart-helpers";

/**
 * This driver's complete deposit history for /driver/deposits, and the
 * source the dashboard's own short preview slices from rather than
 * running a second, near identical query. A deposit doesn't carry a
 * vehicle reference directly, same as an agent's remittance, it's linked
 * through its allocations to whichever schedule entry it paid down, see
 * getAgentRemittances in lib/data/agent.ts for the identical reasoning,
 * duplicated here rather than shared since a driver's version filters by
 * driverId instead of agentId and there's no third caller yet to justify
 * the extra indirection of a shared helper.
 */
export async function getDriverDeposits(driverId: string) {
  const transactions = await prisma.paymentTransaction.findMany({
    where: { driverId },
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
      // Module 59: source/note weren't read by anything before (every
      // deposit was an AGENT_REMITTANCE-sourced webhook row with no note),
      // added for the new admin driver detail page
      // (lib/data/drivers.ts's getDriverById, the second real caller of
      // this function, see its own doc comment) to show a manually
      // recorded cash deposit's reason and offer a reversal action, same
      // fields getAgentById's own remittances mapping now returns. Harmless
      // extra fields for this function's original caller, the driver
      // portal's own dashboard/deposit history, which doesn't read either.
      source: transaction.source,
      note: transaction.note,
      vehicleTags,
      createdAt: transaction.createdAt.toISOString(),
    };
  });
}

/**
 * Real data for the driver dashboard (Module 24). Every driver has had a
 * real, trackable app account since Module 22, and a Paystack collection
 * account since Module 21, but nothing to actually sign into showed
 * either of those until now. Deliberately narrow compared to the agent
 * dashboard: a driver has exactly one current vehicle, not a fleet, so
 * there's no equivalent of /agent/vehicles here, just this one page plus
 * the full deposit history at /driver/deposits.
 */
export async function getDriverDashboardData(driver: Driver) {
  const [driverWithRelations, deposits, depositsForTrend] = await Promise.all([
    prisma.driver.findUniqueOrThrow({
      where: { id: driver.id },
      include: { agent: { include: { user: true } }, currentVehicle: true },
    }),
    getDriverDeposits(driver.id),
    prisma.paymentTransaction.findMany({
      where: { driverId: driver.id, createdAt: { gte: weeksAgoStart(8) } },
      select: { amount: true, createdAt: true },
    }),
  ]);

  const totalReceived = deposits.reduce((sum, deposit) => sum + deposit.amount, 0);

  return {
    agentName: driverWithRelations.agent.user.fullName,
    virtualAccount: driverWithRelations.paystackDvaAccountNumber
      ? {
          accountNumber: driverWithRelations.paystackDvaAccountNumber,
          bankName: driverWithRelations.paystackDvaBankName ?? "Unknown bank",
        }
      : null,
    currentVehicle: driverWithRelations.currentVehicle
      ? {
          assetTag: driverWithRelations.currentVehicle.assetTag,
          type: driverWithRelations.currentVehicle.type,
          status: driverWithRelations.currentVehicle.status,
        }
      : null,
    totalReceived,
    recentDeposits: deposits.slice(0, 5),
    depositTrend: buildWeeklyTrend(
      depositsForTrend.map((tx) => ({ amount: Number(tx.amount), createdAt: tx.createdAt }))
    ),
  };
}
