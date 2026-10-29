import { addDays, dayLabel, startOfWeek } from "@/lib/utils";

export type WeeklyTrend = {
  weeks: string[];
  amounts: number[];
  latestLabel: string;
  latestAmount: number;
};

/**
 * The start of the calendar week `weeksBack` weeks ago, inclusive of the
 * current week. weeksAgoStart(8) is "the Monday that begins an 8 week
 * window ending with this week", the right lower bound for a `createdAt`
 * filter feeding buildWeeklyTrend with the same weeksBack value.
 */
export function weeksAgoStart(weeksBack: number): Date {
  return addDays(startOfWeek(new Date()), -7 * (weeksBack - 1));
}

/**
 * Buckets a list of dated amounts into the last `weeksBack` calendar
 * weeks (inclusive of the current week), summing whatever falls in each
 * week. Shared by the admin, investor, agent, and driver dashboards (and,
 * through the investor dashboard's own data function, the mobile app's
 * `/api/v1/investor/summary` route too) so "amount over time" reads
 * identically everywhere it appears, weekly buckets, same "latest week"
 * callout, only the underlying query differs (system-wide realized
 * payouts, one investor's payouts, one agent's remittances, one driver's
 * deposits). A week with no rows still gets its own zero-valued bucket,
 * so a quiet week shows as a real dip in the chart rather than being
 * skipped and silently compressing the axis.
 *
 * Module 42: each bucket's label used to be `weekLabel`'s ISO-week-ish
 * "W34" form. Direct feedback: "add the date of payment not week
 * count." A week number means nothing without a calendar to look it up
 * in, the date it starts on is the actual information; `dayLabel` (the
 * same short "24 Aug" formatter the daily reports chart already uses)
 * on each bucket's Monday now does that everywhere `buildWeeklyTrend`
 * feeds a chart, this function's callers never needed to change.
 */
export function buildWeeklyTrend(rows: { amount: number; createdAt: Date }[], weeksBack = 8): WeeklyTrend {
  const now = new Date();
  const buckets = new Map<string, number>();
  for (let i = weeksBack - 1; i >= 0; i--) {
    const weekStart = addDays(startOfWeek(now), -7 * i);
    buckets.set(weekStart.toISOString().slice(0, 10), 0);
  }

  for (const row of rows) {
    const key = startOfWeek(row.createdAt).toISOString().slice(0, 10);
    if (buckets.has(key)) {
      buckets.set(key, (buckets.get(key) ?? 0) + row.amount);
    }
  }

  const entries = Array.from(buckets.entries());
  const weeks = entries.map(([iso]) => dayLabel(new Date(iso)));
  const amounts = entries.map(([, amount]) => amount);
  const latest = amounts[amounts.length - 1] ?? 0;

  return {
    weeks,
    amounts,
    latestLabel: weeks[weeks.length - 1] ?? dayLabel(startOfWeek(now)),
    latestAmount: latest,
  };
}
