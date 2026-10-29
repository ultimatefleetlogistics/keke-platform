import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PasswordResetPanel } from "@/components/admin/password-reset-panel";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStaffById } from "@/lib/data/staff";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { resetStaffOrAgentPassword } from "@/lib/actions/staff";
import { StaffEditForm } from "./staff-edit-form";

// Module 51: staff-only now, see lib/data/agents.ts's own comment for
// why. An id here that belongs to an agent instead simply 404s, correct
// behavior, that account's own page now lives at /admin/agents/[id].
export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.STAFF_MANAGE)) redirect("/admin/settings/staff");

  const { id } = await params;
  const account = await getStaffById(id);
  if (!account) notFound();

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">{account.fullName}</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          {account.roles.length > 0 ? account.roles.join(", ") : "No role assigned yet"}. See{" "}
          <Link href="/admin/settings/staff" className="font-bold text-accent-dark hover:underline">
            all staff
          </Link>
          .
        </div>
      </header>

      <div className="grid grid-cols-1 gap-5 px-8 py-6 lg:grid-cols-2 lg:items-start">
        <Card className="p-6">
          <StaffEditForm
            userId={account.id}
            fullName={account.fullName}
            email={account.email}
            phone={account.phone ?? ""}
            jobTitle={account.jobTitle}
          />
        </Card>

        <Card className="p-6">
          <div className="mb-4 text-[13.5px] font-extrabold">Account access</div>
          <PasswordResetPanel
            action={resetStaffOrAgentPassword}
            idFieldName="userId"
            idValue={account.id}
            subjectLabel={account.fullName}
          />
        </Card>
      </div>
    </>
  );
}
