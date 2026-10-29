"use server";

import { revalidatePath } from "next/cache";
import type { DocumentType, DocumentVisibility } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission, ForbiddenError } from "@/lib/rbac/check-permission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { DOCUMENT_BUCKET, MAX_DOCUMENT_BYTES, ACCEPTED_DOCUMENT_TYPES } from "@/lib/document-storage";
import { writeAuditLog } from "@/lib/audit";

const DOCUMENT_TYPES: DocumentType[] = ["CONTRACT", "MAINTENANCE_RECEIPT", "ASSET_PHOTO", "OTHER"];
const VISIBILITIES: DocumentVisibility[] = ["PRIVATE_OWNER", "STAFF_ONLY"];

/**
 * A staff member attaching a file to a vehicle and/or a contract: a
 * signed agreement, a maintenance receipt, an asset photo, anything else
 * worth keeping on record. Investors never upload here themselves, that's
 * what /kyc is for, this is staff record-keeping. Visibility is chosen
 * per upload: PRIVATE_OWNER makes it show up on the relevant investor's
 * own /investor/documents, STAFF_ONLY (the default) never leaves this
 * console. The file goes to a private Supabase Storage bucket, same
 * pattern as lib/actions/kyc.ts, only the storage path is recorded here.
 *
 * Module 43: every real, user-reachable validation and upload-failure
 * throw below converted to a `{ error?: string }` return, this was bound
 * to a plain `<form action={uploadDocument} encType="multipart/form-data">`
 * on `components/documents/document-section.tsx`, see
 * `components/ui/action-form.tsx`'s doc comment. The `if (!user) throw`/
 * `ForbiddenError` guards are left throwing, matching this codebase's
 * convention: the real UI never lets a signed-out or unauthorized account
 * reach this upload form at all.
 */
export async function uploadDocument(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");

  const type = String(formData.get("type") ?? "") as DocumentType;
  if (!DOCUMENT_TYPES.includes(type)) {
    return { error: "Unknown document type." };
  }

  const visibility = String(formData.get("visibility") ?? "STAFF_ONLY") as DocumentVisibility;
  if (!VISIBILITIES.includes(visibility)) {
    return { error: "Unknown visibility." };
  }

  const vehicleId = String(formData.get("vehicleId") ?? "").trim() || null;
  const contractId = String(formData.get("contractId") ?? "").trim() || null;
  if (!vehicleId && !contractId) {
    return { error: "Attach this document to a vehicle or a contract." };
  }

  // Which permission gates this depends on where the document is being
  // attached: a contract document is a contracts.manage decision, a
  // vehicle-only document (no contract at all, e.g. an asset photo) is a
  // fleet.manage one. There is no separate document permission, reusing
  // the domain each upload actually belongs to avoids a permission key
  // that would need its own reseed for a feature this small.
  await requirePermission(user.id, contractId ? PERMISSIONS.CONTRACTS_MANAGE : PERMISSIONS.FLEET_MANAGE);
  if (!user.staff) throw new ForbiddenError(contractId ? PERMISSIONS.CONTRACTS_MANAGE : PERMISSIONS.FLEET_MANAGE);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file to upload." };
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return { error: "That file is larger than 15 MB, use a smaller file." };
  }
  if (!ACCEPTED_DOCUMENT_TYPES.includes(file.type)) {
    return { error: "Only PDF, JPG, PNG or WEBP files are accepted." };
  }

  const supabase = createSupabaseServiceRoleClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${contractId ?? vehicleId}/${type}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: false });

  if (uploadError) {
    return {
      error: `Could not upload this file (${uploadError.message}). If this is the first upload ever, make sure the "${DOCUMENT_BUCKET}" Storage bucket exists in your Supabase project, see the README.`,
    };
  }

  await prisma.document.create({
    data: { vehicleId, contractId, type, storagePath, fileName: file.name, visibility, uploadedById: user.staff.id },
  });

  if (contractId) revalidatePath(`/admin/contracts/${contractId}`);
  if (vehicleId) revalidatePath(`/admin/fleet/${vehicleId}`);
  revalidatePath("/investor/documents");
}

/**
 * Removes a document, both the Storage object and its row. Gated by the
 * same permission its upload would have needed, whichever of
 * contractId/vehicleId the document actually has.
 */
export async function deleteDocument(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");

  const documentId = String(formData.get("documentId") ?? "");
  const document = await prisma.document.findUniqueOrThrow({ where: { id: documentId } });

  await requirePermission(user.id, document.contractId ? PERMISSIONS.CONTRACTS_MANAGE : PERMISSIONS.FLEET_MANAGE);
  if (!user.staff) throw new ForbiddenError(document.contractId ? PERMISSIONS.CONTRACTS_MANAGE : PERMISSIONS.FLEET_MANAGE);

  const supabase = createSupabaseServiceRoleClient();
  await supabase.storage.from(DOCUMENT_BUCKET).remove([document.storagePath]);
  await prisma.document.delete({ where: { id: documentId } });
  await writeAuditLog({
    actorUserId: user.id,
    action: "document.delete",
    entityType: "Document",
    entityId: documentId,
    beforeState: { fileName: document.fileName, type: document.type, visibility: document.visibility },
  });

  if (document.contractId) revalidatePath(`/admin/contracts/${document.contractId}`);
  if (document.vehicleId) revalidatePath(`/admin/fleet/${document.vehicleId}`);
  revalidatePath("/investor/documents");
}
