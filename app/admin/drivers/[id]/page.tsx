import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PasswordResetPanel } from "@/components/admin/password-reset-panel";
import { AgentDriverKycCard } from "@/components/admin/agent-driver-kyc-card";
import { ManualPaymentForm } from "@/components/admin/manual-payment-form";
import { ReversePaymentButton } from "@/components/admin/reverse-payment-button";
import { formatDate, formatNaira } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDriverById } from "@/lib/data/drivers";
import { getAgentOptions } from "@/lib/data/onboarding";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { resetDriverPassword } from "@/lib/actions/drivers";
import { uploadAgentDriverDocument, reviewAgentDriverDocument, reviewAgentDriverKyc } from "@/lib/actions/agent-driver-kyc";
import { recordManualPayment, reversePaymentTransaction } from "@/lib/actions/manual-payments";
import { DriverEditForm } from "./driver-edit-form";

const DEPOSIT_STATUS_LABEL: Record<string, string> = {
  RECORDED: "Recorded",
  ALLOCATED: "Allocated",
  REVERSED: "Reversed",
};

const DEPOSIT_STATUS_VARIANT: Record<string, "good" | "warn" | "bad"> = {
  RECORDED: "warn",
  ALLOCATED: "good",
  REVERSED: "bad",
};

/**
 * Module 59: direct parity with app/admin/agents/[id]/page.tsx (Module
 * 51's "clicking on an agent we should be able to see everything about
 * that agent" page) — before this module a driver's own detail page was
 * a bare edit form, no deposit history, no collection account, no
 * standing, even though the underlying data (getDriverDeposits,
 * Driver.paystackDva* fields) already existed and just wasn't surfaced
 * here. Everything below mirrors the agent page's own structure and
 * component choices on purpose, same reviewer expectations either way.
 */
