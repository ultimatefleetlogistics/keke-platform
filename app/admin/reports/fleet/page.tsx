import { redirect } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ReportsTabs } from "@/components/admin/reports-tabs";
import { formatNaira } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getFleetProfitabilityReport } from "@/lib/data/reports";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const STATUS_VARIANT: Record<string, "good" | "warn" | "bad" | "pending" | "accent" | "neutral"> = {
  ACTIVE: "good",
  MAINTENANCE: "warn",
  UNASSIGNED: "bad",
  PENDING_ONBOARDING: "neutral",
  RETIRED: "neutral",
};

export default async function FleetProfitabilityReportPage() {
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

  const rows = await getFleetProfitabilityReport();
  const totalNetMargin = rows.reduce((sum, row) => sum + row.netMargin, 0);
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenueCollected, 0);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Fleet</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          What each vehicle has actually earned the business: collections in, investor payouts and maintenance out.
          A company profitability view, not an investor&apos;s own return, see each contract&apos;s own page for
          that.
        </div>
      </header>
      <ReportsTabs active="/admin/reports/fleet" />

      <div className="flex flex-col gap-5 px-8 py-6">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Collected across the fleet</div>
            <div className="mt-0.5 text-xl font-extrabold text-good-ink">{formatNaira(totalRevenue)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Net margin across the fleet</div>
            <div className={`mt-0.5 text-xl font-extrabold ${totalNetMargin >= 0 ? "text-good-ink" : "text-bad-ink"}`}>
              {formatNaira(totalNetMargin)}
            </div>
          </Card>
        </div>

        {rows.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-text-soft">No vehicle has a contract yet.</Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <div className="grid grid-cols-[0.8fr_0.8fr_1fr_1fr_1fr_1fr] bg-[#FAFBF9] px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">
              <span>Vehicle</span>
              <span>Status</span>
              <span>Collected</span>
              <span>Paid out</span>
              <span>Maintenance</span>
              <span>Net margin</span>
            </div>
            {rows.map((row, index) => (
              <Link
                key={row.vehicleId}
                href={`/admin/fleet/${row.vehicleId}`}
                className={`grid grid-cols-[0.8fr_0.8fr_1fr_1fr_1fr_1fr] items-center px-5 py-3 text-[13px] font-semibold hover:bg-background/60 ${index > 0 ? "border-t border-border" : ""}`}
              >
                <span>{row.assetTag}</span>
                <Badge variant={STATUS_VARIANT[row.status] ?? "neutral"} className="w-fit">
                  {row.status.replace(/_/g, " ").toLowerCase()}
                </Badge>
                <span className="text-good-ink">{formatNaira(row.revenueCollected)}</span>
                <span className="text-bad-ink">{formatNaira(row.payoutsMade)}</span>
                <span className="text-text-soft">{row.maintenanceCost > 0 ? formatNaira(row.maintenanceCost) : "-"}</span>
                <span className={row.netMargin >= 0 ? "text-good-ink" : "text-bad-ink"}>
                  {formatNaira(row.netMargin)}
                </span>
              </Link>
            ))}
          </Card>
        )}
      </div>
    </>
  );
}
