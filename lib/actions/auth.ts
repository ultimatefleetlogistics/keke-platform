"use server";

import * as Sentry from "@sentry/nextjs";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { createSupabaseServiceRoleClient, createSupabaseAnonClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isPlatformAdmin } from "@/lib/rbac/check-permission";
import { writeAuditLog } from "@/lib/audit";
import { sendNotification } from "@/lib/notifications/send-notification";
import { isAgentDriverPortalEnabled, AGENT_DRIVER_PORTAL_DISABLED_MESSAGE } from "@/lib/config/portal-access";

/**
 * Called right after a Supabase password sign-in resolves client-side, on
 * both /sign-in and /admin/sign-in, to check whether the account that
 * just signed in holds the owner-tier Admin role. The browser's Supabase
 * client already set the session cookie by the time this runs, so
 * getCurrentUser() here sees the account that just signed in, not
 * whatever was signed in before.
 */
export async function verifyAdminAccess(): Promise<{ isAdmin: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { isAdmin: false };
  const isAdmin = await isPlatformAdmin(user.id);
  return { isAdmin };
}

/**
 * Module 24 bug fix, generalized round nine. /sign-in used to have an
 * "Investor" / "Staff / Agent / Driver" tab, and which tab was selected,
 * not the credentials actually typed, decided where a successful sign-in
 * landed: the "Investor" tab (the default one) just pushed straight to
 * /investor/dashboard with no check at all, so a staff, agent, or driver
 * account signing in on that tab got a confusing "no investor profile"
 * message instead of their real dashboard, even though the password
 * itself was completely correct, Supabase Auth was never checking which
 * tab was selected either. Direct user feedback caught this on the
 * mobile app first, where the equivalent tabs turned out to do nothing
 * at all (keke-mobile's `GET /api/v1/me` already ignores them
 * completely), the same fix belongs here: resolve the signed-in
 * account's real portal directly instead of trusting a UI tab to know
 * it in advance. Called the same way verifyAdminAccess is, right after
 * the browser's Supabase client resolves the sign-in, so
 * getCurrentUser() here sees the account that just signed in. Checked in
 * this order because a real deployment could technically have a User row
 * with more than one profile attached (nothing stops it at the schema
 * level): staff first as the most privileged, then agent, then driver,
 * then investor, the same priority order `GET /api/v1/me` already uses
 * for the mobile app's own `portal` field.
 *
 * Module 58: checked here too, before the agent/driver branches below,
 * the same gate `GET /api/v1/me` applies for the mobile app — see
 * `lib/config/portal-access.ts`'s doc comment for the full reasoning.
 * An agent or driver account whose credentials are completely correct
 * still gets a clear, honest error here rather than landing on
 * `/agent/dashboard` or `/driver/dashboard` at all, matching a real
 * login failure's UX (stays on `/sign-in`, sees why) rather than a
 * redirect-then-bounce-back. Staff is checked first and is never
 * affected by this flag.
 */
export async function resolvePortalDestination(): Promise<{ path: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You're not signed in." };
  if (user.staff) return { path: "/admin/dashboard" };
  if ((user.agent || user.driver) && !isAgentDriverPortalEnabled()) {
    return { error: AGENT_DRIVER_PORTAL_DISABLED_MESSAGE };
  }
  if (user.agent) return { path: "/agent/dashboard" };
  if (user.driver) return { path: "/driver/dashboard" };
  if (user.investor) return { path: "/investor/dashboard" };
  return { error: "This account isn't set up yet. Contact an administrator." };
}

/**
 * Self-service investor sign up. Creates the Supabase Auth user directly
 * with the password the investor just chose (email_confirm true), the
 * same reasoning as staff-created investors in lib/actions/investors.ts:
 * this avoids depending on Supabase's outgoing email and a redirect URL
 * allow-list. The difference here is the investor picks their own
 * password instead of being handed a generated one, so once this
 * succeeds the sign up page signs them straight in with it, no separate
 * confirmation step. Returns a plain object rather than redirecting or
 * throwing, since the caller is a Client Component that still needs to
 * establish the browser session afterward with the same credentials.
 */
