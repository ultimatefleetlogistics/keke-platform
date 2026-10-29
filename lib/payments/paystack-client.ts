import crypto from "node:crypto";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

function getSecretKey(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    throw new Error("PAYSTACK_SECRET_KEY is not set");
  }
  return key;
}

/**
 * Thin fetch wrapper around the Paystack REST API. Every real Paystack
 * endpoint we call lives here or in paystack-provider.ts, nowhere else in
 * the app should hardcode a Paystack URL.
 */
export async function paystackRequest<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: Record<string, unknown> } = {}
): Promise<T> {
  const response = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  const json = await response.json();

  if (!response.ok || json.status === false) {
    throw new Error(`Paystack request failed (${path}): ${json.message ?? response.statusText}`);
  }

  return json.data as T;
}

/**
 * Verifies that a webhook payload actually came from Paystack. Must be
 * called on the raw request body, before it is parsed as JSON, comparing
 * against the x-paystack-signature header. Never process a webhook whose
 * signature does not match.
 */
export function verifyPaystackSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;
  const expected = crypto
    .createHmac("sha512", getSecretKey())
    .update(rawBody)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(signatureHeader);
  // timingSafeEqual throws on a length mismatch rather than returning false,
  // and a malformed or truncated header is exactly the kind of input a
  // webhook endpoint has to expect. Checking length first and returning
  // false leaks nothing an attacker doesn't already know, a valid
  // signature's length is fixed (a sha512 hex digest), it's the content
  // that has to stay constant time.
  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

/** Paystack amounts are always in kobo (naira x 100). */
export function nairaToKobo(naira: number): number {
  return Math.round(naira * 100);
}

export function koboToNaira(kobo: number): number {
  return kobo / 100;
}
