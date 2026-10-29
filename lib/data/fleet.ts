import { prisma } from "@/lib/prisma";
import type { VehicleStatus, VehicleType } from "@prisma/client";
import { getFleetStatusCounts } from "@/lib/data/admin";
import { ASSET_TAG_PREFIXES, VEHICLE_TYPES } from "@/lib/vehicle-types";

export type FleetCardStatus = "ACTIVE" | "MAINTENANCE" | "UNASSIGNED" | "PENDING" | "RETIRED";

const STATUS_MAP: Record<VehicleStatus, FleetCardStatus> = {
  ACTIVE: "ACTIVE",
  MAINTENANCE: "MAINTENANCE",
  UNASSIGNED: "UNASSIGNED",
  PENDING_ONBOARDING: "PENDING",
  RETIRED: "RETIRED",
};

export async function getFleetVehicles() {
  const vehicles = await prisma.vehicle.findMany({
    include: {
      agent: { include: { user: true } },
      currentDriver: true,
    },
    orderBy: { assetTag: "asc" },
  });

  return vehicles.map((vehicle) => ({
    id: vehicle.id,
    assetTag: vehicle.assetTag,
    type: vehicle.type as VehicleType,
    status: STATUS_MAP[vehicle.status],
    location: vehicle.location ?? "Not set",
    agent: vehicle.agent?.user.fullName ?? "Unassigned",
    driver: vehicle.currentDriver?.fullName ?? "Unassigned",
  }));
}

export async function getFleetPageData() {
  const [vehicles, statusCounts] = await Promise.all([getFleetVehicles(), getFleetStatusCounts()]);
  return { vehicles, statusCounts };
}

/**
 * Suggests the next asset tag for a vehicle type by finding the highest
 * numeric suffix already in use under that type's prefix and adding one,
 * e.g. if the highest keke on file is "KKE-004" this returns "KKE-005".
 * Requested directly: "when adding new fleet the asset tag should be
 * automatic from the previous number if the last one is KKE-001 the next
 * one should be KKE-002 same thing applies to bike or cars." Only a
 * suggestion, the admin can still type over it on /admin/fleet/new, so a
 * gap or an out-of-sequence tag someone typed by hand never blocks anyone.
 */
export async function getNextAssetTag(type: VehicleType): Promise<string> {
  const prefix = ASSET_TAG_PREFIXES[type];
  const candidates = await prisma.vehicle.findMany({
    where: { assetTag: { startsWith: `${prefix}-` } },
    select: { assetTag: true },
  });

  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let highest = 0;
  for (const vehicle of candidates) {
    const match = vehicle.assetTag.match(pattern);
    if (!match) continue;
    const value = parseInt(match[1], 10);
    if (value > highest) highest = value;
  }

  return `${prefix}-${String(highest + 1).padStart(3, "0")}`;
}

export async function getNextAssetTagsByType(): Promise<Record<VehicleType, string>> {
  const entries = await Promise.all(VEHICLE_TYPES.map(async (type) => [type, await getNextAssetTag(type)] as const));
  return Object.fromEntries(entries) as Record<VehicleType, string>;
}

/**
 * Everything needed for a single vehicle's detail page: its own record,
 * the agent and driver currently assigned, its full driver assignment and
 * maintenance history, and every contract that has ever been written
 * against it (usually one at a time, but the schema allows more over the
 * vehicle's lifetime). Works the same whether it's a keke, car, or bike.
 */
export async function getVehicleDetail(id: string) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      agent: { include: { user: true } },
      currentDriver: true,
      driverAssignments: { include: { driver: true }, orderBy: { startedAt: "desc" } },
      maintenanceRecords: { orderBy: { createdAt: "desc" } },
      contracts: {
        include: { investor: { include: { user: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!vehicle) return null;

  return {
    id: vehicle.id,
    assetTag: vehicle.assetTag,
    type: vehicle.type as VehicleType,
    frameNumber: vehicle.frameNumber,
    plateNumber: vehicle.plateNumber,
    status: STATUS_MAP[vehicle.status],
    location: vehicle.location,
    agent: vehicle.agent ? { id: vehicle.agent.id, fullName: vehicle.agent.user.fullName, region: vehicle.agent.region } : null,
    currentDriver: vehicle.currentDriver
      ? { id: vehicle.currentDriver.id, fullName: vehicle.currentDriver.fullName, phone: vehicle.currentDriver.phone }
      : null,
    driverAssignments: vehicle.driverAssignments.map((a) => ({
      id: a.id,
      driverName: a.driver.fullName,
      startedAt: a.startedAt.toISOString(),
      endedAt: a.endedAt ? a.endedAt.toISOString() : null,
      reason: a.reason,
    })),
    maintenanceRecords: vehicle.maintenanceRecords.map((m) => ({
      id: m.id,
      status: m.status,
      description: m.description,
      cost: m.cost !== null ? Number(m.cost) : null,
      performedAt: m.performedAt ? m.performedAt.toISOString() : null,
    })),
    contracts: vehicle.contracts.map((c) => ({
      id: c.id,
      investorName: c.investor.user.fullName,
      status: c.status,
      startDate: c.startDate ? c.startDate.toISOString() : null,
      principalAmount: Number(c.principalAmount),
      targetPayoutAmount: Number(c.targetPayoutAmount),
      totalPaidToInvestor: Number(c.totalPaidToInvestor),
    })),
  };
}
