"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/rbac/check-permission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { provisionDriverCollectionAccount } from "@/lib/payments/collection-account";
import { sendNotification } from "@/lib/notifications/send-notification";

// Same word list and shape as lib/actions/staff.ts's own generator, kept
// separate rather than shared for the same reason that file's doc
// comment gives: these account types are created from different screens,
// a shared helper would only save a few lines at the cost of an extra
// import to trace.
const WORDS = ["keke", "gold", "kano", "abuja", "lagos", "river", "market", "tiger", "amber", "delta"];

function generateTemporaryPassword(): string {
  const word = WORDS[randomInt(0, WORDS.length)];
  const digits = String(randomInt(1000, 9999));
  return `${word[0].toUpperCase()}${word.slice(1)}${digits}!`;
}

/**
 * Closes out whichever assignment currently has this vehicle (or, when
 * vehicleId is omitted, this driver) as its open row, `endedAt: null`,
 * if one exists. Shared by assignDriverToVehicle below for both sides of
 * a reassignment, a driver being moved off their current vehicle, and a
 * vehicle's previous driver being moved off it, so "driver assignment
 * history" on the vehicle detail page never ends up with two open rows
 * for the same vehicle or the same driver at once.
 */
async function closeOpenAssignment(
  tx: Prisma.TransactionClient,
  where: { vehicleId?: string; driverId?: string },
  reason: string
) {
  const open = await tx.driverAssignment.findFirst({ where: { ...where, endedAt: null }, orderBy: { startedAt: "desc" } });
  if (open) {
    await tx.driverAssignment.update({ where: { id: open.id }, data: { endedAt: new Date(), reason } });
  }
}

/**
 * Assigns a driver to a vehicle, reassigning them off whatever vehicle
 * they were previously driving (if any) and moving whoever was
 * previously driving the target vehicle (if a different person) off it
 * first, `Vehicle.currentDriverId` is unique, one driver cannot be the
 * current driver on two vehicles, so the old side has to be cleared
 * before the new side can be set.
 *
 * Module 43: the real, user-reachable validation throws below ("choose a
 * driver and a vehicle," "driver/vehicle not found") converted to a
 * `{ error?: string }` return, this was bound to a plain
 * `<form action={assignDriverToVehicle}>` on `/admin/fleet/[id]`, see
 * `components/ui/action-form.tsx`'s doc comment.
 */
export async function assignDriverToVehicle(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.FLEET_MANAGE);

  const driverId = String(formData.get("driverId") ?? "").trim();
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  const redirectTo = String(formData.get("redirectTo") ?? "/admin/drivers");
  if (!driverId || !vehicleId) return { error: "Choose a driver and a vehicle." };

  const [driver, vehicle] = await Promise.all([
    prisma.driver.findUnique({ where: { id: driverId }, include: { currentVehicle: true } }),
    prisma.vehicle.findUnique({ where: { id: vehicleId }, include: { currentDriver: true } }),
  ]);
  if (!driver) return { error: "Driver not found." };
  if (!vehicle) return { error: "Vehicle not found." };

  await prisma.$transaction(async (tx) => {
    if (driver.currentVehicle && driver.currentVehicle.id !== vehicleId) {
      await closeOpenAssignment(tx, { vehicleId: driver.currentVehicle.id }, "Reassigned to a different vehicle");
      await tx.vehicle.update({ where: { id: driver.currentVehicle.id }, data: { currentDriverId: null } });
    }
    if (vehicle.currentDriver && vehicle.currentDriver.id !== driverId) {
      await closeOpenAssignment(tx, { vehicleId }, "Vehicle reassigned to a different driver");
    }

    await tx.vehicle.update({ where: { id: vehicleId }, data: { currentDriverId: driverId } });
    await tx.driverAssignment.create({ data: { driverId, vehicleId } });
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: "driver.assign_vehicle",
    entityType: "Vehicle",
    entityId: vehicleId,
    afterState: { driverId, driverName: driver.fullName },
  });

  revalidatePath("/admin/drivers");
  revalidatePath(`/admin/fleet/${vehicleId}`);
  redirect(redirectTo);
}

/** Clears a vehicle's current driver without assigning a new one. */
export async function unassignDriverFromVehicle(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.FLEET_MANAGE);

  const vehicleId = String(formData.get("vehicleId") ?? "").trim();
  if (!vehicleId) return { error: "Missing vehicle." };

  await prisma.$transaction(async (tx) => {
    await closeOpenAssignment(tx, { vehicleId }, "Unassigned, no replacement driver yet");
    await tx.vehicle.update({ where: { id: vehicleId }, data: { currentDriverId: null } });
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: "driver.unassign_vehicle",
    entityType: "Vehicle",
    entityId: vehicleId,
  });

  revalidatePath("/admin/drivers");
  revalidatePath(`/admin/fleet/${vehicleId}`);
}

