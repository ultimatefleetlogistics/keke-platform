import { redirect } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClickableRow } from "@/components/ui/clickable-row";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getInvestorsList } from "@/lib/data/onboarding";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const KYC_VARIANT: Record<string, "good" | "warn" | "bad" | "pending" | "accent" | "neutral"> = {
  NOT_STARTED: "neutral",
  PENDING_REVIEW: "warn",
  VERIFIED: "good",
  REJECTED: "bad",
};

const KYC_LABEL: Record<string, string> = {
  NOT_STARTED: "Not started",
  PENDING_REVIEW: "Pending review",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

export default async function InvestorsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (!user.permissions.has(PERMISSIONS.INVESTORS_VIEW) && !user.permissions.has(PERMISSIONS.INVESTORS_MANAGE)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-20 text-center">
        <div className="text-lg font-extrabold">No access</div>
        <div className="max-w-sm text-[13.5px] text-text-soft">
          Your role doesn&apos;t include permission to view investors.
        </div>
      </div>
    );
  }

  const investors = await getInvestorsList();
  const canManage = user.permissions.has(PERMISSIONS.INVESTORS_MANAGE);
  const canCreateContract = user.permissions.has(PERMISSIONS.CONTRACTS_CREATE);

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Investors</div>
        <div className="flex gap-2.5">
          {canCreateContract ? (
            <Button size="sm" variant="outline" asChild>
              <Link href="/admin/contracts/new">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M4 17h16M6 17V9.5a2 2 0 0 1 1-1.73l4.5-2.6a2 2 0 0 1 2 0l4.5 2.6a2 2 0 0 1 1 1.73V17" stroke="var(--accent-dark)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                New contract
              </Link>
            </Button>
          ) : null}
          {canManage ? (
            <Button size="sm" asChild>
              <Link href="/admin/investors/new">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Add investor
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="px-8 py-6">
        {investors.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-text-soft">
            No investors yet. {canManage ? "Add the first one to get started." : ""}
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Investor</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>KYC status</TableHead>
                  <TableHead>Bank account</TableHead>
                  <TableHead>Active contracts</TableHead>
                  <TableHead>Total contracts</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {investors.map((investor) => (
                  <ClickableRow key={investor.id} href={`/admin/investors/${investor.id}`}>
                    <TableCell className="font-bold">
                      <Link href={`/admin/investors/${investor.id}`} className="hover:underline">
                        {investor.fullName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-text-soft">{investor.email}</TableCell>
                    <TableCell>
                      <Badge variant={KYC_VARIANT[investor.kycStatus]}>{KYC_LABEL[investor.kycStatus]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={investor.hasBankAccount ? "good" : "warn"}>
                        {investor.hasBankAccount ? "On file" : "Not set"}
                      </Badge>
                    </TableCell>
                    <TableCell>{investor.activeContracts}</TableCell>
                    <TableCell className="text-text-soft">{investor.totalContracts}</TableCell>
                    <TableCell className="text-right text-[12.5px] font-bold text-accent-dark">
                      {canManage ? "Edit →" : "View →"}
                    </TableCell>
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
