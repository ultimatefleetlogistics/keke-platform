import { redirect } from "next/navigation";
import Link from "next/link";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAgentOptions } from "@/lib/data/onboarding";
import { getNextAssetTagsByType } from "@/lib/data/fleet";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { createVehicle } from "@/lib/actions/fleet";
import { VehicleTypeAndTagFields } from "./vehicle-type-and-tag";

export default async function NewVehiclePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.FLEET_MANAGE)) {
    redirect("/admin/fleet");
  }

  const [agents, nextAssetTags] = await Promise.all([getAgentOptions(), getNextAssetTagsByType()]);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Add new vehicle</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Assigning an agent now puts it in pending onboarding, leave it unassigned to add it to the fleet first.
        </div>
      </header>

      <div className="px-8 py-6">
        <Card className="p-6">
          <ActionForm action={createVehicle} className="flex flex-col gap-4">
                <VehicleTypeAndTagFields suggestions={nextAssetTags} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="frameNumber">Frame / chassis number (optional)</Label>
                    <Input id="frameNumber" name="frameNumber" placeholder="FRM..." />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="plateNumber">Plate number (optional)</Label>
                    <Input id="plateNumber" name="plateNumber" placeholder="ABC-123-XY" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="location">Location (optional)</Label>
                    <Input id="location" name="location" placeholder="Kano, Sabon Gari" />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="agentId">Assign to agent (optional)</Label>
                    <select
                      id="agentId"
                      name="agentId"
                      defaultValue=""
                      className="flex h-11 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft"
                    >
                      <option value="">Unassigned for now</option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-1.5 flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" asChild>
                    <Link href="/admin/fleet">Cancel</Link>
                  </Button>
                  <ActionSubmitButton className="flex-[2]">Add vehicle</ActionSubmitButton>
                </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
