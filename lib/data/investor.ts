import { prisma } from "@/lib/prisma";
import type { InvestorProfile, ScheduleEntryStatus } from "@prisma/client";
import { buildWeeklyTrend, weeksAgoStart } from "@/lib/data/chart-helpers";

/**
 * Real data for the investor dashboard, shaped the same as the sample data
 * in lib/mock-data.ts so the page component did not need to change shape,
 * only where it gets its data from.
 */
export async function getInvestorDashboardData(investor: InvestorProfile) {
  // Computed once and threaded through every "is this late" check below,
  // rather than each check calling `new Date()` on its own: a request that
  // takes even a few milliseconds to run could otherwise have one entry's
  // overdue-ness judged against a slightly different instant than
  // another's, right on the boundary of a due date.
  const now = new Date();

  const [contracts, payoutTransactions] = await Promise.all([
    prisma.investmentContract.findMany({
      where: { investorId: investor.id },
      include: {
        vehicle: {
          include: {
            agent: { include: { user: true } },
            currentDriver: { include: { user: true } },
            driverAssignments: { where: { endedAt: null }, orderBy: { startedAt: "desc" }, take: 1 },
          },
        },
        scheduleEntries: { orderBy: { dueDate: "desc" } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Same shape and window as the admin dashboard's system-wide chart
    // (lib/data/admin.ts), scoped to this one investor via the investorId
    // PaymentTransaction.recordPayout already stamps on every payout it
    // creates (lib/payments/batch-processor.ts), see chart-helpers.ts.
    prisma.paymentTransaction.findMany({
      where: {
        investorId: investor.id,
        direction: "OUTBOUND",
        source: "INVESTOR_PAYOUT",
        createdAt: { gte: weeksAgoStart(8) },
      },
      select: { amount: true, createdAt: true },
    }),
  ]);

  const totalInvested = contracts.reduce((sum, c) => sum + Number(c.principalAmount), 0);
  const totalRealized = contracts.reduce((sum, c) => sum + Number(c.totalPaidToInvestor), 0);
  const outstanding = contracts.reduce(
    (sum, c) => sum + Math.max(Number(c.targetPayoutAmount) - Number(c.totalPaidToInvestor), 0),
    0
  );
  const activeInvestments = contracts.filter((c) => c.status === "ACTIVE").length;

  const vehicles = contracts.map((c) => {
    const target = Number(c.targetPayoutAmount);
    const realized = Number(c.totalPaidToInvestor);
    const progressPercent = target > 0 ? Math.min(100, Math.round((realized / target) * 100)) : 0;
    const hasDeferredDue = c.scheduleEntries.some((e) => e.status === "DEFERRED");
    // A staff-acknowledged deferral (someone chose to push a due date out)
    // is a different situation from a payment that simply never came in,
    // see mapScheduleStatus's own comment on why the schema has no stored
    // OVERDUE value to read this off of directly. DEFERRED wins when both
    // are true, that entry has already been dealt with one way, an
    // investor doesn't need "overdue" flagged on top of "deferred" for the
    // same underlying gap.
    const hasOverdueDue = c.scheduleEntries.some(
      (e) => (e.status === "DUE" || e.status === "PARTIALLY_PAID") && e.dueDate.getTime() < now.getTime()
    );
    const activeAssignment = c.vehicle.driverAssignments[0];
    return {
      assetTag: c.vehicle.assetTag,
      type: c.vehicle.type,
      agentName: c.vehicle.agent?.user.fullName ?? "Unassigned",
      location: c.vehicle.location ?? "Not set",
      status: (hasDeferredDue ? "PAYMENT_DEFERRED" : hasOverdueDue ? "PAYMENT_OVERDUE" : "ACTIVE") as
        | "ACTIVE"
        | "PAYMENT_DEFERRED"
        | "PAYMENT_OVERDUE",
      progressPercent,
      realized,
      target,
      weekly: Number(c.installmentAmount),
      // Added alongside the OVERDUE status fix: the dashboard card and the
      // mobile Fleet screen both label this figure "Weekly" unconditionally,
      // wrong for a biweekly or monthly contract, this lets either render
      // the actual cadence instead of assuming one.
      frequency: c.paymentFrequency,
      // Added for the mobile Fleet screen (Module 37), the web dashboard
      // card does not show these, only the mobile vehicle detail screen
      // does, kept on the same shared function rather than duplicated
      // into a second query per the mobile/API pattern documented in
      // docs/architecture/CURRENT_STATE.md's "Mobile / external API"
      // section.
      plateNumber: c.vehicle.plateNumber,
      frameNumber: c.vehicle.frameNumber,
      startDate: c.startDate ? c.startDate.toISOString() : null,
      // Driver.user is genuinely optional (a driver may or may not have
      // their own app account, see prisma/schema.prisma's own comment on
      // it), unlike every other user.fullName access in this file
      // (agent.user, investor.user), which are all required relations.
      // `npx tsc --noEmit` and `next dev` both let a single `?.` here
      // through without complaint, only a real `next build` type-checked
      // this strictly enough to catch the second, missing optional-chain
      // on `.user` itself, the same "next build catches things nothing
      // else in this sandbox can" pattern documented in Known gaps.
      driverName: c.vehicle.currentDriver?.user?.fullName ?? null,
      driverAssignedSince: activeAssignment ? activeAssignment.startedAt.toISOString() : null,
    };
  });

  // Every schedule entry across every contract, mapped once, then split by
  // whether it has actually happened yet. `mapScheduleStatus` collapses
  // UPCOMING/DUE/PARTIALLY_PAID into either "UPCOMING" or "OVERDUE" (see
  // its own comment), which is also exactly the split point between
  // "already settled," "still ahead," and "late": PAID and DEFERRED
  // entries are done, one way or another, OVERDUE entries were due but
  // never came in, everything else genuinely hasn't happened yet.
  const allEntries = contracts.flatMap((c, contractIndex) =>
    c.scheduleEntries.map((entry, entryIndexFromEnd) => ({
      vehicle: c.vehicle.assetTag,
      week: c.scheduleEntries.length - entryIndexFromEnd,
      // Number(...) first, then compare: amountPaid/expectedAmount are
      // Prisma Decimal values (decimal.js under the hood), which don't
      // overload `>` against a plain number, `next dev`/lint let this
      // through, a real `next build` type check did not.
      amount: Number(entry.amountPaid) > 0 ? Number(entry.amountPaid) : Number(entry.expectedAmount),
      date: entry.dueDate.toISOString(),
      status: mapScheduleStatus(entry.status, entry.dueDate, now),
      contractIndex,
    }))
  );

  // Most recent first: what already happened, newest first, matches "Recent
  // payments" as a section title actually means.
  const recentPayments = allEntries
    .filter((entry) => entry.status === "PAID" || entry.status === "DEFERRED")
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  // Soonest first: what's still ahead, nearest due date leading, added in
  // Module 38 for the mobile Home/Wallet screens, which previously had no
  // way to show "what's coming up" separately from history, only this same
  // flat list with UPCOMING entries mixed in wherever their due date
  // happened to sort. The web dashboard doesn't render this field yet, it
  // just doesn't have to change.
  //
  // Module 42 (follow-up): this used to also catch DUE/PARTIALLY_PAID
  // entries whose due date had already passed, "the upcoming payment...
  // shows the date that have already gone" was reported directly against
  // this list. mapScheduleStatus now sorts those into OVERDUE instead, so
  // this filter did not need to change, only what counts as "UPCOMING"
  // upstream did.
  const upcomingPayments = allEntries
    .filter((entry) => entry.status === "UPCOMING")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6);

  // New alongside the fix above: entries that were due and never paid.
  // Oldest due date first, the longest-outstanding one is the one most
  // worth chasing. Kept as its own list rather than folded into either of
  // the two above, "recent" means "already happened" and "upcoming" means
  // "hasn't happened yet," neither is true of a missed payment.
  const overduePayments = allEntries
    .filter((entry) => entry.status === "OVERDUE")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 6);

  const payoutTrend = buildWeeklyTrend(
    payoutTransactions.map((tx) => ({ amount: Number(tx.amount), createdAt: tx.createdAt }))
  );

  return {
    stats: {
      totalInvested,
      totalRealized,
      outstanding,
      activeInvestments,
      totalInvestments: contracts.length,
      walletBalance: Number(investor.walletBalance),
    },
    vehicles,
    recentPayments,
    upcomingPayments,
    overduePayments,
    payoutTrend,
  };
}

/**
 * Module 42 (follow-up): this used to collapse UPCOMING/DUE/PARTIALLY_PAID
 * into one "UPCOMING" bucket regardless of the entry's actual due date,
 * which is how a schedule entry due weeks ago, still unpaid, ended up
 * displayed as "Upcoming" right alongside genuinely future payments,
 * reported directly: "the upcoming payment...shows the date that have
 * already gone." `ScheduleEntryStatus` (prisma/schema.prisma) has no
 * OVERDUE value to read this off of, PAID/DEFERRED mean the entry is
 * settled one way or another (paid, or explicitly deferred by staff),
 * everything else (UPCOMING/DUE/PARTIALLY_PAID) is either still ahead or
 * already late depending only on whether `dueDate` has passed, so that's
 * computed here at read time instead. `now` is passed in rather than
 * called fresh per entry so every entry in one request is judged against
 * the same instant.
 *
 * Exported (not just used internally) so lib/data/onboarding.ts's admin-
 * facing getInvestorById can label the same schedule entries the same
 * way for /admin/investors/[id]'s payment history section, one investor
 * should never read as "Missed" on their own dashboard and "Upcoming" on
 * the staff page looking at the exact same row.
 */
export function mapScheduleStatus(
  status: ScheduleEntryStatus,
  dueDate: Date,
  now: Date
): "PAID" | "DEFERRED" | "OVERDUE" | "UPCOMING" {
  if (status === "PAID") return "PAID";
  if (status === "DEFERRED") return "DEFERRED";
  return dueDate.getTime() < now.getTime() ? "OVERDUE" : "UPCOMING";
}

/**
 * Every contract this investor holds, in full, for /investor/investments.
 * Unlike the dashboard's summarized list, this includes each contract's
 * full terms (principal, frequency, term length, start date, overall
 * contract status), since this page is the place to actually look those
 * up rather than just glance at progress.
 */
export async function getInvestorInvestments(investor: InvestorProfile) {
  const now = new Date();
  const contracts = await prisma.investmentContract.findMany({
    where: { investorId: investor.id },
    include: {
      vehicle: { include: { agent: { include: { user: true } } } },
      scheduleEntries: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return contracts.map((c) => {
    const target = Number(c.targetPayoutAmount);
    const realized = Number(c.totalPaidToInvestor);
    const progressPercent = target > 0 ? Math.min(100, Math.round((realized / target) * 100)) : 0;
    const hasDeferredDue = c.scheduleEntries.some((e) => e.status === "DEFERRED");
    // Same OVERDUE derivation as getInvestorDashboardData's vehicles list,
    // see its comment, kept consistent here since this page shows the same
    // payment-status badge per contract.
    const hasOverdueDue = c.scheduleEntries.some(
      (e) => (e.status === "DUE" || e.status === "PARTIALLY_PAID") && e.dueDate.getTime() < now.getTime()
    );
    return {
      id: c.id,
      vehicleType: c.vehicle.type,
      assetTag: c.vehicle.assetTag,
      agentName: c.vehicle.agent?.user.fullName ?? "Unassigned",
      location: c.vehicle.location ?? "Not set",
      contractStatus: c.status,
      paymentStatus: (hasDeferredDue ? "PAYMENT_DEFERRED" : hasOverdueDue ? "PAYMENT_OVERDUE" : "ACTIVE") as
        | "ACTIVE"
        | "PAYMENT_DEFERRED"
        | "PAYMENT_OVERDUE",
      progressPercent,
      principal: Number(c.principalAmount),
      target,
      realized,
      installment: Number(c.installmentAmount),
      frequency: c.paymentFrequency,
      termMonths: c.termMonths,
      startDate: c.startDate ? c.startDate.toISOString() : null,
    };
  });
}

/**
 * Every payment schedule entry across every contract this investor holds,
 * for /investor/payments. The dashboard shows the most recent 6 as a
 * preview, this is the same shape with nothing held back.
 *
 * `filters.from`/`filters.to` (Module 39) narrow the result to entries
 * whose due date falls in that range, for keke-mobile's Payment History
 * screen ("track their payments beyond what fits on the screen", the
 * project owner's words), which lets someone jump to a specific month or
 * a preset range instead of scrolling one long list. Deliberately
 * optional and applied AFTER the flat map below, not as a Prisma `where`
 * on `scheduleEntries` itself: `week` is this entry's position within
 * its OWN contract's full schedule (`scheduleEntries.length -
 * entryIndexFromEnd`), which only comes out right if `scheduleEntries`
 * holds the whole schedule when that math runs, filtering the query
 * itself would silently renumber every week once a date range narrowed
 * which rows came back. `/investor/payments` on the web keeps calling
 * this with no filters, unaffected.
 */
export async function getInvestorPaymentHistory(
  investor: InvestorProfile,
  filters: { from?: Date; to?: Date } = {}
) {
  const now = new Date();
  const contracts = await prisma.investmentContract.findMany({
    where: { investorId: investor.id },
    include: {
      vehicle: true,
      scheduleEntries: { orderBy: { dueDate: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Module 42 (follow-up): the direct ask was "even if the payment was
  // not received on a particular date...it should be noted when the
  // client is reviewing the entire payment history." Before this fix a
  // late DUE/PARTIALLY_PAID entry mapped to "UPCOMING" the same as this
  // function's dashboard-preview sibling did, so a missed payment simply
  // never showed as missed anywhere, including here, the one place meant
  // to hold the complete, nothing-held-back record. mapScheduleStatus now
  // sorts those into OVERDUE, this function needed no other change,
  // `filtered`/the final sort below already return every status as-is.
  const allEntries = contracts.flatMap((c) =>
    c.scheduleEntries.map((entry, entryIndexFromEnd) => ({
      vehicle: c.vehicle.assetTag,
      week: c.scheduleEntries.length - entryIndexFromEnd,
      // Number(...) first, then compare: amountPaid/expectedAmount are
      // Prisma Decimal values (decimal.js under the hood), which don't
      // overload `>` against a plain number, `next dev`/lint let this
      // through, a real `next build` type check did not.
      amount: Number(entry.amountPaid) > 0 ? Number(entry.amountPaid) : Number(entry.expectedAmount),
      date: entry.dueDate.toISOString(),
      status: mapScheduleStatus(entry.status, entry.dueDate, now),
    }))
  );

  const filtered = allEntries.filter((entry) => {
    const dueTime = new Date(entry.date).getTime();
    if (filters.from && dueTime < filters.from.getTime()) return false;
    if (filters.to && dueTime > filters.to.getTime()) return false;
    return true;
  });

  return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
