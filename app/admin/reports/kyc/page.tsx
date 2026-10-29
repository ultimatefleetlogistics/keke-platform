import { redirect } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ReportsTabs } from "@/components/admin/reports-tabs";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getKycSnapshotReport } from "@/lib/data/reports";
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

export default async function KycReportPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.REPORTS_VIEW)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-20 text-center">
        <div className="text-lg font-extrabold">No access</div>
        <div className="max-w-sm text-[13.5px] text-text-soft">
          Your role doesn&apos;t include permission to view reports.
        </div>
      </div>
    );
  }

  const { counts, attention } = await getKycSnapshotReport();
  const total = counts.NOT_STARTED + counts.PENDING_REVIEW + counts.VERIFIED + counts.REJECTED;

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">KYC</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          How many investors are verified, pending, or not started, platform-wide. For the actual document review
          queue, see{" "}
          <Link href="/admin/kyc" className="font-bold text-accent-dark hover:underline">
            KYC review
          </Link>
          .
        </div>
      </header>
      <ReportsTabs active="/admin/reports/kyc" />

      <div className="flex flex-col gap-5 px-8 py-6">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Verified</div>
            <div className="mt-0.5 text-xl font-extrabold text-good-ink">{counts.VERIFIED}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Pending review</div>
            <div className="mt-0.5 text-xl font-extrabold text-warn-ink">{counts.PENDING_REVIEW}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Not started</div>
            <div className="mt-0.5 text-xl font-extrabold text-text-soft">{counts.NOT_STARTED}</div>
          </Card>
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Rejected</div>
            <div className="mt-0.5 text-xl font-extrabold text-bad-ink">{counts.REJECTED}</div>
          </Card>
        </div>

        <div className="text-[11.5px] text-text-faint">
          {total} investor{total === 1 ? "" : "s"} total.
        </div>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4">
            <div className="text-sm font-extrabold">Needs attention</div>
            <div className="mt-0.5 text-[11.5px] font-semibold text-text-faint">
              Investors still not started or pending review, longest waiting first.
            </div>
          </div>
          {attention.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-text-soft">
              Everyone is either verified or rejected, nothing waiting.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1.5fr_1fr_1fr] bg-[#FAFBF9] px-5 py-2.5 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">
                <span>Investor</span>
                <span>Status</span>
                <span>Waiting</span>
              </div>
              {attention.map((row, index) => (
                <Link
                  key={row.investorId}
                  href={`/admin/kyc/${row.investorId}`}
                  className={`grid grid-cols-[1.5fr_1fr_1fr] items-center px-5 py-3 text-[13px] font-semibold hover:bg-background/60 ${index > 0 ? "border-t border-border" : ""}`}
                >
                  <span>{row.investorName}</span>
                  <Badge variant={KYC_VARIANT[row.kycStatus] ?? "neutral"} className="w-fit">
                    {KYC_LABEL[row.kycStatus] ?? row.kycStatus}
                  </Badge>
                  <span className="text-text-soft">
                    {row.daysSinceCreated} day{row.daysSinceCreated === 1 ? "" : "s"}
                  </span>
                </Link>
              ))}
            </>
          )}
        </Card>
      </div>
    </>
  );
}
