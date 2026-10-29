"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/rbac/check-permission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { writeAuditLog } from "@/lib/audit";

/**
 * Mutations behind the RBAC settings screen. Every one of these requires
 * PERMISSIONS.RBAC_MANAGE, and every one that touches a role first checks
 * `isSystem`, the seeded "Admin" role can have members added or removed
 * (someone has to be able to make, or stop being, an admin) but its
 * permission set and its own existence are locked, so there is never a
 * path, accidental or otherwise, to an app with zero people able to grant
 * access.
 *
 * Module 43: every real, user-reachable validation throw below (a blank
 * role name, a duplicate name, a system-role guard, "choose someone,"
 * "at least one admin must remain") converted to a `{ error?: string }`
 * return, these were bound to plain `<form action={fn}>`s on
 * `/admin/settings/roles/new` and `/admin/settings/roles/[id]`, see
 * `components/ui/action-form.tsx`'s doc comment. `requireRbacManage`'s own
 * throws are left as is, matching this codebase's convention: reaching
 * this action at all without the permission needs a bypassed request, the
 * real UI never shows these forms to an account that lacks it.
 */

async function requireRbacManage() {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.RBAC_MANAGE);
  return user;
}

export async function createRole(formData: FormData): Promise<{ error?: string } | void> {
  const user = await requireRbacManage();

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!name) return { error: "Give the role a name." };

  const existing = await prisma.role.findUnique({ where: { name } });
  if (existing) return { error: `A role named "${name}" already exists.` };

  const role = await prisma.role.create({
    data: { name, description: description || null, isSystem: false },
  });
  await writeAuditLog({
    actorUserId: user.id,
    action: "role.create",
    entityType: "Role",
    entityId: role.id,
    afterState: { name: role.name, description: role.description },
  });

  revalidatePath("/admin/settings/roles");
  redirect(`/admin/settings/roles/${role.id}`);
}

export async function deleteRole(formData: FormData): Promise<{ error?: string } | void> {
  const user = await requireRbacManage();

  const roleId = String(formData.get("roleId") ?? "");
  const role = await prisma.role.findUniqueOrThrow({
    where: { id: roleId },
    include: { _count: { select: { assignments: true } } },
  });

  if (role.isSystem) return { error: `"${role.name}" is a system role and can't be deleted.` };
  if (role._count.assignments > 0) {
    return { error: `Remove everyone assigned to "${role.name}" before deleting it.` };
  }

  await prisma.role.delete({ where: { id: roleId } });
  await writeAuditLog({
    actorUserId: user.id,
    action: "role.delete",
    entityType: "Role",
    entityId: roleId,
    beforeState: { name: role.name, description: role.description },
  });

  revalidatePath("/admin/settings/roles");
  redirect("/admin/settings/roles");
}

/**
 * Grants or revokes a single permission on a role. Each row in the
 * permission matrix is its own tiny form (see
 * app/admin/settings/roles/[id]/page.tsx) posting here with the current
 * state, rather than one big form for the whole matrix, so a toggle takes
 * effect immediately instead of needing a separate "save" step someone can
 * forget.
 */
export async function toggleRolePermission(formData: FormData): Promise<{ error?: string } | void> {
  const user = await requireRbacManage();

  const roleId = String(formData.get("roleId") ?? "");
  const permissionId = String(formData.get("permissionId") ?? "");
  const nextState = String(formData.get("nextState") ?? "");

  const role = await prisma.role.findUniqueOrThrow({ where: { id: roleId } });
  if (role.isSystem) return { error: `"${role.name}" is a system role, its permissions can't be changed.` };

  if (nextState === "grant") {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId } },
      update: {},
      create: { roleId, permissionId },
    });
  } else {
    await prisma.rolePermission.deleteMany({ where: { roleId, permissionId } });
  }
  await writeAuditLog({
    actorUserId: user.id,
    action: "role_permission.toggle",
    entityType: "Role",
    entityId: roleId,
    afterState: { permissionId, nextState },
  });

  revalidatePath(`/admin/settings/roles/${roleId}`);
}

export async function assignRole(formData: FormData): Promise<{ error?: string } | void> {
  const user = await requireRbacManage();

  const roleId = String(formData.get("roleId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  if (!userId) return { error: "Choose someone to assign this role to." };

  await prisma.roleAssignment.upsert({
    where: { userId_roleId: { userId, roleId } },
    update: {},
    create: { userId, roleId },
  });
  await writeAuditLog({
    actorUserId: user.id,
    action: "role_assignment.create",
    entityType: "Role",
    entityId: roleId,
    afterState: { assignedUserId: userId },
  });

  revalidatePath(`/admin/settings/roles/${roleId}`);
}

export async function removeRoleAssignment(formData: FormData): Promise<{ error?: string } | void> {
  const user = await requireRbacManage();

  const assignmentId = String(formData.get("assignmentId") ?? "");
  const roleId = String(formData.get("roleId") ?? "");

  const assignment = await prisma.roleAssignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { role: true },
  });

  if (assignment.role.isSystem) {
    const remainingAdmins = await prisma.roleAssignment.count({ where: { roleId: assignment.roleId } });
    if (remainingAdmins <= 1) {
      return { error: "Can't remove the last member of the Admin role, at least one admin must remain." };
    }
  }

  await prisma.roleAssignment.delete({ where: { id: assignmentId } });
  await writeAuditLog({
    actorUserId: user.id,
    action: "role_assignment.remove",
    entityType: "Role",
    entityId: roleId,
    beforeState: { removedUserId: assignment.userId },
  });

  revalidatePath(`/admin/settings/roles/${roleId}`);
}
