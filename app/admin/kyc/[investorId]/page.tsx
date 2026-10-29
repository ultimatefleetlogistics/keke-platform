import { redirect, notFound } from "next/navigation";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getInvestorKycDetail } from "@/lib/data/kyc";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { reviewKycDocument, reviewInvestorKyc } from "@/lib/actions/kyc";

const DOC_TYPE_LABEL: Record<string, string> = {
  GOVERNMENT_ID: "Government-issued ID",
  PROOF_OF_ADDRESS: "Proof of address",
};

const DOC_STATUS_VARIANT: Record<string, "good" | "warn" | "bad"> = {
  PENDING_REVIEW: "warn",
  VERIFIED: "good",
  REJECTED: "bad",
};

const OVERALL_STATUS_VARIANT: Record<string, "good" | "warn" | "bad" | "neutral"> = {
  NOT_STARTED: "neutral",
  PENDING_REVIEW: "warn",
  VERIFIED: "good",
  REJECTED: "bad",
};

export default async function KycReviewPage({ params }: { params: Promise<{ investorId: string }> }) {
  const { investorId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.KYC_REVIEW)) redirect("/admin/kyc");

  const investor = await getInvestorKycDetail(investorId);
  if (!investor) notFound();

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">{investor.fullName}</div>
        <Badge variant={OVERALL_STATUS_VARIANT[investor.kycStatus] ?? "neutral"}>
          {investor.kycStatus.replaceAll("_", " ").toLowerCase()}
        </Badge>
      </header>

      <div className="flex flex-col gap-5 px-8 py-6">
        <Card className="p-5">
          <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Email</div>
          <div className="mt-0.5 text-[14px] font-bold">{investor.email}</div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4 text-sm font-extrabold">Documents</div>
          {investor.documents.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-text-soft">No documents uploaded yet.</div>
          ) : (
            <div className="flex flex-col">
              {investor.documents.map((doc, index) => (
                <div key={doc.id} className={`flex items-center justify-between px-5 py-4 ${index > 0 ? "border-t border-border" : ""}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold">{DOC_TYPE_LABEL[doc.type] ?? doc.type}</span>
                      <Badge variant={DOC_STATUS_VARIANT[doc.status]}>{doc.status.replaceAll("_", " ").toLowerCase()}</Badge>
                    </div>
                    <div className="mt-0.5 text-[12px] text-text-faint">
                      {doc.fileName} &middot; uploaded {formatDate(doc.createdAt)}
                      {doc.reviewedBy ? ` · reviewed by ${doc.reviewedBy} on ${formatDate(doc.reviewedAt!)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {doc.signedUrl ? (
                      <a
                        href={doc.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-border px-3 py-1.5 text-[12.5px] font-bold hover:bg-background"
                      >
                        View
                      </a>
                    ) : null}
                    {doc.status === "PENDING_REVIEW" ? (
                      <>
                        <ActionForm action={reviewKycDocument}>
                          <input type="hidden" name="documentId" value={doc.id} />
                          <input type="hidden" name="decision" value="VERIFIED" />
                          <ActionSubmitButton size="sm">Approve</ActionSubmitButton>
                        </ActionForm>
                        <ActionForm action={reviewKycDocument}>
                          <input type="hidden" name="documentId" value={doc.id} />
                          <input type="hidden" name="decision" value="REJECTED" />
                          <ActionSubmitButton size="sm" variant="destructive">
                            Reject
                          </ActionSubmitButton>
                        </ActionForm>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {investor.kycStatus === "PENDING_REVIEW" ? (
          <Card className="flex flex-col gap-3 p-5">
            <div className="text-sm font-extrabold">Overall decision</div>
            <div className="text-[13px] text-text-soft">
              This is separate from any one document, it&apos;s what actually unlocks the investor&apos;s first
              contract. Review both documents above before deciding.
            </div>
            <div className="flex gap-3">
              <ActionForm action={reviewInvestorKyc} className="flex-1">
                <input type="hidden" name="investorId" value={investor.id} />
                <input type="hidden" name="decision" value="VERIFIED" />
                <ActionSubmitButton className="w-full">Verify this investor</ActionSubmitButton>
              </ActionForm>
              <ActionForm action={reviewInvestorKyc} className="flex-1">
                <input type="hidden" name="investorId" value={investor.id} />
                <input type="hidden" name="decision" value="REJECTED" />
                <ActionSubmitButton variant="destructive" className="w-full">
                  Reject
                </ActionSubmitButton>
              </ActionForm>
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