/**
 * Adds a driver record, this is the first admin-console way to do so at
 * all, see the Module 21 README entry, drivers previously only ever
 * existed via the seed script. Every driver gets a real Supabase Auth
 * account at creation time, same generated-password pattern as
 * lib/actions/staff.ts, this was a deliberate change in Module 22: most
 * drivers will never actually sign in (`Driver.userId` staying optional
 * on the schema is exactly for the drivers who existed before this
 * change, or anyone created directly against the database), but every
 * driver going forward has a real, trackable account ready the moment
 * they choose to use it, rather than app access being something decided
 * for them later. This also means their deposit SMS alert always goes
 * through the normal tracked sendNotification path, not the untracked
 * fallback, see lib/notifications/send-notification.ts. A phone number
 * is still required, both because assigning a vehicle to a driver nobody
 * can reach defeats the point, and because it's what the Paystack
 * collection account and its deposit SMS alert need.
 * `mustChangePassword: true` (Module 26) forces whoever actually does
 * sign in with the generated password to pick their own at
 * `/change-password` first, before anything else.
 *
 * Module 27 bug fix: the nested `driver: { create: ... } }` below never
 * actually set `fullName` on the Driver record it creates, even though
 * that column is required (`fullName String`, no `?`, no `@default`, see
 * prisma/schema.prisma). Every call to this function would have failed
 * outright at the database level with a missing-required-field error,
 * this is likely the actual reason adding a driver never worked, found
 * while wiring up updateDriver below and cross-checking every Prisma
 * call in this file against the real schema, the same discipline that
 * caught the prisma.staff/staffProfile mistake in Module 25.
 *
 * Module 43: every real, user-reachable validation and Supabase-failure
 * throw below converted to a `{ error?: string }` return, this was bound
 * to a plain `<form action={createDriver}>` on `/admin/drivers/new`, see
 * `components/ui/action-form.tsx`'s doc comment.
 */
export async function createDriver(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.FLEET_MANAGE);

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const agentId = String(formData.get("agentId") ?? "").trim();
  const vehicleId = String(formData.get("vehicleId") ?? "").trim();

  if (!fullName) return { error: "Full name is required." };
  if (!email) return { error: "Email is required, it's how their app account is created." };
  if (!phone) return { error: "Phone number is required." };
  if (!agentId) return { error: "Choose which agent this driver reports to." };

  const temporaryPassword = generateTemporaryPassword();

  const supabaseAdmin = createSupabaseServiceRoleClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) return { error: `Could not create the Supabase Auth account: ${error.message}` };

  const newUser = await prisma.user.create({
    data: {
      authId: data.user.id,
      email,
      phone,
      fullName,
      mustChangePassword: true,
      driver: { create: { fullName, phone, agentId } },
    },
    include: { driver: true },
  });
  if (!newUser.driver) return { error: "Driver record was not created." };
  const driver = newUser.driver;

  await writeAuditLog({
    actorUserId: user.id,
    action: "driver.create",
    entityType: "Driver",
    entityId: driver.id,
    afterState: { fullName, email, phone, agentId },
  });

  if (vehicleId) {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, include: { currentDriver: true } });
    if (vehicle) {
      await prisma.$transaction(async (tx) => {
        if (vehicle.currentDriver) {
          await closeOpenAssignment(tx, { vehicleId }, "Vehicle reassigned to a different driver");
        }
        await tx.vehicle.update({ where: { id: vehicleId }, data: { currentDriverId: driver.id } });
        await tx.driverAssignment.create({ data: { driverId: driver.id, vehicleId } });
      });
    }
  }

  // Best-effort, same reasoning as agent creation in lib/actions/staff.ts:
  // a Paystack failure here must never block the driver record itself
  // from being created, staff can retry from /admin/drivers.
  await provisionDriverCollectionAccount(driver.id, user.id);

  // Same welcome message every other account-creation path now sends,
  // see createInvestor's own comment for why the temporary password
  // itself is never included.
  await sendNotification({
    userId: newUser.id,
    type: "account_created",
    title: "Your Ultimate account is ready",
    body: "An Ultimate driver account has been created for you. Whoever set this up will share your sign-in details with you shortly.",
    channels: ["EMAIL", "SMS"],
  });

  revalidatePath("/admin/drivers");
  if (vehicleId) revalidatePath(`/admin/fleet/${vehicleId}`);
  redirect(
    `/admin/drivers/new/success?name=${encodeURIComponent(fullName)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(temporaryPassword)}`
  );
}

