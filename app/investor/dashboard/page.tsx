import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AreaTrendChart } from "@/components/charts/area-trend-chart";
import { VehicleAllocationChart } from "@/components/charts/vehicle-allocation-chart";
import { InvestedIcon, OutstandingIcon, PortfolioIcon, RealizedIcon } from "@/components/design-system/stat-icons";
import { VehicleTypeIllustration } from "@/components/design-system/vehicle-illustrations";
import { formatNaira, formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getInvestorDashboardData } from "@/lib/data/investor";
import { VEHICLE_TYPE_LABELS } from "@/lib/vehicle-types";

const FREQUENCY_LABEL: Record<string, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Biweekly",
  MONTHLY: "Monthly",
};

export default async function InvestorDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (!user.investor) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-9 py-20 text-center">
        <div className="text-lg font-extrabold">No investor profile yet</div>
        <div className="max-w-sm text-[13.5px] text-text-soft">
          Your account isn&apos;t linked to an investor profile yet. Complete identity verification to get started.
        </div>
        <Button asChild>
          <a href="/kyc">Start verification</a>
        </Button>
      </div>
    );
  }

  const data = await getInvestorDashboardData(user.investor);
  const firstName = user.fullName.split(" ")[0];

  const statCards = [
    {
      label: "Total invested",
      value: data.stats.totalInvested,
      iconBg: "bg-accent-soft",
      iconColor: "var(--accent-dark)",
      Icon: InvestedIcon,
    },
    {
      label: "Total realized",
      value: data.stats.totalRealized,
      iconBg: "bg-teal-soft",
      iconColor: "var(--teal)",
      Icon: RealizedIcon,
    },
    {
      label: "Outstanding",
      value: data.stats.outstanding,
      iconBg: "bg-rose-soft",
      iconColor: "var(--rose)",
      Icon: OutstandingIcon,
    },
  ];

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-9 py-5.5">
        <div>
          <div className="text-xl font-extrabold tracking-tight">Good afternoon, {firstName}</div>
          <div className="mt-0.5 text-[13px] text-text-soft">Here&apos;s how your investments are performing</div>
        </div>
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
          <Badge variant={user.investor.kycStatus === "VERIFIED" ? "good" : "warn"}>
            {user.investor.kycStatus === "VERIFIED" ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="m5 12 5 5L20 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : null}
            {user.investor.kycStatus === "VERIFIED"
              ? "KYC Verified"
              : user.investor.kycStatus === "PENDING_REVIEW"
                ? "KYC Pending review"
                : "KYC Not started"}
          </Badge>
        </div>
      </header>

      <div className="flex flex-col gap-5.5 px-9 py-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className="p-5">
              <div className={`flex h-10.5 w-10.5 items-center justify-center rounded-[13px] ${stat.iconBg}`}>
                <stat.Icon className="h-5 w-5" color={stat.iconColor} strokeWidth={1.8} />
              </div>
              <div className="mt-3 text-xs font-semibold text-text-soft">{stat.label}</div>
              <div className="mt-0.5 text-[22px] font-extrabold">{formatNaira(stat.value)}</div>
            </Card>
          ))}
          <Card className="p-5">
            <div className="flex h-10.5 w-10.5 items-center justify-center rounded-[13px] bg-violet-soft">
              <PortfolioIcon className="h-5 w-5" color="var(--violet)" strokeWidth={1.8} />
            </div>
            <div className="mt-3 text-xs font-semibold text-text-soft">Active investments</div>
            <div className="mt-0.5 text-[22px] font-extrabold">
              {data.stats.activeInvestments}{" "}
              <span className="text-[13px] font-semibold text-text-faint">/ {data.stats.totalInvestments}</span>
            </div>
          </Card>
          <a href="/investor/wallet">
            <Card className="h-full p-5 hover:shadow-card-hover">
              <div className="flex h-10.5 w-10.5 items-center justify-center rounded-[13px] bg-accent-soft">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="2.5" y="5.5" width="19" height="14" rx="2.5" stroke="var(--accent-dark)" strokeWidth="1.8" />
                  <path d="M2.5 10.5h19" stroke="var(--accent-dark)" strokeWidth="1.8" />
                  <circle cx="17.5" cy="14.5" r="1.4" fill="var(--accent-dark)" />
                </svg>
              </div>
              <div className="mt-3 text-xs font-semibold text-text-soft">Wallet balance</div>
              <div className="mt-0.5 text-[22px] font-extrabold text-accent-dark">{formatNaira(data.stats.walletBalance)}</div>
            </Card>
          </a>
        </div>

        {/*
          Module 51: "the line chart is stretched too much to fill the
          screen, reduce its size and add a pie chart by the side for
          asset allocation." The line chart used to be the sole child of
          a full-width Card, so on a wide desktop viewport its wrapper
          (aspect-[14/5], capped at max-h-[200px] - see
          area-trend-chart.tsx's own Module 42 comments) ran wide enough
          that the height cap kicked in well before the aspect ratio's
          natural height did, leaving the rendered box noticeably wider
          than the 14:5 ratio the SVG's viewBox actually draws to -
          exactly the over-stretched look reported. Splitting this into a
          5-column grid (line chart 3, allocation 2) caps the line
          chart's own width at roughly 60% of what it had before, which
          brings its rendered box back close to the viewBox's own ratio
          instead of relying on the max-h clamp to save it - the safe
          fix here is narrowing the box, not touching the chart's
          internal aspect-ratio/viewBox pairing again (three prior
          "Module 42" bugs all trace back to those two disagreeing).
        */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <Card className="p-5 lg:col-span-3">
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-extrabold">Payouts realized (last 8 weeks)</div>
              <span className="text-xs font-semibold text-text-faint">Weekly total</span>
            </div>
            <AreaTrendChart
              weeks={data.payoutTrend.weeks}
              amounts={data.payoutTrend.amounts}
              latestLabel={data.payoutTrend.latestLabel}
              latestAmount={data.payoutTrend.latestAmount}
              formatAmount={formatNaira}
              emptyMessage="No payouts recorded yet"
              gradientId="investor-payouts-area"
            />
          </Card>
          <Card className="p-5 lg:col-span-2">
            <div className="flex items-baseline justify-between">
              <div className="text-sm font-extrabold">Asset allocation</div>
              <span className="text-xs font-semibold text-text-faint">By vehicle type</span>
            </div>
            <VehicleAllocationChart vehicles={data.vehicles} />
          </Card>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[15px] font-extrabold">My vehicles</div>
            <a href="/investor/investments" className="text-[13px] font-bold">
              View all &rarr;
            </a>
          </div>
          {data.vehicles.length === 0 ? (
            <Card className="p-8 text-center text-[13px] text-text-soft">
              No investments yet. Once staff create your first contract, it will show up here.
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {data.vehicles.map((vehicle) => (
                // 2026-10-30: wasn't wired up at all before — see the
                // dated comment on app/investor/vehicles/[assetTag]/page.tsx
                // for why (mobile-only feature, never ported to web).
                <a key={vehicle.assetTag} href={`/investor/vehicles/${encodeURIComponent(vehicle.assetTag)}`}>
                <Card className="p-5 hover:shadow-card-hover">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-13 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent-soft">
                        <VehicleTypeIllustration type={vehicle.type} className="w-16" />
                      </div>
                      <div>
                        <div className="text-[15px] font-extrabold">
                          {VEHICLE_TYPE_LABELS[vehicle.type]} {vehicle.assetTag}
                        </div>
                        <div className="mt-0.5 text-[12.5px] text-text-faint">
                          Agent: {vehicle.agentName} · {vehicle.location}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant={
                        vehicle.status === "ACTIVE" ? "good" : vehicle.status === "PAYMENT_OVERDUE" ? "bad" : "warn"
                      }
                    >
                      {vehicle.status === "ACTIVE"
                        ? "Active"
                        : vehicle.status === "PAYMENT_OVERDUE"
                          ? "Payment overdue"
                          : "Payment deferred"}
                    </Badge>
                  </div>
                  <div className="my-4 flex items-center justify-between text-[12.5px] font-semibold text-text-soft">
                    <span>Progress</span>
                    <span className="text-text">{vehicle.progressPercent}%</span>
                  </div>
                  <Progress value={vehicle.progressPercent} />
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div>
                      <div className="text-[11px] font-semibold text-text-faint">Realized</div>
                      <div className="mt-0.5 text-[13.5px] font-bold">{formatNaira(vehicle.realized)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-text-faint">Target</div>
                      <div className="mt-0.5 text-[13.5px] font-bold">{formatNaira(vehicle.target)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-text-faint">
                        {FREQUENCY_LABEL[vehicle.frequency] ?? "Installment"}
                      </div>
                      <div className="mt-0.5 text-[13.5px] font-bold">{formatNaira(vehicle.weekly)}</div>
                    </div>
                  </div>
                </Card>
                </a>
              ))}
            </div>
          )}
        </div>

        {data.overduePayments.length > 0 ? (
          <Card className="overflow-hidden border-bad p-0">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div className="text-[14.5px] font-extrabold text-bad-ink">Missed payments</div>
              <a href="/investor/payments" className="text-[13px] font-bold">
                Full history &rarr;
              </a>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Vehicle / Payment</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Was due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.overduePayments.map((payment, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-semibold">
                      {payment.vehicle} · Payment {payment.week}
                    </TableCell>
                    <TableCell className="font-bold">{formatNaira(payment.amount)}</TableCell>
                    <TableCell className="text-text-soft">{formatDate(payment.date)}</TableCell>
                    <TableCell>
                      <Badge variant="bad">Missed</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        ) : null}

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="text-[14.5px] font-extrabold">Recent payments</div>
            <a href="/investor/payments" className="text-[13px] font-bold">
              Full history &rarr;
            </a>
          </div>
          {data.recentPayments.length === 0 ? (
            <div className="p-6 text-center text-[13px] text-text-soft">No payments recorded yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Vehicle / Payment</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentPayments.map((payment, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-semibold">
                      {payment.vehicle} · Payment {payment.week}
                    </TableCell>
                    <TableCell className="font-bold">{formatNaira(payment.amount)}</TableCell>
                    <TableCell className="text-text-soft">{formatDate(payment.date)}</TableCell>
                    <TableCell>
                      <Badge variant={payment.status === "PAID" ? "good" : payment.status === "DEFERRED" ? "warn" : "pending"}>
                        {payment.status === "PAID" ? "Paid" : payment.status === "DEFERRED" ? "Deferred" : "Upcoming"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