export default async function DriverDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.FLEET_VIEW)) redirect("/admin/drivers");

  const { id } = await params;
  const [driver, agents] = await Promise.all([getDriverById(id), getAgentOptions()]);
  if (!driver) notFound();

  const canManage = user.permissions.has(PERMISSIONS.FLEET_MANAGE);
  const canRecordPayments = user.permissions.has(PERMISSIONS.RECONCILIATION_VIEW);
  const canReviewKyc = user.permissions.has(PERMISSIONS.KYC_REVIEW);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="text-[19px] font-extrabold tracking-tight">{driver.fullName}</div>
          <Badge variant={driver.hasAppAccess ? "accent" : "neutral"}>{driver.hasAppAccess ? "App access" : "No app access"}</Badge>
          {driver.isDelinquent ? <Badge variant="bad">Hasn&apos;t deposited in {driver.daysSinceLastDeposit}d</Badge> : null}
        </div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Reports to {driver.agentName}, {driver.vehicle ? `driving ${driver.vehicle.assetTag}` : "no vehicle assigned"}. See{" "}
          <Link href="/admin/drivers" className="font-bold text-accent-dark hover:underline">
            all drivers
          </Link>
          .
        </div>
      </header>

      <div className="flex flex-col gap-5 px-8 py-6">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Total received, all time</div>
            <div className="mt-0.5 text-xl font-extrabold">
              <AnimatedNumber value={driver.totalReceived} format="naira" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Last deposit</div>
            <div className="mt-0.5 text-xl font-extrabold">
              {driver.daysSinceLastDeposit === null ? "Never" : `${driver.daysSinceLastDeposit}d ago`}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Deposits on record</div>
            <div className="mt-0.5 text-xl font-extrabold">
              <AnimatedNumber value={driver.deposits.length} format="count" />
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
          <Card className="p-6">
            {canManage ? (
              <DriverEditForm
                driverId={driver.id}
                fullName={driver.fullName}
                email={driver.email ?? ""}
                hasAppAccess={driver.hasAppAccess}
                phone={driver.phone ?? ""}
                agentId={driver.agentId}
                agents={agents}
              />
            ) : (
              <div className="text-[13px] text-text-soft">Your role doesn&apos;t include permission to edit driver records.</div>
            )}
          </Card>

          <div className="flex flex-col gap-5">
            {driver.hasAppAccess ? (
              <Card className="p-6">
                <div className="mb-4 text-[13.5px] font-extrabold">Account access</div>
                {canManage ? (
                  <PasswordResetPanel action={resetDriverPassword} idFieldName="driverId" idValue={driver.id} subjectLabel={driver.fullName} />
                ) : (
                  <div className="text-[13px] text-text-soft">Your role doesn&apos;t include permission to reset this driver&apos;s password.</div>
                )}
              </Card>
            ) : null}

            <Card className="p-6">
              <div className="mb-3 text-[13.5px] font-extrabold">Collection account</div>
              {driver.collectionAccount ? (
                <div>
                  <Badge variant="good" className="w-fit">
                    Active
                  </Badge>
                  <div className="mt-2 text-[13px] font-semibold">
                    {driver.collectionAccount.accountNumber} · {driver.collectionAccount.bankName}
                  </div>
                  <div className="mt-1 text-[11.5px] text-text-faint">Deposits paid into this account land in this driver&apos;s history automatically.</div>
                </div>
              ) : (
                <div>
                  <Badge variant="pending" className="w-fit">
                    Not set up
                  </Badge>
                  <div className="mt-2 text-[12.5px] text-text-soft">
                    Retry creating it from{" "}
                    <Link href="/admin/drivers" className="font-bold text-accent-dark hover:underline">
                      the drivers list
                    </Link>
                    .
                  </div>
                </div>
              )}
            </Card>
          </div>
        </div>

        <Card className="p-6">
          <AgentDriverKycCard
            subjectType="DRIVER"
            subjectId={driver.id}
            kycStatus={driver.kycStatus}
            documents={driver.documents}
            canUpload={canManage}
            canReview={canReviewKyc}
            uploadAction={uploadAgentDriverDocument}
            reviewDocumentAction={reviewAgentDriverDocument}
            reviewKycAction={reviewAgentDriverKyc}
          />
        </Card>

        {canRecordPayments ? (
          <Card className="p-6">
            <div className="mb-1 text-[13.5px] font-extrabold">Record a cash deposit</div>
            <div className="mb-3.5 text-[12px] text-text-faint">
              For money that reached this driver&apos;s collection outside Paystack (a cash handoff at a depot, for example), not for anything already showing below.
            </div>
            <ManualPaymentForm
              subjectType="DRIVER"
              subjectId={driver.id}
              vehicles={driver.vehicle ? [driver.vehicle] : []}
              action={recordManualPayment}
            />
          </Card>
        ) : null}

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4">
            <div className="text-sm font-extrabold">Deposit history</div>
            <div className="mt-0.5 text-[11.5px] font-semibold text-text-faint">Most recent, including any manually recorded cash deposits.</div>
          </div>
          {driver.deposits.length === 0 ? (
            <EmptyState
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3v12m0 0-4-4m4 4 4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              }
              title="No deposits recorded yet"
              description="Once Paystack confirms a payment into this driver's collection account, or staff record a cash deposit, it shows up here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Note</TableHead>
                  {canRecordPayments ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {driver.deposits.map((deposit) => (
                  <TableRow key={deposit.id}>
                    <TableCell className="text-text-soft">{formatDate(deposit.createdAt)}</TableCell>
                    <TableCell className="font-bold">{deposit.vehicleTags.length > 0 ? deposit.vehicleTags.join(", ") : "Not yet allocated"}</TableCell>
                    <TableCell className="font-bold">{formatNaira(deposit.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={DEPOSIT_STATUS_VARIANT[deposit.status]}>{DEPOSIT_STATUS_LABEL[deposit.status] ?? deposit.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-[11.5px] text-text-faint">{deposit.note ?? "—"}</TableCell>
                    {canRecordPayments ? (
                      <TableCell>
                        {deposit.status !== "REVERSED" ? (
                          <ReversePaymentButton paymentTransactionId={deposit.id} action={reversePaymentTransaction} />
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </>
  );
}
