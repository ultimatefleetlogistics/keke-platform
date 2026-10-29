"use client";

import { useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type DocSlot = { id: string; fileName: string; status: string; signedUrl: string | null } | null;
type ActionResult = { error?: string } | void;

const STATUS_VARIANT: Record<string, "good" | "warn" | "bad" | "pending" | "neutral"> = {
  NOT_STARTED: "neutral",
  PENDING_REVIEW: "pending",
  VERIFIED: "good",
  REJECTED: "bad",
};
const STATUS_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  PENDING_REVIEW: "Pending review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};
const DOC_LABEL: Record<string, string> = { GOVERNMENT_ID: "Government ID", PROOF_OF_ADDRESS: "Proof of address" };

/**
 * Module 59: the staff-driven counterpart to /kyc's own IdentityForm, for
 * an agent or driver instead of an investor. Since neither account type
 * ever signs in to upload anything themselves (client-decisions-log.md
 * decision #1), every action here is staff acting on the subject's
 * behalf: enter a document staff have physically collected, then a
 * (possibly different) staff member with kyc.review reviews it, same
 * maker-checker shape as the investor flow, just both sides staff-driven
 * instead of one side self-service.
 */
export function AgentDriverKycCard({
  subjectType,
  subjectId,
  kycStatus,
  documents,
  canUpload,
  canReview,
  uploadAction,
  reviewDocumentAction,
  reviewKycAction,
}: {
  subjectType: "AGENT" | "DRIVER";
  subjectId: string;
  kycStatus: string;
  documents: Record<"GOVERNMENT_ID" | "PROOF_OF_ADDRESS", DocSlot>;
  canUpload: boolean;
  canReview: boolean;
  uploadAction: (formData: FormData) => Promise<ActionResult>;
  reviewDocumentAction: (formData: FormData) => Promise<ActionResult>;
  reviewKycAction: (formData: FormData) => Promise<ActionResult>;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[13.5px] font-extrabold">Identity verification</div>
        <Badge variant={STATUS_VARIANT[kycStatus] ?? "neutral"}>{STATUS_LABEL[kycStatus] ?? kycStatus}</Badge>
      </div>
      <div className="flex flex-col gap-3">
        {(["GOVERNMENT_ID", "PROOF_OF_ADDRESS"] as const).map((type) => (
          <DocumentRow
            key={type}
            type={type}
            doc={documents[type]}
            subjectType={subjectType}
            subjectId={subjectId}
            canUpload={canUpload}
            canReview={canReview}
            uploadAction={uploadAction}
            reviewDocumentAction={reviewDocumentAction}
          />
        ))}
      </div>
      {canReview && kycStatus === "PENDING_REVIEW" ? (
        <div className="mt-4 flex gap-2 border-t border-border pt-4">
          <VerdictButton subjectType={subjectType} subjectId={subjectId} decision="VERIFIED" action={reviewKycAction}>
            Verify
          </VerdictButton>
          <VerdictButton subjectType={subjectType} subjectId={subjectId} decision="REJECTED" action={reviewKycAction}>
            Reject
          </VerdictButton>
        </div>
      ) : null}
    </div>
  );
}

function DocumentRow({
  type,
  doc,
  subjectType,
  subjectId,
  canUpload,
  canReview,
  uploadAction,
  reviewDocumentAction,
}: {
  type: "GOVERNMENT_ID" | "PROOF_OF_ADDRESS";
  doc: DocSlot;
  subjectType: "AGENT" | "DRIVER";
  subjectId: string;
  canUpload: boolean;
  canReview: boolean;
  uploadAction: (formData: FormData) => Promise<ActionResult>;
  reviewDocumentAction: (formData: FormData) => Promise<ActionResult>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const result = await uploadAction(formData);
    setIsSubmitting(false);
    if (result && "error" in result && result.error) setError(result.error);
  }

  async function handleReview(decision: "VERIFIED" | "REJECTED") {
    if (!doc) return;
    setIsSubmitting(true);
    const formData = new FormData();
    formData.set("documentId", doc.id);
    formData.set("decision", decision);
    const result = await reviewDocumentAction(formData);
    setIsSubmitting(false);
    if (result && "error" in result && result.error) setError(result.error);
  }

  return (
    <div className="rounded-xl border border-border p-3.5">
      <div className="flex items-center justify-between">
        <div className="text-[12.5px] font-bold">{DOC_LABEL[type]}</div>
        {doc ? <Badge variant={STATUS_VARIANT[doc.status] ?? "neutral"}>{STATUS_LABEL[doc.status] ?? doc.status}</Badge> : null}
      </div>
      {doc ? (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          {doc.signedUrl ? (
            <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer" className="text-[12px] font-semibold text-accent-dark hover:underline">
              {doc.fileName}
            </a>
          ) : (
            <span className="text-[12px] text-text-faint">{doc.fileName}</span>
          )}
          {canReview && doc.status === "PENDING_REVIEW" ? (
            <div className="flex gap-1.5">
              <Button type="button" size="sm" variant="outline" disabled={isSubmitting} onClick={() => handleReview("VERIFIED")}>
                Verify
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={isSubmitting} onClick={() => handleReview("REJECTED")}>
                Reject
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="mt-1 text-[11.5px] text-text-faint">Nothing on file yet.</div>
      )}
      {canUpload ? (
        <form onSubmit={handleUpload} encType="multipart/form-data" className="mt-2.5 flex items-center gap-2">
          <input type="hidden" name="subjectType" value={subjectType} />
          <input type="hidden" name="subjectId" value={subjectId} />
          <input type="hidden" name="type" value={type} />
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            required
            className="flex-1 text-[11.5px] text-text-soft file:mr-2 file:rounded-lg file:border-0 file:bg-background file:px-2.5 file:py-1.5 file:text-[11.5px] file:font-semibold"
          />
          <Button type="submit" size="sm" variant="outline" disabled={isSubmitting} loading={isSubmitting}>
            {doc ? "Replace" : "Upload"}
          </Button>
        </form>
      ) : null}
      {error ? <div className="mt-1.5 text-[11.5px] font-medium text-bad-ink">{error}</div> : null}
    </div>
  );
}

function VerdictButton({
  subjectType,
  subjectId,
  decision,
  action,
  children,
}: {
  subjectType: "AGENT" | "DRIVER";
  subjectId: string;
  decision: "VERIFIED" | "REJECTED";
  action: (formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setIsSubmitting(true);
    const formData = new FormData();
    formData.set("subjectType", subjectType);
    formData.set("subjectId", subjectId);
    formData.set("decision", decision);
    const result = await action(formData);
    setIsSubmitting(false);
    if (result && "error" in result && result.error) setError(result.error);
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        size="sm"
        variant={decision === "VERIFIED" ? "default" : "outline"}
        disabled={isSubmitting}
        loading={isSubmitting}
        onClick={handleClick}
      >
        {children}
      </Button>
      {error ? <div className="text-[11px] font-medium text-bad-ink">{error}</div> : null}
    </div>
  );
}
