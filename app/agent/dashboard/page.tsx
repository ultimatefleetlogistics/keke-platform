import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopyAccountNumber } from "@/components/agent/copy-account-number";
import { AreaTrendChart } from "@/components/charts/area-trend-chart";
import { formatNaira, formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAgentDashboardData } from "@/lib/data/agent";

export default async function AgentDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (!user.agent) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-20 text-center">
        <div className="text-lg font-extrabold">No agent profile yet</div>
        <div className="max-w-sm text-[13.5px] text-text-soft">
          Your account isn&apos;t linked to an agent profile. Ask an administrator to set this up.
        </div>
      </div>
    );
  }

  const data = await getAgentDashboardData(user.agent);
  const paidPercent = data.weeklyTarget > 0 ? Math.round((data.paidThisWeek / data.weeklyTarget) * 100) : 0;
  const firstName = user.fullName.split(" ")[0];

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-xl font-extrabold tracking-tight">Hello, {firstName}</div>
        <div className="mt-0.5 text-[13px] text-text-soft">{data.region} region</div>
      </header>

      <div className="flex flex-col gap-5 px-8 py-6">
        <Card className="p-5">
          <div className="text-xs font-semibold text-text-soft">Your Paystack collection account</div>
          {data.virtualAccount ? (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2.5">
                <div className="text-lg font-extrabold tracking-wide">{data.virtualAccount.accountNumber}</div>
                <CopyAccountNumber accountNumber={data.virtualAccount.accountNumber} />
              </div>
              <div className="mt-0.5 text-xs text-text-faint">{data.virtualAccount.bankName}</div>

              <div className="mt-4 flex flex-col gap-1.5 border-t border-border pt-4 text-[12.5px] text-text-soft">
                <div className="flex gap-2">
                  <span className="font-bold text-text">1.</span>
                  Copy the account number above.
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-text">2.</span>
                  Open your own bank app or dial your bank&apos;s USSD code, and send your weekly remittance to that
                  account and bank.
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-text">3.</span>
                  It reflects here automatically as soon as Paystack confirms it, usually within a minute or two, no
                  need to tell anyone yourself.
                </div>
              </div>
            </>
          ) : (
            <div className="mt-1 text-sm font-semibold text-text-soft">
              Not yet issued, add a Paystack secret key so one can be created for you.
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="p-5">
            <div className="text-xs font-semibold text-text-soft">This week&apos;s target</div>
            <div className="mt-1 text-2xl font-extrabold">{formatNaira(data.weeklyTarget)}</div>
          </Card>
          <Card className="p-5">
            <div className="text-xs font-semibold text-text-soft">Paid so far this week</div>
            <div className="mt-1 flex items-baseline gap-2">
              <div className="text-2xl font-extrabold">{formatNaira(data.paidThisWeek)}</div>
              <Badge variant={paidPercent >= 100 ? "good" : "warn"}>{paidPercent}%</Badge>
            </div>
          </Card>
        </div>

        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-extrabold">Remittances collected (last 8 weeks)</div>
            <span className="text-xs font-semibold text-text-faint">Weekly total</span>
          </div>
          <AreaTrendChart
            weeks={data.remittanceTrend.weeks}
            amounts={data.remittanceTrend.amounts}
            latestLabel={data.remittanceTrend.latestLabel}
            latestAmount={data.remittanceTrend.latestAmount}
            formatAmount={formatNaira}
            emptyMessage="No remittances recorded yet"
            gradientId="agent-remittances-area"
          />
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4 text-sm font-extrabold">Your vehicles this week</div>
          {data.assignedVehicles.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-text-soft">No vehicles assigned to you yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.assignedVehicles.map((row) => (
                  <TableRow key={row.assetTag}>
                    <TableCell className="font-bold">{row.assetTag}</TableCell>
                    <TableCell className="text-text-soft">{row.driver}</TableCell>
                    <TableCell className="font-bold">{formatNaira(row.amount)}</TableCell>
                    <TableCell className="text-text-soft">{formatDate(row.date)}</TableCell>
                    <TableCell>
                      <Badge variant={row.status === "PAID" ? "good" : "pending"}>
                        {row.status === "PAID" ? "Paid" : "Pending"}
                      </Badge>
                    </TableCell>
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
