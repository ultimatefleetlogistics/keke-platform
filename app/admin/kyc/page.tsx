import { redirect } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClickableRow } from "@/components/ui/clickable-row";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getKycQueue } from "@/lib/data/kyc";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function KycQueuePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.KYC_REVIEW)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-20 text-center">
        <div className="text-lg font-extrabold">No access</div>
        <div className="max-w-sm text-[13.5px] text-text-soft">
          Your role doesn&apos;t include permission to review KYC submissions.
        </div>
      </div>
    );
  }

  const queue = await getKycQueue();

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">KYC review</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Every investor with a submission awaiting a decision on an uploaded document.
        </div>
      </header>

      <div className="px-8 py-6">
        {queue.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-text-soft">
            Nothing waiting on review right now.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Investor</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Documents</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {queue.map((row) => (
                  <ClickableRow key={row.id} href={`/admin/kyc/${row.id}`}>
                    <TableCell className="font-bold">
                      <Link href={`/admin/kyc/${row.id}`} className="hover:underline">
                        {row.fullName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-text-soft">{row.email}</TableCell>
                    <TableCell className="text-text-soft">
                      {row.pendingDocumentCount} pending / {row.documentCount} total
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.kycStatus === "PENDING_REVIEW" ? "warn" : "neutral"}>
                        {row.kycStatus.replaceAll("_", " ").toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-[12.5px] font-bold text-accent-dark">Review →</TableCell>
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
