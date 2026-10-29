import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DocumentSection } from "@/components/documents/document-section";
import { formatDate, formatNaira } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getContractDetail } from "@/lib/data/contracts";
import { getContractDocuments } from "@/lib/data/documents";
import { deferScheduleEntry, undeferScheduleEntry } from "@/lib/actions/contracts";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const CONTRACT_DOCUMENT_TYPES = [
  { value: "CONTRACT", label: "Signed contract" },
  { value: "OTHER", label: "Other" },
];

const CONTRACT_STATUS_VARIANT: Record<string, "good" | "warn" | "bad" | "pending" | "accent" | "neutral"> = {
  DRAFT: "neutral",
  ACTIVE: "accent",
  TARGET_ACHIEVED: "warn",
  TRANSFER_IN_PROGRESS: "warn",
  COMPLETED: "good",
  CANCELLED: "bad",
};

const ENTRY_STATUS_VARIANT: Record<string, "good" | "warn" | "bad" | "pending" | "neutral"> = {
  UPCOMING: "neutral",
  DUE: "warn",
  PARTIALLY_PAID: "pending",
  PAID: "good",
  DEFERRED: "bad",
};

const FREQUENCY_LABEL: Record<string, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Biweekly",
  MONTHLY: "Monthly",
};

export default async function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const contract = await getContractDetail(id);
  if (!contract) notFound();

  const documents = await getContractDocuments(id);
  const canManageDocuments = user.permissions.has(PERMISSIONS.CONTRACTS_MANAGE);
  const canManageSchedule = user.permissions.has(PERMISSIONS.CONTRACTS_MANAGE);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="text-[19px] font-extrabold tracking-tight">{contract.investor.fullName}</div>
          <Badge variant={CONTRACT_STATUS_VARIANT[contract.status] ?? "neutral"}>
            {contract.status.replaceAll("_", " ").toLowerCase()}
          </Badge>
        </div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          <Link href={`/admin/fleet/${contract.vehicle.id}`} className="font-semibold hover:underline">
            {contract.vehicle.assetTag}
          </Link>{" "}
          &middot; {contract.investor.email} &middot; {FREQUENCY_LABEL[contract.paymentFrequency]} installments of{" "}
          {formatNaira(contract.installmentAmount)}
        </div>
      </header>

      <div className="flex flex-col gap-5 px-8 py-6">
        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-extrabold">Progress toward target payout</div>
            <div className="text-[13px] font-bold text-text-soft">{contract.progressPercent.toFixed(1)}%</div>
          </div>
          <Progress value={contract.progressPercent} className="mt-3" />
          <div className="mt-2 flex justify-between text-[12.5px] font-semibold text-text-soft">
            <span className="text-good-ink">{formatNaira(contract.totalPaidToInvestor)} paid</span>
            <span>{formatNaira(contract.targetPayoutAmount)} target</span>
          </div>

          {contract.ownershipTransferId ? (
            <Link
              href={`/admin/transfers/${contract.ownershipTransferId}`}
              className="mt-4 flex items-center justify-between rounded-xl bg-warn-soft px-4 py-3 text-[12.5px] font-bold text-warn-ink hover:opacity-90"
            >
              This contract has reached its target, view the ownership transfer &rarr;
            </Link>
          ) : null}
        </Card>

        <Card className="p-5">
          <div className="mb-3 text-sm font-extrabold">Contract terms</div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Principal</div>
              <div className="mt-0.5 text-[14px] font-bold">{formatNaira(contract.principalAmount)}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Target payout</div>
              <div className="mt-0.5 text-[14px] font-bold">{formatNaira(contract.targetPayoutAmount)}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Term</div>
              <div className="mt-0.5 text-[14px] font-bold">{contract.termMonths} months</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Started</div>
              <div className="mt-0.5 text-[14px] font-bold">
                {contract.startDate ? formatDate(contract.startDate) : "Not set"}
              </div>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="text-sm font-extrabold">Payment schedule</div>
            <div className="text-[12px] font-semibold text-text-faint">
              {contract.scheduleSummary.paid} of {contract.scheduleSummary.total} paid
            </div>
          </div>
          {contract.scheduleEntries.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-text-soft">No schedule entries yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Due date</TableHead>
                  <TableHead>Expected</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Status</TableHead>
                  {canManageSchedule ? <TableHead>Action</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {contract.scheduleEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-semibold">{formatDate(entry.dueDate)}</TableCell>
                    <TableCell className="text-text-soft">{formatNaira(entry.expectedAmount)}</TableCell>
                    <TableCell className="font-bold">{formatNaira(entry.amountPaid)}</TableCell>
                    <TableCell>
                      <Badge variant={ENTRY_STATUS_VARIANT[entry.status] ?? "neutral"}>
                        {entry.status.replaceAll("_", " ").toLowerCase()}
                      </Badge>
                    </TableCell>
                    {canManageSchedule ? (
                      <TableCell>
                        {entry.status === "UPCOMING" || entry.status === "DUE" ? (
                          <ActionForm action={deferScheduleEntry} className="flex items-center gap-1.5">
                            <input type="hidden" name="scheduleEntryId" value={entry.id} />
                            <Input
                              name="reason"
                              placeholder="Reason (optional)"
                              className="h-8 w-40 px-2.5 text-[12px]"
                            />
                            <ActionSubmitButton size="sm" variant="outline">
                              Skip
                            </ActionSubmitButton>
                          </ActionForm>
                        ) : entry.status === "DEFERRED" ? (
                          <ActionForm action={undeferScheduleEntry}>
                            <input type="hidden" name="scheduleEntryId" value={entry.id} />
                            <ActionSubmitButton size="sm" variant="outline">
                              Un-skip
                            </ActionSubmitButton>
                          </ActionForm>
                        ) : (
                          <span className="text-text-faint">&mdash;</span>
                        )}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <DocumentSection
          documents={documents}
          canManage={canManageDocuments}
          contractId={contract.id}
          typeOptions={CONTRACT_DOCUMENT_TYPES}
          showVisibility
        />
      </div>
    </>
  );
}
