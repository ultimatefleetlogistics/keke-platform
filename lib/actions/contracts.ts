"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/rbac/check-permission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { generateScheduleDates, type Frequency } from "@/lib/schedule";
import { writeAuditLog } from "@/lib/audit";

/**
 * Creates a real investment contract between an investor and a vehicle
 * (keke, car, or bike, see prisma/schema.prisma's VehicleType), generates
 * its full payment schedule up front (rather than lazily), and marks the
 * vehicle ACTIVE. Every number here comes from the form, nothing is hard
 * coded, per the "contract terms are data, not code" decision in
 * docs/architecture, that holds regardless of which vehicle type this is.
 *
 * Module 43: the two real validation throws below ("select both," "must
 * all be positive numbers") converted to a `{ error?: string }` return.
 * This was bound to a plain `<form action={createInvestmentContract}>` on
 * `app/admin/contracts/new/new-contract-form.tsx`, a Client Component but
 * with no try/catch or return-value handling of its own, so either failure
 * still crashed straight through, see `components/ui/action-form.tsx`'s
 * doc comment.
 */
export async function createInvestmentContract(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.CONTRACTS_CREATE);
  if (!user.staff) throw new Error("Only staff accounts can create contracts.");

  const investorId = String(formData.get("investorId") ?? "");
  const vehicleId = String(formData.get("vehicleId") ?? "");
  const principalAmount = Number(formData.get("principalAmount"));
  const targetPayoutAmount = Number(formData.get("targetPayoutAmount"));
  const installmentAmount = Number(formData.get("installmentAmount"));
  const termMonths = Number(formData.get("termMonths"));
  const paymentFrequency = String(formData.get("paymentFrequency") ?? "WEEKLY") as Frequency;
  const startDateInput = String(formData.get("startDate") ?? "");

  if (!investorId || !vehicleId) {
    return { error: "Select both an investor and a vehicle." };
  }
  if (![principalAmount, targetPayoutAmount, installmentAmount, termMonths].every((n) => Number.isFinite(n) && n > 0)) {
    return { error: "Principal, target payout, installment, and term must all be positive numbers." };
  }

  const startDate = startDateInput ? new Date(startDateInput) : new Date();

  await prisma.investmentContract.create({
    data: {
      investorId,
      vehicleId,
      principalAmount,
      targetPayoutAmount,
      installmentAmount,
      paymentFrequency,
      termMonths,
      status: "ACTIVE",
      startDate,
      createdById: user.staff.id,
      scheduleEntries: {
        create: generateScheduleDates(startDate, paymentFrequency, termMonths).map((dueDate) => ({
          dueDate,
          expectedAmount: installmentAmount,
        })),
      },
    },
  });

  await prisma.vehicle.update({ where: { id: vehicleId }, data: { status: "ACTIVE" } });

  revalidatePath("/admin/investors");
  revalidatePath("/admin/fleet");
  revalidatePath("/admin/dashboard");
  redirect(`/admin/investors`);
}

/**
 * Skips one installment on a contract's payment schedule, e.g. a manager
 * deciding not to collect a remittance during the festive period, per the
 * real offline paper agreement's only named reason for skipping one. Sets
 * that single PaymentScheduleEntry to DEFERRED rather than leaving it
 * DUE/OVERDUE or force-marking it PAID, which matters in two places that
 * already exist and needed no changes to support this:
 *
 * 1. findEarliestUnpaidScheduleEntry (lib/payments/webhook-handler.ts) and
 *    applyTransferOutcome (lib/payments/batch-processor.ts), which match
 *    an incoming agent remittance against a contract's earliest entry
 *    whose status is in ["UPCOMING", "DUE", "PARTIALLY_PAID"], both
 *    already exclude DEFERRED. A remittance that comes in while an entry
 *    is deferred automatically rolls forward and pays the next one in
 *    line instead, no special-casing needed here.
 * 2. mapScheduleStatus (lib/data/investor.ts) already maps DEFERRED to a
 *    distinct "Deferred" label on the investor's own payment history
 *    (app/investor/payments/page.tsx), styled apart from a real missed
 *    ("OVERDUE") payment, and it's excluded from that page's missedCount.
 *    Since amountPaid on a deferred entry stays untouched (never forced to
 *    the expected amount), totalPaidToInvestor and progressPercent
 *    (lib/data/contracts.ts, lib/data/investor.ts) both keep counting the
 *    installment as still outstanding, exactly the "keep record of the
 *    amount left" behavior asked for, no bookkeeping change required.
 *
 * Only reachable from UPCOMING or DUE, an already PAID/PARTIALLY_PAID
 * entry can't be un-collected from here, that's a real reversal, not a
 * skip. The reason is optional and free text, recorded on the audit log
 * (lib/audit.ts) rather than a new column, so this needed no migration.
 */
export async function deferScheduleEntry(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!user.staff || !user.permissions.has(PERMISSIONS.CONTRACTS_MANAGE)) {
    return { error: "Your role doesn't include permission to manage contracts." };
  }

  const scheduleEntryId = String(formData.get("scheduleEntryId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!scheduleEntryId) {
    return { error: "Missing schedule entry." };
  }

  const entry = await prisma.paymentScheduleEntry.findUnique({ where: { id: scheduleEntryId } });
  if (!entry) {
    return { error: "Schedule entry not found." };
  }
  if (entry.status !== "UPCOMING" && entry.status !== "DUE") {
    return { error: `This installment is already ${entry.status.toLowerCase().replaceAll("_", " ")}, it can't be skipped.` };
  }

  await prisma.paymentScheduleEntry.update({ where: { id: scheduleEntryId }, data: { status: "DEFERRED" } });

  await writeAuditLog({
    actorUserId: user.id,
    action: "schedule_entry.defer",
    entityType: "PaymentScheduleEntry",
    entityId: scheduleEntryId,
    beforeState: { status: entry.status },
    afterState: { status: "DEFERRED", reason: reason || null },
  });

  revalidatePath(`/admin/contracts/${entry.contractId}`);
  revalidatePath("/admin/dashboard");
}

/**
 * Undoes deferScheduleEntry above, e.g. a manager who deferred the wrong
 * row by mistake. Only reachable from DEFERRED, puts the entry straight
 * back to UPCOMING so it re-enters the same remittance-matching and
 * payout-batch eligibility as any other not-yet-paid installment.
 */
export async function undeferScheduleEntry(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!user.staff || !user.permissions.has(PERMISSIONS.CONTRACTS_MANAGE)) {
    return { error: "Your role doesn't include permission to manage contracts." };
  }

  const scheduleEntryId = String(formData.get("scheduleEntryId") ?? "");
  if (!scheduleEntryId) {
    return { error: "Missing schedule entry." };
  }

  const entry = await prisma.paymentScheduleEntry.findUnique({ where: { id: scheduleEntryId } });
  if (!entry) {
    return { error: "Schedule entry not found." };
  }
  if (entry.status !== "DEFERRED") {
    return { error: "This installment isn't skipped." };
  }

  await prisma.paymentScheduleEntry.update({ where: { id: scheduleEntryId }, data: { status: "UPCOMING" } });

  await writeAuditLog({
    actorUserId: user.id,
    action: "schedule_entry.undefer",
    entityType: "PaymentScheduleEntry",
    entityId: scheduleEntryId,
    beforeState: { status: "DEFERRED" },
    afterState: { status: "UPCOMING" },
  });

  revalidatePath(`/admin/contracts/${entry.contractId}`);
  revalidatePath("/admin/dashboard");
}
