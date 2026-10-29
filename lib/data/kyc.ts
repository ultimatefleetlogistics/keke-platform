import { prisma } from "@/lib/prisma";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { KYC_DOCUMENT_BUCKET } from "@/lib/kyc-storage";

/**
 * The signed-in investor's own uploaded documents, keyed by type, for the
 * /kyc page to show what's already on file instead of a blank upload box.
 */
export async function getMyKycDocuments(investorId: string) {
  const documents = await prisma.kycDocument.findMany({
    where: { investorId },
    orderBy: { createdAt: "desc" },
  });

  // Typed as exactly these two keys, not a loose `Record<string, ...>`,
  // that widened shape compiled fine under `next dev`/`npm run lint` (this
  // sandbox's only two checks) but failed a real `next build`'s type
  // check: IdentityForm's `documents` prop wants precisely
  // `{ GOVERNMENT_ID; PROOF_OF_ADDRESS }`, and a `Record<string, X>` isn't
  // assignable to that even when its only two keys at runtime are exactly
  // those, TypeScript can't know a plain string-indexed record won't have
  // some other key too. Caught by the project owner's own `next build`,
  // this sandbox cannot run one, see "Known gaps" for why.
  const byType: Record<"GOVERNMENT_ID" | "PROOF_OF_ADDRESS", { id: string; fileName: string; status: string; createdAt: string } | null> = {
    GOVERNMENT_ID: null,
    PROOF_OF_ADDRESS: null,
  };
  for (const doc of documents) {
    if (!byType[doc.type]) {
      byType[doc.type] = { id: doc.id, fileName: doc.fileName, status: doc.status, createdAt: doc.createdAt.toISOString() };
    }
  }
  return byType;
}

/**
 * Every investor currently sitting in the review queue: KYC submitted
 * (PENDING_REVIEW) or with at least one document awaiting review.
 */
export async function getKycQueue() {
  const investors = await prisma.investorProfile.findMany({
    where: {
      OR: [{ kycStatus: "PENDING_REVIEW" }, { kycDocuments: { some: { status: "PENDING_REVIEW" } } }],
    },
    include: { user: true, kycDocuments: true },
    orderBy: { updatedAt: "desc" },
  });

  return investors.map((inv) => ({
    id: inv.id,
    fullName: inv.user.fullName,
    email: inv.user.email,
    kycStatus: inv.kycStatus,
    documentCount: inv.kycDocuments.length,
    pendingDocumentCount: inv.kycDocuments.filter((d) => d.status === "PENDING_REVIEW").length,
  }));
}

/**
 * Full detail for one investor's KYC review: every document, with a
 * short-lived signed URL so staff can actually view a file sitting in a
 * private Storage bucket. BVN/NIN is not part of this anymore, see the
 * step-down note on this function's own return statement below.
 *
 * Bug fix: `KycDocument.reviewedById` (set by reviewKycDocument in
 * lib/actions/kyc.ts to the reviewing staff member's StaffProfile id) has
 * always been a plain `String?` column in prisma/schema.prisma, never a
 * real Prisma relation, unlike the identical reviewer pattern on
 * WalletWithdrawal and OwnershipTransfer, which both do have one. This
 * function used to `include: { reviewedBy: { include: { user: true } } }`
 * as if it were a real relation, which throws PrismaClientValidationError
 * ("Unknown field `reviewedBy`") the moment it actually runs, this page
 * had apparently never been opened for a document that had already been
 * reviewed until now. Fixed here without a schema change or a migration
 * (adding a real `@relation` would need one, to add the foreign key
 * constraint, see the Known gaps entry this is documented under): look
 * reviewer names up as a second query instead of a Prisma include.
 */
export async function getInvestorKycDetail(investorId: string) {
  const investor = await prisma.investorProfile.findUnique({
    where: { id: investorId },
    include: {
      user: true,
      kycDocuments: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!investor) return null;

  const reviewerIds = Array.from(
    new Set(investor.kycDocuments.map((doc) => doc.reviewedById).filter((id): id is string => Boolean(id)))
  );
  const reviewers =
    reviewerIds.length > 0
      ? await prisma.staffProfile.findMany({ where: { id: { in: reviewerIds } }, include: { user: true } })
      : [];
  const reviewerNameById = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer.user.fullName]));

  const supabase = createSupabaseServiceRoleClient();
  const documents = await Promise.all(
    investor.kycDocuments.map(async (doc) => {
      const { data } = await supabase.storage.from(KYC_DOCUMENT_BUCKET).createSignedUrl(doc.storagePath, 60 * 10);
      return {
        id: doc.id,
        type: doc.type,
        fileName: doc.fileName,
        status: doc.status,
        signedUrl: data?.signedUrl ?? null,
        reviewedBy: doc.reviewedById ? (reviewerNameById.get(doc.reviewedById) ?? null) : null,
        reviewedAt: doc.reviewedAt ? doc.reviewedAt.toISOString() : null,
        createdAt: doc.createdAt.toISOString(),
      };
    })
  );

  return {
    id: investor.id,
    fullName: investor.user.fullName,
    email: investor.user.email,
    kycStatus: investor.kycStatus,
    // BVN/NIN fields (bvn, bvnVerificationStatus, nin,
    // ninVerificationStatus, and their VerifiedName/VerifiedAt siblings)
    // deliberately left out of this return since the step-down: nothing
    // is collected there anymore, see client-decisions-log.md decision
    // #2 and CURRENT_STATE.md's "Known gaps." The columns themselves
    // still exist on InvestorProfile (any already-stored values from
    // before the step-down are untouched), just no longer read here.
    documents,
  };
}
