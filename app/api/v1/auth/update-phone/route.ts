import * as Sentry from "@sentry/nextjs";

import { authenticateApiRequest, apiError } from "@/lib/api/auth";
import { prisma } from "@/lib/prisma";
import { sendNotification } from "@/lib/notifications/send-notification";

/**
 * Module 39: lets a signed-in user update their own phone number, the
 * "settings" screen should let the investor change their phone but NOT
 * their email, in the project owner's words. Email deliberately stays
 * out of reach here: it doubles as the Supabase Auth sign-in identity,
 * changing it needs the service-role client and already exists as an
 * admin-only capability (`updateInvestor`, `lib/actions/investors.ts`),
 * a bigger and riskier change than a plain contact-detail update. Phone
 * has no such entanglement, it is a plain column on `User`
 * (`prisma/schema.prisma`) used only for outbound SMS via Termii
 * (`lib/notifications/termii-provider.ts`), so this is a direct
 * `prisma.user.update`, no Supabase Admin API call needed the way
 * change-password above needs one.
 *
 * Portal-agnostic like change-password: any signed-in user can update
 * their own phone number, no permission check beyond "is this your own
 * account." Only keke-mobile's Security screen calls this today, but
 * nothing here is investor-specific, a web self-service settings page
 * for the other portals could call it unchanged if one gets built later.
 */
export async function POST(request: Request) {
  const user = await authenticateApiRequest(request);
  if (!user) return apiError(401, "Not signed in.");

  const body = await request.json().catch(() => null);
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";

  if (!phone) return apiError(400, "Enter a phone number.");

  const digitCount = phone.replace(/[^\d]/g, "").length;
  if (digitCount < 10 || digitCount > 15) {
    return apiError(400, "Enter a valid phone number, digits only aside from a leading +.");
  }

  try {
    await prisma.user.update({ where: { id: user.id }, data: { phone } });
  } catch (err) {
    Sentry.captureException(err, { contexts: { updatePhone: { userId: user.id } } });
    return apiError(500, "Could not update your phone number. Try again.");
  }

  // EMAIL only, not SMS: the whole point of this alert is to warn someone
  // if a phone number change was not their own doing, sending it to the
  // number that just changed would not reach them in exactly that case.
  await sendNotification({
    userId: user.id,
    type: "phone_number_changed",
    title: "Your phone number was updated",
    body: `The phone number on your Ultimate account was just changed to ${phone}. If this wasn't you, contact an administrator immediately so your account can be secured.`,
    channels: ["EMAIL"],
  });

  return Response.json({ ok: true, phone });
}
