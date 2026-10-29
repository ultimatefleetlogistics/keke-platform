import { redirect } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KekeIcon } from "@/components/design-system/keke-icon";
import { formatDate, formatNaira } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getOwnershipTransfers } from "@/lib/data/transfers";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const STATUS_VARIANT: Record<string, "good" | "warn" | "bad" | "pending" | "accent" | "neutral"> = {
  TARGET_ACHIEVED: "warn",
  VERIFICATION_PENDING: "warn",
  VERIFIED: "accent",
  APPROVAL_PENDING: "accent",
  APPROVED: "pending",
  COMPLETED: "good",
  REJECTED: "bad",
};

const STATUS_LABEL: Record<string, string> = {
  TARGET_ACHIEVED: "Awaiting verification",
  VERIFICATION_PENDING: "Awaiting verification",
  VERIFIED: "Awaiting approval",
  APPROVAL_PENDING: "Awaiting approval",
  APPROVED: "Approved",
  COMPLETED: "Completed",
  REJECTED: "Sent back for correction",
};

export default async function OwnershipTransfersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (!user.permissions.has(PERMISSIONS.TRANSFER_VERIFY) && !user.permissions.has(PERMISSIONS.TRANSFER_APPROVE)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-20 text-center">
        <div className="text-lg font-extrabold">No access</div>
        <div className="max-w-sm text-[13.5px] text-text-soft">
          Your role doesn&apos;t include permission to view ownership transfers.
        </div>
      </div>
    );
  }

  const transfers = await getOwnershipTransfers();

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-accent-soft">
            <KekeIcon className="h-4 w-4" color="var(--accent-dark)" />
          </div>
          <div className="text-[19px] font-extrabold tracking-tight">Ownership transfers</div>
        </div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          A vehicle lands here the moment an investor&apos;s total payout reaches their contract&apos;s target, on
          its own that only records that it&apos;s time, staff still verify and approve every handover.
        </div>
      </header>

      <div className="px-8 py-6">
        {transfers.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-text-soft">
            No contract has reached its target payout yet, this list will fill in on its own as investors get paid.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Investor</TableHead>
                  <TableHead>Paid out</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Reached</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map((transfer) => (
                  <TableRow key={transfer.id}>
                    <TableCell className="font-bold">
                      <Link href={`/admin/transfers/${transfer.id}`} className="hover:underline">
                        {transfer.vehicleAssetTag}
                      </Link>
                    </TableCell>
                    <TableCell className="text-text-soft">{transfer.investorName}</TableCell>
                    <TableCell className="font-bold">{formatNaira(transfer.totalPaidToInvestor)}</TableCell>
                    <TableCell className="text-text-soft">{formatNaira(transfer.targetPayoutAmount)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[transfer.status] ?? "neutral"}>
                        {STATUS_LABEL[transfer.status] ?? transfer.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-text-soft">{formatDate(transfer.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
