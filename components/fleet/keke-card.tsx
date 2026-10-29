import type { VehicleType } from "@prisma/client";

import { VehicleTypeIllustration } from "@/components/design-system/vehicle-illustrations";
import { Card } from "@/components/ui/card";

type FleetStatus = "ACTIVE" | "MAINTENANCE" | "UNASSIGNED" | "PENDING" | "RETIRED";

const STATUS_CONFIG: Record<FleetStatus, { label: string; dot: string; ink: string; iconBg: string }> = {
  ACTIVE: { label: "Active", dot: "#0ca30c", ink: "var(--good-ink)", iconBg: "#E3F6EA" },
  MAINTENANCE: { label: "Maintenance", dot: "#E0650F", ink: "var(--warn-ink)", iconBg: "var(--warn-soft)" },
  UNASSIGNED: { label: "Unassigned", dot: "#d03b3b", ink: "var(--bad-ink)", iconBg: "var(--bad-soft)" },
  PENDING: { label: "Pending onboarding", dot: "var(--pending)", ink: "var(--pending)", iconBg: "var(--pending-soft)" },
  RETIRED: { label: "Retired", dot: "#8A8FA6", ink: "var(--text-faint)", iconBg: "#F0F2ED" },
};

// This file kept its original name (keke-card.tsx) even though the
// component itself is now generic, renaming the file would have meant
// deleting the old one on disk, and this session has no way to do that on
// your machine. The export below, VehicleCard, is what everything else in
// the app imports.
export function VehicleCard({
  assetTag,
  type,
  status,
  location,
  agent,
  driver,
}: {
  assetTag: string;
  type: VehicleType;
  status: FleetStatus;
  location: string;
  agent: string;
  driver: string;
}) {
  const config = STATUS_CONFIG[status];

  return (
    <Card className="flex items-center justify-between gap-3.5 p-4 hover:shadow-card-hover">
      <div>
        <div className="flex items-center gap-1.5 text-xs font-bold" style={{ color: config.ink }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: config.dot }} />
          {config.label}
        </div>
        <div className="mt-1.5 text-[15px] font-extrabold">{assetTag}</div>
        <div className="mt-1 text-xs font-semibold text-text-faint">{location}</div>
        <div className="mt-2.5 flex gap-3.5">
          <div>
            <div className="text-[10.5px] font-semibold text-text-faint">Agent</div>
            <div className="mt-0.5 text-xs font-bold">{agent}</div>
          </div>
          <div>
            <div className="text-[10.5px] font-semibold text-text-faint">Driver</div>
            <div className="mt-0.5 text-xs font-bold" style={{ color: driver.includes("None") || driver.includes("Pending") ? "var(--text-faint)" : undefined }}>
              {driver}
            </div>
          </div>
        </div>
      </div>
      <div
        className="flex h-14 w-21 shrink-0 items-center justify-center overflow-hidden rounded-md"
        style={{ background: config.iconBg }}
      >
        <VehicleTypeIllustration type={type} className="w-17" />
      </div>
    </Card>
  );
}
