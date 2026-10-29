"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/rbac/check-permission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { KYC_DOCUMENT_BUCKET, MAX_KYC_DOCUMENT_BYTES, ACCEPTED_KYC_DOCUMENT_TYPES } from "@/lib/kyc-storage";
import { sendNotification } from "@/lib/notifications/send-notification";
import { writeAuditLog } from "@/lib/audit";

type DocumentType = "GOVERNMENT_ID" | "PROOF_OF_ADDRESS";

/**
 * An investor uploading their own government ID or proof of address. The
 * file itself goes to a private Supabase Storage bucket (never made
 * public, staff view it through a short-lived signed URL, see
 * lib/data/kyc.ts), only the storage path is recorded in Postgres.
 * Re-uploading the same document type replaces whatever was there before,
 * both the old file and its row, so there is only ever one document per
 * type per investor at a time, rather than an ever-growing pile of retries.
 *
 * Module 43: every real, user-reachable validation and Supabase-upload
 * failure throw below converted to a `{ error?: string }` return, this
 * was bound to plain `<form action={uploadKycDocument}>`s on `/kyc`, see
 * `components/ui/action-form.tsx`'s doc comment. The `!user.investor`
 * guard above is left as a real throw, the real /kyc page never lets a
 * non-investor account reach this form at all.
 *
 * BVN/NIN step-down: this now also moves the investor's overall
 * `kycStatus` to PENDING_REVIEW on every successful upload, a
 * responsibility that used to belong to the removed BVN/NIN save action
 * (app/kyc/actions.ts's retired submitIdentityDetails, which set this
 * unconditionally on every save, the same behavior kept here). Identity
 * verification on /kyc is document-only now, so a document upload is the
 * only "I'm submitting this for review" signal left, without it nothing
 * would ever move an investor into the KYC queue by kycStatus, and
 * /kyc's own "Submitted, awaiting review" step label would never show.
 */
export async function uploadKycDocument(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  if (!user.investor) throw new Error("Only investor accounts can upload KYC documents.");

  const type = String(formData.get("type") ?? "") as DocumentType;
  if (type !== "GOVERNMENT_ID" && type !== "PROOF_OF_ADDRESS") {
    return { error: "Unknown document type." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > MAX_KYC_DOCUMENT_BYTES) {
    return { error: "That file is larger than 5 MB, use a smaller scan or photo." };
  }
  if (!ACCEPTED_KYC_DOCUMENT_TYPES.includes(file.type)) {
    return { error: "Only PDF, JPG, PNG or WEBP files are accepted." };
  }

  const supabase = createSupabaseServiceRoleClient();
  const investorId = user.investor.id;

  const existing = await prisma.kycDocument.findFirst({ where: { investorId, type } });
  if (existing) {
    await supabase.storage.from(KYC_DOCUMENT_BUCKET).remove([existing.storagePath]);
    await prisma.kycDocument.delete({ where: { id: existing.id } });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${investorId}/${type}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(KYC_DOCUMENT_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: false });

  if (uploadError) {
    return {
      error: `Could not upload this file (${uploadError.message}). If this is the first upload ever, make sure the "${KYC_DOCUMENT_BUCKET}" Storage bucket exists in your Supabase project, see the README.`,
    };
  }

  await prisma.kycDocument.create({
    data: { investorId, type, storagePath, fileName: file.name, status: "PENDING_REVIEW" },
  });

  await prisma.investorProfile.update({
    where: { id: investorId },
    data: { kycStatus: "PENDING_REVIEW" },
  });

  revalidatePath("/kyc");
  revalidatePath(`/admin/kyc/${investorId}`);
  revalidatePath("/admin/kyc");
}

/**
 * Staff approving or rejecting one specific document. Deciding on a
 * document does not by itself move the investor's overall KYC status,
 * that is a separate, deliberate action below, staff review everything
 * before deciding the investor as a whole is verified.
 *
 * Module 43: the "Unknown decision" throw below converted to a
 * `{ error?: string }` return, this was bound to a plain
 * `<form action={reviewKycDocument}>` on `/admin/kyc/[investorId]`. The
 * `!user.staff` guard above is left as a real throw, matching this
 * codebase's own "UI already hides this" convention.
 */
export async function reviewKycDocument(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.KYC_REVIEW);
  if (!user.staff) throw new Error("Only staff accounts can review KYC documents.");

  const documentId = String(formData.get("documentId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "VERIFIED" && decision !== "REJECTED") {
    return { error: "Unknown decision." };
  }

  const document = await prisma.kycDocument.findUniqueOrThrow({ where: { id: documentId } });

  await prisma.kycDocument.update({
    where: { id: documentId },
    data: { status: decision, reviewedById: user.staff.id, reviewedAt: new Date() },
  });
  await writeAuditLog({
    actorUserId: user.id,
    action: "kyc_document.review",
    entityType: "KycDocument",
    entityId: documentId,
    beforeState: { status: document.status },
    afterState: { status: decision },
  });

  revalidatePath(`/admin/kyc/${document.investorId}`);
  revalidatePath("/admin/kyc");
}

/**
 * The overall verdict on an investor's identity, separate from any one
 * document, this is what actually unlocks their first investment. Staff
 * make this call after looking at the BVN/NIN and both documents together.
 *
 * Module 43: the "Unknown decision" throw below converted to a
 * `{ error?: string }` return, this was bound to a plain
 * `<form action={reviewInvestorKyc}>` on `/admin/kyc/[investorId]`.
 */
export async function reviewInvestorKyc(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.KYC_REVIEW);

  const investorId = String(formData.get("investorId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "VERIFIED" && decision !== "REJECTED") {
    return { error: "Unknown decision." };
  }

  const previousInvestor = await prisma.investorProfile.findUniqueOrThrow({ where: { id: investorId } });

  const investor = await prisma.investorProfile.update({
    where: { id: investorId },
    data: { kycStatus: decision },
  });
  await writeAuditLog({
    actorUserId: user.id,
    action: "investor_kyc.review",
    entityType: "InvestorProfile",
    entityId: investorId,
    beforeState: { kycStatus: previousInvestor.kycStatus },
    afterState: { kycStatus: decision },
  });

  await sendNotification({
    userId: investor.userId,
    type: "kyc_status_changed",
    title: decision === "VERIFIED" ? "Your identity has been verified" : "Your identity verification needs another look",
    body:
      decision === "VERIFIED"
        ? "You're fully verified and can now be added to an investment contract."
        : "Something on your uploaded documents needs correcting. Sign in and check your KYC page for details.",
    channels: ["EMAIL", "SMS"],
  });

  revalidatePath(`/admin/kyc/${investorId}`);
  revalidatePath("/admin/kyc");
  revalidatePath("/kyc");
}
