import { redirect } from "next/navigation";
import Link from "next/link";

import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ActiveFleetIcon,
  FleetIcon,
  InflowIcon,
  InvestedIcon,
  MaintenanceIcon,
  NetIcon,
  OutflowIcon,
} from "@/components/design-system/stat-icons";
import { AreaTrendChart } from "@/components/charts/area-trend-chart";
import { GlobalSearch } from "@/components/admin/global-search";
import { formatNaira } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAdminDashboardData } from "@/lib/data/admin";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const attentionTone: Record<string, { bg: string; ink: string }> = {
  bad: { bg: "var(--bad-soft)", ink: "var(--bad-ink)" },
  warn: { bg: "var(--warn-soft)", ink: "var(--warn-ink)" },
  accent: { bg: "var(--accent-soft)", ink: "var(--accent-dark)" },
};

export default async function AdminDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const data = await getAdminDashboardData();
  const firstName = user.fullName.split(" ")[0];
  const today = new Intl.DateTimeFormat("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(
    new Date()
  );

  const statCards = [
    {
      label: "Total vehicles",
      value: data.stats.totalVehicles,
      format: "count" as const,
      iconBg: "bg-accent-soft",
      iconColor: "var(--accent-dark)",
      Icon: FleetIcon,
    },
    {
      label: "Active fleet",
      value: data.stats.activeFleet,
      format: "count" as const,
      iconBg: "bg-teal-soft",
      iconColor: "var(--teal)",
      Icon: ActiveFleetIcon,
    },
    {
      label: "In maintenance",
      value: data.stats.inMaintenance,
      format: "count" as const,
      iconBg: "bg-warn-soft",
      iconColor: "var(--warn-ink)",
      Icon: MaintenanceIcon,
    },
    {
      label: "Investment value",
      value: data.stats.investmentValue,
      format: "compactNaira" as const,
      iconBg: "bg-violet-soft",
      iconColor: "var(--violet)",
      Icon: InvestedIcon,
    },
  ];

  // Module 32: money in vs. money out for the current calendar month so
  // far, agent/driver remittances against investor payouts. Added
  // alongside the fleet cards above, not replacing them, both rows stay
  // visible together. See lib/data/reports.ts and /admin/reports for the
  // full daily/per-partner breakdown behind these two numbers.
  const monthToDateNet = data.stats.monthToDateInflow - data.stats.monthToDateOutflow;
  const flowCards = [
    {
      label: "Inflow this month",
      value: data.stats.monthToDateInflow,
      format: "compactNaira" as const,
      tone: "text-good-ink",
      iconBg: "bg-good-soft",
      iconColor: "var(--good-ink)",
      Icon: InflowIcon,
    },
    {
      label: "Outflow this month",
      value: data.stats.monthToDateOutflow,
      format: "compactNaira" as const,
      tone: "text-bad-ink",
      iconBg: "bg-bad-soft",
      iconColor: "var(--bad-ink)",
      Icon: OutflowIcon,
    },
    {
      label: "Net this month",
      value: monthToDateNet,
      format: "compactNaira" as const,
      tone: monthToDateNet >= 0 ? "text-good-ink" : "text-bad-ink",
      iconBg: monthToDateNet >= 0 ? "bg-good-soft" : "bg-bad-soft",
      iconColor: monthToDateNet >= 0 ? "var(--good-ink)" : "var(--bad-ink)",
      Icon: NetIcon,
    },
  ];

  // Every fleet-status count feeds this total, including retired vehicles,
  // so the ring segments below must also cover retired, otherwise the
  // ring's colored arcs sum to less than the full circle and the center
  // total no longer matches what the ring visually shows, a real gap a
  // viewer would have noticed, not a rounding artifact.
  const total = data.fleetStatusCounts.all;
  const circumference = 439.8;
  const segments = [
    { value: data.fleetStatusCounts.active, color: "#0ca30c" },
    { value: data.fleetStatusCounts.maintenance, color: "#E0650F" },
    { value: data.fleetStatusCounts.unassigned, color: "#d03b3b" },
    { value: data.fleetStatusCounts.pending, color: "#8A8FA6" },
    { value: data.fleetStatusCounts.retired, color: "#0EA5A5" },
  ];
  let offsetAcc = 0;
  const donutSegments = segments.map((s) => {
    const length = total > 0 ? (s.value / total) * circumference : 0;
    const seg = { ...s, length, offset: -offsetAcc };
    offsetAcc += length;
    return seg;
  });

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <div>
          <div className="text-[19px] font-extrabold tracking-tight">Good morning, {firstName}</div>
          <div className="mt-0.5 text-[12.5px] text-text-soft">{today}</div>
        </div>
        <GlobalSearch />
        <div className="flex items-center gap-3.5">
          <div className="relative flex h-9.5 w-9.5 items-center justify-center rounded-xl border border-border">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 4a5 5 0 0 0-5 5v3.2c0 .5-.16 1-.46 1.4L5.3 15.5c-.6.8-.03 2 .96 2h11.5c.99 0 1.55-1.2.95-2l-1.23-1.9a2.3 2.3 0 0 1-.48-1.4V9a5 5 0 0 0-5-5Z"
                stroke="var(--text-soft)"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            <div className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full border-[1.5px] border-surface bg-bad" />
          </div>
          {user.permissions.has(PERMISSIONS.PAYMENT_BATCH_CREATE) ? (
            <Button size="sm" asChild>
              <Link href="/admin/payments/batches/new">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
                New batch
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="flex flex-col gap-4.5 px-8 py-5.5">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className="flex items-center gap-3.5 p-4">
              <div className={`flex h-10.5 w-10.5 items-center justify-center rounded-[13px] ${stat.iconBg}`}>
                <stat.Icon className="h-[19px] w-[19px]" color={stat.iconColor} strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-[11.5px] font-semibold text-text-soft">{stat.label}</div>
                <div className="mt-0.5 text-xl font-extrabold">
                  <AnimatedNumber value={stat.value} format={stat.format} />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {flowCards.map((stat) => (
            <Card key={stat.label} className="flex items-center gap-3.5 p-4">
              <div className={`flex h-10.5 w-10.5 items-center justify-center rounded-[13px] ${stat.iconBg}`}>
                <stat.Icon className="h-[19px] w-[19px]" color={stat.iconColor} strokeWidth={1.8} />
              </div>
              <div>
                <div className="text-[11.5px] font-semibold text-text-soft">{stat.label}</div>
                <div className={`mt-0.5 text-xl font-extrabold ${stat.tone}`}>
                  <AnimatedNumber value={stat.value} format={stat.format} />
                </div>
              </div>
            </Card>
          ))}
          <Link
            href="/admin/reports"
            className="flex items-center justify-center rounded-2xl border border-dashed border-border p-4 text-[12.5px] font-bold text-accent-dark hover:bg-accent-soft/40 sm:col-span-3"
          >
            View full reports, by day and by partner &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
          <Card className="p-5">
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-extrabold">Realized payments (last 8 weeks)</div>
              <span className="text-xs font-semibold text-text-faint">Weekly total</span>
            </div>
            <AreaTrendChart
              weeks={data.weeklyPayments.weeks}
              amounts={data.weeklyPayments.amounts}
              latestLabel={data.weeklyPayments.latestLabel}
              latestAmount={data.weeklyPayments.latestAmount}
              formatAmount={formatNaira}
              emptyMessage="No investor payouts recorded yet"
              gradientId="admin-payouts-area"
            />
          </Card>

          <Card className="p-5">
            <div className="mb-1.5 text-sm font-extrabold">Fleet by status</div>
            <div className="flex items-center gap-4.5">
              <svg width="132" height="132" viewBox="0 0 160 160" className="shrink-0">
                <g transform="rotate(-90 80 80)">
                  {total === 0 ? (
                    <circle cx="80" cy="80" r="70" fill="none" stroke="#E7E9E4" strokeWidth="20" />
                  ) : (
                    donutSegments.map((seg) => (
                      <circle
                        key={seg.color}
                        cx="80"
                        cy="80"
                        r="70"
                        fill="none"
                        stroke={seg.color}
                        strokeWidth="20"
                        strokeDasharray={`${seg.length} ${circumference}`}
                        strokeDashoffset={seg.offset}
                      />
                    ))
                  )}
                </g>
                <text x="80" y="76" textAnchor="middle" fontSize="26" fontWeight="800" fill="#14171A" fontFamily="Plus Jakarta Sans, sans-serif">
                  {total}
                </text>
                <text x="80" y="94" textAnchor="middle" fontSize="11" fill="#8A8F86" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="600">
                  Total vehicles
                </text>
              </svg>
              <div className="flex flex-1 flex-col gap-2.5">
                {[
                  { label: "Active", value: data.fleetStatusCounts.active, color: "#0ca30c" },
                  { label: "Maintenance", value: data.fleetStatusCounts.maintenance, color: "#E0650F" },
                  { label: "Unassigned", value: data.fleetStatusCounts.unassigned, color: "#d03b3b" },
                  { label: "Pending onboarding", value: data.fleetStatusCounts.pending, color: "#8A8FA6" },
                  { label: "Retired", value: data.fleetStatusCounts.retired, color: "#0EA5A5" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between text-[12.5px]">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <span className="h-2 w-2 rounded-full" style={{ background: row.color }} />
                      {row.label}
                    </span>
                    <span className="font-bold">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.7fr_1fr]">
          <Card className="overflow-hidden p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <div className="text-sm font-extrabold">Investors due today</div>
                <div className="mt-0.5 text-[11.5px] font-semibold text-text-faint">
                  {data.investorsDueToday.length} investor{data.investorsDueToday.length === 1 ? "" : "s"}, {formatNaira(
                    data.investorsDueToday.reduce((sum, row) => sum + row.amount, 0)
                  )} total
                </div>
              </div>
              <Link href="/admin/payments/batches" className="text-[12.5px] font-bold">
                View all &rarr;
              </Link>
            </div>
            {data.investorsDueToday.length === 0 ? (
              <div className="px-5 py-8 text-center text-[13px] text-text-soft">Nothing due today.</div>
            ) : (
              <>
                <div className="grid grid-cols-[1.6fr_1fr_1fr_0.9fr] bg-[#FAFBF9] px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">
                  <span>Investor</span>
                  <span>Vehicle</span>
                  <span>Amount due</span>
                  <span>Status</span>
                </div>
                {data.investorsDueToday.map((row, index) => (
                  <Link
                    key={row.contractId}
                    href={`/admin/contracts/${row.contractId}`}
                    className={`grid grid-cols-[1.6fr_1fr_1fr_0.9fr] items-center px-5 py-3 text-[13px] font-semibold hover:bg-background/60 ${index > 0 ? "border-t border-border" : ""}`}
                  >
                    <span>{row.investor}</span>
                    <span className="font-medium text-text-soft">{row.vehicle}</span>
                    <span className="font-bold">{formatNaira(row.amount)}</span>
                    <Badge variant={row.status === "DUE" ? "warn" : "pending"} className="w-fit">
                      {row.status === "DUE" ? "Due" : "Partial"}
                    </Badge>
                  </Link>
                ))}
              </>
            )}
          </Card>

          <Card className="p-4.5">
            <div className="mb-3 text-sm font-extrabold">Needs attention</div>
            {data.needsAttention.length === 0 ? (
              <div className="text-[12.5px] text-text-soft">All caught up, nothing needs attention right now.</div>
            ) : (
              <div className="flex flex-col gap-3.5">
                {data.needsAttention.map((item) => {
                  const row = (
                    <div className="flex items-start gap-2.5">
                      <div
                        className="mt-0.5 flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: attentionTone[item.tone].bg }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="9" stroke={attentionTone[item.tone].ink} strokeWidth="1.7" />
                          <path d="M12 8v5" stroke={attentionTone[item.tone].ink} strokeWidth="1.7" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="pt-0.5 text-[12.5px] font-semibold leading-tight">
                        {item.text}
                        {item.href ? <span className="ml-1 font-bold text-accent-dark">View &rarr;</span> : null}
                      </div>
                    </div>
                  );
                  return item.href ? (
                    <Link key={item.text} href={item.href} className="hover:opacity-80">
                      {row}
                    </Link>
                  ) : (
                    <div key={item.text}>{row}</div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
