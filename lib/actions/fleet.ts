"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/rbac/check-permission";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const VALID_VEHICLE_TYPES = ["KEKE", "CAR", "BIKE"] as const;
type VehicleTypeInput = (typeof VALID_VEHICLE_TYPES)[number];

const VALID_VEHICLE_STATUSES = ["PENDING_ONBOARDING", "ACTIVE", "MAINTENANCE", "UNASSIGNED", "RETIRED"] as const;
type VehicleStatusInput = (typeof VALID_VEHICLE_STATUSES)[number];

/**
 * Module 43: the two real validation throws below ("asset tag is
 * required," "unknown vehicle type") converted to a `{ error?: string }`
 * return, this was bound to a plain `<form action={createVehicle}>` on
 * `/admin/fleet/new`, see `components/ui/action-form.tsx`'s doc comment.
 */
export async function createVehicle(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.FLEET_MANAGE);

  const assetTag = String(formData.get("assetTag") ?? "").trim();
  const type = String(formData.get("type") ?? "KEKE") as VehicleTypeInput;
  const frameNumber = String(formData.get("frameNumber") ?? "").trim();
  const plateNumber = String(formData.get("plateNumber") ?? "").trim();
  const location = String(formData.get("location") ?? "").trim();
  const agentId = String(formData.get("agentId") ?? "").trim();

  if (!assetTag) {
    return { error: "Asset tag is required." };
  }
  if (!VALID_VEHICLE_TYPES.includes(type)) {
    return { error: "Unknown vehicle type." };
  }

  await prisma.vehicle.create({
    data: {
      assetTag,
      type,
      frameNumber: frameNumber || null,
      plateNumber: plateNumber || null,
      location: location || null,
      agentId: agentId || null,
      status: agentId ? "PENDING_ONBOARDING" : "UNASSIGNED",
    },
  });

  revalidatePath("/admin/fleet");
  revalidatePath("/admin/dashboard");
  redirect("/admin/fleet");
}

/**
 * Sets a vehicle's own operational status (Active, Maintenance, Unassigned,
 * Pending onboarding, or Retired) directly from /admin/fleet/[id]. Direct
 * feedback after Module 42's delivery: "after clicking the fleet from the
 * admin there is no place to change or set the fleet to maybe under
 * maintenance those kind of settings or is there any where to do that in
 * the app," createVehicle above only ever sets this once, at creation
 * (PENDING_ONBOARDING or UNASSIGNED depending on whether an agent was
 * picked), nothing in the app has ever let staff change it again since,
 * MAINTENANCE in particular is a real value in the VehicleStatus enum
 * (prisma/schema.prisma) that the fleet browser already renders a badge
 * and filter chip for (app/admin/fleet/fleet-browser.tsx), just nothing
 * could ever set it.
 *
 * Module 43: the two real validation throws below converted to a
 * `{ error?: string }` return, same reasoning as createVehicle above.
 */
export async function updateVehicleStatus(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.FLEET_MANAGE);

  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  const status = String(formData.get("status") ?? "") as VehicleStatusInput;

  if (!vehicleId) {
    return { error: "Vehicle is required." };
  }
  if (!VALID_VEHICLE_STATUSES.includes(status)) {
    return { error: "Unknown vehicle status." };
  }

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: { status },
  });

  revalidatePath(`/admin/fleet/${vehicleId}`);
  revalidatePath("/admin/fleet");
  revalidatePath("/admin/dashboard");
}
