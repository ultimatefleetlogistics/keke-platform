import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VehicleTypeIllustration } from "@/components/design-system/vehicle-illustrations";
import { formatNaira, formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getInvestorDashboardData, getInvestorPaymentHistory } from "@/lib/data/investor";
import { VEHICLE_TYPE_LABELS } from "@/lib/vehicle-types";

const FREQUENCY_LABEL: Record<string, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Biweekly",
  MONTHLY: "Monthly",
};

/**
 * 2026-10-30: web-side equivalent of keke-mobile's vehicle-detail.tsx
 * (Module 42 follow-up: "on clicking on a particular vehicle a user
 * should be able to see all the history of the vehicle"). That screen
 * only ever shipped on mobile — the investor dashboard and
 * /investor/investments cards on web had no click target at all, reported
 * directly as "not responding to click" once someone actually tried it
 * on the freshly deployed site. Same data-reuse approach mobile already
 * uses rather than a new endpoint: getInvestorDashboardData's `vehicles`
 * list already carries this vehicle's plate/frame/driver detail (added
 * for mobile's Fleet screen, Module 37, see that function's own
 * comment), and getInvestorPaymentHistory already returns every schedule
 * entry across every contract with a `vehicle` (assetTag) field on each
 * one — this just filters that full list down to the one vehicle, same
 * as vehicle-detail.tsx's own comment describes doing on mobile.
 */
export default async function InvestorVehicleDetailPage({
  params,
}: {
  params: Promise<{ assetTag: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.investor) redirect("/investor/dashboard");

  const { assetTag: rawAssetTag } = await params;
  const assetTag = decodeURIComponent(rawAssetTag);

  const [dashboardData, allPayments] = await Promise.all([
    getInvestorDashboardData(user.investor),
    getInvestorPaymentHistory(user.investor),
  ]);

  const vehicle = dashboardData.vehicles.find((v) => v.assetTag === assetTag);
  // Scoped to this investor's own contracts either way (both calls above
  // already filter by user.investor), so there's no cross-investor data
  // to accidentally expose here — a missing match just means a bad/stale
  // URL, not someone else's vehicle.
  if (!vehicle) notFound();

  const payments = allPayments.filter((p) => p.vehicle === assetTag);
  const totalPaid = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);
  const missedCount = payments.filter((p) => p.status === "OVERDUE").length;

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-9 py-5.5">
        <div>
          <Link href="/investor/investments" className="mb-1 inline-flex items-center gap-1 text-[12.5px] font-bold text-text-soft">
            &larr; My investments
          </Link>
          <div className="text-xl font-extrabold tracking-tight">
            {VEHICLE_TYPE_LABELS[vehicle.type]} {vehicle.assetTag}
          </div>
          <div className="mt-0.5 text-[13px] text-text-soft">Full remittance history for this vehicle</div>
        </div>
        <div className="flex items-center gap-5">
          {missedCount > 0 ? (
            <div className="text-right">
              <div className="text-[11px] font-semibold text-text-faint">Missed</div>
              <div className="text-[17px] font-extrabold text-bad-ink">{missedCount}</div>
            </div>
          ) : null}
          <div className="text-right">
            <div className="text-[11px] font-semibold text-text-faint">Total received</div>
            <div className="text-[17px] font-extrabold text-good-ink">{formatNaira(totalPaid)}</div>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-5.5 px-9 py-6">
        <Card className="p-5.5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-accent-soft">
                <VehicleTypeIllustration type={vehicle.type} className="w-18" />
              </div>
              <div>
                <div className="text-[16px] font-extrabold">
                  {VEHICLE_TYPE_LABELS[vehicle.type]} {vehicle.assetTag}
                </div>
                <div className="mt-0.5 text-[12.5px] text-text-faint">
                  Agent: {vehicle.agentName} &middot; {vehicle.location}
                </div>
                {vehicle.plateNumber || vehicle.frameNumber ? (
                  <div className="mt-0.5 text-[12.5px] text-text-faint">
                    {vehicle.plateNumber ? `Plate: ${vehicle.plateNumber}` : null}
                    {vehicle.plateNumber && vehicle.frameNumber ? " · " : null}
                    {vehicle.frameNumber ? `Frame: ${vehicle.frameNumber}` : null}
                  </div>
                ) : null}
                <div className="mt-0.5 text-[12.5px] text-text-faint">
                  Driver: {vehicle.driverName ?? "Unassigned"}
                </div>
              </div>
            </div>
            <Badge
              variant={vehicle.status === "ACTIVE" ? "good" : vehicle.status === "PAYMENT_OVERDUE" ? "bad" : "warn"}
            >
              {vehicle.status === "ACTIVE"
                ? "Active"
                : vehicle.status === "PAYMENT_OVERDUE"
                  ? "Payment overdue"
                  : "Payment deferred"}
            </Badge>
          </div>

          <div className="my-4 flex items-center justify-between text-[12.5px] font-semibold text-text-soft">
            <span>Progress toward payout</span>
            <span className="text-text">{vehicle.progressPercent}%</span>
          </div>
          <Progress value={vehicle.progressPercent} />

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
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
            <div>
              <div className="text-[11px] font-semibold text-text-faint">Started</div>
              <div className="mt-0.5 text-[13.5px] font-bold">
                {vehicle.startDate ? formatDate(vehicle.startDate) : "Not started yet"}
              </div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="text-[14.5px] font-extrabold">Remittance history</div>
          </div>
          {payments.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-text-soft">No payments recorded yet for this vehicle.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Payment #</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment, index) => (
                  <TableRow key={index} className={payment.status === "OVERDUE" ? "bg-bad-soft/40" : undefined}>
                    <TableCell className="text-text-soft">Payment {payment.week}</TableCell>
                    <TableCell className="font-bold">{formatNaira(payment.amount)}</TableCell>
                    <TableCell className="text-text-soft">{formatDate(payment.date)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          payment.status === "PAID"
                            ? "good"
                            : payment.status === "DEFERRED"
                              ? "warn"
                              : payment.status === "OVERDUE"
                                ? "bad"
                                : "pending"
                        }
                      >
                        {payment.status === "PAID"
                          ? "Paid"
                          : payment.status === "DEFERRED"
                            ? "Deferred"
                            : payment.status === "OVERDUE"
                              ? "Missed"
                              : "Upcoming"}
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
