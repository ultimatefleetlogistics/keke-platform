import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAuditLogEntries, getAuditLogEntityTypes } from "@/lib/data/audit-log";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const SELECT_CLASS =
  "flex h-10 w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-[13px] text-text outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft sm:w-56";

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ entityType?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.AUDIT_LOG_VIEW)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-20 text-center">
        <div className="text-lg font-extrabold">No access</div>
        <div className="max-w-sm text-[13.5px] text-text-soft">
          Your role doesn&apos;t include permission to view the audit log.
        </div>
      </div>
    );
  }

  const { entityType } = await searchParams;

  const [entries, entityTypes] = await Promise.all([
    getAuditLogEntries(entityType ? { entityType } : undefined),
    getAuditLogEntityTypes(),
  ]);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Audit log</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Every approval, rejection, role change, and delete a staff member has made, most recent first. Only the
          decisions this app already gates behind a permission are recorded here, not every read or page view.
        </div>
      </header>

      <div className="flex flex-col gap-5 px-8 py-6">
        <form method="get" className="flex flex-wrap items-end gap-2.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Entity type</label>
            <select name="entityType" defaultValue={entityType ?? ""} className={SELECT_CLASS}>
              <option value="">All</option>
              {entityTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" size="sm" variant="outline">
            Filter
          </Button>
          {entityType ? (
            <Button asChild size="sm" variant="ghost">
              <a href="/admin/audit-log">Clear</a>
            </Button>
          ) : null}
        </form>

        {entries.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-text-soft">
            {entityType ? `No audit entries for "${entityType}" yet.` : "No audit entries recorded yet."}
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="flex flex-col">
              {entries.map((entry, index) => (
                <div
                  key={entry.id}
                  className={`flex flex-wrap items-start justify-between gap-3 px-5 py-3.5 text-[13px] ${index > 0 ? "border-t border-border" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">{entry.action}</Badge>
                      <span className="font-semibold">{entry.actorName}</span>
                    </div>
                    <div className="mt-0.5 text-[12px] text-text-faint">
                      {entry.entityType} · {entry.entityId} · {entry.actorEmail} · {formatDateTime(entry.createdAt)}
                    </div>
                  </div>
                  {entry.beforeState || entry.afterState ? (
                    <details className="text-[12px]">
                      <summary className="cursor-pointer font-semibold text-accent-dark">Details</summary>
                      <div className="mt-2 flex max-w-[420px] flex-col gap-2">
                        {entry.beforeState ? (
                          <div>
                            <div className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">Before</div>
                            <pre className="mt-1 overflow-x-auto rounded-xl bg-background p-3 text-[11px] leading-4 text-text-soft">
                              {entry.beforeState}
                            </pre>
                          </div>
                        ) : null}
                        {entry.afterState ? (
                          <div>
                            <div className="text-[10.5px] font-bold uppercase tracking-wide text-text-faint">After</div>
                            <pre className="mt-1 overflow-x-auto rounded-xl bg-background p-3 text-[11px] leading-4 text-text-soft">
                              {entry.afterState}
                            </pre>
                          </div>
                        ) : null}
                      </div>
                    </details>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
