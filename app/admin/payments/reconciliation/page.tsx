import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatNaira, formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  getUnmatchedTransactions,
  getRecentlyProcessedTransactions,
  getVehicleOptionsForReconciliation,
} from "@/lib/data/reconciliation";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { MatchTransactionForm, DismissTransactionForm } from "./match-dismiss-forms";

export default async function ReconciliationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.RECONCILIATION_VIEW)) redirect("/admin/payments/batches");

  const [unmatched, recentlyProcessed, vehicleOptions] = await Promise.all([
    getUnmatchedTransactions(),
    getRecentlyProcessedTransactions(),
    getVehicleOptionsForReconciliation(),
  ]);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Reconciliation</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Every Paystack event the app received but couldn&apos;t match to an agent or driver on its own, most often
          because a remittance came from a Paystack customer code we don&apos;t recognize. The money already moved,
          this only decides which vehicle&apos;s contract it should count toward.
        </div>
      </header>

      <div className="flex flex-col gap-5 px-8 py-6">
        {unmatched.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-text-soft">Nothing waiting on reconciliation right now.</Card>
        ) : (
          <div className="flex flex-col gap-3">
            {unmatched.map((t) => (
              <Card key={t.id} className="flex flex-col gap-3.5 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-extrabold">
                        {t.amountNaira !== null ? formatNaira(t.amountNaira) : "Amount unknown"}
                      </span>
                      <Badge variant="bad">{t.eventType}</Badge>
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-text-soft">
                      Received {formatDate(t.receivedAt)}
                      {t.customerEmail ? ` · ${t.customerEmail}` : ""}
                      {t.customerCode ? ` · ${t.customerCode}` : ""}
                      {t.reference ? ` · ref ${t.reference}` : ""}
                    </div>
                  </div>
                  <details className="text-[12px]">
                    <summary className="cursor-pointer font-semibold text-accent-dark">Raw payload</summary>
                    <pre className="mt-2 max-w-[420px] overflow-x-auto rounded-xl bg-background p-3 text-[11px] leading-4 text-text-soft">
                      {t.rawPayloadPretty}
                    </pre>
                  </details>
                </div>

                {vehicleOptions.length === 0 ? (
                  <div className="text-[12.5px] text-text-soft">No vehicle currently has an active contract to match this to.</div>
                ) : (
                  <div className="flex flex-col gap-2.5 sm:flex-row">
                    <MatchTransactionForm providerTransactionId={t.id} vehicleOptions={vehicleOptions} />
                    <DismissTransactionForm providerTransactionId={t.id} />
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {recentlyProcessed.length > 0 ? (
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-5 py-4 text-sm font-extrabold">Recently resolved</div>
            <div className="flex flex-col">
              {recentlyProcessed.map((t, index) => (
                <div
                  key={t.id}
                  className={`flex items-center justify-between px-5 py-3.5 text-[13px] ${index > 0 ? "border-t border-border" : ""}`}
                >
                  <div className="text-text-soft">
                    {formatDate(t.processedAt)}
                    {t.agentName ? ` · ${t.agentName}` : ""}
                    {t.vehicle ? ` · ${t.vehicle}` : " · dismissed, not matched to a vehicle"}
                  </div>
                  <div className="font-bold">{t.amount !== null ? formatNaira(t.amount) : "Amount unknown"}</div>
                </div>
              ))}
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
