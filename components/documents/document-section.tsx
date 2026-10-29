import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { uploadDocument, deleteDocument } from "@/lib/actions/documents";

const SELECT_CLASS =
  "flex h-10 w-full rounded-xl border border-border bg-surface px-3 py-2 text-[13px] text-text outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft";

const TYPE_LABEL: Record<string, string> = {
  CONTRACT: "Signed contract",
  MAINTENANCE_RECEIPT: "Maintenance receipt",
  ASSET_PHOTO: "Asset photo",
  OTHER: "Other",
};

export type DocumentRow = {
  id: string;
  type: string;
  fileName: string;
  visibility?: string;
  signedUrl: string | null;
  createdAt: string;
};

/**
 * The upload form plus document list shown on both the admin contract
 * detail page and the admin fleet detail page, the only difference
 * between the two callers is which id (contractId or vehicleId) gets
 * attached and whether a visibility choice makes sense at all: a
 * vehicle-only document has no investor to ever show it to, so
 * showVisibility should only be true when contractId is set, see
 * lib/data/documents.ts's getInvestorVisibleDocuments, which only ever
 * looks at documents reached through a contract.
 */
export function DocumentSection({
  documents,
  canManage,
  contractId,
  vehicleId,
  typeOptions,
  showVisibility,
}: {
  documents: DocumentRow[];
  canManage: boolean;
  contractId?: string;
  vehicleId?: string;
  typeOptions: { value: string; label: string }[];
  showVisibility: boolean;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-5 py-4 text-sm font-extrabold">Documents</div>

      {canManage ? (
        <ActionForm
          action={uploadDocument}
          className="flex flex-col gap-2.5 border-b border-border px-5 py-4 sm:flex-row sm:items-end"
        >
          {contractId ? <input type="hidden" name="contractId" value={contractId} /> : null}
          {vehicleId ? <input type="hidden" name="vehicleId" value={vehicleId} /> : null}

          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Type</label>
            <select name="type" required defaultValue={typeOptions[0]?.value} className={SELECT_CLASS}>
              {typeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {showVisibility ? (
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Visible to</label>
              <select name="visibility" defaultValue="STAFF_ONLY" className={SELECT_CLASS}>
                <option value="STAFF_ONLY">Staff only</option>
                <option value="PRIVATE_OWNER">This investor too</option>
              </select>
            </div>
          ) : null}

          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wide text-text-faint">File</label>
            <input
              type="file"
              name="file"
              required
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="flex h-10 w-full rounded-xl border border-border bg-surface px-3 py-2 text-[12.5px] text-text file:mr-2 file:rounded-lg file:border-0 file:bg-accent-soft file:px-2.5 file:py-1 file:text-[12px] file:font-semibold file:text-accent-dark"
            />
          </div>

          <ActionSubmitButton size="sm" className="shrink-0">
            Upload
          </ActionSubmitButton>
        </ActionForm>
      ) : null}

      {documents.length === 0 ? (
        <div className="px-5 py-8 text-center text-[13px] text-text-soft">No documents on file yet.</div>
      ) : (
        <div className="flex flex-col">
          {documents.map((doc, index) => (
            <div
              key={doc.id}
              className={`flex items-center justify-between gap-3 px-5 py-3.5 text-[13px] ${index > 0 ? "border-t border-border" : ""}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{doc.fileName}</span>
                  <Badge variant="neutral">{TYPE_LABEL[doc.type] ?? doc.type}</Badge>
                  {doc.visibility === "PRIVATE_OWNER" ? <Badge variant="accent">Investor can see this</Badge> : null}
                </div>
                <div className="mt-0.5 text-[12px] text-text-faint">Uploaded {formatDate(doc.createdAt)}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {doc.signedUrl ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={doc.signedUrl} target="_blank" rel="noreferrer">
                      View
                    </a>
                  </Button>
                ) : null}
                {canManage ? (
                  <ActionForm action={deleteDocument}>
                    <input type="hidden" name="documentId" value={doc.id} />
                    <ActionSubmitButton size="sm" variant="ghost">
                      Delete
                    </ActionSubmitButton>
                  </ActionForm>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
