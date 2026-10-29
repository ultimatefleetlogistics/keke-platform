import { redirect } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function StaffOrAgentCreatedPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; email?: string; password?: string; type?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.STAFF_MANAGE)) {
    redirect("/admin/settings/staff");
  }

  const { name, email, password, type } = await searchParams;
  if (!name || !email || !password) {
    redirect("/admin/settings/staff");
  }

  const accountTypeLabel = type === "AGENT" ? "Agent" : "Staff";

  return (
    <div className="px-8 py-6">
      <Card className="max-w-[560px] p-6">
        <div className="flex items-center gap-2.5 text-good-ink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" className="fill-good-soft" />
            <path d="m8 12.5 2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="text-[15px] font-extrabold">{accountTypeLabel} account created</div>
        </div>

        <div className="mt-4 rounded-xl bg-warn-soft px-4 py-3 text-[12.5px] font-semibold text-warn-ink">
          This password is shown once and cannot be retrieved again. Share it with {name} directly, they can change
          it once they sign in.
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Name</div>
            <div className="text-[14px] font-bold">{name}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Email</div>
            <div className="text-[14px] font-bold">{email}</div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-text-faint">Temporary password</div>
            <div className="text-[14px] font-bold tracking-wide">{password}</div>
          </div>
        </div>

        <div className="mt-5 flex gap-3">
          <Button variant="outline" className="flex-1" asChild>
            <Link href="/admin/settings/roles">Assign a role</Link>
          </Button>
          <Button className="flex-1" asChild>
            <Link href="/admin/settings/staff">Done</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