/**
 * Module 27: editing an existing driver's own record, added alongside the
 * equivalent for investors and staff/agents, there was previously no way
 * to fix a typo'd name, update a phone number, or move a driver to a
 * different reporting agent from the admin side once the record was
 * created. Email is only editable when this driver actually has app
 * access (`Driver.userId` set), most never do, see createDriver's doc
 * comment, editing an email that doesn't exist would be meaningless.
 * Returns `{error?}` rather than throwing, called from a Client
 * Component, not a plain form action.
 */
export async function updateDriver(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!user.permissions.has(PERMISSIONS.FLEET_MANAGE)) {
    return { error: "Your role doesn't include permission to edit drivers." };
  }

  const driverId = String(formData.get("driverId") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const agentId = String(formData.get("agentId") ?? "").trim();

  if (!driverId) return { error: "Missing driver." };
  if (!fullName) return { error: "Full name is required." };
  if (!phone) return { error: "Phone number is required." };
  if (!agentId) return { error: "Choose which agent this driver reports to." };

  const driver = await prisma.driver.findUnique({ where: { id: driverId }, include: { user: true } });
  if (!driver) return { error: "That driver no longer exists." };

  if (driver.user && email && email !== driver.user.email) {
    const existing = await prisma.user.findFirst({ where: { email, NOT: { id: driver.user.id } } });
    if (existing) return { error: "That email is already in use by another account." };

    const supabaseAdmin = createSupabaseServiceRoleClient();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(driver.user.authId, { email, email_confirm: true });
    if (error) return { error: `Could not update their sign in email: ${error.message}` };

    await prisma.user.update({ where: { id: driver.user.id }, data: { fullName, email, phone } });
  } else if (driver.user) {
    await prisma.user.update({ where: { id: driver.user.id }, data: { fullName, phone } });
  }

  await prisma.driver.update({
    where: { id: driverId },
    data: { fullName, phone, agentId },
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: "driver.update",
    entityType: "Driver",
    entityId: driverId,
    beforeState: { fullName: driver.fullName, phone: driver.phone, agentId: driver.agentId },
    afterState: { fullName, phone, agentId },
  });

  revalidatePath("/admin/drivers");
  revalidatePath(`/admin/drivers/${driverId}`);
  return {};
}

/**
 * Generates a fresh temporary password for a driver who has app access
 * (`Driver.userId` set), requested alongside the same for investors and
 * staff/agents: "admin/assigned staff should be able to manage investor,
 * agents, drivers and staff accounts this include changing their
 * password." Same shape as resetInvestorPassword in
 * lib/actions/investors.ts: a new random password set directly in
 * Supabase Auth, shown once for staff to relay, `mustChangePassword` set
 * back to true so the driver is forced through `/change-password` next
 * time they sign in. Most drivers have no app account at all (see
 * createDriver's doc comment above), those have nothing to reset.
 */
export async function resetDriverPassword(formData: FormData): Promise<{ error?: string; temporaryPassword?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!user.permissions.has(PERMISSIONS.FLEET_MANAGE)) {
    return { error: "Your role doesn't include permission to reset a driver's password." };
  }

  const driverId = String(formData.get("driverId") ?? "").trim();
  if (!driverId) return { error: "Missing driver." };

  const driver = await prisma.driver.findUnique({ where: { id: driverId }, include: { user: true } });
  if (!driver) return { error: "That driver no longer exists." };
  if (!driver.user) return { error: "This driver has no app account, there's no password to reset." };

  const temporaryPassword = generateTemporaryPassword();
  const supabaseAdmin = createSupabaseServiceRoleClient();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(driver.user.authId, { password: temporaryPassword });
  if (error) return { error: `Could not reset their password: ${error.message}` };

  await prisma.user.update({ where: { id: driver.user.id }, data: { mustChangePassword: true } });

  await writeAuditLog({
    actorUserId: user.id,
    action: "driver.password_reset",
    entityType: "User",
    entityId: driver.user.id,
  });

  return { temporaryPassword };
}

/**
 * Manual retry for a driver whose collection account failed, or was never
 * attempted.
 *
 * Module 43: this was the one sibling of retryAgentCollectionAccount
 * (lib/actions/staff.ts) and retryInvestorCollectionAccount
 * (lib/actions/investors.ts) that never actually got the Module 25 fix
 * those two received, still doing `throw new Error(result.error)` on
 * failure and crashing to Next's generic error boundary instead of
 * showing the real Paystack error. Fixed the same way as its two
 * siblings: redirect back to the same page with the message in the query
 * string, which the page now reads and shows as a banner.
 */
export async function retryDriverCollectionAccount(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.FLEET_MANAGE);

  const driverId = String(formData.get("driverId") ?? "").trim();
  if (!driverId) throw new Error("Missing driver.");

  const result = await provisionDriverCollectionAccount(driverId, user.id);
  if (!result.ok) {
    redirect(`/admin/drivers?collectionAccountError=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/admin/drivers");
  redirect("/admin/drivers");
}
