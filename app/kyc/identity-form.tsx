"use client";

import { useState } from "react";
import Link from "next/link";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toast, ToastStack } from "@/components/ui/toast";
import { uploadKycDocument } from "@/lib/actions/kyc";

const DOC_STATUS_VARIANT: Record<string, "good" | "warn" | "bad"> = {
  PENDING_REVIEW: "warn",
  VERIFIED: "good",
  REJECTED: "bad",
};

const DOC_STATUS_LABEL: Record<string, string> = {
  PENDING_REVIEW: "Pending review",
  VERIFIED: "Verified",
  REJECTED: "Rejected, please re-upload",
};

type DocumentInfo = { id: string; fileName: string; status: string; createdAt: string } | null;

type Props = {
  investor: {
    kycStatus: string;
  } | null;
  documents: { GOVERNMENT_ID: DocumentInfo; PROOF_OF_ADDRESS: DocumentInfo };
};

/**
 * BVN/NIN verification (and the Dojah check that used to run against it,
 * Module 46) was stepped down on the client's explicit request: identity
 * verification here is document-only now, a government ID plus a proof
 * of address, reviewed by staff. See client-decisions-log.md decision #2
 * for the original reasoning and CURRENT_STATE.md's "Known gaps" for the
 * step-down itself. The two document upload forms below are the entire
 * flow now; `uploadKycDocument` (lib/actions/kyc.ts) moves the investor's
 * overall `kycStatus` to PENDING_REVIEW on a successful upload, which is
 * what makes the "Awaiting review" card below appear on the next render,
 * the same job the removed BVN/NIN form used to do on save.
 */