export async function signUpInvestor(formData: FormData): Promise<{ error?: string }> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phone = String(formData.get("phone") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || !password) {
    return { error: "Full name, email and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "An account with this email already exists, try signing in instead." };
  }

  const supabaseAdmin = createSupabaseServiceRoleClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) {
    return { error: error.message };
  }

  try {
    const newUser = await prisma.user.create({
      data: { authId: data.user.id, email, phone: phone || null, fullName, investor: { create: {} } },
    });
    const investorRole = await prisma.role.findUniqueOrThrow({ where: { name: "Investor" } });
    await prisma.roleAssignment.create({ data: { userId: newUser.id, roleId: investorRole.id } });

    // Requested directly: a welcome message here too, same as every
    // staff-created account now gets (createInvestor, createDriver,
    // createStaffOrAgentAccount). Unlike those, this one picked their own
    // password and is about to be signed straight in with it by the sign
    // up page itself, so there is no temporary password to withhold, just
    // a plain welcome.
    await sendNotification({
      userId: newUser.id,
      type: "account_created",
      title: "Welcome to Ultimate",
      body: "Your investor account is ready. Sign in anytime to track your investment.",
      channels: ["EMAIL", "SMS"],
    });
  } catch (dbError) {
    // The Auth user and the Postgres rows aren't one transaction, if the
    // second half fails, undo the first half so retrying this email
    // doesn't just hit "already exists" against a half-created account.
    // This path only runs when Postgres itself, not a validation check, is
    // the problem, worth knowing about even though the investor already
    // sees a clear error and can just try again.
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    Sentry.captureException(dbError, { contexts: { signUp: { email } } });
    const message = dbError instanceof Error ? dbError.message : "Could not finish creating your account.";
    return { error: message };
  }

  return {};
}

/**
 * Module 25: creates the very first Admin account for a brand new
 * deployment. Every other account-creation flow in this app
 * (createInvestor, createStaffOrAgentAccount) requires a signed-in staff
 * member holding a specific permission, which is exactly the
 * chicken-and-egg problem on a fresh database: nobody has any permission
 * yet, and staff.manage itself only exists to grant to someone by an
 * Admin who doesn't exist. Before this, the only way in was a manual edit
 * against the database or the Supabase dashboard.
 *
 * /setup (see proxy.ts's public paths) is reachable without signing in,
 * so it is double-gated instead of permission-gated: it refuses outright
 * unless SETUP_BOOTSTRAP_KEY is set and matches what was submitted (a
 * secret only whoever configured the deployment's environment variables
 * knows), and it refuses unless the database has zero StaffProfile rows,
 * so it permanently disables itself the moment a first admin exists, whether
 * created here or by hand. The key is compared with plain string
 * equality rather than the timing-safe comparison
 * verifyPaystackSignature uses: that one defends a webhook endpoint an
 * attacker can hit at high volume to slowly leak a signature byte by
 * byte, this is a one-time setup secret typed once by a developer, the
 * threat model does not call for it.
 *
 * The zero-staff check and the account creation below are not one
 * transaction (Supabase Auth is a separate external call in between, the
 * same reason signUpInvestor above cannot make its checks and its create
 * atomic either), so two people submitting this form at the same instant
 * on a brand new database could both pass the check and both end up with
 * an Admin account. Worth knowing about, not worth guarding against: the
 * only person who can reach that outcome already holds the setup key,
 * and the failure mode is "two admins instead of one," not a security
 * hole.
 */
export async function bootstrapFirstAdmin(formData: FormData): Promise<{ error?: string }> {
  const setupKey = process.env.SETUP_BOOTSTRAP_KEY;
  if (!setupKey) {
    return {
      error: "Setup is disabled. Set SETUP_BOOTSTRAP_KEY in the environment to enable it, see .env.example.",
    };
  }

  const suppliedKey = String(formData.get("setupKey") ?? "");
  if (suppliedKey !== setupKey) {
    return { error: "Incorrect setup key." };
  }

  const existingStaffCount = await prisma.staffProfile.count();
  if (existingStaffCount > 0) {
    return {
      error: "Setup has already been completed, a staff account already exists. Sign in at /admin-sign-in instead.",
    };
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!fullName || !email || !password) {
    return { error: "Full name, email, and password are required." };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters." };
  }

  const adminRole = await prisma.role.findUnique({ where: { name: "Admin" } });
  if (!adminRole) {
    return {
      error: "The Admin role doesn't exist yet, run npm run db:seed first, it creates the fixed system roles.",
    };
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return { error: "An account with this email already exists, try signing in instead." };
  }

  const supabaseAdmin = createSupabaseServiceRoleClient();
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) {
    return { error: error.message };
  }

  try {
    const newUser = await prisma.user.create({
      data: { authId: data.user.id, email, fullName, staff: { create: {} } },
    });
    await prisma.roleAssignment.create({ data: { userId: newUser.id, roleId: adminRole.id } });
    await writeAuditLog({
      actorUserId: newUser.id,
      action: "auth.bootstrap_admin",
      entityType: "User",
      entityId: newUser.id,
      afterState: { fullName, email },
    });
  } catch (dbError) {
    // Same rollback reasoning as signUpInvestor above: the Auth user and
    // the Postgres rows are not one transaction, undo the first half so
    // retrying this email doesn't just hit "already exists" against a
    // half-created account.
    await supabaseAdmin.auth.admin.deleteUser(data.user.id);
    Sentry.captureException(dbError, { contexts: { bootstrapAdmin: { email } } });
    const message = dbError instanceof Error ? dbError.message : "Could not finish creating the admin account.";
    return { error: message };
  }

  return {};
}

