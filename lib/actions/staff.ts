"use server";

import { randomInt } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/rbac/check-permission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/lib/audit";
import { provisionAgentCollectionAccount } from "@/lib/payments/collection-account";
import { sendNotification } from "@/lib/notifications/send-notification";

// Same word list and shape as lib/actions/investors.ts's generator, kept
// separate rather than shared since these two account types are created
// from different screens with different permission gates, a shared helper
// would only save a few lines at the cost of an extra import to trace.
const WORDS = ["keke", "gold", "kano", "abuja", "lagos", "river", "market", "tiger", "amber", "delta"];

function generateTemporaryPassword(): string {
  const word = WORDS[randomInt(0, WORDS.length)];
  const digits = String(randomInt(1000, 9999));
  return `${word[0].toUpperCase()}${word.slice(1)}${digits}!`;
}

const VALID_ACCOUNT_TYPES = ["STAFF", "AGENT"] as const;
type AccountType = (typeof VALID_ACCOUNT_TYPES)[number];

/**
 * Onboards a real staff or agent account, this was the last account type
 * with no in-app creation flow, staff and agents previously had to be
 * created directly in the database or through a seed script. Same
 * reasoning as createInvestor in lib/actions/investors.ts: a Supabase Auth
 * user is created directly with a generated password rather than an email
 * invite, since that depends on Supabase's outgoing email working. Staff
 * relay the password shown on the confirmation screen to the new hire
 * directly. `mustChangePassword: true` (Module 26) forces them to
 * `/change-password` before they can use anything else, they are never
 * left running on the temporary password permanently.
 *
 * Module 43: every real, user-reachable validation and Supabase-failure
 * throw below converted to a `{ error?: string }` return, this was bound
 * to a plain `<form action={createStaffOrAgentAccount}>` on
 * `/admin/settings/staff/new`, see `components/ui/action-form.tsx`'s doc
 * comment.
 */
export async function createStaffOrAgentAccount(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.STAFF_MANAGE);

  const accountTypeInput = String(formData.get("accountType") ?? "");
  const accountType = (VALID_ACCOUNT_TYPES as readonly string[]).includes(accountTypeInput)
    ? (accountTypeInput as AccountType)
    : null;
  if (!accountType) {
    return { error: "Choose whether this is a staff or agent account." };
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();
  const roleId = String(formData.get("roleId") ?? "").trim();

  if (!fullName || !email) {
    return { error: "Full name and email are required." };
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
      ...(accountType === "STAFF"
        ? { staff: { create: { jobTitle: jobTitle || null } } }
        : { agent: { create: { region: region || null } } }),
    },
    include: { agent: true },
  });

  // Assigning a role now is optional, an admin can always do it later from
  // /admin/settings/roles/[id], this just saves the extra trip when they
  // already know which role this person needs.
  if (roleId) {
    await prisma.roleAssignment.create({ data: { userId: newUser.id, roleId } });
  }

  await writeAuditLog({
    actorUserId: user.id,
    action: "user.create_staff_or_agent",
    entityType: "User",
    entityId: newUser.id,
    afterState: { accountType, fullName, email, roleId: roleId || null },
  });

  // Best-effort, deliberately not awaited into a blocking failure: a new
  // agent's Paystack collection account failing to provision (missing
  // PAYSTACK_SECRET_KEY, Paystack being briefly down) must never prevent
  // the account itself from being created, staff can retry it afterward
  // from /admin/settings/staff, see retryAgentCollectionAccount below.
  if (newUser.agent) {
    await provisionAgentCollectionAccount(newUser.agent.id, user.id);
  }

  // Same welcome message every other account-creation path now sends,
  // see createInvestor's own comment for why the temporary password
  // itself is never included.
  await sendNotification({
    userId: newUser.id,
    type: "account_created",
    title: "Your Ultimate account is ready",
    body: `An Ultimate ${accountType === "STAFF" ? "staff" : "agent"} account has been created for you. Whoever set this up will share your sign-in details with you shortly.`,
    channels: ["EMAIL", "SMS"],
  });

  // Module 51: staff and agents now have entirely separate list/detail
  // screens (/admin/settings/staff vs /admin/agents, see lib/data/agents.ts's
  // own comment for why), so the confirmation screen after creating one
  // has to land on that same account type's own success page, not always
  // the staff one.
  const successPath = accountType === "AGENT" ? "/admin/agents/new/success" : "/admin/settings/staff/new/success";
  redirect(
    `${successPath}?name=${encodeURIComponent(fullName)}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(temporaryPassword)}&type=${accountType}`
  );
}

/**
 * Manual retry for an agent whose collection account either failed at
 * creation time or, for every agent created before this module, was
 * never attempted at all, provisionAgentCollectionAccount used to exist
 * but nothing ever called it. Surfaced as a button next to any agent row
 * on /admin/settings/staff that has no collection account yet.
 *
 * Module 25 bug fix: this used to `throw new Error(result.error)` on
 * failure, which crashed the whole Server Action and left whoever
 * clicked it staring at Next's generic error boundary with an error
 * reference number and no idea what actually went wrong.
 * provisionAgentCollectionAccount never throws by design, it always
 * returns a plain result specifically so its real error message (Paystack
 * rejecting an invalid key, an unverified business category, a bad bank
 * code, and so on) could be shown to the person who needs to act on it,
 * this action was just discarding that message into a crash instead of
 * displaying it. Likely never actually hit in earnest before, since
 * exercising it needs a real (mis)configured PAYSTACK_SECRET_KEY. Fixed
 * by redirecting back to the same page with the real message in the
 * query string, which the page reads and shows as a banner, instead of
 * throwing.
 */
