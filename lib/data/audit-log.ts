import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 100;

/**
 * Every distinct entityType any AuditLog row has ever used, for the filter
 * dropdown on /admin/audit-log. Built from the data itself rather than a
 * hard-coded list, so a new call site's entityType shows up here without
 * this file needing a change.
 */
export async function getAuditLogEntityTypes() {
  const rows = await prisma.auditLog.findMany({
    distinct: ["entityType"],
    select: { entityType: true },
    orderBy: { entityType: "asc" },
  });
  return rows.map((r) => r.entityType);
}

/**
 * The most recent audit entries, newest first, optionally narrowed to one
 * entityType. Capped at 100 rather than paginated, this table has no
 * write path except staff decisions that are already individually
 * gated behind a permission, so volume stays low compared to, say,
 * PaymentTransaction.
 */
export async function getAuditLogEntries(filter?: { entityType?: string }) {
  const entries = await prisma.auditLog.findMany({
    where: filter?.entityType ? { entityType: filter.entityType } : undefined,
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    include: { actor: true },
  });

  return entries.map((entry) => ({
    id: entry.id,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    actorName: entry.actor.fullName,
    actorEmail: entry.actor.email,
    beforeState: entry.beforeState !== null ? JSON.stringify(entry.beforeState, null, 2) : null,
    afterState: entry.afterState !== null ? JSON.stringify(entry.afterState, null, 2) : null,
    createdAt: entry.createdAt.toISOString(),
  }));
}