/**
 * Module 26: lets anyone signed in, whichever portal they belong to,
 * change their own password. Used two ways from the same one page,
 * /change-password: as a forced first step for any account someone else
 * created for them with a generated temporary password (investor, agent,
 * driver, or staff accounts created via createInvestor, createDriver, or
 * createStaffOrAgentAccount all set User.mustChangePassword true, every
 * portal layout redirects here until it's cleared), and as a voluntary
 * "change my password" reachable from AppShell any other time.
 *
 * Always requires the current password, even on the forced first change:
 * proving they actually have the temporary password they were handed is
 * cheap and real security, skipping that check would mean anyone who
 * found a signed-in browser tab left open, not just the account holder,
 * could silently take the account over by "changing" its password.
 * Verified with signInWithPassword against a throwaway anon client
 * (createSupabaseAnonClient), never the request's own cookie-bound
 * client, see that function's doc comment for why.
 */
export async function changePassword(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword || !newPassword) {
    return { error: "Enter your current password and choose a new one." };
  }
  if (newPassword.length < 8) {
    return { error: "Your new password must be at least 8 characters." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Those new passwords don't match." };
  }
  if (newPassword === currentPassword) {
    return { error: "Choose a password different from your current one." };
  }

  const verifier = createSupabaseAnonClient();
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return { error: "Your current password is incorrect." };
  }

  const supabaseAdmin = createSupabaseServiceRoleClient();
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.authId, {
    password: newPassword,
  });
  if (updateError) {
    Sentry.captureException(updateError, { contexts: { changePassword: { userId: user.id } } });
    return { error: `Could not update your password: ${updateError.message}` };
  }

  await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });

  // Requested directly: a security alert whenever a password changes, the
  // same way most real accounts work, so the account holder finds out even
  // if they weren't the one who did it (a shared device, a compromised
  // session that reset the password before this app's own MFA gate ever
  // saw it). Both EMAIL and SMS, not email-only: this is exactly the kind
  // of alert someone is most likely to actually notice fast on a phone,
  // matching the account-security notifications elsewhere in this app
  // (KYC status, withdrawal decisions) that already go over both channels.
  // Fire-and-await like every other sendNotification call site, never
  // throws, so a Resend or Termii outage can't make the password change
  // itself look like it failed.
  await sendNotification({
    userId: user.id,
    type: "password_changed",
    title: "Your password was changed",
    body: "Your Ultimate account password was just changed. If this wasn't you, contact an administrator immediately so your account can be secured.",
    channels: ["EMAIL", "SMS"],
  });

  return {};
}

/**
 * Module 39: lets anyone signed in update their own phone number, the web
 * counterpart to `POST /api/v1/auth/update-phone` (mirrors it field for
 * field, not a shared implementation, same reasoning as changePassword
 * above having both a Server Action and an API route: this app's own
 * pages use Server Actions, keke-mobile has no Server Actions to call so
 * it gets a bearer-token route instead). Used from `/investor/settings`'s
 * "Phone number" card, and, since round ten, `/agent/settings`'s,
 * `/driver/settings`'s, and `/admin/settings/security`'s own copies of
 * that same card too, portal-agnostic so any of them could call it
 * unchanged. (Round eleven renamed the investor, agent, and driver pages
 * from `/security` to `/settings`; admin's own settings hub was already
 * named right and needed no change.)
 *
 * Deliberately no email counterpart anywhere near this: "under the
 * settings user should be able to update phone number but not email
 * address," the project owner's own words. Email doubles as the Supabase
 * Auth sign-in identity, changing it needs the service-role client plus a
 * confirmation step and stays an admin-only capability
 * (`updateInvestor` above).
 */
