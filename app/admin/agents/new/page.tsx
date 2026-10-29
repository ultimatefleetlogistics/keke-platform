import { redirect } from "next/navigation";
import Link from "next/link";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getRolesOverview } from "@/lib/data/rbac";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { createStaffOrAgentAccount } from "@/lib/actions/staff";

// Module 51: mirrors app/admin/settings/staff/new/page.tsx exactly, just
// the agent half of what used to be one combined form (see
// lib/data/agents.ts's own comment for why staff and agents were split).
// Both pages still submit to the same createStaffOrAgentAccount action,
// which already branches on the (now hidden, no longer user-chosen)
// accountType field, so nothing on the server side needed to duplicate.
export default async function NewAgentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.STAFF_MANAGE)) {
    redirect("/admin/agents");
  }

  const roles = await getRolesOverview();

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Add agent</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          This creates a real sign in account for them, with access to the agent portal, and a collection account is
          set up automatically so they can start receiving remittances. A temporary password is generated and shown
          once, you pass it on to them directly. Adding operations staff instead? Use{" "}
          <Link href="/admin/settings/staff/new" className="font-bold text-accent-dark hover:underline">
            Add staff
          </Link>
          .
        </div>
      </header>

      <div className="px-8 py-6">
        <Card className="p-6">
          <ActionForm action={createStaffOrAgentAccount} className="flex flex-col gap-4">
                <input type="hidden" name="accountType" value="AGENT" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="fullName">Full name</Label>
                    <Input id="fullName" name="fullName" placeholder="Ngozi Umeh" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" placeholder="ngozi@example.com" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="phone">Phone (optional)</Label>
                    <Input id="phone" name="phone" type="tel" placeholder="080..." />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:col-span-2">
                    <Label htmlFor="region">Region (optional)</Label>
                    <Input id="region" name="region" placeholder="Kano" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="roleId">Assign a role now (optional)</Label>
                  <select
                    id="roleId"
                    name="roleId"
                    defaultValue=""
                    className="flex h-11 w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-[13.5px] text-text outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft"
                  >
                    <option value="">No role yet, assign one later</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mt-1.5 flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" asChild>
                    <Link href="/admin/agents">Cancel</Link>
                  </Button>
                  <ActionSubmitButton className="flex-[2]">Create account</ActionSubmitButton>
                </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
