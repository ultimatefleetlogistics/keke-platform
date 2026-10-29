import { redirect } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getFleetPageData } from "@/lib/data/fleet";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { FleetBrowser } from "./fleet-browser";

export default async function FleetPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const { vehicles, statusCounts } = await getFleetPageData();
  const canManageFleet = user.permissions.has(PERMISSIONS.FLEET_MANAGE);

  return (
    <>
      <div className="px-8 pt-5.5">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2.5">
            <div className="text-[21px] font-extrabold">Fleet</div>
            <span className="text-[13px] font-semibold text-text-faint">{statusCounts.all} vehicles</span>
          </div>
          {canManageFleet ? (
            <Button size="sm" asChild>
              <Link href="/admin/fleet/new">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Add new vehicle
              </Link>
            </Button>
          ) : null}
        </div>

        <FleetBrowser vehicles={vehicles} statusCounts={statusCounts} />
      </div>
    </>
  );
}
