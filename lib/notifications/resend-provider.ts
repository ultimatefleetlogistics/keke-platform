import { Resend } from "resend";

import type { EmailProvider, EmailMessage, SendResult } from "./provider";

/**
 * Real Resend implementation of EmailProvider. Confirmed against Resend's
 * own Node SDK docs (resend.com/docs/send-with-nodejs): `emails.send`
 * returns `{data, error}` rather than throwing, so every call is checked
 * for `error` explicitly instead of relying on a try/catch to catch a
 * failed send.
 */
export class ResendEmailProvider implements EmailProvider {
  async sendEmail(message: EmailMessage): Promise<SendResult> {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM_EMAIL;
    if (!apiKey || !from) {
      return { success: false, error: "RESEND_API_KEY or RESEND_FROM_EMAIL is not set" };
    }

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true, providerRef: data?.id };
  }
}
