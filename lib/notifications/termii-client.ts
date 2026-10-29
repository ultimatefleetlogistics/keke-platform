/**
 * Thin fetch wrapper around Termii's REST API, the SMS equivalent of
 * lib/payments/paystack-client.ts. Endpoint and request shape confirmed
 * against Termii's own developer docs (developers.termii.com/messaging-api)
 * and cross-checked against a published third-party SDK for the base
 * domain, since Termii's own docs give the endpoint as a "BASE_URL"
 * placeholder without stating the literal domain. `TERMII_BASE_URL` is
 * still left overridable via env, several third-party SDKs treat it as
 * configurable rather than hardcoded, in case Termii ever serves a
 * different domain for a given account or region.
 */
const DEFAULT_TERMII_BASE_URL = "https://api.ng.termii.com";

function getApiKey(): string {
  const key = process.env.TERMII_API_KEY;
  if (!key) {
    throw new Error("TERMII_API_KEY is not set");
  }
  return key;
}

function getSenderId(): string {
  const senderId = process.env.TERMII_SENDER_ID;
  if (!senderId) {
    throw new Error("TERMII_SENDER_ID is not set");
  }
  return senderId;
}

function getBaseUrl(): string {
  return process.env.TERMII_BASE_URL || DEFAULT_TERMII_BASE_URL;
}

export async function termiiSendSms(to: string, message: string): Promise<{ messageId: string }> {
  const response = await fetch(`${getBaseUrl()}/api/sms/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: getApiKey(),
      to,
      from: getSenderId(),
      sms: message,
      type: "plain",
      channel: "generic",
    }),
    cache: "no-store",
  });

  const json = await response.json();

  if (!response.ok || json.code !== "ok") {
    throw new Error(`Termii request failed: ${json.message ?? response.statusText}`);
  }

  return { messageId: json.message_id };
}
