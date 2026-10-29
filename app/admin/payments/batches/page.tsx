import { redirect } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClickableRow } from "@/components/ui/clickable-row";
import { formatDate, formatNaira } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPaymentBatches } from "@/lib/data/payments";
import { getUnmatchedCount } from "@/lib/data/reconciliation";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const STATUS_VARIANT: Record<string, "good" | "warn" | "bad" | "pending" | "accent" | "neutral"> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "warn",
  APPROVED: "accent",
  PROCESSING: "pending",
  COMPLETED: "good",
  PARTIALLY_FAILED: "bad",
  REJECTED: "bad",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  PARTIALLY_FAILED: "Partially failed",
  REJECTED: "Rejected",
};

export default async function PaymentBatchesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (!user.permissions.has(PERMISSIONS.PAYMENTS_VIEW)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-20 text-center">
        <div className="text-lg font-extrabold">No access</div>
        <div className="max-w-sm text-[13.5px] text-text-soft">
          Your role doesn&apos;t include permission to view payment batches.
        </div>
      </div>
    );
  }

  const canReconcile = user.permissions.has(PERMISSIONS.RECONCILIATION_VIEW);
  const [batches, unmatchedCount] = await Promise.all([
    getPaymentBatches(),
    canReconcile ? getUnmatchedCount() : Promise.resolve(0),
  ]);
  const canCreate = user.permissions.has(PERMISSIONS.PAYMENT_BATCH_CREATE);

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Payment batches</div>
        <div className="flex items-center gap-2.5">
          {canReconcile ? (
            <Button size="sm" variant="outline" asChild>
              <Link href="/admin/payments/reconciliation">
                Reconciliation
                {unmatchedCount > 0 ? <Badge variant="bad">{unmatchedCount}</Badge> : null}
              </Link>
            </Button>
          ) : null}
          {canCreate ? (
            <Button size="sm" asChild>
              <Link href="/admin/payments/batches/new">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
                New batch
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="px-8 py-6">
        {batches.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-text-soft">
            No payment batches yet. {canCreate ? "Create one to pay investors who are due." : ""}
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Batch</TableHead>
                  <TableHead>Created by</TableHead>
                  <TableHead>Investors</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <ClickableRow key={batch.id} href={`/admin/payments/batches/${batch.id}`}>
                    <TableCell className="font-bold">
                      <Link href={`/admin/payments/batches/${batch.id}`} className="hover:underline">
                        {batch.periodLabel}
                      </Link>
                    </TableCell>
                    <TableCell className="text-text-soft">{batch.createdBy}</TableCell>
                    <TableCell>{batch.itemCount}</TableCell>
                    <TableCell className="font-bold">{formatNaira(batch.totalAmount)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[batch.status]}>{STATUS_LABEL[batch.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-text-soft">{formatDate(batch.createdAt)}</TableCell>
                  </ClickableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
