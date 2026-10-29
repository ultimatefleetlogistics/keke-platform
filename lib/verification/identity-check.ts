/**
 * RETIRED. Only caller was app/kyc/actions.ts's submitIdentityDetails,
 * itself retired, see that file's header comment: BVN/NIN verification
 * was stepped down on the client's explicit request. Kept working and on
 * disk (this project's file bridge can't delete files), not wired into
 * any live route.
 */

import { lookupBvn, lookupNin, namesReasonablyMatch, isDojahConfigured } from "@/lib/verification/dojah-client";

export type IdentityCheckResult = {
  status: "VERIFIED" | "NAME_MISMATCH" | "NOT_FOUND" | "FAILED";
  verifiedName: string | null;
};

function fullNameOf(entity: { first_name: string; last_name: string; middle_name?: string }): string {
  return [entity.first_name, entity.middle_name, entity.last_name].filter(Boolean).join(" ");
}

/**
 * Checks a submitted BVN against Dojah and turns the result into exactly
 * the four-value shape InvestorProfile.bvnVerificationStatus/
 * ninVerificationStatus stores (see prisma/schema.prisma's
 * VerificationStatus enum comment). `statedFullName` is the investor's
 * own account name (User.fullName), compared against whatever name
 * Dojah has on file, see dojah-client.ts's namesReasonablyMatch for the
 * matching rule.
 *
 * Returns null, not a FAILED result, when Dojah isn't configured at all
 * (DOJAH_API_KEY/DOJAH_APP_ID unset): that is a distinct "this feature
 * isn't turned on" state from "we tried to check and it failed," and the
 * caller (app/kyc/actions.ts) treats a null return the same way it did
 * before Module 46 existed, saving the raw bvn/nin string with no
 * verification fields touched, so this app works exactly as it always
 * has until those two environment variables are actually set.
 */
export async function checkBvn(bvn: string, statedFullName: string): Promise<IdentityCheckResult | null> {
  if (!isDojahConfigured()) return null;

  const result = await lookupBvn(bvn);
  if (result.outcome === "not_found") return { status: "NOT_FOUND", verifiedName: null };
  if (result.outcome === "error") return { status: "FAILED", verifiedName: null };

  const verifiedName = fullNameOf(result.entity);
  return {
    status: namesReasonablyMatch(statedFullName, result.entity) ? "VERIFIED" : "NAME_MISMATCH",
    verifiedName,
  };
}

/** Same as checkBvn above, against Dojah's NIN lookup instead. */
export async function checkNin(nin: string, statedFullName: string): Promise<IdentityCheckResult | null> {
  if (!isDojahConfigured()) return null;

  const result = await lookupNin(nin);
  if (result.outcome === "not_found") return { status: "NOT_FOUND", verifiedName: null };
  if (result.outcome === "error") return { status: "FAILED", verifiedName: null };

  const verifiedName = fullNameOf(result.entity);
  return {
    status: namesReasonablyMatch(statedFullName, result.entity) ? "VERIFIED" : "NAME_MISMATCH",
    verifiedName,
  };
}
