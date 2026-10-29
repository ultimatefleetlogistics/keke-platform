import { redirect } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PERMISSIONS } from "@/lib/rbac/permissions";

// Module 51: mirrors app/admin/settings/staff/new/success/page.tsx, the
// agent half of what createStaffOrAgentAccount now redirects to based on
// accountType, see that action's own comment.
export default async function AgentCreatedPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; email?: string; password?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.STAFF_MANAGE)) {
    redirect("/admin/agents");
  }

  const { name, email, password } = await searchParams;
  if (!name || !email || !password) {
    redirect("/admin/agents");
  }

  return (
    <div className="px-8 py-6">
      <Card className="max-w-[560px] p-6">
        <div className="flex items-center gap-2.5 text-good-ink">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" className="fill-good-soft" />
            <path d="m8 12.5 2.5 2.5L16 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="text-[15px] font-extrabold">Agent account created</div>
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

        <div className="mt-4 text-[11.5px] text-text-faint">
          Their Paystack collection account is set up in the background, check{" "}
          <Link href="/admin/agents" className="font-bold text-accent-dark hover:underline">
            Agents
          </Link>{" "}
          in a moment if you want to confirm it, or create it from there if it fails.
        </div>

        <div className="mt-5 flex gap-3">
          <Button variant="outline" className="flex-1" asChild>
            <Link href="/admin/settings/roles">Assign a role</Link>
          </Button>
          <Button className="flex-1" asChild>
            <Link href="/admin/agents">Done</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
