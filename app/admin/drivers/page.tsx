import { redirect } from "next/navigation";
import Link from "next/link";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getDrivers } from "@/lib/data/drivers";
import { retryDriverCollectionAccount } from "@/lib/actions/drivers";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function DriversPage({
  searchParams,
}: {
  searchParams: Promise<{ collectionAccountError?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (!user.permissions.has(PERMISSIONS.FLEET_VIEW)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-20 text-center">
        <div className="text-lg font-extrabold">No access</div>
        <div className="max-w-sm text-[13.5px] text-text-soft">
          Your role doesn&apos;t include permission to view fleet and driver records.
        </div>
      </div>
    );
  }

  const canManage = user.permissions.has(PERMISSIONS.FLEET_MANAGE);
  const drivers = await getDrivers();
  const { collectionAccountError } = await searchParams;

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <div>
          <div className="text-[19px] font-extrabold tracking-tight">Drivers</div>
          <div className="mt-0.5 text-[13px] text-text-soft">
            Every driver on record, which vehicle they currently drive, and their Paystack collection account, see{" "}
            <Link href="/admin/agents" className="font-bold text-accent-dark hover:underline">
              Agents
            </Link>{" "}
            for the same on agents.
          </div>
        </div>
        {canManage ? (
          <Button size="sm" asChild>
            <Link href="/admin/drivers/new">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Add driver
            </Link>
          </Button>
        ) : null}
      </header>

      <div className="px-8 py-6">
        {collectionAccountError ? (
          <div className="mb-5 rounded-xl bg-bad-soft px-4 py-3 text-[12.5px] font-semibold text-bad-ink">
            Couldn&apos;t create the collection account: {collectionAccountError}
          </div>
        ) : null}
        {drivers.length === 0 ? (
          <Card className="p-10 text-center text-[13px] text-text-soft">
            No drivers on record yet. Add the first one to get started.
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>App access</TableHead>
                  <TableHead>Standing</TableHead>
                  <TableHead>Collection account</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-bold">{driver.fullName}</TableCell>
                    <TableCell className="text-text-soft">{driver.phone ?? "Not set"}</TableCell>
                    <TableCell className="text-text-soft">{driver.agentName}</TableCell>
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
                      {driver.isDelinquent ? (
                        <Badge variant="bad">{driver.daysSinceLastDeposit}d since deposit</Badge>
                      ) : driver.daysSinceLastDeposit === null ? (
                        <Badge variant="neutral">No deposits yet</Badge>
                      ) : (
                        <Badge variant="good">Current</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {driver.collectionAccount ? (
                        <div className="flex flex-col">
                          <Badge variant="good" className="w-fit">
                            Active
                          </Badge>
                          <span className="mt-1 text-[11.5px] text-text-faint">
                            {driver.collectionAccount.accountNumber} · {driver.collectionAccount.bankName}
                          </span>
                        </div>
                      ) : canManage ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="pending" className="w-fit">
                            Not set up
                          </Badge>
                          <ActionForm action={retryDriverCollectionAccount}>
                            <input type="hidden" name="driverId" value={driver.id} />
                            <ActionSubmitButton size="sm" variant="outline">
                              Create
                            </ActionSubmitButton>
                          </ActionForm>
                        </div>
                      ) : (
                        <Badge variant="pending" className="w-fit">
                          Not set up
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/drivers/${driver.id}`} className="font-semibold text-accent-dark hover:underline">
                        {canManage ? "Edit" : "View"}
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
