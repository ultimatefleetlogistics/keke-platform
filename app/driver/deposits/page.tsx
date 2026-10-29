import { redirect } from "next/navigation";

import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNaira, formatDate } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDriverDeposits } from "@/lib/data/driver";

const STATUS_VARIANT: Record<string, "good" | "warn" | "bad"> = {
  RECORDED: "warn",
  ALLOCATED: "good",
  REVERSED: "bad",
};

const STATUS_LABEL: Record<string, string> = {
  RECORDED: "Recorded",
  ALLOCATED: "Allocated",
  REVERSED: "Reversed",
};

export default async function DriverDepositsPage() {
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

  const deposits = await getDriverDeposits(user.driver.id);
  const totalReceived = deposits.reduce((sum, deposit) => sum + deposit.amount, 0);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-xl font-extrabold tracking-tight">My Deposits</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Every payment Paystack has confirmed into your collection account, not just this week&apos;s total on your
          dashboard.
        </div>
      </header>

      <div className="flex flex-col gap-5 px-8 py-6">
        <Card className="max-w-[280px] p-5">
          <div className="text-xs font-semibold text-text-soft">Total received, all time</div>
          <div className="mt-1 text-2xl font-extrabold">
            <AnimatedNumber value={totalReceived} format="naira" />
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          {deposits.length === 0 ? (
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
              title="No deposits recorded yet"
              description="Once Paystack confirms a payment into your collection account, it shows up here automatically."
            />
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
                {deposits.map((deposit) => (
                  <TableRow key={deposit.id}>
                    <TableCell className="text-text-soft">{formatDate(deposit.createdAt)}</TableCell>
                    <TableCell className="font-bold">
                      {deposit.vehicleTags.length > 0 ? deposit.vehicleTags.join(", ") : "Not yet allocated"}
                    </TableCell>
                    <TableCell className="font-bold">{formatNaira(deposit.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[deposit.status]}>{STATUS_LABEL[deposit.status]}</Badge>
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
