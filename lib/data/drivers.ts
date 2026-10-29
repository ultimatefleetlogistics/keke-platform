import { prisma } from "@/lib/prisma";
import { getDriverDeposits } from "@/lib/data/driver";
import { getSubjectDocuments } from "@/lib/data/agent-driver-documents";
import { daysSince, isDelinquent } from "@/lib/delinquency";

/**
 * Every driver, for /admin/drivers. Drivers previously had no admin
 * screen at all, only the seed script ever created one, see the Module
 * 21 README entry. `hasAppAccess` reflects whether this driver has a
 * linked User (`Driver.userId` is optional, most drivers never sign in
 * to anything), which matters for how a deposit alert reaches them, see
 * lib/payments/webhook-handler.ts.
 *
 * Module 59: same "days since last deposit" standing signal
 * getAgents/getAgentById already compute for agents (lib/data/agents.ts),
 * added here so /admin/drivers can show the same "Standing" column, and
 * so the dashboard's "Needs attention" card (lib/data/admin.ts) can flag
 * a driver who has gone quiet exactly the way it already flags an agent.
 * See lib/delinquency.ts for why this is always computed live rather
 * than read off a denormalized column.
 */
export async function getDrivers() {
  const drivers = await prisma.driver.findMany({
    include: { agent: { include: { user: true } }, currentVehicle: true },
    orderBy: { fullName: "asc" },
  });

  const lastDeposits =
    drivers.length === 0
      ? []
      : await prisma.paymentTransaction.groupBy({
          by: ["driverId"],
          where: { driverId: { in: drivers.map((driver) => driver.id) }, direction: "INBOUND" },
          _max: { createdAt: true },
        });
  const lastDepositByDriver = new Map(lastDeposits.map((row) => [row.driverId, row._max.createdAt ?? null]));

  return drivers.map((driver) => {
    const lastDepositAt = lastDepositByDriver.get(driver.id) ?? null;
    return {
      id: driver.id,
      fullName: driver.fullName,
      phone: driver.phone,
      hasAppAccess: Boolean(driver.userId),
      agentName: driver.agent.user.fullName,
      vehicle: driver.currentVehicle ? { id: driver.currentVehicle.id, assetTag: driver.currentVehicle.assetTag } : null,
      collectionAccount: driver.paystackDvaAccountNumber
        ? { accountNumber: driver.paystackDvaAccountNumber, bankName: driver.paystackDvaBankName }
        : null,
      kycStatus: driver.kycStatus,
      lastDepositAt: lastDepositAt ? lastDepositAt.toISOString() : null,
      daysSinceLastDeposit: daysSince(lastDepositAt),
      isDelinquent: isDelinquent(lastDepositAt),
    };
  });
}

/**
 * One driver's full profile, for /admin/drivers/[id]: their own editable
 * details, their collection account, their complete deposit history, and
 * their staff-entered KYC documents — the driver-side mirror of
 * getAgentById in lib/data/agents.ts, added in Module 59 after direct
 * feedback that clicking into a driver showed only a bare edit form while
 * the equivalent agent screen (Module 51) already showed everything.
 * Deposits are fetched with getDriverDeposits (lib/data/driver.ts, the
 * driver PORTAL's own data module) rather than a second, hand-rolled copy
 * of the same allocation-unwrapping query: that file's own doc comment
 * explains why agent/driver admin data is normally kept separate from
 * portal data, but getDriverDeposits takes a plain driverId and returns
 * exactly what this page needs unchanged, so this is a real second caller
 * justifying the reuse, not a blurring of that split.
 */
export async function getDriverById(id: string) {
  const driver = await prisma.driver.findUnique({
    where: { id },
    include: { user: true, agent: { include: { user: true } }, currentVehicle: true },
  });
  if (!driver) return null;

  const [deposits, documents] = await Promise.all([
    getDriverDeposits(driver.id),
    getSubjectDocuments({ driverId: driver.id }),
  ]);
  const totalReceived = deposits.reduce((sum, deposit) => sum + deposit.amount, 0);
  const lastDepositAt = deposits.length > 0 ? new Date(deposits[0].createdAt) : null;

  return {
    id: driver.id,
    fullName: driver.fullName,
    phone: driver.phone,
    email: driver.user?.email ?? null,
    hasAppAccess: Boolean(driver.userId),
    agentId: driver.agentId,
    agentName: driver.agent.user.fullName,
    vehicle: driver.currentVehicle ? { id: driver.currentVehicle.id, assetTag: driver.currentVehicle.assetTag } : null,
    collectionAccount: driver.paystackDvaAccountNumber
      ? { accountNumber: driver.paystackDvaAccountNumber, bankName: driver.paystackDvaBankName }
      : null,
    totalReceived,
    lastDepositAt: lastDepositAt ? lastDepositAt.toISOString() : null,
    daysSinceLastDeposit: daysSince(lastDepositAt),
    isDelinquent: isDelinquent(lastDepositAt),
    kycStatus: driver.kycStatus,
    documents,
    deposits,
  };
}

/**
 * Every driver for a vehicle-assignment dropdown (the new driver form's
 * own "assign now" field aside, this is for assigning an existing driver
 * from the vehicle detail page or the drivers list), labeled with
 * whichever vehicle they currently drive, if any, so staff can see
 * they're about to move someone rather than assigning someone unclaimed.
 */
export async function getDriverOptions() {
  const drivers = await prisma.driver.findMany({
    include: { currentVehicle: true },
    orderBy: { fullName: "asc" },
  });

  return drivers.map((driver) => ({
    id: driver.id,
    label: driver.currentVehicle ? `${driver.fullName} (currently ${driver.currentVehicle.assetTag})` : driver.fullName,
  }));
}

/**
 * Every vehicle for the "assign to vehicle" dropdown, on the new driver
 * form and on the drivers list, labeled with whoever is currently
 * driving it (if anyone) so staff can see at a glance they are about to
 * take a vehicle away from its current driver rather than assigning an
 * unclaimed one. Deliberately not filtered by contract status the way
 * getAvailableVehicleOptions is, who drives a vehicle is independent of
 * whether it has an active investment contract.
 */
export async function getVehicleOptionsForDriverAssignment() {
  const vehicles = await prisma.vehicle.findMany({
    where: { status: { not: "RETIRED" } },
    include: { currentDriver: true },
    orderBy: { assetTag: "asc" },
  });

  return vehicles.map((vehicle) => ({
    id: vehicle.id,
    label: vehicle.currentDriver ? `${vehicle.assetTag} (currently ${vehicle.currentDriver.fullName})` : vehicle.assetTag,
  }));
}
