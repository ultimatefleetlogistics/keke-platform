import { prisma } from "@/lib/prisma";
import { PERMISSIONS, type PermissionKey } from "@/lib/rbac/permissions";

/**
 * Loads every permission key granted to a user, across all of their role
 * assignments. This is the one place that reads the database-driven RBAC
 * tables, every other permission check in the app should call
 * requirePermission below rather than querying roles directly.
 *
 * Module 51 fix: a role with `isSystem: true` (currently only "Admin")
 * is documented, and shown in the UI, as always holding every
 * permission, see DEFAULT_ROLE_SEED in lib/rbac/permissions.ts ("Admin:
 * Object.values(PERMISSIONS)") and the "This is a system role, it
 * always holds every permission and can't be edited" copy on
 * app/admin/settings/roles/[id]/page.tsx. Before this fix that was only
 * ever true at the moment `npx prisma db seed` last ran: the actual
 * authorization check below read RolePermission junction rows like any
 * other role, so a permission added to the PERMISSIONS catalog after a
 * database's last reseed was silently missing from the real Admin
 * account's granted set, even though the settings screen kept showing
 * every permission as "Granted" regardless. That is exactly what
 * happened for real this round: `transfer.verify`/`transfer.approve`
 * existed in the catalog and in the seed script, but the project
 * owner's actual database had never linked them to their Admin role
 * (most likely seeded before ownership transfers existed, and never
 * reseeded since), so a real signed-in Admin hit "Your role doesn't
 * include permission to view ownership transfers." Re-running
 * `npx prisma db seed` fixes any one database's existing drift, but
 * does not stop the same gap from reopening the next time a permission
 * is added to the catalog without a reseed. Checking `isSystem` here
 * closes it for good: a system role's permission set is now computed
 * from the fixed PERMISSIONS catalog directly, the same source
 * DEFAULT_ROLE_SEED itself reads from, rather than from junction rows
 * that can drift out of sync with it.
 */
export async function getUserPermissions(userId: string): Promise<Set<string>> {
  const assignments = await prisma.roleAssignment.findMany({
    where: { userId },
    include: { role: { include: { permissions: { include: { permission: true } } } } },
  });

  if (assignments.some((assignment: { role: { isSystem: boolean } }) => assignment.role.isSystem)) {
    return new Set(Object.values(PERMISSIONS));
  }

  const keys = new Set<string>();
  for (const assignment of assignments) {
    for (const rolePermission of assignment.role.permissions) {
      keys.add(rolePermission.permission.key);
    }
  }
  return keys;
}

/**
 * True if this user holds a system role (currently only "Admin" is
 * marked isSystem: true). Used to separate the owner-tier admin sign-in
 * page from the regular one, see app/admin/sign-in/page.tsx, this is a
 * stronger check than any single permission since it means "holds the
 * one role that can't be edited or deleted," not just "happens to have a
 * lot of permissions."
 */
export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const assignment = await prisma.roleAssignment.findFirst({
    where: { userId, role: { isSystem: true } },
  });
  return Boolean(assignment);
}

export class ForbiddenError extends Error {
  constructor(permission: string) {
    super(`Missing required permission: ${permission}`);
    this.name = "ForbiddenError";
  }
}

/**
 * Throws if the user does not hold the given permission. Every Route
 * Handler and Server Action that performs a sensitive mutation (creating a
 * payment batch, approving a transfer, editing RBAC) must call this before
 * doing any work, even though the UI also hides the corresponding button.
 * The UI check is for a good experience, this check is the real gate.
 */
export async function requirePermission(userId: string, permission: PermissionKey) {
  const permissions = await getUserPermissions(userId);
  if (!permissions.has(permission)) {
    throw new ForbiddenError(permission);
  }
}

/**
 * Segregation of duties helper: confirms that the given user is not the
 * same user who performed a prior action on the same entity. Used, for
 * example, to stop whoever created a payment batch from also approving it.
 */
export function assertDifferentActor(firstActorUserId: string, secondActorUserId: string, actionLabel: string) {
  if (firstActorUserId === secondActorUserId) {
    throw new ForbiddenError(`${actionLabel}: the approver must be different from the creator`);
  }
}
