"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/rbac/check-permission";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { KYC_DOCUMENT_BUCKET, MAX_KYC_DOCUMENT_BYTES, ACCEPTED_KYC_DOCUMENT_TYPES } from "@/lib/kyc-storage";
import { writeAuditLog } from "@/lib/audit";
import { sendNotification } from "@/lib/notifications/send-notification";

type DocumentType = "GOVERNMENT_ID" | "PROOF_OF_ADDRESS";
type Subject = "AGENT" | "DRIVER";

function revalidateSubject(subjectType: Subject, subjectId: string) {
  if (subjectType === "AGENT") {
    revalidatePath("/admin/agents");
    revalidatePath(`/admin/agents/${subjectId}`);
  } else {
    revalidatePath("/admin/drivers");
    revalidatePath(`/admin/drivers/${subjectId}`);
  }
}

/**
 * Module 59: staff entering a government ID or proof of address on an
 * agent's or driver's behalf, the direct counterpart to
 * lib/actions/kyc.ts's uploadKycDocument, which only an investor can call
 * for themselves. Agents and drivers never upload anything themselves
 * (client-decisions-log.md decision #1: no self-service platform access
 * at all), so this is staff data entry, in person or over the phone, at
 * onboarding or any time after — the "workflow trigger changes, the
 * underlying verification logic doesn't" gap the project owner's own
 * missing-features-agent-driver-restructure.md flagged as still open.
 * Same private "kyc-documents" Storage bucket investor documents already
 * use (see lib/kyc-storage.ts), no second bucket to create, just a
 * different path prefix so the two subjects' files can never collide, see
 * lib/data/agent-driver-documents.ts's own doc comment.
 *
 * Which permission gates this depends on which subject: an agent
 * document is a staff.manage decision (the same permission
 * updateStaffOrAgentAccount already requires), a driver document is a
 * fleet.manage one (same as updateDriver), reusing each entity's own
 * existing management permission rather than adding a third permission
 * key that would need its own database reseed for a feature this
 * narrow, the same reasoning lib/actions/documents.ts's uploadDocument
 * already gives for doing the same thing.
 */
export async function uploadAgentDriverDocument(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");

  const subjectType = String(formData.get("subjectType") ?? "") as Subject;
  if (subjectType !== "AGENT" && subjectType !== "DRIVER") {
    return { error: "Unknown subject type." };
  }
  const subjectId = String(formData.get("subjectId") ?? "").trim();
  if (!subjectId) return { error: "Missing agent or driver." };

  await requirePermission(user.id, subjectType === "AGENT" ? PERMISSIONS.STAFF_MANAGE : PERMISSIONS.FLEET_MANAGE);
  if (!user.staff) throw new Error("Only staff accounts can enter agent or driver documents.");

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

  if (subjectType === "AGENT") {
    const agent = await prisma.agent.findUnique({ where: { id: subjectId } });
    if (!agent) return { error: "That agent no longer exists." };
  } else {
    const driver = await prisma.driver.findUnique({ where: { id: subjectId } });
    if (!driver) return { error: "That driver no longer exists." };
  }

  const supabase = createSupabaseServiceRoleClient();
  const pathPrefix = subjectType === "AGENT" ? `agent/${subjectId}` : `driver/${subjectId}`;

  const existing = await prisma.agentDriverDocument.findFirst({
    where: subjectType === "AGENT" ? { agentId: subjectId, type } : { driverId: subjectId, type },
  });
  if (existing) {
    await supabase.storage.from(KYC_DOCUMENT_BUCKET).remove([existing.storagePath]);
    await prisma.agentDriverDocument.delete({ where: { id: existing.id } });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${pathPrefix}/${type}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(KYC_DOCUMENT_BUCKET)
    .upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: false });
  if (uploadError) {
    return {
      error: `Could not upload this file (${uploadError.message}). If this is the first upload ever, make sure the "${KYC_DOCUMENT_BUCKET}" Storage bucket exists in your Supabase project, see the README.`,
    };
  }

  await prisma.agentDriverDocument.create({
    data: {
      agentId: subjectType === "AGENT" ? subjectId : null,
      driverId: subjectType === "DRIVER" ? subjectId : null,
      type,
      storagePath,
      fileName: file.name,
      status: "PENDING_REVIEW",
    },
  });

  // Same "a document lands, the whole KYC verdict goes back to pending
  // review" behavior as the investor flow's uploadKycDocument. Unlike the
  // investor flow, there is deliberately no separate /admin/kyc-style
  // queue page for agents/drivers: staff enter and review their documents
  // on the same screen, the agent/driver detail page they are already on
  // (there is no "the subject submitted this themselves, staff review it
  // later" gap to bridge with a queue, staff did the data entry too), so
  // this only flips the status flag the agent/driver detail page's own
  // KYC card reads, see app/admin/agents/[id]/page.tsx and
  // app/admin/drivers/[id]/page.tsx.
  if (subjectType === "AGENT") {
    await prisma.agent.update({ where: { id: subjectId }, data: { kycStatus: "PENDING_REVIEW" } });
  } else {
    await prisma.driver.update({ where: { id: subjectId }, data: { kycStatus: "PENDING_REVIEW" } });
  }

  await writeAuditLog({
    actorUserId: user.id,
    action: "agent_driver_document.upload",
    entityType: subjectType === "AGENT" ? "Agent" : "Driver",
    entityId: subjectId,
    afterState: { type, fileName: file.name },
  });

  revalidateSubject(subjectType, subjectId);
  revalidatePath("/admin/kyc");
}

