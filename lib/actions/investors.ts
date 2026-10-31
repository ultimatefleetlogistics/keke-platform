"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission, ForbiddenError } from "@/lib/rbac/check-permission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { getPaymentProvider } from "@/lib/payments/provider";
import { provisionInvestorCollectionAccount } from "@/lib/payments/collection-account";
import { sendNotification } from "@/lib/notifications/send-notification";

const WORDS = ["keke", "gold", "kano", "abuja", "lagos", "river", "market", "tiger", "amber", "delta"];

function generateTemporaryPassword(): string {
  const word = WORDS[randomInt(0, WORDS.length)];
  // 2026-10-31: same fix as lib/actions/staff.ts's own copy of this
  // generator, see that file's comment for the full reasoning — a
  // 4-digit suffix produced a 9-character password for any 4-letter word
  // in WORDS, which started failing once Supabase's Auth password policy
  // was tightened to a 10-character minimum. 5 digits guarantees 10.
  const digits = String(randomInt(10000, 99999));
  return `${word[0].toUpperCase()}${word.slice(1)}${digits}!`;
}

/**
 * Onboards a real investor: creates a Supabase Auth user directly with a
 * generated password (email_confirm true), rather than emailing an
 * invite link, since that would depend on Supabase's outgoing email
 * working and a redirect URL being allow-listed, neither of which this
 * app controls in local development. Staff relay the password shown on
 * the confirmation screen to the investor directly, the investor can
 * switch to signing in with a magic link afterward if they prefer never
 * to have a password at all. `mustChangePassword: true` (Module 26)
 * forces them to `/change-password` on their very first sign in, before
 * anything else, so the generated password relayed by hand never stays
 * their real one indefinitely.
 *
 * Module 30: bank account entry is now offered right here too, not only
 * afterward on `/admin/investors/[id]` (which stays the only option once
 * PAYSTACK_SECRET_KEY isn't set yet, or staff simply doesn't have the
 * investor's bank details in hand at signup). Both fields are optional
 * and either both are filled in or neither is, resolved against Paystack
 * (same `resolveBankAccount` call `updateInvestorBankDetails` uses)
 * before the Supabase Auth account is even created, so a bad account
 * number is caught before anything is created at all rather than leaving
 * a real sign-in account behind with no bank on file.
 *
 * Module 43: every real, user-reachable validation, Paystack-resolve, and
 * Supabase-failure throw below converted to a `{ error?: string }` return,
 * this was bound to a plain `<form action={createInvestor}>` on
 * `/admin/investors/new`, see `components/ui/action-form.tsx`'s doc
 * comment.
 */
export async function createInvestor(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.INVESTORS_MANAGE);

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const bankCode = String(formData.get("bankCode") ?? "").trim();
  const accountNumber = String(formData.get("accountNumber") ?? "").trim();
  // Module 26: the investor's own standing choice for where a payout
  // lands, set once here, editable later by the investor themselves on
  // /investor/payout-details. createPaymentBatch reads this per investor
  // when building a new batch, no staff member picks it per row anymore.
  const payoutDestination = formData.get("payoutDestination") === "WALLET" ? "WALLET" : "BANK";

  if (!fullName || !email) {
    return { error: "Full name and email are required." };
  }
  if (Boolean(bankCode) !== Boolean(accountNumber)) {
    return { error: "Choose a bank and enter an account number, or leave both blank to add this later." };
  }

  // Resolved before anything is created: a bad or mistyped account number
  // should never leave a real Supabase Auth account and User row behind
  // with no way to redo just the bank half.
  let bankAccountName: string | null = null;
  if (bankCode && accountNumber) {
    if (!/^\d{10}$/.test(accountNumber)) {
      return { error: "Nigerian account numbers are 10 digits." };
    }
    const provider = await getPaymentProvider();
    try {
      const resolved = await provider.resolveBankAccount({ accountNumber, bankCode });
      bankAccountName = resolved.accountName;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not verify this account.";
      return { error: `Could not verify this account with the bank: ${message}` };
    }
  }

  const temporaryPassword = generateTemporaryPassword();

  const supabaseAdmin = createSupabaseServiceRoleClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) return { error: `Could not create the Supabase Auth account: ${error.message}` };

  const newUser = await prisma.user.create({
    data: {
      authId: data.user.id,
      email,
      phone: phone || null,
      fullName,
      mustChangePassword: true,
      investor: {
        create: {
          defaultPayoutDestination: payoutDestination,
          ...(bankCode && accountNumber
            ? { bankCode, bankAccountNumber: accountNumber, bankAccountName }
            : {}),
        },
      },
    },
    include: { investor: true },
  });

  const investorRole = await prisma.role.findUniqueOrThrow({ where: { name: "Investor" } });
  await prisma.roleAssignment.create({ data: { userId: newUser.id, roleId: investorRole.id } });

  // Best-effort, deliberately not awaited into a blocking failure: a new
  // investor's Paystack Dedicated Virtual Account (their deposit account,
  // Module 41) failing to provision (missing PAYSTACK_SECRET_KEY, Paystack
  // being briefly down) must never prevent the account itself from being
  // created, staff can retry it afterward from /admin/investors/[id], see
  // retryInvestorCollectionAccount below. Same reasoning as
  // provisionAgentCollectionAccount's call site in lib/actions/staff.ts.
  if (newUser.investor) {
    await provisionInvestorCollectionAccount(newUser.investor.id, user.id);
  }

  // Requested directly: a welcome message on account creation, the same
  // way the other account-creation paths in this app now do (see
  // signUpInvestor in lib/actions/auth.ts, createDriver, and
  // createStaffOrAgentAccount). Deliberately does not include the
  // generated password itself, that stays exactly where it already was,
  // shown once on this page's own success screen for staff to relay by
  // hand, an email or text carrying a plaintext temporary password would
  // be a real step backward from that.
  await sendNotification({
    userId: newUser.id,
    type: "account_created",
    title: "Your Ultimate account is ready",
    body: "An Ultimate investor account has been created for you. Whoever set this up will share your sign-in details with you shortly.",
    channels: ["EMAIL", "SMS"],
  });

  redirect(
    `/admin/investors/new/success?name=${encodeURIComponent(fullName)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(temporaryPassword)}`
  );
}

