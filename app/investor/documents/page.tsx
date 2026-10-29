import Link from "next/link";
import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getMyKycDocuments } from "@/lib/data/kyc";
import { getInvestorVisibleDocuments } from "@/lib/data/documents";

const CONTRACT_DOC_TYPE_LABEL: Record<string, string> = {
  CONTRACT: "Signed contract",
  MAINTENANCE_RECEIPT: "Maintenance receipt",
  ASSET_PHOTO: "Asset photo",
  OTHER: "Other",
};

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

const DOC_TYPE_LABEL: Record<string, string> = {
  GOVERNMENT_ID: "Government-issued ID",
  PROOF_OF_ADDRESS: "Proof of address",
};

export default async function InvestorDocumentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.investor) redirect("/investor/dashboard");

  const documents = await getMyKycDocuments(user.investor.id);
  // `keyof typeof documents`, not a bare `string` index: Module 31
  // narrowed getMyKycDocuments's return type from a loose
  // `Record<string, ...>` to the exact `Record<"GOVERNMENT_ID" |
  // "PROOF_OF_ADDRESS", ...>` IdentityForm actually wants (see lib/data/kyc.ts),
  // which fixed a real next build error there but broke type-checking
  // here, a plain `string` index no longer has a matching signature on
  // the narrower type. `keyof typeof documents` resolves to the same two
  // literal keys either way, so this line works regardless of how loose
  // or narrow that return type is.
  const entries = Object.entries(documents) as [string, (typeof documents)[keyof typeof documents]][];
  const contractDocuments = await getInvestorVisibleDocuments(user.investor.id);

  return (
    <>
      <header className="border-b border-border px-9 py-5.5">
        <div className="text-xl font-extrabold tracking-tight">Documents</div>
        <div className="mt-0.5 text-[13px] text-text-soft">The identity documents you&apos;ve submitted for verification</div>
      </header>

      <div className="flex flex-col gap-4 px-9 py-6">
        <div className="flex flex-col gap-3">
          {entries.map(([type, doc]) => (
            <Card key={type} className="flex items-center justify-between gap-3 p-5">
              <div>
                <div className="text-[14.5px] font-extrabold">{DOC_TYPE_LABEL[type] ?? type}</div>
                {doc ? (
                  <div className="mt-0.5 text-[12.5px] text-text-faint">
                    {doc.fileName} &middot; uploaded {formatDate(doc.createdAt)}
                  </div>
                ) : (
                  <div className="mt-0.5 text-[12.5px] text-text-faint">Not uploaded yet</div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {doc ? <Badge variant={DOC_STATUS_VARIANT[doc.status]}>{DOC_STATUS_LABEL[doc.status]}</Badge> : null}
                <Button asChild size="sm" variant="outline">
                  <Link href="/kyc">{doc ? "Replace" : "Upload"}</Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4">
            <div className="text-sm font-extrabold">Contract documents</div>
            <div className="mt-0.5 text-[12.5px] text-text-soft">
              Documents your account manager has shared with you for your vehicles
            </div>
          </div>
          {contractDocuments.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-text-soft">
              No documents have been shared with you yet.
            </div>
          ) : (
            <div className="flex flex-col">
              {contractDocuments.map((doc, index) => (
                <div
                  key={doc.id}
                  className={`flex items-center justify-between gap-3 px-5 py-3.5 text-[13px] ${index > 0 ? "border-t border-border" : ""}`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{doc.fileName}</span>
                      <Badge variant="neutral">{CONTRACT_DOC_TYPE_LABEL[doc.type] ?? doc.type}</Badge>
                    </div>
                    <div className="mt-0.5 text-[12px] text-text-faint">
                      {doc.vehicleAssetTag ? `${doc.vehicleAssetTag} · ` : ""}
                      uploaded {formatDate(doc.createdAt)}
                    </div>
                  </div>
                  {doc.signedUrl ? (
                    <Button asChild size="sm" variant="outline" className="shrink-0">
                      <a href={doc.signedUrl} target="_blank" rel="noreferrer">
                        View
                      </a>
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