/** Staff approving or rejecting one specific document, the agent/driver counterpart to reviewKycDocument in lib/actions/kyc.ts. */
export async function reviewAgentDriverDocument(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.KYC_REVIEW);
  if (!user.staff) throw new Error("Only staff accounts can review these documents.");

  const documentId = String(formData.get("documentId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "VERIFIED" && decision !== "REJECTED") {
    return { error: "Unknown decision." };
  }

  const document = await prisma.agentDriverDocument.findUniqueOrThrow({ where: { id: documentId } });

  await prisma.agentDriverDocument.update({
    where: { id: documentId },
    data: { status: decision, reviewedById: user.staff.id, reviewedAt: new Date() },
  });
  await writeAuditLog({
    actorUserId: user.id,
    action: "agent_driver_document.review",
    entityType: "AgentDriverDocument",
    entityId: documentId,
    beforeState: { status: document.status },
    afterState: { status: decision },
  });

  const subjectType: Subject = document.agentId ? "AGENT" : "DRIVER";
  revalidateSubject(subjectType, (document.agentId ?? document.driverId)!);
  revalidatePath("/admin/kyc");
}

/**
 * The overall verdict on an agent's or driver's identity, separate from
 * any one document, the counterpart to reviewInvestorKyc in
 * lib/actions/kyc.ts. Notifies the subject only when they actually have
 * an app account to notify (Agent.userId is always set; Driver.userId is
 * optional, see createDriver's own doc comment in
 * lib/actions/drivers.ts) — most agents/drivers will never see this
 * message at all, staff relay the outcome directly, the same reality the
 * whole "no self-service portal" decision already assumes.
 */
export async function reviewAgentDriverKyc(formData: FormData): Promise<{ error?: string } | void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("You must be signed in.");
  await requirePermission(user.id, PERMISSIONS.KYC_REVIEW);

  const subjectType = String(formData.get("subjectType") ?? "") as Subject;
  if (subjectType !== "AGENT" && subjectType !== "DRIVER") {
    return { error: "Unknown subject type." };
  }
  const subjectId = String(formData.get("subjectId") ?? "").trim();
  const decision = String(formData.get("decision") ?? "");
  if (decision !== "VERIFIED" && decision !== "REJECTED") {
    return { error: "Unknown decision." };
  }

  let notifyUserId: string | null = null;

  if (subjectType === "AGENT") {
    const previous = await prisma.agent.findUniqueOrThrow({ where: { id: subjectId } });
    await prisma.agent.update({ where: { id: subjectId }, data: { kycStatus: decision } });
    await writeAuditLog({
      actorUserId: user.id,
      action: "agent_kyc.review",
      entityType: "Agent",
      entityId: subjectId,
      beforeState: { kycStatus: previous.kycStatus },
      afterState: { kycStatus: decision },
    });
    notifyUserId = previous.userId;
  } else {
    const previous = await prisma.driver.findUniqueOrThrow({ where: { id: subjectId } });
    await prisma.driver.update({ where: { id: subjectId }, data: { kycStatus: decision } });
    await writeAuditLog({
      actorUserId: user.id,
      action: "driver_kyc.review",
      entityType: "Driver",
      entityId: subjectId,
      beforeState: { kycStatus: previous.kycStatus },
      afterState: { kycStatus: decision },
    });
    notifyUserId = previous.userId;
  }

  if (notifyUserId) {
    await sendNotification({
      userId: notifyUserId,
      type: "kyc_status_changed",
      title: decision === "VERIFIED" ? "Your identity has been verified" : "Your identity verification needs another look",
      body:
        decision === "VERIFIED"
          ? "Ultimate staff have verified your identity documents."
          : "Something on your submitted documents needs correcting. Contact Ultimate staff for details.",
      channels: ["EMAIL", "SMS"],
    });
  }

  revalidateSubject(subjectType, subjectId);
  revalidatePath("/admin/kyc");
}