export async function updateOwnPhone(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "You must be signed in." };

  const phone = String(formData.get("phone") ?? "").trim();
  if (!phone) return { error: "Enter a phone number." };

  const digitCount = phone.replace(/[^\d]/g, "").length;
  if (digitCount < 10 || digitCount > 15) {
    return { error: "Enter a valid phone number, digits only aside from a leading +." };
  }

  try {
    await prisma.user.update({ where: { id: user.id }, data: { phone } });
  } catch (err) {
    Sentry.captureException(err, { contexts: { updateOwnPhone: { userId: user.id } } });
    return { error: "Could not update your phone number. Try again." };
  }

  // EMAIL only, not SMS, same reasoning as the API route: the alert exists
  // to catch a change that wasn't the account holder's own doing, texting
  // the number that just changed wouldn't reach them in exactly that case.
  await sendNotification({
    userId: user.id,
    type: "phone_number_changed",
    title: "Your phone number was updated",
    body: `The phone number on your Ultimate account was just changed to ${phone}. If this wasn't you, contact an administrator immediately so your account can be secured.`,
    channels: ["EMAIL"],
  });

  // Round ten bug fix: this only ever revalidated /investor/security,
  // written back when that was the only page calling this. Once
  // /agent/security, /driver/security, and /admin/settings/security
  // started calling it too, saving a new phone number on any of those
  // would show the old one again until Next.js's cache for that page
  // happened to expire on its own, since only the investor path was
  // ever told to drop its cache. All four portal security pages that
  // use this card now get told.
  //
  // Round eleven renamed the investor, agent, and driver pages from
  // `/security` to `/settings` (see `app/driver/settings/page.tsx`'s
  // own comment), so these three paths were updated to match; admin's
  // own settings hub keeps its `/admin/settings/security` path unchanged.
  revalidatePath("/investor/settings");
  revalidatePath("/agent/settings");
  revalidatePath("/driver/settings");
  revalidatePath("/admin/settings/security");
  return {};
}

/**
 * Module 33: closes the gap flagged in Module 30, disclosed on purpose at
 * the time rather than left for someone to find by trying it. Two-factor
 * authentication on /sign-in only ever covered the password path
 * (handleSignIn below in the page), the magic-link ("send a login link by
 * email") option signed the browser straight in on a clicked link with no
 * code prompt in between, even for an account with a verified
 * authenticator app factor.
 *
 * Of the two fixes Module 30 named, disabling magic-link for any account
 * with MFA turned on versus adding the same AAL check after the redirect,
 * this builds the first. The second would need a real `/auth/callback`
 * route to run the check against, this codebase has never had one (magic
 * links currently land the browser wherever Supabase's own client-side
 * `onAuthStateChange` happens to be), so it is a bigger change with more
 * to get wrong. This one is a single lookup before the email is even
 * sent, no new route, no new redirect flow, and it fails safe: nothing
 * currently reachable from this account exists to lose because a valid
 * password + code sign-in is still right there as the working path,
 * magic-link is a convenience option only.
 *
 * `email`'s corresponding auth id is resolved through this app's own
 * User table (the same lookup signUpInvestor and every account-creation
 * action already do), not a paginated `admin.listUsers()` scan; this
 * Supabase JS version's admin API has no "get user by email" or
 * "list users by email" call, only by id. An email with no matching
 * User row, or an admin-side lookup error, is deliberately *not*
 * blocked, this check only ever adds a block, never a false one, that
 * would turn an admin API hiccup into every magic-link sign-in failing,
 * not just the accounts this is actually meant to protect.
 */
export async function checkMagicLinkBlocked(
  email: string
): Promise<{ blocked: boolean; reason?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const dbUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!dbUser) return { blocked: false };

  const supabaseAdmin = createSupabaseServiceRoleClient();
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(dbUser.authId);
  if (error || !data.user) return { blocked: false };

  const hasVerifiedFactor = (data.user.factors ?? []).some((factor) => factor.status === "verified");
  if (!hasVerifiedFactor) return { blocked: false };

  return {
    blocked: true,
    reason:
      "This account has two-factor authentication turned on. Sign in with your password and authenticator code instead.",
  };
}
