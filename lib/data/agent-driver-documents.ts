import { prisma } from "@/lib/prisma";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { KYC_DOCUMENT_BUCKET } from "@/lib/kyc-storage";

/**
 * Module 59: an agent's or driver's staff-entered documents, shared by
 * both app/admin/agents/[id]/page.tsx and app/admin/drivers/[id]/page.tsx
 * rather than duplicated per file, unlike the deliberate agent/driver
 * duplication elsewhere in lib/data/ (see lib/data/driver.ts's own doc
 * comment on why *that* duplication is intentional): this query has no
 * "self-service portal" vs "admin" split to preserve, AgentDriverDocument
 * only ever has an admin side, so there is nothing to keep separate.
 * Exactly one of agentId/driverId is expected to be set, matching the
 * table's own CHECK constraint, see prisma/schema.prisma's
 * AgentDriverDocument comment.
 *
 * Same signed-URL pattern as lib/data/kyc.ts's getInvestorKycDetail:
 * documents live in the same private "kyc-documents" Storage bucket
 * investor documents use (no second bucket to set up, see
 * lib/kyc-storage.ts), under an "agent/<id>/..." or "driver/<id>/..."
 * path prefix instead of a bare investor id, so the two can never collide.
 * reviewedById is looked up as a second query rather than a Prisma
 * include, same reasoning as getInvestorKycDetail: it is a plain String
 * column, not a real @relation.
 */
export async function getSubjectDocuments(subject: { agentId?: string; driverId?: string }) {
  const documents = await prisma.agentDriverDocument.findMany({
    where: subject.agentId ? { agentId: subject.agentId } : { driverId: subject.driverId },
    orderBy: { createdAt: "desc" },
  });

  const reviewerIds = Array.from(
    new Set(documents.map((doc) => doc.reviewedById).filter((id): id is string => Boolean(id)))
  );
  const reviewers =
    reviewerIds.length > 0
      ? await prisma.staffProfile.findMany({ where: { id: { in: reviewerIds } }, include: { user: true } })
      : [];
  const reviewerNameById = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer.user.fullName]));

  const supabase = createSupabaseServiceRoleClient();
  const withUrls = await Promise.all(
    documents.map(async (doc) => {
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

  // Same "typed as exactly these two keys" shape as getMyKycDocuments in
  // lib/data/kyc.ts, and the same reason: a real `next build` (which this
  // sandbox cannot run) enforces this in a way `npm run lint` alone does
  // not, see that function's own doc comment for the Module 46 bug this
  // avoids repeating.
  const byType: Record<
    "GOVERNMENT_ID" | "PROOF_OF_ADDRESS",
    { id: string; fileName: string; status: string; signedUrl: string | null; reviewedBy: string | null; reviewedAt: string | null; createdAt: string } | null
  > = { GOVERNMENT_ID: null, PROOF_OF_ADDRESS: null };
  for (const doc of withUrls) {
    if (!byType[doc.type]) byType[doc.type] = doc;
  }
  return byType;
}