export function IdentityForm({ investor, documents }: Props) {
  const [dismissed, setDismissed] = useState<Record<string, boolean>>({});

  const isVerified = investor?.kycStatus === "VERIFIED";
  const isAwaitingReview = investor?.kycStatus === "PENDING_REVIEW";

  function dismiss(id: string) {
    setDismissed((current) => ({ ...current, [id]: true }));
  }

  return (
    <div className="flex flex-col gap-5">
      {/*
        A floating popup rather than more page content, so it's visible
        the instant it appears, whatever you've scrolled to, instead of
        something you only notice by scrolling back up to the top of the
        form. See components/ui/toast.tsx.
      */}
      <ToastStack>
        {isVerified && !dismissed.verified ? (
          <Toast
            variant="good"
            title="You're verified"
            onDismiss={() => dismiss("verified")}
            icon={
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="m5 12 5 5L20 7" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          >
            There&apos;s nothing left to do on this page.
          </Toast>
        ) : null}

        {!isVerified && isAwaitingReview && !dismissed.submitted ? (
          <Toast
            variant="warn"
            title="Awaiting review"
            onDismiss={() => dismiss("submitted")}
            icon={
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          >
            Your documents are with our compliance team. You can still replace them below if you made a mistake.
          </Toast>
        ) : null}

        {!isVerified && isAwaitingReview && !dismissed.nextSteps ? (
          <Toast
            variant="accent"
            title="What's next"
            onDismiss={() => dismiss("nextSteps")}
            delayMs={140}
            icon={
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="10" width="18" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
                <path d="M3 10 12 4l9 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 14v2M12 14v2M17 14v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            }
          >
            Add your bank account under{" "}
            <Link href="/investor/payout-details" className="font-semibold text-accent-dark">
              Payout details
            </Link>{" "}
            in your dashboard sidebar, any time, no need to wait for compliance to finish reviewing this first.
          </Toast>
        ) : null}
      </ToastStack>

      <div>
        <div className="mb-1.5 flex items-center gap-2 text-[12.5px] font-semibold">
          Government-issued ID
          {documents.GOVERNMENT_ID ? (
            <Badge variant={DOC_STATUS_VARIANT[documents.GOVERNMENT_ID.status]}>
              {DOC_STATUS_LABEL[documents.GOVERNMENT_ID.status]}
            </Badge>
          ) : null}
        </div>
        {documents.GOVERNMENT_ID ? (
          <div className="flex items-center justify-between rounded-2xl border-[1.5px] border-border bg-[#FAFBF9] px-4 py-3">
            <div className="truncate text-[13px] font-semibold text-text-soft">{documents.GOVERNMENT_ID.fileName}</div>
            <ActionForm action={uploadKycDocument} className="flex items-center gap-2">
              <input type="hidden" name="type" value="GOVERNMENT_ID" />
              <input
                type="file"
                name="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                required
                className="text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-background file:px-2.5 file:py-1.5 file:text-xs file:font-bold"
              />
              <ActionSubmitButton size="sm" variant="outline">
                Replace
              </ActionSubmitButton>
            </ActionForm>
          </div>
        ) : (
          <ActionForm action={uploadKycDocument} className="flex flex-col items-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-border bg-[#FAFBF9] p-5.5 text-center">
            <input type="hidden" name="type" value="GOVERNMENT_ID" />
            <div className="flex h-11 w-11 items-center justify-center rounded-[11px] bg-[#F0F2ED]">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                <path d="M12 16V4M12 4 7 9M12 4l5 5" stroke="var(--text-soft)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" stroke="var(--text-soft)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <div className="text-[13.5px] font-bold">Upload a photo or scan</div>
              <div className="mt-0.5 text-xs text-text-faint">PDF, JPG or PNG, less than 5 MB</div>
            </div>
            <input
              type="file"
              name="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              required
              className="mt-1 w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-2.5 file:py-1.5 file:text-xs file:font-bold"
            />
            <ActionSubmitButton size="sm" className="mt-1 w-full">
              Upload
            </ActionSubmitButton>
          </ActionForm>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-center gap-2 text-[12.5px] font-semibold">
          Proof of address
          {documents.PROOF_OF_ADDRESS ? (
            <Badge variant={DOC_STATUS_VARIANT[documents.PROOF_OF_ADDRESS.status]}>
              {DOC_STATUS_LABEL[documents.PROOF_OF_ADDRESS.status]}
            </Badge>
          ) : null}
        </div>
        {documents.PROOF_OF_ADDRESS ? (
          <div className="flex items-center justify-between rounded-2xl border-[1.5px] border-border bg-[#FAFBF9] px-4 py-3">
            <div className="truncate text-[13px] font-semibold text-text-soft">{documents.PROOF_OF_ADDRESS.fileName}</div>
            <ActionForm action={uploadKycDocument} className="flex items-center gap-2">
              <input type="hidden" name="type" value="PROOF_OF_ADDRESS" />
              <input
                type="file"
                name="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                required
                className="text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-background file:px-2.5 file:py-1.5 file:text-xs file:font-bold"
              />
              <ActionSubmitButton size="sm" variant="outline">
                Replace
              </ActionSubmitButton>
            </ActionForm>
          </div>
        ) : (
          <ActionForm action={uploadKycDocument} className="flex flex-col items-center gap-2.5 rounded-2xl border-[1.5px] border-dashed border-border bg-[#FAFBF9] p-5.5 text-center">
            <input type="hidden" name="type" value="PROOF_OF_ADDRESS" />
            <div className="flex h-11 w-11 items-center justify-center rounded-[11px] bg-[#F0F2ED]">
              <svg width="21" height="21" viewBox="0 0 24 24" fill="none">
                <path d="M12 8v8M8 12h8" stroke="var(--text-soft)" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <div className="text-[13.5px] font-bold">Upload a utility bill or bank statement</div>
              <div className="mt-0.5 text-xs text-text-faint">PDF, JPG or PNG, less than 5 MB, dated within 3 months</div>
            </div>
            <input
              type="file"
              name="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              required
              className="mt-1 w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-white file:px-2.5 file:py-1.5 file:text-xs file:font-bold"
            />
            <ActionSubmitButton size="sm" className="mt-1 w-full">
              Upload
            </ActionSubmitButton>
          </ActionForm>
        )}
      </div>

      <div className="mt-1.5 flex gap-3">
        <Button asChild variant="outline" className="group flex-1">
          <Link href="/sign-in" className="flex items-center justify-center gap-1.5">
            Sign in
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              className="transition-transform duration-200 ease-out group-hover:translate-x-1"
            >
              <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </Button>
      </div>
    </div>
  );
}