export async function retryAgentCollectionAccount(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.STAFF_MANAGE);

  const agentId = String(formData.get("agentId") ?? "").trim();
  if (!agentId) throw new Error("Missing agent.");

  const result = await provisionAgentCollectionAccount(agentId, user.id);
  if (!result.ok) {
    // Module 51: agents moved to their own /admin/agents screen.
    redirect(`/admin/agents?collectionAccountError=${encodeURIComponent(result.error)}`);
  }

  revalidatePath("/admin/agents");
  redirect("/admin/agents");
}

/**
 * Module 27: editing an existing staff or agent's own record, added
 * alongside the equivalent for investors and drivers, there was
 * previously no way to fix a typo'd name, update a phone number, or
 * change a job title/region from the admin side once the account was
 * created. Deliberately does not let accountType itself change (STAFF
 * versus AGENT), converting one profile type to the other mid-flight
 * would mean deciding what happens to an agent's collection account or a
 * staff member's approvals history, out of scope here, that would need
 * its own dedicated flow. Returns `{error?}` rather than throwing,
 * called from a Client Component, not a plain form action.
 */
export async function updateStaffOrAgentAccount(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!user.permissions.has(PERMISSIONS.STAFF_MANAGE)) {
    return { error: "Your role doesn't include permission to edit staff and agent accounts." };
  }

  const userId = String(formData.get("userId") ?? "").trim();
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  const region = String(formData.get("region") ?? "").trim();

  if (!userId) return { error: "Missing account." };
  if (!fullName || !email) return { error: "Full name and email are required." };

  const account = await prisma.user.findUnique({ where: { id: userId }, include: { staff: true, agent: true } });
  if (!account) return { error: "That account no longer exists." };
  if (!account.staff && !account.agent) return { error: "That account isn't a staff or agent account." };

  if (email !== account.email) {
    const existing = await prisma.user.findFirst({ where: { email, NOT: { id: userId } } });
    if (existing) return { error: "That email is already in use by another account." };

    const supabaseAdmin = createSupabaseServiceRoleClient();
    const { error } = await supabaseAdmin.auth.admin.updateUserById(account.authId, { email, email_confirm: true });
    if (error) return { error: `Could not update their sign in email: ${error.message}` };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { fullName, email, phone: phone || null },
  });

  if (account.staff) {
    await prisma.staffProfile.update({ where: { userId }, data: { jobTitle: jobTitle || null } });
  } else if (account.agent) {
    await prisma.agent.update({ where: { userId }, data: { region: region || null } });
  }

  await writeAuditLog({
    actorUserId: user.id,
    action: "user.update_staff_or_agent",
    entityType: "User",
    entityId: userId,
    beforeState: { fullName: account.fullName, email: account.email, phone: account.phone },
    afterState: { fullName, email, phone: phone || null, jobTitle: jobTitle || null, region: region || null },
  });

  // Module 51: revalidate whichever screen this account actually lives
  // on now, staff and agents no longer share one list/detail path.
  if (account.staff) {
    revalidatePath("/admin/settings/staff");
    revalidatePath(`/admin/settings/staff/${userId}`);
  } else {
    revalidatePath("/admin/agents");
    revalidatePath(`/admin/agents/${userId}`);
  }
  return {};
}

/**
 * Generates a fresh temporary password for a staff or agent account,
 * requested alongside the same for investors and drivers:
 * "admin/assigned staff should be able to manage investor, agents,
 * drivers and staff accounts this include changing their password."
 * Same shape as resetInvestorPassword in lib/actions/investors.ts: a new
 * random password set directly in Supabase Auth, shown once for whoever
 * reset it to relay, `mustChangePassword` set back to true so the account
 * is forced through `/change-password` next time it signs in. Gated on
 * `staff.manage`, the same permission `createStaffOrAgentAccount` and
 * `updateStaffOrAgentAccount` above already require, deliberately not
 * open to a broader set of roles: this can reset any staff or agent
 * account's password, including another admin's.
 */
export async function resetStaffOrAgentPassword(formData: FormData): Promise<{ error?: string; temporaryPassword?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };
  if (!user.permissions.has(PERMISSIONS.STAFF_MANAGE)) {
    return { error: "Your role doesn't include permission to reset a staff or agent's password." };
  }

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) return { error: "Missing account." };

  const account = await prisma.user.findUnique({ where: { id: userId }, include: { staff: true, agent: true } });
  if (!account) return { error: "That account no longer exists." };
  if (!account.staff && !account.agent) return { error: "That account isn't a staff or agent account." };

  const temporaryPassword = generateTemporaryPassword();
  const supabaseAdmin = createSupabaseServiceRoleClient();
  const { error } = await supabaseAdmin.auth.admin.updateUserById(account.authId, { password: temporaryPassword });
  if (error) return { error: `Could not reset their password: ${error.message}` };

  await prisma.user.update({ where: { id: userId }, data: { mustChangePassword: true } });

  await writeAuditLog({
    actorUserId: user.id,
    action: "user.password_reset",
    entityType: "User",
    entityId: userId,
  });

  return { temporaryPassword };
}
