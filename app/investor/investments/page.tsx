import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatNaira, formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getInvestorInvestments } from "@/lib/data/investor";
import { VEHICLE_TYPE_LABELS } from "@/lib/vehicle-types";

const CONTRACT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  TARGET_ACHIEVED: "Target reached, transfer pending",
  TRANSFER_IN_PROGRESS: "Ownership transfer in progress",
  COMPLETED: "Completed, ownership transferred",
  CANCELLED: "Cancelled",
};

const CONTRACT_STATUS_VARIANT: Record<string, "good" | "warn" | "bad" | "pending" | "accent" | "neutral"> = {
  DRAFT: "neutral",
  ACTIVE: "accent",
  TARGET_ACHIEVED: "warn",
  TRANSFER_IN_PROGRESS: "warn",
  COMPLETED: "good",
  CANCELLED: "bad",
};

const FREQUENCY_LABEL: Record<string, string> = {
  WEEKLY: "Weekly",
  BIWEEKLY: "Every two weeks",
  MONTHLY: "Monthly",
};

export default async function InvestorInvestmentsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.investor) redirect("/investor/dashboard");

  const investments = await getInvestorInvestments(user.investor);

  return (
    <>
      <header className="border-b border-border px-9 py-5.5">
        <div className="text-xl font-extrabold tracking-tight">My investments</div>
        <div className="mt-0.5 text-[13px] text-text-soft">Every vehicle you&apos;ve invested in, with full contract terms</div>
      </header>

      <div className="flex flex-col gap-4 px-9 py-6">
        {investments.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-text-soft">
            No investments yet. Once staff create your first contract, it will show up here.
          </Card>
        ) : (
          investments.map((investment) => (
            // 2026-10-30: same fix as the dashboard's "My vehicles" cards
            // — see the dated comment on
            // app/investor/vehicles/[assetTag]/page.tsx.
            <a key={investment.id} href={`/investor/vehicles/${encodeURIComponent(investment.assetTag)}`}>
            <Card className="p-5.5 hover:shadow-card-hover">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-[16px] font-extrabold">
                      {VEHICLE_TYPE_LABELS[investment.vehicleType]} {investment.assetTag}
                    </div>
                    <Badge
                      variant={
                        investment.paymentStatus === "ACTIVE"
                          ? "good"
                          : investment.paymentStatus === "PAYMENT_OVERDUE"
                            ? "bad"
                            : "warn"
                      }
                    >
                      {investment.paymentStatus === "ACTIVE"
                        ? "Active"
                        : investment.paymentStatus === "PAYMENT_OVERDUE"
                          ? "Payment overdue"
                          : "Payment deferred"}
                    </Badge>
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-text-faint">
                    Agent: {investment.agentName} &middot; {investment.location}
                  </div>
                </div>
                <Badge variant={CONTRACT_STATUS_VARIANT[investment.contractStatus] ?? "neutral"}>
                  {CONTRACT_STATUS_LABEL[investment.contractStatus] ?? investment.contractStatus}
                </Badge>
              </div>

              <div className="my-4 flex items-center justify-between text-[12.5px] font-semibold text-text-soft">
                <span>Progress toward payout</span>
                <span className="text-text">{investment.progressPercent}%</span>
              </div>
              <Progress value={investment.progressPercent} />

              <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <div className="text-[11px] font-semibold text-text-faint">Principal</div>
                  <div className="mt-0.5 text-[13.5px] font-bold">{formatNaira(investment.principal)}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-text-faint">Target payout</div>
                  <div className="mt-0.5 text-[13.5px] font-bold">{formatNaira(investment.target)}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-text-faint">Realized so far</div>
                  <div className="mt-0.5 text-[13.5px] font-bold text-good-ink">{formatNaira(investment.realized)}</div>
                </div>
                <div>
                  <div className="text-[11px] font-semibold text-text-faint">Installment</div>
                  <div className="mt-0.5 text-[13.5px] font-bold">
                    {formatNaira(investment.installment)}{" "}
                    <span className="text-[11px] font-semibold text-text-faint">
                      {FREQUENCY_LABEL[investment.frequency] ?? investment.frequency}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3.5 flex flex-wrap gap-4 border-t border-border pt-3.5 text-[12px] text-text-faint">
                <span>Term: up to {investment.termMonths} months</span>
                <span>Started: {investment.startDate ? formatDate(investment.startDate) : "Not started yet"}</span>
              </div>
            </Card>
            </a>
          ))
        )}
      </div>
    </>
  );
}
