import * as Sentry from "@sentry/nextjs";

import { authenticateApiRequest, apiError } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma";
import { createSupabaseServiceRoleClient, createSupabaseAnonClient } from "@/lib/supabase/server";
import { sendNotification } from "@/lib/notifications/send-notification";

/**
 * Module 38: this app's first `/api/v1` mutation route, every route before
 * this only ever read data. Mirrors `changePassword` (`lib/actions/auth.ts`)
 * field for field and step for step: same current-password re-verification
 * through a throwaway anon client (never trust a request just because it
 * carries a valid session token, a leaked token alone shouldn't be enough
 * to take over the account's password), same service-role update, same
 * `mustChangePassword` clear, same "your password was changed" alert over
 * both email and SMS. Only the transport differs, a bearer token and a JSON
 * body instead of a signed-in Server Action's form submission, so
 * keke-mobile's Security screen has something to call.
 */
export async function POST(request: Request) {
  const user = await authenticateApiRequest(request);
  if (!user) return apiError(401, "Not signed in.");

  const body = await request.json().catch(() => null);
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : "";

  if (!currentPassword || !newPassword) {
    return apiError(400, "Enter your current password and choose a new one.");
  }
  if (newPassword.length < 8) {
    return apiError(400, "Your new password must be at least 8 characters.");
  }
  if (newPassword !== confirmPassword) {
    return apiError(400, "Those new passwords don't match.");
  }
  if (newPassword === currentPassword) {
    return apiError(400, "Choose a password different from your current one.");
  }

  const verifier = createSupabaseAnonClient();
  const { error: verifyError } = await verifier.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    return apiError(401, "Your current password is incorrect.");
  }

  const supabaseAdmin = createSupabaseServiceRoleClient();
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.authId, {
    password: newPassword,
  });
  if (updateError) {
    Sentry.captureException(updateError, { contexts: { changePassword: { userId: user.id } } });
    return apiError(500, `Could not update your password: ${updateError.message}`);
  }

  await prisma.user.update({ where: { id: user.id }, data: { mustChangePassword: false } });

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

  return Response.json({ ok: true });
}
