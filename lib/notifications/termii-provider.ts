import { termiiSendSms } from "./termii-client";
import type { SmsProvider, SmsMessage, SendResult } from "./provider";

/**
 * Converts however a phone number was typed into the international format
 * Termii expects (no leading zero, no "+", country code first): a local
 * "080..." becomes "234...". Anything already starting with a country
 * code is passed through as-is (stripped of "+" and spaces), since we
 * cannot tell a foreign number was intentional versus a typo, and
 * guessing wrong would silently misroute a message.
 */
export function toTermiiPhoneFormat(phone: string): string {
  const digitsOnly = phone.replace(/[^\d]/g, "");
  if (digitsOnly.startsWith("0")) {
    return `234${digitsOnly.slice(1)}`;
  }
  return digitsOnly;
}

/**
 * Real Termii implementation of SmsProvider. See termii-client.ts for the
 * request shape and the base URL note.
 */
export class TermiiSmsProvider implements SmsProvider {
  async sendSms(message: SmsMessage): Promise<SendResult> {
    if (!process.env.TERMII_API_KEY || !process.env.TERMII_SENDER_ID) {
      return { success: false, error: "TERMII_API_KEY or TERMII_SENDER_ID is not set" };
    }

    try {
      const result = await termiiSendSms(toTermiiPhoneFormat(message.to), message.message);
      return { success: true, providerRef: result.messageId };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : "SMS send failed" };
    }
  }
}
