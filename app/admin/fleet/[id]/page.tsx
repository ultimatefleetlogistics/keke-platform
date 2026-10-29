import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { VehicleTypeIcon } from "@/components/design-system/vehicle-icons";
import { DocumentSection } from "@/components/documents/document-section";
import { formatDate, formatNaira } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getVehicleDetail } from "@/lib/data/fleet";
import { getVehicleDocuments } from "@/lib/data/documents";
import { getDriverOptions } from "@/lib/data/drivers";
import { assignDriverToVehicle, unassignDriverFromVehicle } from "@/lib/actions/drivers";
import { updateVehicleStatus } from "@/lib/actions/fleet";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { VEHICLE_TYPE_LABELS } from "@/lib/vehicle-types";

const SELECT_CLASS =
  "flex h-10 flex-1 rounded-xl border border-border bg-surface px-3.5 py-2 text-[13px] text-text outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft";

const FLEET_DOCUMENT_TYPES = [
  { value: "MAINTENANCE_RECEIPT", label: "Maintenance receipt" },
  { value: "ASSET_PHOTO", label: "Asset photo" },
  { value: "OTHER", label: "Other" },
];

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

// getVehicleDetail (lib/data/fleet.ts) renders the Prisma VehicleStatus
// enum's PENDING_ONBOARDING as the shorter "PENDING" for display, matching
// the fleet browser's own FleetCardStatus type. The status-change <select>
// below needs the real enum value back to preselect the vehicle's current
// status among its <option>s, which are the enum values themselves.
const STATUS_ENUM_VALUE: Record<string, string> = {
  ACTIVE: "ACTIVE",
  MAINTENANCE: "MAINTENANCE",
  UNASSIGNED: "UNASSIGNED",
  PENDING: "PENDING_ONBOARDING",
  RETIRED: "RETIRED",
};

const CONTRACT_STATUS_VARIANT: Record<string, "good" | "warn" | "bad" | "pending" | "accent" | "neutral"> = {
  DRAFT: "neutral",
  ACTIVE: "accent",
  TARGET_ACHIEVED: "warn",
  TRANSFER_IN_PROGRESS: "warn",
  COMPLETED: "good",
  CANCELLED: "bad",
};