/**
 * Module 27: editing an existing investor's own record, added alongside
 * the equivalent for drivers and staff/agents, there was previously no
 * way to fix a typo'd name, update a phone number, or change an
 * investor's payout preference from the admin side at all once the
 * account was created, only the investor themselves could change their
 * payout destination, from their own portal. Email is editable here too,
 * since it doubles as their sign-in, updated in Supabase Auth first (so
 * a failure there never leaves Postgres and Supabase Auth disagreeing
 * about what an investor's email is) and only written to Postgres once
 * that succeeds. Returns `{error?}` rather than throwing, this is called
 * from a Client Component, not a plain form action, see the Module 25/26
 * README entries for why that distinction matters.
 */
export async function updateInvestor(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!user.permissions.has(PERMISSIONS.INVESTORS_MANAGE)) {
    return { error: "Your role doesn't include permission to edit investors." };
  }

  const investorId = String(formData.get("investorId") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const payoutDestination = formData.get("payoutDestination") === "WALLET" ? "WALLET" : "BANK";

  if (!investorId) return { error: "Missing investor." };
  if (!fullName || !email) return { error: "Full name and email are required." };

  const investor = await prisma.investorProfile.findUnique({ where: { id: investorId }, include: { user: true } });
  if (!investor) return { error: "That investor no longer exists." };

  if (email !== investor.user.email) {
    const existing = await prisma.user.findFirst({ where: { email, NOT: { id: investor.user.id } } });
    if (existing) return { error: "That email is already in use by another account." };

    const supabaseAdmin = createSupabaseServiceRoleClient();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(investor.user.authId, { email, email_confirm: true });
    if (error) return { error: `Could not update their sign in email: ${error.message}` };
  }

  await prisma.user.update({
    where: { id: investor.user.id },
    data: { fullName, email, phone: phone || null },
  });
  await prisma.investorProfile.update({
    where: { id: investorId },
    data: { defaultPayoutDestination: payoutDestination },
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: "investor.update",
    entityType: "InvestorProfile",
    entityId: investorId,
    beforeState: { fullName: investor.user.fullName, email: investor.user.email, phone: investor.user.phone },
    afterState: { fullName, email, phone: phone || null, payoutDestination },
  });

  revalidatePath("/admin/investors");
  revalidatePath(`/admin/investors/${investorId}`);
  return {};
}

/**
 * Lets staff enter or correct an investor's bank account on the investor's
 * own admin detail page. Reported directly: "i just noticed there isn't
 * place where to add investor's bank details i think it should be under
 * or when creating contract right ?" It goes on the investor's own record
 * rather than on the contract, an investor's bank account is a property of
 * them, not of any one contract, and this now matches how an investor sets
 * it themselves on /investor/payout-details (updatePayoutDetails in
 * lib/actions/investor-profile.ts): the account is resolved against
 * Paystack before saving, so it can never be pointed at an account that
 * doesn't exist, and any existing `paystackRecipientCode` is cleared so
 * the next payout batch creates a fresh transfer recipient for the new
 * account rather than continuing to pay the old one. This is the admin
 * counterpart, scoped by `investorId` and gated on INVESTORS_MANAGE,
 * updatePayoutDetails only ever acts on the signed-in investor and can't
 * be reused here.
 */
