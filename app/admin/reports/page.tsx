import { redirect } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AreaTrendChart } from "@/components/charts/area-trend-chart";
import { ReportsTabs } from "@/components/admin/reports-tabs";
import { formatNaira } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { defaultReportsRange, getReportsData } from "@/lib/data/reports";
import { PERMISSIONS } from "@/lib/rbac/permissions";

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses a `?from=`/`?to=` searchParam string (yyyy-mm-dd from a date input) into midnight of that day, or null if missing/invalid. */
function parseDateParam(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const kindBadge: Record<string, "accent" | "neutral" | "pending"> = {
  Agent: "accent",
  Driver: "neutral",
  Investor: "pending",
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
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

  const params = await searchParams;
  const defaults = defaultReportsRange();
  const from = parseDateParam(params.from) ?? defaults.from;
  const to = parseDateParam(params.to) ?? defaults.to;

  const data = await getReportsData({ from, to });
  const isDefaultRange = !params.from && !params.to;

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Reports</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Money in and money out across the whole platform, agent and driver remittances against investor payouts,
          traceable down to the day.
        </div>
      </header>
      <ReportsTabs active="/admin/reports" />

      <div className="flex flex-col gap-5 px-8 py-6">
        <form method="get" className="flex flex-wrap items-end gap-2.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">From</label>
            <Input type="date" name="from" defaultValue={toDateInputValue(from)} className="w-44" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">To</label>
            <Input type="date" name="to" defaultValue={toDateInputValue(to)} className="w-44" />
          </div>
          <Button type="submit" size="sm" variant="outline">
            Filter
          </Button>
          {isDefaultRange ? null : (
            <Button asChild size="sm" variant="ghost">
              <a href="/admin/reports">Reset to last 30 days</a>
            </Button>
          )}
        </form>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Total inflow</div>
            <div className="mt-0.5 text-xl font-extrabold text-good-ink">{formatNaira(data.summary.totalInflow)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Total outflow</div>
            <div className="mt-0.5 text-xl font-extrabold text-bad-ink">{formatNaira(data.summary.totalOutflow)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Net</div>
            <div className={`mt-0.5 text-xl font-extrabold ${data.summary.net >= 0 ? "text-good-ink" : "text-bad-ink"}`}>
              {formatNaira(data.summary.net)}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Transactions</div>
            <div className="mt-0.5 text-xl font-extrabold">{data.summary.transactionCount}</div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-extrabold">Inflow by day</div>
              <span className="text-xs font-semibold text-text-faint">Agent & driver remittances</span>
            </div>
            <AreaTrendChart
              weeks={data.daily.days}
              amounts={data.daily.inflow}
              latestLabel={data.daily.latestLabel}
              latestAmount={data.daily.latestInflow}
              formatAmount={formatNaira}
              emptyMessage="No inflow recorded in this range"
              gradientId="reports-inflow-area"
              accentColor="#0ca30c"
            />
          </Card>
          <Card className="p-5">
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-extrabold">Outflow by day</div>
              <span className="text-xs font-semibold text-text-faint">Investor payouts</span>
            </div>
            <AreaTrendChart
              weeks={data.daily.days}
              amounts={data.daily.outflow}
              latestLabel={data.daily.latestLabel}
              latestAmount={data.daily.latestOutflow}
              formatAmount={formatNaira}
              emptyMessage="No outflow recorded in this range"
              gradientId="reports-outflow-area"
              accentColor="#d03b3b"
            />
          </Card>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4">
            <div className="text-sm font-extrabold">Daily trace</div>
            <div className="mt-0.5 text-[11.5px] font-semibold text-text-faint">
              Every day in the selected range, oldest first, so a specific day&apos;s inflow and outflow can be
              looked up directly.
            </div>
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr] bg-[#FAFBF9] px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">
            <span>Day</span>
            <span>Inflow</span>
            <span>Outflow</span>
            <span>Net</span>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {data.daily.days.map((day, index) => {
              const dayInflow = data.daily.inflow[index] ?? 0;
              const dayOutflow = data.daily.outflow[index] ?? 0;
              const dayNet = dayInflow - dayOutflow;
              return (
                <div
                  key={`${day}-${index}`}
                  className={`grid grid-cols-[1fr_1fr_1fr_1fr] items-center px-5 py-3 text-[13px] font-semibold ${index > 0 ? "border-t border-border" : ""}`}
                >
                  <span>{day}</span>
                  <span className="text-good-ink">{dayInflow > 0 ? formatNaira(dayInflow) : "-"}</span>
                  <span className="text-bad-ink">{dayOutflow > 0 ? formatNaira(dayOutflow) : "-"}</span>
                  <span className={dayNet >= 0 ? "text-good-ink" : "text-bad-ink"}>{formatNaira(dayNet)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4">
            <div className="text-sm font-extrabold">By partner</div>
            <div className="mt-0.5 text-[11.5px] font-semibold text-text-faint">
              Agents and drivers who remitted money in, investors who were paid money out, in the selected range.
              Click a row for that account&apos;s full statement and to export it.
            </div>
          </div>
          {data.partners.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-text-soft">No transactions in this range.</div>
          ) : (
            <>
              <div className="grid grid-cols-[0.5fr_1.3fr_1fr_1fr_1fr] bg-[#FAFBF9] px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">
                <span>Type</span>
                <span>Name</span>
                <span>Inflow</span>
                <span>Outflow</span>
                <span>Net</span>
              </div>
              {data.partners.map((row, index) => (
                <Link
                  key={row.key}
                  href={`/admin/reports/partner/${row.kindPath}/${row.id}`}
                  className={`grid grid-cols-[0.5fr_1.3fr_1fr_1fr_1fr] items-center px-5 py-3 text-[13px] font-semibold hover:bg-background/60 ${index > 0 ? "border-t border-border" : ""}`}
                >
                  <Badge variant={kindBadge[row.kind]} className="w-fit">
                    {row.kind}
                  </Badge>
                  <span>{row.name}</span>
                  <span className="text-good-ink">{row.inflow > 0 ? formatNaira(row.inflow) : "-"}</span>
                  <span className="text-bad-ink">{row.outflow > 0 ? formatNaira(row.outflow) : "-"}</span>
                  <span className={row.net >= 0 ? "text-good-ink" : "text-bad-ink"}>{formatNaira(row.net)}</span>
                </Link>
              ))}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
