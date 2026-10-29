import * as Sentry from "@sentry/nextjs";

import { prisma } from "@/lib/prisma";
import { getEmailProvider, getSmsProvider } from "./provider";
import { buildAlertEmailHtml, buildAlertSms, type AlertDetails } from "./templates";

type NotificationInput = {
  userId: string;
  type: string; // e.g. "kyc_status_changed", "payment_received", "ownership_transfer_completed"
  title: string;
  body: string;
  channels: Array<"EMAIL" | "SMS">;
  // Module 53: when present, this is what actually renders on both
  // channels — the approved bank-style SMS and receipt-style email (see
  // templates.ts). `title`/`body` are still always stored on the
  // Notification row below, so the admin-facing audit trail keeps reading
  // as a plain sentence regardless of what channel of alert was chosen.
  // Left undefined for non-transaction notifications (account_created,
  // contract_target_achieved), which keep the older plain-text rendering,
  // there is no amount or balance for those to build a receipt around.
  alert?: AlertDetails;
};

/**
 * Sends a notification over one or more channels and records every attempt
 * as a Notification row, PENDING then SENT or FAILED. This never throws,
 * a notification failing to send (a bad phone number, Resend or Termii
 * being down, missing API keys) must never break the business action that
 * triggered it, an investor's payout succeeding is real regardless of
 * whether we managed to text them about it. Callers fire this and move
 * on, they do not await a guarantee of delivery.
 *
 * A FAILED row alone sits in the database with nobody looking, nothing in
 * this app currently surfaces notification failures anywhere in the UI,
 * so a genuine send failure (not the expected "no phone on file" skip
 * below) is also reported to Sentry, that is the only place anyone finds
 * out Resend or Termii is down before an investor calls asking why they
 * never got paid.
 *
 * SMS is skipped, not attempted and marked failed, when the recipient has
 * no phone number on file, that is an expected, common case (phone is
 * optional throughout this app), not an error worth a row for.
 */
export async function sendNotification(input: NotificationInput): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user) return;

  for (const channel of input.channels) {
    if (channel === "SMS" && !user.phone) continue;

    const notification = await prisma.notification.create({
      data: {
        recipientUserId: input.userId,
        channel,
        type: input.type,
        title: input.title,
        body: input.body,
        status: "PENDING",
      },
    });

    try {
      const result =
        channel === "EMAIL"
          ? await (await getEmailProvider()).sendEmail({
              to: user.email,
              subject: input.title,
              html: input.alert ? buildAlertEmailHtml(input.title, input.alert) : `<p>${input.body}</p>`,
            })
          : await (await getSmsProvider()).sendSms({
              to: user.phone!,
              message: input.alert ? buildAlertSms(input.alert) : `${input.title}: ${input.body}`,
            });

      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: result.success ? "SENT" : "FAILED", sentAt: result.success ? new Date() : null },
      });
      if (!result.success) {
        Sentry.captureMessage(`Notification send failed: ${channel} ${input.type}`, {
          level: "warning",
          contexts: { notification: { channel, type: input.type, notificationId: notification.id, error: result.error } },
        });
      }
    } catch (error) {
      await prisma.notification.update({ where: { id: notification.id }, data: { status: "FAILED" } });
      Sentry.captureException(error, {
        contexts: { notification: { channel, type: input.type, notificationId: notification.id } },
      });
    }
  }
}

/**
 * An SMS with no Notification row behind it, for a recipient who has no
 * User account at all. `Notification.recipientUserId` is a required
 * foreign key, so sendNotification (above) has no way to record a
 * message sent to someone who isn't a User, and a driver is not
 * guaranteed to be one (`Driver.userId` is optional, most drivers never
 * get app access). This is the one gap that leaves: a driver without a
 * linked User account gets the SMS itself, but the send is not tracked
 * anywhere, so it will not show up in any notification history or admin
 * screen the way every other notification in this app does. Same
 * never-throws contract as sendNotification: a failed send here must
 * never make the payment that triggered it look like it failed, so a
 * genuine failure (not simply not being called at all) is reported to
 * Sentry, same as sendNotification's own failures, since nothing else
 * would ever surface it.
 */
export async function sendUntrackedSms(phone: string, message: string): Promise<void> {
  try {
    const result = await (await getSmsProvider()).sendSms({ to: phone, message });
    if (!result.success) {
      Sentry.captureMessage("Untracked SMS send failed", {
        level: "warning",
        contexts: { notification: { phone, error: result.error } },
      });
    }
  } catch (error) {
    Sentry.captureException(error, { contexts: { notification: { phone } } });
  }
}
