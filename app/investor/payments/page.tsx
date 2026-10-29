import { redirect } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNaira, formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getInvestorPaymentHistory } from "@/lib/data/investor";

type PresetKey = "month" | "last3" | "last6" | "year";

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "month", label: "This month" },
  { key: "last3", label: "Last 3 months" },
  { key: "last6", label: "Last 6 months" },
  { key: "year", label: "This year" },
];

function monthStart(year: number, monthIndex0: number): Date {
  return new Date(year, monthIndex0, 1);
}

function monthEnd(year: number, monthIndex0: number): Date {
  return new Date(year, monthIndex0 + 1, 0, 23, 59, 59, 999);
}

function presetRange(key: PresetKey, now: Date): { from: Date; to: Date } {
  if (key === "month") return { from: monthStart(now.getFullYear(), now.getMonth()), to: monthEnd(now.getFullYear(), now.getMonth()) };
  if (key === "last3") return { from: monthStart(now.getFullYear(), now.getMonth() - 2), to: monthEnd(now.getFullYear(), now.getMonth()) };
  if (key === "last6") return { from: monthStart(now.getFullYear(), now.getMonth() - 5), to: monthEnd(now.getFullYear(), now.getMonth()) };
  return { from: monthStart(now.getFullYear(), 0), to: monthEnd(now.getFullYear(), 11) };
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Parses a `?from=`/`?to=` searchParam string (yyyy-mm-dd from a date input) into midnight of that day, or null if missing/invalid. Same helper as app/admin/reports/page.tsx. */
function parseDateParam(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Module 39: the same "filter or calendar to track payments beyond what
 * fits on the screen" request that added keke-mobile's Payment History
 * screen, brought to the web app too rather than leaving it mobile-only.
 * This page already existed (full, unfiltered history) and already had
 * the natural place for this: a preset chip row plus a real `<input
 * type="date">` range, both plain GET navigation, no client component,
 * matching how every other filter in this app works (see
 * `app/admin/reports/page.tsx`'s identical from/to date-input pattern
 * and `ReportsTabs`' comment on why: "a real navigation the browser back
 * button understands, not a client component pretending to be one"). A
 * native date input IS a real calendar picker in every browser, so
 * unlike the mobile app (no such control in React Native without a new
 * dependency) this needed no hand-rolled month stepper.
 */
export default async function InvestorPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.investor) redirect("/investor/dashboard");

  const params = await searchParams;
  const now = new Date();
  const activePreset = PRESETS.find((p) => p.key === params.range)?.key;

  let from: Date | undefined;
  let to: Date | undefined;
  if (activePreset) {
    ({ from, to } = presetRange(activePreset, now));
  } else {
    from = parseDateParam(params.from) ?? undefined;
    to = parseDateParam(params.to) ?? undefined;
  }
  const isFiltered = Boolean(activePreset || from || to);

  const payments = await getInvestorPaymentHistory(user.investor, { from, to });
  const totalPaid = payments.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);
  // Module 42 (follow-up): "even if the payment was not received on a
  // particular date...it should be noted when the client is reviewing the
  // entire payment history." This page is that full history, a small
  // count call-out up top means a missed payment doesn't only show up as
  // one row among many, easy to scroll past.
  const missedCount = payments.filter((p) => p.status === "OVERDUE").length;

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-9 py-5.5">
        <div>
          <div className="text-xl font-extrabold tracking-tight">Payment history</div>
          <div className="mt-0.5 text-[13px] text-text-soft">Every payment recorded across all of your investments</div>
        </div>
        <div className="flex items-center gap-5">
          {missedCount > 0 ? (
            <div className="text-right">
              <div className="text-[11px] font-semibold text-text-faint">Missed{isFiltered ? ", in range" : ""}</div>
              <div className="text-[17px] font-extrabold text-bad-ink">{missedCount}</div>
            </div>
          ) : null}
          <div className="text-right">
            <div className="text-[11px] font-semibold text-text-faint">Total received{isFiltered ? ", in range" : ""}</div>
            <div className="text-[17px] font-extrabold text-good-ink">{formatNaira(totalPaid)}</div>
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 px-9 py-6">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link
            href="/investor/payments"
            className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
              isFiltered
                ? "border-border bg-surface text-text-soft hover:bg-background"
                : "border-accent bg-accent text-white"
            }`}
          >
            All time
          </Link>
          {PRESETS.map((p) => (
            <Link
              key={p.key}
              href={`/investor/payments?range=${p.key}`}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition-colors ${
                activePreset === p.key
                  ? "border-accent bg-accent text-white"
                  : "border-border bg-surface text-text-soft hover:bg-background"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </div>

        <form method="get" className="flex flex-wrap items-end gap-2.5">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">From</label>
            <Input type="date" name="from" defaultValue={from ? toDateInputValue(from) : ""} className="w-44" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">To</label>
            <Input type="date" name="to" defaultValue={to ? toDateInputValue(to) : ""} className="w-44" />
          </div>
          <Button type="submit" size="sm" variant="outline">
            Filter
          </Button>
          {isFiltered ? (
            <Button asChild size="sm" variant="ghost">
              <Link href="/investor/payments">Reset to all time</Link>
            </Button>
          ) : null}
        </form>

        <Card className="overflow-hidden p-0">
          {payments.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-text-soft">
              {isFiltered ? "No payments in this range." : "No payments recorded yet."}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Payment #</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment, index) => (
                  <TableRow key={index} className={payment.status === "OVERDUE" ? "bg-bad-soft/40" : undefined}>
                    <TableCell className="font-semibold">{payment.vehicle}</TableCell>
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