export default async function VehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const vehicle = await getVehicleDetail(id);
  if (!vehicle) notFound();

  const documents = await getVehicleDocuments(vehicle.id);
  const canManage = user.permissions.has(PERMISSIONS.FLEET_MANAGE);
  const driverOptions = canManage ? await getDriverOptions() : [];

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border px-8 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-accent-soft">
          <VehicleTypeIcon type={vehicle.type} className="h-4.5 w-4.5" color="var(--accent-dark)" />
        </div>
        <div className="text-[19px] font-extrabold tracking-tight">{vehicle.assetTag}</div>
        <Badge variant="neutral">{VEHICLE_TYPE_LABELS[vehicle.type]}</Badge>
        <Badge variant={STATUS_VARIANT[vehicle.status]}>{STATUS_LABEL[vehicle.status]}</Badge>
      </header>

      <div className="flex flex-col gap-5 px-8 py-6">
        <Card className="p-5">
          <div className="mb-3 text-sm font-extrabold">Fleet record</div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Location</div>
              <div className="mt-0.5 text-[14px] font-bold">{vehicle.location ?? "Not set"}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Frame number</div>
              <div className="mt-0.5 text-[14px] font-bold">{vehicle.frameNumber ?? "Not set"}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Plate number</div>
              <div className="mt-0.5 text-[14px] font-bold">{vehicle.plateNumber ?? "Not set"}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Agent</div>
              <div className="mt-0.5 text-[14px] font-bold">
                {vehicle.agent ? `${vehicle.agent.fullName}${vehicle.agent.region ? ` (${vehicle.agent.region})` : ""}` : "Unassigned"}
              </div>
            </div>
          </div>
          {canManage ? (
            <div className="mt-4 border-t border-border pt-4">
              <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Status</div>
              <ActionForm action={updateVehicleStatus} className="mt-2 flex flex-wrap items-center gap-2">
                <input type="hidden" name="vehicleId" value={vehicle.id} />
                <select
                  name="status"
                  required
                  defaultValue={STATUS_ENUM_VALUE[vehicle.status] ?? "ACTIVE"}
                  className={SELECT_CLASS}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="MAINTENANCE">Maintenance</option>
                  <option value="UNASSIGNED">Unassigned</option>
                  <option value="PENDING_ONBOARDING">Pending onboarding</option>
                  <option value="RETIRED">Retired</option>
                </select>
                <ActionSubmitButton size="sm" variant="outline">
                  Update status
                </ActionSubmitButton>
              </ActionForm>
            </div>
          ) : null}

          <div className="mt-4 border-t border-border pt-4">
            <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Current driver</div>
            {vehicle.currentDriver ? (
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <div className="text-[14px] font-bold">
                  {vehicle.currentDriver.fullName}
                  {vehicle.currentDriver.phone ? (
                    <span className="ml-2 font-medium text-text-soft">{vehicle.currentDriver.phone}</span>
                  ) : null}
                </div>
                {canManage ? (
                  <ActionForm action={unassignDriverFromVehicle}>
                    <input type="hidden" name="vehicleId" value={vehicle.id} />
                    <ActionSubmitButton size="sm" variant="outline">
                      Unassign
                    </ActionSubmitButton>
                  </ActionForm>
                ) : null}
              </div>
            ) : (
              <div className="mt-0.5 text-[14px] font-bold text-text-soft">Unassigned</div>
            )}
            {canManage ? (
              <ActionForm action={assignDriverToVehicle} className="mt-3 flex gap-2">
                <input type="hidden" name="vehicleId" value={vehicle.id} />
                <input type="hidden" name="redirectTo" value={`/admin/fleet/${vehicle.id}`} />
                <select name="driverId" required defaultValue="" className={SELECT_CLASS}>
                  <option value="" disabled>
                    {vehicle.currentDriver ? "Change driver…" : "Assign a driver…"}
                  </option>
                  {driverOptions.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.label}
                    </option>
                  ))}
                </select>
                <ActionSubmitButton size="sm" variant="outline">
                  {vehicle.currentDriver ? "Change" : "Assign"}
                </ActionSubmitButton>
              </ActionForm>
            ) : null}
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4 text-sm font-extrabold">Contracts</div>
          {vehicle.contracts.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-text-soft">
              No investment contract has ever been written against this vehicle.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Investor</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Paid / target</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicle.contracts.map((contract) => (
                  <TableRow key={contract.id}>
                    <TableCell className="font-bold">
                      <Link href={`/admin/contracts/${contract.id}`} className="hover:underline">
                        {contract.investorName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-text-soft">
                      {contract.startDate ? formatDate(contract.startDate) : "Not set"}
                    </TableCell>
                    <TableCell className="text-text-soft">{formatNaira(contract.principalAmount)}</TableCell>
                    <TableCell className="font-bold">
                      {formatNaira(contract.totalPaidToInvestor)}{" "}
                      <span className="font-medium text-text-faint">/ {formatNaira(contract.targetPayoutAmount)}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={CONTRACT_STATUS_VARIANT[contract.status] ?? "neutral"}>
                        {contract.status.replaceAll("_", " ").toLowerCase()}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4 text-sm font-extrabold">Driver assignment history</div>
          {vehicle.driverAssignments.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-text-soft">No driver has ever been assigned yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Driver</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Ended</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicle.driverAssignments.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-semibold">{a.driverName}</TableCell>
                    <TableCell className="text-text-soft">{formatDate(a.startedAt)}</TableCell>
                    <TableCell className="text-text-soft">{a.endedAt ? formatDate(a.endedAt) : "Current"}</TableCell>
                    <TableCell className="text-text-faint">{a.reason ?? "Not set"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="border-b border-border px-5 py-4 text-sm font-extrabold">Maintenance history</div>
          {vehicle.maintenanceRecords.length === 0 ? (
            <div className="px-5 py-8 text-center text-[13px] text-text-soft">No maintenance recorded yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Performed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicle.maintenanceRecords.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-semibold">{m.description}</TableCell>
                    <TableCell className="text-text-soft">{m.status.replaceAll("_", " ").toLowerCase()}</TableCell>
                    <TableCell className="text-text-soft">{m.cost !== null ? formatNaira(m.cost) : "Not set"}</TableCell>
                    <TableCell className="text-text-soft">{m.performedAt ? formatDate(m.performedAt) : "Not set"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        <DocumentSection
          documents={documents}
          canManage={canManage}
          vehicleId={vehicle.id}
          typeOptions={FLEET_DOCUMENT_TYPES}
          showVisibility={false}
        />
      </div>
    </>
  );
}
