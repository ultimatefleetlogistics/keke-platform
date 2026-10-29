import { redirect } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ReportsTabs } from "@/components/admin/reports-tabs";
import { formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPortfolioProgressReport } from "@/lib/data/reports";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const STATUS_VARIANT: Record<string, "good" | "warn" | "bad" | "pending" | "accent" | "neutral"> = {
  ACTIVE: "good",
  TARGET_ACHIEVED: "accent",
  TRANSFER_IN_PROGRESS: "pending",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  TARGET_ACHIEVED: "Target achieved",
  TRANSFER_IN_PROGRESS: "Transfer in progress",
};

export default async function PortfolioReportPage() {
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

  const rows = await getPortfolioProgressReport();
  const behindCount = rows.filter((row) => row.overdueCount > 0).length;

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Portfolio</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Every open contract&apos;s progress toward its target payout, and how many of its scheduled installments
          are currently overdue. Contracts with overdue installments, then the least progress, sort to the top.
        </div>
      </header>
      <ReportsTabs active="/admin/reports/portfolio" />

      <div className="flex flex-col gap-5 px-8 py-6">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Open contracts</div>
            <div className="mt-0.5 text-xl font-extrabold">{rows.length}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">With overdue installments</div>
            <div className={`mt-0.5 text-xl font-extrabold ${behindCount > 0 ? "text-bad-ink" : "text-good-ink"}`}>
              {behindCount}
            </div>
          </Card>
        </div>

        {rows.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-text-soft">No open contracts yet.</Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="grid grid-cols-[1.2fr_1fr_1fr_1.4fr_0.8fr_1fr] bg-[#FAFBF9] px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">
              <span>Investor</span>
              <span>Vehicle</span>
              <span>Status</span>
              <span>Progress</span>
              <span>Overdue</span>
              <span>Started</span>
            </div>
            {rows.map((row, index) => (
              <Link
                key={row.contractId}
                href={`/admin/contracts/${row.contractId}`}
                className={`grid grid-cols-[1.2fr_1fr_1fr_1.4fr_0.8fr_1fr] items-center px-5 py-3 text-[13px] font-semibold hover:bg-background/60 ${index > 0 ? "border-t border-border" : ""}`}
              >
                <span>{row.investorName}</span>
                <span className="text-text-soft">{row.vehicleAssetTag}</span>
                <Badge variant={STATUS_VARIANT[row.status] ?? "neutral"} className="w-fit">
                  {STATUS_LABEL[row.status] ?? row.status}
                </Badge>
                <div className="flex items-center gap-2.5 pr-3">
                  <Progress value={row.percentComplete} className="flex-1" />
                  <span className="w-11 shrink-0 text-right text-[12px] text-text-soft">
                    {row.percentComplete.toFixed(0)}%
                  </span>
                </div>
                {row.overdueCount > 0 ? (
                  <Badge variant="bad" className="w-fit">
                    {row.overdueCount}
                  </Badge>
                ) : (
                  <span className="text-text-faint">-</span>
                )}
                <span className="text-text-soft">{row.startDate ? formatDate(row.startDate) : "-"}</span>
              </Link>
            ))}
          </Card>
        )}

        <div className="text-[11.5px] text-text-faint">
          Click a row for that contract&apos;s full detail, including its principal and target payout amounts.
        </div>
      </div>
    </>
  );
}
