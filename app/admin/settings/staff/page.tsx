import { redirect } from "next/navigation";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getStaff } from "@/lib/data/staff";
import { PERMISSIONS } from "@/lib/rbac/permissions";

// Module 51: direct feedback, "separate staff and agent" — this used to
// be a combined staff-and-agent list (see lib/data/agents.ts's own
// comment for the full reasoning). Agents now have their own list at
// /admin/agents with the fleet/driver/remittance detail a staff account
// never has, this screen is staff only.
export default async function StaffPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (!user.permissions.has(PERMISSIONS.STAFF_MANAGE)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-20 text-center">
        <div className="text-lg font-extrabold">No access</div>
        <div className="max-w-sm text-[13.5px] text-text-soft">
          Your role doesn&apos;t include permission to manage staff accounts.
        </div>
      </div>
    );
  }

  const staff = await getStaff();

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <div>
          <div className="text-[19px] font-extrabold tracking-tight">Staff</div>
          <div className="mt-0.5 text-[13px] text-text-soft">
            Every account with access to the operations console. See{" "}
            <Link href="/admin/agents" className="font-bold text-accent-dark hover:underline">
              Agents
            </Link>{" "}
            for field agents instead, and{" "}
            <Link href="/admin/settings/roles" className="font-bold text-accent-dark hover:underline">
              Roles &amp; permissions
            </Link>{" "}
            to manage what each role can do.
          </div>
        </div>
        <Button size="sm" asChild>
          <Link href="/admin/settings/staff/new">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add staff
          </Link>
        </Button>
      </header>

      <div className="px-8 py-6">
        {staff.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM3.5 20c0-3.31 2.46-6 5.5-6s5.5 2.69 5.5 6M18 8v6m3-3h-6"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              title="No staff accounts yet"
              description="Add the first one to get started."
              action={
                <Button size="sm" asChild>
                  <Link href="/admin/settings/staff/new">Add staff</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-t-0 hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Job title</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-bold">{account.fullName}</TableCell>
                    <TableCell className="text-text-soft">{account.email}</TableCell>
                    <TableCell className="text-text-soft">{account.jobTitle}</TableCell>
                    <TableCell className="text-text-soft">
                      {account.roles.length > 0 ? account.roles.join(", ") : "No role assigned yet"}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/settings/staff/${account.id}`} className="font-semibold text-accent-dark hover:underline">
                        Edit
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </>
  );
}
