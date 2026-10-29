import { prisma } from "@/lib/prisma";

/**
 * Every staff account, for /admin/settings/staff. Investors, drivers, and
 * agents are deliberately excluded, same reasoning as getAssignableUsers
 * in lib/data/rbac.ts, they get access through their own portals or their
 * own admin screen, never through this one. Agents used to be listed
 * alongside staff here; Module 51 split them out to lib/data/agents.ts
 * and /admin/agents, since an agent has fleet, drivers, and remittances
 * behind it that a staff account never has, and there was nowhere on the
 * combined screen to actually show any of that.
 */
export async function getStaff() {
  const users = await prisma.user.findMany({
    where: { staff: { isNot: null } },
    include: {
      staff: true,
      roleAssignments: { include: { role: true } },
    },
    orderBy: { fullName: "asc" },
  });

  return users.map((u) => ({
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    jobTitle: u.staff?.jobTitle ?? "No job title set",
    roles: u.roleAssignments.map((assignment) => assignment.role.name),
    isActive: u.isActive,
  }));
}

/** One staff account's own editable details, for /admin/settings/staff/[id]. */
export async function getStaffById(userId: string) {
  const account = await prisma.user.findUnique({
    where: { id: userId },
    include: { staff: true, roleAssignments: { include: { role: true } } },
  });
  if (!account || !account.staff) return null;

  return {
    id: account.id,
    fullName: account.fullName,
    email: account.email,
    phone: account.phone,
    jobTitle: account.staff.jobTitle ?? "",
    roles: account.roleAssignments.map((assignment) => assignment.role.name),
  };
}
