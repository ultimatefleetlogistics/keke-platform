"use server";

/**
 * RETIRED. BVN/NIN verification was stepped down on the client's explicit
 * request (see client-decisions-log.md decision #2 and
 * docs/architecture/CURRENT_STATE.md's "Known gaps" for the step-down
 * entry): identity verification on /kyc is document-only now, see
 * app/kyc/identity-form.tsx. Nothing imports submitIdentityDetails
 * anymore, it is kept on disk rather than deleted (this project's file
 * bridge can't delete files) but is dead code, not a live route. Left
 * working as written below rather than gutted, in case BVN/NIN
 * verification is ever revisited, at which point this is the starting
 * point, not something to rebuild from scratch.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { checkBvn, checkNin } from "@/lib/verification/identity-check";

/**
 * The shape app/kyc/identity-form.tsx (a Client Component) drives with
 * React's useActionState: submitted flips true only once this action has
 * actually finished, which is what lets that form show its "submitted"
 * notification card the moment the request completes, rather than the
 * card just being some text that's always sitting on the page whether or
 * not anything just happened.
 */
export type IdentitySubmissionState = {
  submitted: boolean;
};

/**
 * Saves the BVN/NIN step of identity verification, and, since Module 46,
 * checks whatever was actually typed against Dojah before saving, see
 * lib/verification/identity-check.ts and
 * docs/architecture/CURRENT_STATE.md's "BVN/NIN verification (Module 46)"
 * section for the full reasoning. This still only ever moves a profile's
 * overall kycStatus to PENDING_REVIEW, never straight to VERIFIED, on
 * purpose, unchanged since phase one: what Dojah reports is a strong new
 * signal for staff, shown to them on `/admin/kyc/[investorId]`, not a
 * replacement for their own review of the uploaded documents. Creates the
 * InvestorProfile on first submission if one does not already exist,
 * since there is no separate sign up flow yet that would have created it.
 *
 * Only re-checks a field with Dojah when it actually changed from what
 * is already saved (or is being saved for the first time): re-submitting
 * the exact same, already-checked BVN/NIN (e.g. because the investor just
 * fixed a typo in the other field) does not spend another Dojah call on
 * a number nothing new is known about.
 */
export async function submitIdentityDetails(
  _previousState: IdentitySubmissionState,
  formData: FormData
): Promise<IdentitySubmissionState> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("You must be signed in to submit identity details.");
  }

  const bvn = String(formData.get("bvn") ?? "").trim();
  const nin = String(formData.get("nin") ?? "").trim();

  const existing = await prisma.investorProfile.findUnique({ where: { userId: user.id } });

  const bvnChanged = Boolean(bvn) && bvn !== existing?.bvn;
  const ninChanged = Boolean(nin) && nin !== existing?.nin;

  const [bvnCheck, ninCheck] = await Promise.all([
    bvnChanged ? checkBvn(bvn, user.fullName) : Promise.resolve(undefined),
    ninChanged ? checkNin(nin, user.fullName) : Promise.resolve(undefined),
  ]);

  const bvnFields = bvnChanged
    ? {
        bvnVerificationStatus: bvnCheck?.status,
        bvnVerifiedName: bvnCheck?.verifiedName ?? null,
        bvnVerifiedAt: bvnCheck ? new Date() : null,
      }
    : {};
  const ninFields = ninChanged
    ? {
        ninVerificationStatus: ninCheck?.status,
        ninVerifiedName: ninCheck?.verifiedName ?? null,
        ninVerifiedAt: ninCheck ? new Date() : null,
      }
    : {};

  await prisma.investorProfile.upsert({
    where: { userId: user.id },
    update: {
      bvn: bvn || undefined,
      nin: nin || undefined,
      kycStatus: "PENDING_REVIEW",
      ...bvnFields,
      ...ninFields,
    },
    create: {
      userId: user.id,
      bvn: bvn || null,
      nin: nin || null,
      kycStatus: "PENDING_REVIEW",
      ...bvnFields,
      ...ninFields,
    },
  });

  revalidatePath("/kyc");
  if (existing) revalidatePath(`/admin/kyc/${existing.id}`);
  return { submitted: true };
}
