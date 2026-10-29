/**
 * Module 59: "this agent/driver hasn't remitted in a while" is a real gap
 * flagged directly by the project owner (missing-features-agent-driver-
 * restructure.md item 3, tracked in this project's Claude Desktop docs):
 * with no self-service dashboard to warn agents/drivers about their own
 * standing, staff needs it surfaced instead, automatically, not discovered
 * during a manual review.
 *
 * There is no cron or scheduled job anywhere in this codebase (confirmed
 * by grep before building this: lib/schedule.ts is pure date math, not a
 * scheduler, and every notification in this app is triggered synchronously
 * from an action, never on a timer), so "automatically" here means
 * "computed live, every time staff open a screen that would show it,"
 * the same live-computation approach lib/data/reports.ts's own
 * overdue-installment logic already uses (daysOverdue = now - dueDate,
 * recomputed on every read, nothing denormalized). Nor is there any
 * lastRemittanceAt/lastDepositAt column on Agent or Driver to read
 * instead, so this is always a live MAX(createdAt) over that subject's
 * own PaymentTransaction rows, see lib/data/agents.ts's getAgents/
 * getAgentById and lib/data/drivers.ts's getDrivers/getDriverById for
 * where this is actually queried.
 *
 * The threshold itself is a flat, hand-picked number, not derived from
 * each contract's own PaymentFrequency (WEEKLY/BIWEEKLY/MONTHLY, a
 * per-contract field, not a per-agent or per-driver one, so there is no
 * single "expected cadence" to read for a whole agent's book of vehicles
 * anyway). Seven days is a reasonable "gone quiet" signal for a cash
 * collection business without being noisy for a normal short gap, worth
 * revisiting with the project owner once real remittance cadence data
 * exists to tune it against, changing it is a one-line edit here, nothing
 * else needs to change.
 */
export const DELINQUENCY_THRESHOLD_DAYS = 7;

/** Whole days between `since` and now, or null if `since` is null (never remitted/deposited at all, a different, stronger signal than merely "late"). */
export function daysSince(since: Date | null): number | null {
  if (!since) return null;
  return Math.floor((Date.now() - since.getTime()) / (24 * 60 * 60 * 1000));
}

export function isDelinquent(lastPaidAt: Date | null): boolean {
  const days = daysSince(lastPaidAt);
  return days !== null && days >= DELINQUENCY_THRESHOLD_DAYS;
}
