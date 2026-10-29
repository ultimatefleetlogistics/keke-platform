import { redirect } from "next/navigation";
import Link from "next/link";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { createRole } from "@/lib/actions/rbac";

export default async function NewRolePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.RBAC_MANAGE)) {
    redirect("/admin/settings/roles");
  }

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">New role</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          A new role starts with zero permissions. Add them from the role&apos;s page once it&apos;s created.
        </div>
      </header>

      <div className="px-8 py-6">
        <Card className="p-6">
          <ActionForm action={createRole} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="name">Role name</Label>
                    <Input id="name" name="name" placeholder="Fleet Coordinator" required />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="description">Description (optional)</Label>
                    <Input id="description" name="description" placeholder="What this role is for" />
                  </div>
                </div>

                <div className="mt-1.5 flex gap-3">
                  <Button type="button" variant="outline" className="flex-1" asChild>
                    <Link href="/admin/settings/roles">Cancel</Link>
                  </Button>
                  <ActionSubmitButton className="flex-[2]">Create role</ActionSubmitButton>
                </div>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
