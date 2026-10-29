import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/rbac/permissions";

/**
 * Read side of the RBAC settings screen (app/admin/settings/roles). Roles,
 * permissions, and who holds which role all live in the database (see the
 * Role/Permission/RolePermission/RoleAssignment models), this file is the
 * only place that shapes that data for the UI, mutations live in
 * lib/actions/rbac.ts.
 */

const TOTAL_PERMISSION_COUNT = Object.values(PERMISSIONS).length;

export async function getRolesOverview() {
  const roles = await prisma.role.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { permissions: true, assignments: true } },
    },
  });

  return roles.map((role) => ({
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    // Module 51: a system role's real, enforced permission set is now
    // always the full PERMISSIONS catalog (see the isSystem check added
    // to getUserPermissions in lib/rbac/check-permission.ts), whatever
    // its actual RolePermission junction rows say, that's the whole
    // point of the fix, a database that was seeded before a new
    // permission existed no longer matters for authorization. This list
    // is what an admin sees on the roles screen, so it needs to agree
    // with that, not with a junction-row count that can now be stale by
    // design without being a bug.
    permissionCount: role.isSystem ? TOTAL_PERMISSION_COUNT : role._count.permissions,
    memberCount: role._count.assignments,
  }));
}

/**
 * Groups the flat permission catalog by the part of the key before the
 * first dot ("payments.batch.create" -> "payments"), purely to keep the
 * matrix on the role detail page from being one long undifferentiated
 * list, this grouping has no meaning to the authorization checks
 * themselves.
 */
function groupKey(permissionKey: string) {
  return permissionKey.split(".")[0];
}

const GROUP_LABELS: Record<string, string> = {
  investors: "Investors",
  kyc: "KYC",
  fleet: "Fleet",
  contracts: "Contracts",
  payments: "Payments",
  transfer: "Ownership transfers",
  wallet: "Wallet",
  maintenance: "Maintenance",
  staff: "Staff & agent accounts",
  rbac: "Roles & permissions",
  settings: "Settings",
  audit: "Audit log",
};

export async function getRoleDetail(roleId: string) {
  const [role, allPermissions] = await Promise.all([
    prisma.role.findUnique({
      where: { id: roleId },
      include: {
        permissions: { select: { permissionId: true } },
        assignments: { include: { user: true }, orderBy: { createdAt: "asc" } },
      },
    }),
    prisma.permission.findMany({ orderBy: { key: "asc" } }),
  ]);

  if (!role) return null;

  const grantedIds = new Set(role.permissions.map((p) => p.permissionId));

  const groups = new Map<string, { key: string; label: string; permissions: { id: string; key: string; description: string; granted: boolean }[] }>();
  for (const permission of allPermissions) {
    const key = groupKey(permission.key);
    if (!groups.has(key)) {
      groups.set(key, { key, label: GROUP_LABELS[key] ?? key, permissions: [] });
    }
    groups.get(key)!.permissions.push({
      id: permission.id,
      key: permission.key,
      description: permission.description,
      granted: grantedIds.has(permission.id),
    });
  }

  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissionGroups: Array.from(groups.values()),
    members: role.assignments.map((assignment) => ({
      assignmentId: assignment.id,
      userId: assignment.user.id,
      fullName: assignment.user.fullName,
      email: assignment.user.email,
    })),
  };
}

/**
 * Everyone eligible to hold a staff-side role: users with a staff or agent
 * profile. Investors and drivers are deliberately excluded, they are
 * granted access through their own portals, never through this screen.
 * Filters out anyone already assigned this specific role, so the "assign"
 * dropdown never offers someone who already holds it.
 */
export async function getAssignableUsers(roleId: string) {
  const [users, existingAssignments] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ staff: { isNot: null } }, { agent: { isNot: null } }] },
      orderBy: { fullName: "asc" },
    }),
    prisma.roleAssignment.findMany({ where: { roleId }, select: { userId: true } }),
  ]);

  const alreadyAssigned = new Set(existingAssignments.map((a) => a.userId));
  return users.filter((u) => !alreadyAssigned.has(u.id)).map((u) => ({ id: u.id, fullName: u.fullName, email: u.email }));
}
