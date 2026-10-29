import { redirect } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNaira } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAgentVehicles } from "@/lib/data/agent";
import { VEHICLE_TYPE_LABELS } from "@/lib/vehicle-types";

const STATUS_VARIANT: Record<string, "good" | "warn" | "bad" | "pending" | "neutral"> = {
  ACTIVE: "good",
  MAINTENANCE: "warn",
  UNASSIGNED: "bad",
  PENDING: "pending",
  RETIRED: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Active",
  MAINTENANCE: "Maintenance",
  UNASSIGNED: "Unassigned",
  PENDING: "Pending onboarding",
  RETIRED: "Retired",
};

const FREQUENCY_LABEL: Record<string, string> = {
  WEEKLY: "weekly",
  BIWEEKLY: "biweekly",
  MONTHLY: "monthly",
};

export default async function AgentVehiclesPage() {
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

  const vehicles = await getAgentVehicles(user.agent);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-xl font-extrabold tracking-tight">My vehicles</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Every vehicle currently assigned to you, not just this week&apos;s snapshot on your dashboard.
        </div>
      </header>

      <div className="px-8 py-6">
        <Card className="overflow-hidden p-0">
          {vehicles.length === 0 ? (
            <div className="px-5 py-10 text-center text-[13px] text-text-soft">No vehicles assigned to you yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Driver</TableHead>
                  <TableHead>Installment</TableHead>
                  <TableHead>Investor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((vehicle) => (
                  <TableRow key={vehicle.id}>
                    <TableCell className="font-bold">{vehicle.assetTag}</TableCell>
                    <TableCell className="text-text-soft">{VEHICLE_TYPE_LABELS[vehicle.type]}</TableCell>
                    <TableCell className="text-text-soft">{vehicle.driver ?? "Unassigned"}</TableCell>
                    <TableCell className="font-bold">
                      {vehicle.installmentAmount ? (
                        <>
                          {formatNaira(vehicle.installmentAmount)}
                          <span className="ml-1 font-medium text-text-faint">
                            / {FREQUENCY_LABEL[vehicle.paymentFrequency ?? ""] ?? "period"}
                          </span>
                        </>
                      ) : (
                        <span className="font-medium text-text-faint">No active contract</span>
                      )}
                    </TableCell>
                    <TableCell className="text-text-soft">{vehicle.investorName ?? "Not set"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[vehicle.status]}>{STATUS_LABEL[vehicle.status]}</Badge>
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
