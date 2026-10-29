/**
 * Thin fetch wrapper around Dojah's Nigeria KYC lookup API
 * (docs.dojah.io), the vendor picked in Module 46 for automated BVN/NIN
 * verification, see docs/architecture/CURRENT_STATE.md's "BVN/NIN
 * verification (Module 46)" section for the vendor research and why
 * Dojah specifically (synchronous, documented endpoints for both BVN and
 * NIN, unlike Paystack's Identity Verification API, which only covers
 * BVN, asynchronously, tied to a bank account, and cannot check a NIN at
 * all).
 *
 * Every real Dojah endpoint this app calls lives here, nowhere else in
 * the app should hardcode a Dojah URL or its header shape, the same rule
 * lib/payments/paystack-client.ts follows for Paystack.
 *
 * Not verified against a live Dojah account from this sandbox, this
 * sandbox has no real DOJAH_API_KEY/DOJAH_APP_ID and no way to reach the
 * open internet to test one even if it did (see the README's usual
 * sandbox-network-limitation notes). The request shape, header names, and
 * response field names below are taken directly from Dojah's own current
 * published API reference (docs.dojah.io), not guessed, but this has not
 * been exercised against a real response the way lib/payments/
 * paystack-client.ts's shapes have been (that vendor's test-mode
 * credentials were available to check against). Worth a real sandbox-key
 * smoke test on the project owner's own machine before this goes live,
 * the same way every other new external integration in this app has
 * been.
 */

const DOJAH_SANDBOX_BASE_URL = "https://sandbox.dojah.io";
const DOJAH_LIVE_BASE_URL = "https://api.dojah.io";

function getBaseUrl(): string {
  // Defaults to sandbox, the same safe-by-default posture
  // PAYSTACK_DVA_PREFERRED_BANK=test-bank uses: a misconfigured or
  // forgotten environment variable should never silently start making
  // real, billable live calls against a real government identity
  // database. Set DOJAH_ENVIRONMENT=live deliberately once ready.
  return process.env.DOJAH_ENVIRONMENT === "live" ? DOJAH_LIVE_BASE_URL : DOJAH_SANDBOX_BASE_URL;
}

function getCredentials(): { appId: string; secretKey: string } | null {
  const appId = process.env.DOJAH_APP_ID;
  const secretKey = process.env.DOJAH_API_KEY;
  if (!appId || !secretKey) return null;
  return { appId, secretKey };
}

/** True only once both DOJAH_APP_ID and DOJAH_API_KEY are set. */
export function isDojahConfigured(): boolean {
  return getCredentials() !== null;
}

export type DojahLookupResult<TEntity> =
  | { outcome: "found"; entity: TEntity }
  | { outcome: "not_found" }
  | { outcome: "error"; message: string };

async function dojahLookup<TEntity>(path: string, params: Record<string, string>): Promise<DojahLookupResult<TEntity>> {
  const credentials = getCredentials();
  if (!credentials) {
    return { outcome: "error", message: "DOJAH_APP_ID/DOJAH_API_KEY are not set." };
  }

  const url = `${getBaseUrl()}${path}?${new URLSearchParams(params).toString()}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        // No "Bearer " prefix: Dojah's documented Authorization header is
        // the raw secret key, unlike Paystack's `Bearer ${key}`, this is
        // deliberate, not a copy-paste of the Paystack client's shape.
        Authorization: credentials.secretKey,
        AppId: credentials.appId,
      },
      cache: "no-store",
    });
  } catch (error) {
    return { outcome: "error", message: error instanceof Error ? error.message : "Network error reaching Dojah." };
  }

  // Dojah's documented error shape isn't published anywhere this app
  // could confirm, so this treats any non-2xx as "not found" for a 404
  // specifically (the documented shape for "this BVN/NIN does not
  // exist") and a generic error for everything else (bad credentials, a
  // 5xx, a malformed response), rather than assuming a JSON error body
  // exists to read a message out of.
  if (response.status === 404) {
    return { outcome: "not_found" };
  }

  if (!response.ok) {
    return { outcome: "error", message: `Dojah request failed (${path}): HTTP ${response.status}` };
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    return { outcome: "error", message: `Dojah returned a non-JSON response (${path}).` };
  }

  const entity = (json as { entity?: TEntity } | null)?.entity;
  if (!entity) {
    return { outcome: "not_found" };
  }

  return { outcome: "found", entity };
}

/**
 * GET /api/v1/kyc/bvn/full, Dojah's "full" tier: names, gender, date of
 * birth, and both phone numbers on file for a BVN. Deliberately not the
 * "advance" tier (which adds enrollment bank, state/LGA of residence and
 * origin, and watch-list status): the advance tier costs more per call
 * and this app only needs enough to compare the name on file against
 * what the investor typed, see checkBvn below. Switching tiers later is
 * a one-line path change here if the business wants the extra fields for
 * some other reason (e.g. watch-list status for AML), that is a real
 * cost decision for the project owner to make, not a default to reach
 * for on its own.
 */
export type DojahBvnEntity = {
  bvn: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  gender?: string;
  date_of_birth?: string;
  phone_number1?: string;
  phone_number2?: string;
};

export async function lookupBvn(bvn: string): Promise<DojahLookupResult<DojahBvnEntity>> {
  return dojahLookup<DojahBvnEntity>("/api/v1/kyc/bvn/full", { bvn });
}

/**
 * GET /api/v1/kyc/nin, Dojah's standard NIN lookup: names, gender, date
 * of birth, phone number, and a photo for a NIN. Same reasoning as
 * lookupBvn above for not reaching for a richer/pricier tier by default.
 */
export type DojahNinEntity = {
  first_name: string;
  last_name: string;
  middle_name?: string;
  gender?: string;
  date_of_birth?: string;
  phone_number?: string;
};

export async function lookupNin(nin: string): Promise<DojahLookupResult<DojahNinEntity>> {
  return dojahLookup<DojahNinEntity>("/api/v1/kyc/nin", { nin });
}

/**
 * Whether the name Dojah has on file for a BVN/NIN reasonably matches
 * the name the investor entered on their own account. Deliberately
 * lenient, not a cryptographic-grade check: normalizes case and
 * whitespace, then requires the first and last name Dojah returned to
 * both appear somewhere among the words in the investor's own stated
 * full name, in either order, ignoring Dojah's middle_name entirely.
 * Real people's own typed full names routinely drop or reorder a middle
 * name, and the middle_name field is exactly where a stricter check
 * would produce the most false "mismatch" flags for entirely legitimate
 * investors, this is meant to catch the case that actually matters
 * (someone else's BVN/NIN entirely), not to penalize normal naming
 * variation.
 */
export function namesReasonablyMatch(statedFullName: string, entity: { first_name: string; last_name: string }): boolean {
  const statedWords = new Set(
    statedFullName
      .toUpperCase()
      .split(/\s+/)
      .filter(Boolean)
  );
  const firstNameWords = entity.first_name.toUpperCase().split(/\s+/).filter(Boolean);
  const lastNameWords = entity.last_name.toUpperCase().split(/\s+/).filter(Boolean);

  const hasFirst = firstNameWords.some((word) => statedWords.has(word));
  const hasLast = lastNameWords.some((word) => statedWords.has(word));
  return hasFirst && hasLast;
}
