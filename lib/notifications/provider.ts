/**
 * Every provider-specific detail (Resend, Termii) is behind these two
 * interfaces, the same shape as lib/payments/provider.ts. Domain code
 * never imports resend-provider.ts or termii-provider.ts directly, it
 * calls sendNotification() in ./send-notification.ts, which is the only
 * thing that talks to these.
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface SmsMessage {
  to: string;
  message: string;
}

export interface SendResult {
  success: boolean;
  providerRef?: string;
  error?: string;
}

export interface EmailProvider {
  sendEmail(message: EmailMessage): Promise<SendResult>;
}

export interface SmsProvider {
  sendSms(message: SmsMessage): Promise<SendResult>;
}

let cachedEmailProvider: EmailProvider | null = null;
let cachedSmsProvider: SmsProvider | null = null;

export async function getEmailProvider(): Promise<EmailProvider> {
  if (!cachedEmailProvider) {
    const { ResendEmailProvider } = await import("./resend-provider");
    cachedEmailProvider = new ResendEmailProvider();
  }
  return cachedEmailProvider;
}

export async function getSmsProvider(): Promise<SmsProvider> {
  if (!cachedSmsProvider) {
    const { TermiiSmsProvider } = await import("./termii-provider");
    cachedSmsProvider = new TermiiSmsProvider();
  }
  return cachedSmsProvider;
}
