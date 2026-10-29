import { redirect } from "next/navigation";
import Link from "next/link";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAgentOptions } from "@/lib/data/onboarding";
import { getVehicleOptionsForDriverAssignment } from "@/lib/data/drivers";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { createDriver } from "@/lib/actions/drivers";

const SELECT_CLASS =
  "flex h-11 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft";

export default async function NewDriverPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.FLEET_MANAGE)) {
    redirect("/admin/drivers");
  }

  const [agents, vehicles] = await Promise.all([getAgentOptions(), getVehicleOptionsForDriverAssignment()]);

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Add driver</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Every driver gets a real app account, most will never sign in, but it&apos;s ready the moment they choose
          to. A phone number is also required, it&apos;s how a Paystack collection account is created for this
          driver and where they&apos;re SMS&apos;d when a remittance lands in it.
        </div>
      </header>

      <div className="px-8 py-6">
        <Card className="p-6">
          <ActionForm action={createDriver} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input id="fullName" name="fullName" placeholder="Musa Ibrahim" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" placeholder="musa@example.com" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="phone">Phone number</Label>
                    <Input id="phone" name="phone" placeholder="08012345678" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="agentId">Reports to agent</Label>
                    <select id="agentId" name="agentId" required defaultValue="" className={SELECT_CLASS}>
                      <option value="" disabled>
                        Choose an agent…
                      </option>
                      {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>
                          {agent.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="vehicleId">Assign to vehicle (optional)</Label>
                    <select id="vehicleId" name="vehicleId" defaultValue="" className={SELECT_CLASS}>
                      <option value="">Not now, add without a vehicle</option>
                      {vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mt-1.5 flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" asChild>
                    <Link href="/admin/drivers">Cancel</Link>
                  </Button>
                  <ActionSubmitButton className="flex-[2]">Add driver</ActionSubmitButton>
                </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
