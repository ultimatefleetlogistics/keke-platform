import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ReportsTabs } from "@/components/admin/reports-tabs";
import { formatDate, formatNaira } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getArrearsReport } from "@/lib/data/reports";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const STATUS_LABEL: Record<string, string> = {
  DUE: "Due",
  PARTIALLY_PAID: "Partial",
  DEFERRED: "Deferred",
};

export default async function ArrearsReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.REPORTS_VIEW)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-20 text-center">
        <div className="text-lg font-extrabold">No access</div>
        <div className="max-w-sm text-[13.5px] text-text-soft">
          Your role doesn&apos;t include permission to view reports.
        </div>
      </div>
    );
  }

  const { rows, byAgent } = await getArrearsReport();
  const totalOutstanding = rows.reduce((sum, row) => sum + row.amountOutstanding, 0);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Arrears</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Every scheduled installment currently overdue, not just due today, attributed to whichever agent
          currently runs the vehicle, oldest first.
        </div>
      </header>
      <ReportsTabs active="/admin/reports/arrears" />

      <div className="flex flex-col gap-5 px-8 py-6">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Overdue installments</div>
            <div className={`mt-0.5 text-xl font-extrabold ${rows.length > 0 ? "text-bad-ink" : "text-good-ink"}`}>
              {rows.length}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Total outstanding</div>
            <div className={`mt-0.5 text-xl font-extrabold ${totalOutstanding > 0 ? "text-bad-ink" : "text-good-ink"}`}>
              {formatNaira(totalOutstanding)}
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4">
            <div className="text-sm font-extrabold">By agent</div>
            <div className="mt-0.5 text-[11.5px] font-semibold text-text-faint">
              Who to follow up with first, ranked by how much is currently outstanding under them.
            </div>
          </div>
          {byAgent.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-text-soft">Nothing overdue right now.</div>
          ) : (
            <>
              <div className="grid grid-cols-[1.5fr_1fr_1fr] bg-[#FAFBF9] px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">
                <span>Agent</span>
                <span>Overdue installments</span>
                <span>Outstanding</span>
              </div>
              {byAgent.map((row, index) => (
                <div
                  key={row.agentKey}
                  className={`grid grid-cols-[1.5fr_1fr_1fr] items-center px-5 py-3 text-[13px] font-semibold ${index > 0 ? "border-t border-border" : ""}`}
                >
                  <span>{row.agentName}</span>
                  <span>{row.entryCount}</span>
                  <span className="text-bad-ink">{formatNaira(row.totalOutstanding)}</span>
                </div>
              ))}
            </>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4">
            <div className="text-sm font-extrabold">Every overdue installment</div>
          </div>
          {rows.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-text-soft">Nothing overdue right now.</div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_1fr_1fr_0.9fr_1fr_1fr_0.8fr] bg-[#FAFBF9] px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">
                <span>Agent</span>
                <span>Investor</span>
                <span>Vehicle</span>
                <span>Due date</span>
                <span>Days overdue</span>
                <span>Outstanding</span>
                <span>Status</span>
              </div>
              {rows.map((row, index) => (
                <div
                  key={row.scheduleEntryId}
                  className={`grid grid-cols-[1fr_1fr_1fr_0.9fr_1fr_1fr_0.8fr] items-center px-5 py-3 text-[13px] font-semibold ${index > 0 ? "border-t border-border" : ""}`}
                >
                  <span>{row.agentName ?? "Unassigned"}</span>
                  <span className="text-text-soft">{row.investorName}</span>
                  <span className="text-text-soft">{row.vehicleAssetTag}</span>
                  <span>{formatDate(row.dueDate)}</span>
                  <span className="text-bad-ink">{row.daysOverdue}</span>
                  <span>{formatNaira(row.amountOutstanding)}</span>
                  <Badge variant="warn" className="w-fit">
                    {STATUS_LABEL[row.status] ?? row.status}
                  </Badge>
                </div>
              ))}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
