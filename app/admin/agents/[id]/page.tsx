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
import { getAgentById, vehicleStatusLabel, vehicleStatusVariant } from "@/lib/data/agents";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { resetStaffOrAgentPassword } from "@/lib/actions/staff";
import { uploadAgentDriverDocument, reviewAgentDriverDocument, reviewAgentDriverKyc } from "@/lib/actions/agent-driver-kyc";
import { recordManualPayment, reversePaymentTransaction } from "@/lib/actions/manual-payments";
import { AgentEditForm } from "./agent-edit-form";

const REMITTANCE_STATUS_LABEL: Record<string, string> = {
  RECORDED: "Recorded",
  ALLOCATED: "Allocated",
  REVERSED: "Reversed",
};

const REMITTANCE_STATUS_VARIANT: Record<string, "good" | "warn" | "bad"> = {
  RECORDED: "warn",
  ALLOCATED: "good",
  REVERSED: "bad",
};

// Module 51: direct feedback — "clicking on an agent we should be able
// to see everything about that agent, his location, drivers under him,
// vehicles under him, how much he has remitted, since day or date of
// joining the company etc." Everything below comes from
// lib/data/agents.ts's getAgentById, one query per section (drivers,
// vehicles, remittances) rather than trying to cram it all into the
// edit form the way the combined staff/agent screen used to, an agent
// carries real operational history a staff account never has.
//
// Module 59: adds the same three staff-facing tools the driver detail
// page got (identity verification, cash remittance capture, dispute/
// reversal), plus a delinquency badge — parity with the driver page on
// purpose, see that page's own header comment.
export default async function AgentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.STAFF_MANAGE)) redirect("/admin/agents");

  const { id } = await params;
  const agent = await getAgentById(id);
  if (!agent) notFound();

  const canRecordPayments = user.permissions.has(PERMISSIONS.RECONCILIATION_VIEW);
  const canReviewKyc = user.permissions.has(PERMISSIONS.KYC_REVIEW);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="flex items-center gap-2.5">
          <div className="text-[19px] font-extrabold tracking-tight">{agent.fullName}</div>
          <Badge variant="neutral">Agent</Badge>
          {agent.isDelinquent ? <Badge variant="bad">Hasn&apos;t remitted in {agent.daysSinceLastRemittance}d</Badge> : null}
        </div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          {agent.region ? agent.region : "No region set"} · Joined {formatDate(agent.joinedAt)} ·{" "}
          {agent.roles.length > 0 ? agent.roles.join(", ") : "No role assigned yet"}. See{" "}
          <Link href="/admin/agents" className="font-bold text-accent-dark hover:underline">
            all agents
          </Link>
          .
        </div>
      </header>

      <div className="flex flex-col gap-5 px-8 py-6">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Total remitted, all time</div>
            <div className="mt-0.5 text-xl font-extrabold">
              <AnimatedNumber value={agent.totalRemitted} format="naira" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Drivers</div>
            <div className="mt-0.5 text-xl font-extrabold">
              <AnimatedNumber value={agent.drivers.length} format="count" />
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-[11.5px] font-semibold text-text-soft">Vehicles</div>
            <div className="mt-0.5 text-xl font-extrabold">
              <AnimatedNumber value={agent.vehicles.length} format="count" />
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
          <Card className="p-6">
            <AgentEditForm
              userId={agent.id}
              fullName={agent.fullName}
              email={agent.email}
              phone={agent.phone ?? ""}
              region={agent.region}
            />
          </Card>

          <div className="flex flex-col gap-5">
            <Card className="p-6">
              <div className="mb-4 text-[13.5px] font-extrabold">Account access</div>
              <PasswordResetPanel
                action={resetStaffOrAgentPassword}
                idFieldName="userId"
                idValue={agent.id}
                subjectLabel={agent.fullName}
              />
            </Card>

            <Card className="p-6">
              <div className="mb-3 text-[13.5px] font-extrabold">Collection account</div>
              {agent.collectionAccount ? (
                <div>
                  <Badge variant="good" className="w-fit">
                    Active
                  </Badge>
                  <div className="mt-2 text-[13px] font-semibold">
                    {agent.collectionAccount.accountNumber} · {agent.collectionAccount.bankName}
                  </div>
                  <div className="mt-1 text-[11.5px] text-text-faint">
                    Remittances paid into this account land in this agent&apos;s history automatically.
                  </div>
                </div>
              ) : (
                <div>
                  <Badge variant="pending" className="w-fit">
                    Not set up
                  </Badge>
                  <div className="mt-2 text-[12.5px] text-text-soft">
                    Retry creating it from{" "}
                    <Link href="/admin/agents" className="font-bold text-accent-dark hover:underline">
                      the agents list
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
            subjectType="AGENT"
            subjectId={agent.id}
            kycStatus={agent.kycStatus}
            documents={agent.documents}
            canUpload={user.permissions.has(PERMISSIONS.STAFF_MANAGE)}
            canReview={canReviewKyc}
            uploadAction={uploadAgentDriverDocument}
            reviewDocumentAction={reviewAgentDriverDocument}
            reviewKycAction={reviewAgentDriverKyc}
          />
        </Card>

        {canRecordPayments ? (
          <Card className="p-6">
            <div className="mb-1 text-[13.5px] font-extrabold">Record a cash remittance</div>
            <div className="mb-3.5 text-[12px] text-text-faint">
              For money that reached this agent outside Paystack (a cash handoff at a depot, for example), not for anything already showing below.
            </div>
            <ManualPaymentForm
              subjectType="AGENT"
              subjectId={agent.id}
              vehicles={agent.vehicles.map((vehicle) => ({ id: vehicle.id, assetTag: vehicle.assetTag }))}
              action={recordManualPayment}
            />
          </Card>
        ) : null}

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4 text-sm font-extrabold">Drivers</div>
          {agent.drivers.length === 0 ? (
            <EmptyState
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
                  <circle cx="12" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.7" />
                  <path d="M12 3.5v6.2M12 14.3v6.2M20.5 12h-6.2M9.7 12H3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              }
              title="No drivers reporting to this agent yet"
              description="Drivers assigned to this agent will show up here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>App access</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {agent.drivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-bold">{driver.fullName}</TableCell>
                    <TableCell className="text-text-soft">{driver.phone ?? "Not set"}</TableCell>
                    <TableCell className="text-text-soft">
                      {driver.vehicle ? (
                        <Link href={`/admin/fleet/${driver.vehicle.id}`} className="font-semibold hover:underline">
                          {driver.vehicle.assetTag}
                        </Link>
                      ) : (
                        "Unassigned"
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={driver.hasAppAccess ? "accent" : "neutral"}>
                        {driver.hasAppAccess ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/drivers/${driver.id}`} className="font-semibold text-accent-dark hover:underline">
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4 text-sm font-extrabold">Vehicles</div>
          {agent.vehicles.length === 0 ? (
            <EmptyState
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M4 17h16M6 17V9.5a2 2 0 0 1 1-1.73l4.5-2.6a2 2 0 0 1 2 0l4.5 2.6a2 2 0 0 1 1 1.73V17"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              title="No vehicles assigned to this agent yet"
              description="Vehicles assigned to this agent will show up here."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Asset tag</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Driver</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agent.vehicles.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-bold">
                      <Link href={`/admin/fleet/${vehicle.id}`} className="hover:underline">
                        {vehicle.assetTag}
                      </Link>
                    </TableCell>
                    <TableCell className="text-text-soft">{vehicle.type}</TableCell>
                    <TableCell>
                      <Badge variant={vehicleStatusVariant(vehicle.status)}>{vehicleStatusLabel(vehicle.status)}</Badge>
                    </TableCell>
                    <TableCell className="text-text-soft">{vehicle.location}</TableCell>
                    <TableCell className="text-text-soft">{vehicle.driver ?? "Unassigned"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4">
            <div className="text-sm font-extrabold">Remittance history</div>
            <div className="mt-0.5 text-[11.5px] font-semibold text-text-faint">
              Most recent 50. See{" "}
              <Link href="/admin/payments/reconciliation" className="font-bold text-accent-dark hover:underline">
                Reconciliation
              </Link>{" "}
              for the complete ledger.
            </div>
          </div>
          {agent.remittances.length === 0 ? (
            <EmptyState
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 3v12m0 0-4-4m4 4 4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              title="No remittances recorded yet"
              description="Once Paystack confirms a payment into this agent's collection account, it shows up here automatically."
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
                {agent.remittances.map((remittance) => (
                  <TableRow key={remittance.id}>
                    <TableCell className="text-text-soft">{formatDate(remittance.createdAt)}</TableCell>
                    <TableCell className="font-bold">
                      {remittance.vehicleTags.length > 0 ? remittance.vehicleTags.join(", ") : "Not yet allocated"}
                    </TableCell>
                    <TableCell className="font-bold">{formatNaira(remittance.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={REMITTANCE_STATUS_VARIANT[remittance.status]}>
                        {REMITTANCE_STATUS_LABEL[remittance.status] ?? remittance.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[220px] truncate text-[11.5px] text-text-faint">{remittance.note ?? "—"}</TableCell>
                    {canRecordPayments ? (
                      <TableCell>
                        {remittance.status !== "REVERSED" ? (
                          <ReversePaymentButton paymentTransactionId={remittance.id} action={reversePaymentTransaction} />
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
