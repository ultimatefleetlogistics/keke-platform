import { redirect } from "next/navigation";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ClickableRow } from "@/components/ui/clickable-row";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getRolesOverview } from "@/lib/data/rbac";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function RolesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (!user.permissions.has(PERMISSIONS.RBAC_MANAGE)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-20 text-center">
        <div className="text-lg font-extrabold">No access</div>
        <div className="max-w-sm text-[13.5px] text-text-soft">
          Your role doesn&apos;t include permission to manage roles and permissions.
        </div>
      </div>
    );
  }

  const roles = await getRolesOverview();

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <div>
          <div className="text-[19px] font-extrabold tracking-tight">Roles & permissions</div>
          <div className="mt-0.5 text-[13px] text-text-soft">
            Every staff and agent account gets its access through a role here, not through anything set on the
            account itself. To create the account itself first, see{" "}
            <Link href="/admin/settings/staff" className="font-bold text-accent-dark hover:underline">
              Staff & agents
            </Link>
            .
          </div>
        </div>
        <Button size="sm" asChild>
          <Link href="/admin/settings/roles/new">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            New role
          </Link>
        </Button>
      </header>

      <div className="px-8 py-6">
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-t-0 hover:bg-transparent">
                <TableHead>Role</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead>Members</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => (
                <ClickableRow key={role.id} href={`/admin/settings/roles/${role.id}`}>
                  <TableCell className="font-bold">
                    <Link href={`/admin/settings/roles/${role.id}`} className="flex items-center gap-2 hover:text-accent-dark">
                      {role.name}
                      {role.isSystem ? <Badge variant="accent">System</Badge> : null}
                    </Link>
                  </TableCell>
                  <TableCell className="text-text-soft">{role.description || "No description"}</TableCell>
                  <TableCell>{role.permissionCount}</TableCell>
                  <TableCell className="text-text-soft">{role.memberCount}</TableCell>
                </ClickableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
    </>
  );
}