export async function updateInvestorBankDetails(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!user.permissions.has(PERMISSIONS.INVESTORS_MANAGE)) {
    return { error: "Your role doesn't include permission to edit investors." };
  }

  const investorId = String(formData.get("investorId") ?? "").trim();
  const bankCode = String(formData.get("bankCode") ?? "").trim();
  const accountNumber = String(formData.get("accountNumber") ?? "").trim();

  if (!investorId) return { error: "Missing investor." };
  if (!bankCode || !accountNumber) return { error: "Choose a bank and enter an account number." };
  if (!/^\d{10}$/.test(accountNumber)) return { error: "Nigerian account numbers are 10 digits." };

  const investor = await prisma.investorProfile.findUnique({ where: { id: investorId } });
  if (!investor) return { error: "That investor no longer exists." };

  const provider = await getPaymentProvider();
  let accountName: string;
  try {
    const resolved = await provider.resolveBankAccount({ accountNumber, bankCode });
    accountName = resolved.accountName;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not verify this account.";
    return { error: `Could not verify this account with the bank: ${message}` };
  }

  await prisma.investorProfile.update({
    where: { id: investorId },
    data: {
      bankCode,
      bankAccountNumber: accountNumber,
      bankAccountName: accountName,
      paystackRecipientCode: null,
    },
  });

  await writeAuditLog({
    actorUserId: user.id,
    action: "investor.bank_details.update",
    entityType: "InvestorProfile",
    entityId: investorId,
    beforeState: { bankCode: investor.bankCode, bankAccountNumber: investor.bankAccountNumber },
    afterState: { bankCode, bankAccountNumber: accountNumber, bankAccountName: accountName },
  });

  revalidatePath(`/admin/investors/${investorId}`);
  return {};
}

/**
 * Staff can now generate a fresh temporary password for an investor
 * directly, requested alongside the same for drivers and staff/agents:
 * "admin/assigned staff should be able to manage investor, agents,
 * drivers and staff accounts this include changing their password."
 * Same generated-password pattern as account creation
 * (`createInvestor` above): a new random temporary password is set
 * directly in Supabase Auth (never chosen by staff, never typed by
 * anyone but the investor themselves afterward), shown once on this
 * page for staff to relay, and `mustChangePassword` is set back to
 * true so the investor is forced through `/change-password` the next
 * time they sign in rather than being left on a password staff also
 * now know.
 */
export async function resetInvestorPassword(formData: FormData): Promise<{ error?: string; temporaryPassword?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!user.permissions.has(PERMISSIONS.INVESTORS_MANAGE)) {
    return { error: "Your role doesn't include permission to reset an investor's password." };
  }

  const investorId = String(formData.get("investorId") ?? "").trim();
  if (!investorId) return { error: "Missing investor." };

  const investor = await prisma.investorProfile.findUnique({ where: { id: investorId }, include: { user: true } });
  if (!investor) return { error: "That investor no longer exists." };

  const temporaryPassword = generateTemporaryPassword();
  const supabaseAdmin = createSupabaseServiceRoleClient();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(investor.user.authId, { password: temporaryPassword });
  if (error) return { error: `Could not reset their password: ${error.message}` };

  await prisma.user.update({ where: { id: investor.user.id }, data: { mustChangePassword: true } });

  await writeAuditLog({
    actorUserId: user.id,
    action: "investor.password_reset",
    entityType: "User",
    entityId: investor.user.id,
  });

  return { temporaryPassword };
}

/**
 * Manual retry for an investor whose Paystack Dedicated Virtual Account
 * (their deposit account, Module 41) either failed at creation time or,
 * for every investor created before this module, was never attempted at
 * all. Surfaced as a plain `<form action={fn}>` button on
 * /admin/investors/[id] for any investor with no collection account yet.
 * Same Module 25 fix as retryAgentCollectionAccount in
 * lib/actions/staff.ts: provisionInvestorCollectionAccount never throws
 * by design, so this redirects back to the same page with the real
 * message in the query string (read and shown as a banner there) instead
 * of throwing it into Next's generic error boundary.
 */
