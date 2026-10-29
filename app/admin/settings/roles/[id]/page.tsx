import { redirect, notFound } from "next/navigation";
import Link from "next/link";

import { ActionForm, ActionSubmitButton } from "@/components/ui/action-form";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getRoleDetail, getAssignableUsers } from "@/lib/data/rbac";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { toggleRolePermission, assignRole, removeRoleAssignment, deleteRole } from "@/lib/actions/rbac";

export default async function RoleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (!user.permissions.has(PERMISSIONS.RBAC_MANAGE)) {
    redirect("/admin/settings/roles");
  }

  const role = await getRoleDetail(id);
  if (!role) notFound();

  const assignableUsers = await getAssignableUsers(id);
  const canDelete = !role.isSystem && role.members.length === 0;

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <div>
          <div className="flex items-center gap-2 text-[19px] font-extrabold tracking-tight">
            {role.name}
            {role.isSystem ? <Badge variant="accent">System</Badge> : null}
          </div>
          <div className="mt-0.5 text-[13px] text-text-soft">
            {role.description || "No description"}
          </div>
        </div>
        {canDelete ? (
          <ActionForm action={deleteRole}>
            <input type="hidden" name="roleId" value={role.id} />
            <ActionSubmitButton size="sm" variant="destructive">
              Delete role
            </ActionSubmitButton>
          </ActionForm>
        ) : null}
      </header>

      <div className="grid grid-cols-1 gap-6 px-8 py-6 lg:grid-cols-[1.4fr_1fr]">
        <Card className="p-6">
          <div className="mb-4 text-[14.5px] font-extrabold">Permissions</div>
          {role.isSystem ? (
            <div className="mb-4 rounded-xl bg-accent-soft px-4 py-3 text-[12.5px] font-semibold text-accent-dark">
              This is a system role, it always holds every permission and can&apos;t be edited.
            </div>
          ) : null}
          <div className="flex flex-col gap-5">
            {role.permissionGroups.map((group) => (
              <div key={group.key}>
                <div className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-text-soft">
                  {group.label}
                </div>
                <div className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
                  {group.permissions.map((permission) => (
                    <div key={permission.id} className="flex items-center justify-between gap-4 bg-surface px-4 py-3">
                      <div>
                        <div className="text-[13px] font-semibold">{permission.key}</div>
                        <div className="mt-0.5 text-[12px] text-text-soft">{permission.description}</div>
                      </div>
                      {role.isSystem ? (
                        <Badge variant="good">Granted</Badge>
                      ) : (
                        <ActionForm action={toggleRolePermission}>
                          <input type="hidden" name="roleId" value={role.id} />
                          <input type="hidden" name="permissionId" value={permission.id} />
                          <input type="hidden" name="nextState" value={permission.granted ? "revoke" : "grant"} />
                          <ActionSubmitButton size="sm" variant={permission.granted ? "subtle" : "outline"}>
                            {permission.granted ? "Granted" : "Grant"}
                          </ActionSubmitButton>
                        </ActionForm>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="h-fit p-6">
          <div className="mb-4 text-[14.5px] font-extrabold">Members</div>
          {role.members.length === 0 ? (
            <div className="mb-4 text-[13px] text-text-soft">Nobody holds this role yet.</div>
          ) : (
            <div className="mb-4 flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border">
              {role.members.map((member) => (
                <div key={member.assignmentId} className="flex items-center justify-between gap-3 bg-surface px-4 py-3">
                  <div>
                    <div className="text-[13px] font-bold">{member.fullName}</div>
                    <div className="mt-0.5 text-[12px] text-text-soft">{member.email}</div>
                  </div>
                  <ActionForm action={removeRoleAssignment}>
                    <input type="hidden" name="assignmentId" value={member.assignmentId} />
                    <input type="hidden" name="roleId" value={role.id} />
                    <ActionSubmitButton size="sm" variant="ghost">
                      Remove
                    </ActionSubmitButton>
                  </ActionForm>
                </div>
              ))}
            </div>
          )}

          {assignableUsers.length > 0 ? (
            <ActionForm action={assignRole} className="flex flex-col gap-2.5 border-t border-border pt-4">
              <input type="hidden" name="roleId" value={role.id} />
              <label htmlFor="userId" className="text-[12.5px] font-semibold text-text-soft">
                Assign to someone
              </label>
              <div className="flex gap-2">
                <select
                  id="userId"
                  name="userId"
                  required
                  defaultValue=""
                  className="flex h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-[13px] text-text outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft"
                >
                  <option value="" disabled>
                    Choose a staff or agent account
                  </option>
                  {assignableUsers.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.fullName} ({candidate.email})
                    </option>
                  ))}
                </select>
                <ActionSubmitButton size="sm">Assign</ActionSubmitButton>
              </div>
            </ActionForm>
          ) : (
            <div className="border-t border-border pt-4 text-[12.5px] text-text-soft">
              Every staff and agent account already holds this role.
            </div>
          )}
        </Card>
      </div>

      <div className="px-8 pb-6">
        <Link href="/admin/settings/roles" className="text-[13px] font-semibold text-accent-dark hover:underline">
          Back to roles
        </Link>
      </div>
    </>
  );
}
