import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopyAccountNumber } from "@/components/agent/copy-account-number";
import { AreaTrendChart } from "@/components/charts/area-trend-chart";
import { VehicleTypeIcon } from "@/components/design-system/vehicle-icons";
import { formatNaira, formatDate } from "@/lib/utils";
import { VEHICLE_TYPE_LABELS } from "@/lib/vehicle-types";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDriverDashboardData } from "@/lib/data/driver";

const VEHICLE_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  MAINTENANCE: "In maintenance",
  UNASSIGNED: "Unassigned",
  PENDING_ONBOARDING: "Pending onboarding",
  RETIRED: "Retired",
};

const TRANSACTION_STATUS_VARIANT: Record<string, "good" | "warn" | "bad"> = {
  RECORDED: "warn",
  ALLOCATED: "good",
  REVERSED: "bad",
};

const TRANSACTION_STATUS_LABEL: Record<string, string> = {
  RECORDED: "Recorded",
  ALLOCATED: "Allocated",
  REVERSED: "Reversed",
};

export default async function DriverDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (!user.driver) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-20 text-center">
        <div className="text-lg font-extrabold">No driver profile yet</div>
        <div className="max-w-sm text-[13.5px] text-text-soft">
          Your account isn&apos;t linked to a driver profile. Ask an administrator to set this up.
        </div>
      </div>
    );
  }

  const data = await getDriverDashboardData(user.driver);
  const firstName = user.fullName.split(" ")[0];

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-xl font-extrabold tracking-tight">Hello, {firstName}</div>
        <div className="mt-0.5 text-[13px] text-text-soft">Reports to {data.agentName}</div>
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
                  Anyone can send money to this account, for example a passenger paying a fare by transfer instead
                  of cash.
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-text">2.</span>
                  The moment Paystack confirms a deposit, you get an SMS and it shows up below, usually within a
                  minute or two.
                </div>
                <div className="flex gap-2">
                  <span className="font-bold text-text">3.</span>
                  If you&apos;re expected to hand over collections to {data.agentName}, this account doesn&apos;t do
                  that for you automatically, it only tells you what landed here.
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
            <div className="text-xs font-semibold text-text-soft">Your vehicle</div>
            {data.currentVehicle ? (
              <div className="mt-2 flex items-center gap-2.5">
                <VehicleTypeIcon type={data.currentVehicle.type} className="h-6 w-6 text-accent" />
                <div>
                  <div className="text-lg font-extrabold">{data.currentVehicle.assetTag}</div>
                  <div className="text-xs text-text-faint">
                    {VEHICLE_TYPE_LABELS[data.currentVehicle.type]} &middot;{" "}
                    {VEHICLE_STATUS_LABEL[data.currentVehicle.status] ?? data.currentVehicle.status}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-1 text-sm font-semibold text-text-soft">No vehicle assigned to you right now.</div>
            )}
          </Card>
          <Card className="p-5">
            <div className="text-xs font-semibold text-text-soft">Received, all time</div>
            <div className="mt-1 text-2xl font-extrabold">{formatNaira(data.totalReceived)}</div>
          </Card>
        </div>

        <Card className="p-5">
          <div className="flex items-baseline justify-between">
            <div className="text-sm font-extrabold">Deposits received (last 8 weeks)</div>
            <span className="text-xs font-semibold text-text-faint">Weekly total</span>
          </div>
          <AreaTrendChart
            weeks={data.depositTrend.weeks}
            amounts={data.depositTrend.amounts}
            latestLabel={data.depositTrend.latestLabel}
            latestAmount={data.depositTrend.latestAmount}
            formatAmount={formatNaira}
            emptyMessage="No deposits recorded yet"
            gradientId="driver-deposits-area"
          />
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4 text-sm font-extrabold">Recent deposits</div>
          {data.recentDeposits.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-text-soft">
              No deposits recorded yet. Once Paystack confirms a payment into your collection account, it shows up
              here automatically.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Date</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentDeposits.map((deposit) => (
                  <TableRow key={deposit.id}>
                    <TableCell className="text-text-soft">{formatDate(deposit.createdAt)}</TableCell>
                    <TableCell className="font-bold">
                      {deposit.vehicleTags.length > 0 ? deposit.vehicleTags.join(", ") : "Not yet allocated"}
                    </TableCell>
                    <TableCell className="font-bold">{formatNaira(deposit.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={TRANSACTION_STATUS_VARIANT[deposit.status]}>
                        {TRANSACTION_STATUS_LABEL[deposit.status]}
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