export async function retryInvestorCollectionAccount(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.INVESTORS_MANAGE);

  const investorId = String(formData.get("investorId") ?? "").trim();
  if (!investorId) throw new Error("Missing investor.");

  const result = await provisionInvestorCollectionAccount(investorId, user.id);
  if (!result.ok) {
    redirect(`/admin/investors/${investorId}?collectionAccountError=${encodeURIComponent(result.error)}`);
  }

  revalidatePath(`/admin/investors/${investorId}`);
}

/**
 * Staff approving an investor's own request to change their payout bank
 * account (Module 41, see requestPayoutDetailsChange in
 * lib/actions/investor-profile.ts). This is the moment the account
 * actually changes: InvestorProfile is updated from the request's already-
 * Paystack-resolved details, exactly the same fields
 * updateInvestorBankDetails above sets when staff enter an account
 * directly, including clearing paystackRecipientCode so the next payout
 * batch creates a fresh transfer recipient rather than continuing to pay
 * whatever account was on file before.
 */
export async function approveBankChangeRequest(formData: FormData): Promise<{ error?: string } | void> {
  const requestId = String(formData.get("requestId") ?? "").trim();

  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.INVESTORS_MANAGE);
  if (!user.staff) throw new ForbiddenError(PERMISSIONS.INVESTORS_MANAGE);

  const request = await prisma.investorBankChangeRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { investor: { include: { user: true } } },
  });

  if (request.status !== "PENDING_APPROVAL") {
    return { error: `This request is already ${request.status.toLowerCase().replaceAll("_", " ")}.` };
  }

  await prisma.$transaction(async (tx) => {
    await tx.investorProfile.update({
      where: { id: request.investorId },
      data: {
        bankCode: request.bankCode,
        bankAccountNumber: request.accountNumber,
        bankAccountName: request.accountName,
        paystackRecipientCode: null,
      },
    });
    await tx.investorBankChangeRequest.update({
      where: { id: request.id },
      data: { status: "APPROVED", reviewedById: user.staff!.id, reviewedAt: new Date() },
    });
    await writeAuditLog(
      {
        actorUserId: user.id,
        action: "investor_bank_change_request.approve",
        entityType: "InvestorBankChangeRequest",
        entityId: request.id,
        beforeState: {
          bankAccountNumber: request.investor.bankAccountNumber,
          bankAccountName: request.investor.bankAccountName,
        },
        afterState: { bankAccountNumber: request.accountNumber, bankAccountName: request.accountName },
      },
      tx
    );
  });

  await sendNotification({
    userId: request.investor.userId,
    type: "bank_change_approved",
    title: "Your bank change request was approved",
    body: `Your payout account is now ${request.accountName} (${request.accountNumber}).`,
    channels: ["EMAIL", "SMS"],
  });

  revalidatePath("/admin/investors/bank-change-requests");
  revalidatePath(`/admin/investors/${request.investorId}`);
  revalidatePath("/investor/payout-details");
}

/**
 * Staff declining a bank change request. Nothing on InvestorProfile was
 * ever touched for a request that hasn't been approved, so this is a pure
 * status change, same as rejectWalletWithdrawal in lib/actions/wallet.ts.
 */
export async function rejectBankChangeRequest(formData: FormData): Promise<{ error?: string } | void> {
  const requestId = String(formData.get("requestId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();

  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.INVESTORS_MANAGE);
  if (!user.staff) throw new ForbiddenError(PERMISSIONS.INVESTORS_MANAGE);

  const request = await prisma.investorBankChangeRequest.findUniqueOrThrow({
    where: { id: requestId },
    include: { investor: true },
  });

  if (request.status !== "PENDING_APPROVAL") {
    return { error: `This request is already ${request.status.toLowerCase().replaceAll("_", " ")}.` };
  }

  await prisma.investorBankChangeRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", reviewedById: user.staff.id, reviewedAt: new Date(), reviewNote: reason || null },
  });
  await writeAuditLog({
    actorUserId: user.id,
    action: "investor_bank_change_request.reject",
    entityType: "InvestorBankChangeRequest",
    entityId: requestId,
    beforeState: { status: request.status },
    afterState: { status: "REJECTED", reviewNote: reason || null },
  });

  await sendNotification({
    userId: request.investor.userId,
    type: "bank_change_rejected",
    title: "Your bank change request was declined",
    body: reason
      ? `Your request to change your payout account was declined: "${reason}". Your existing account on file is unchanged.`
      : "Your request to change your payout account was declined. Your existing account on file is unchanged.",
    channels: ["EMAIL", "SMS"],
  });

  revalidatePath("/admin/investors/bank-change-requests");
  revalidatePath(`/admin/investors/${request.investorId}`);
  revalidatePath("/investor/payout-details");
}
