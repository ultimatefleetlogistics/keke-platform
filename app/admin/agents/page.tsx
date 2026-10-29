import { redirect } from "next/navigation";
import Link from "next/link";

import { AnimatedNumber } from "@/components/ui/animated-number";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SubmitButton } from "@/components/ui/submit-button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getAgents } from "@/lib/data/agents";
import { retryAgentCollectionAccount } from "@/lib/actions/staff";
import { PERMISSIONS } from "@/lib/rbac/permissions";

// Module 51: direct feedback, "separate staff and agent" — agents used
// to be listed alongside staff on /admin/settings/staff (see
// lib/data/agents.ts's own comment for the full reasoning). This is
// their own screen now, with the fleet/driver/remittance summary a
// staff account never has, each row links to /admin/agents/[id] for the
// full picture on that one agent.
export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ collectionAccountError?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (!user.permissions.has(PERMISSIONS.STAFF_MANAGE)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 py-20 text-center">
        <div className="text-lg font-extrabold">No access</div>
        <div className="max-w-sm text-[13.5px] text-text-soft">
          Your role doesn&apos;t include permission to manage agent accounts.
        </div>
      </div>
    );
  }

  const agents = await getAgents();
  // Module 25 bug fix, carried over from the combined staff/agent list:
  // retryAgentCollectionAccount used to throw its real Paystack error
  // straight into a crash instead of showing it. This is where the
  // message actually lands now.
  const { collectionAccountError } = await searchParams;

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-8 py-5">
        <div>
          <div className="text-[19px] font-extrabold tracking-tight">Agents</div>
          <div className="mt-0.5 text-[13px] text-text-soft">
            Every field agent, their region, and everything reporting to them. See{" "}
            <Link href="/admin/settings/staff" className="font-bold text-accent-dark hover:underline">
              Staff
            </Link>{" "}
            for operations console accounts instead.
          </div>
        </div>
        <Button size="sm" asChild>
          <Link href="/admin/agents/new">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add agent
          </Link>
        </Button>
      </header>

      <div className="px-8 py-6">
        {collectionAccountError ? (
          <div className="mb-5 rounded-xl bg-bad-soft px-4 py-3 text-[12.5px] font-semibold text-bad-ink">
            Couldn&apos;t create the collection account: {collectionAccountError}
          </div>
        ) : null}
        {agents.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icon={
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.7" />
                </svg>
              }
              title="No agents yet"
              description="Add the first one to get started."
              action={
                <Button size="sm" asChild>
                  <Link href="/admin/agents/new">Add agent</Link>
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
                  <TableHead>Region</TableHead>
                  <TableHead>Drivers</TableHead>
                  <TableHead>Vehicles</TableHead>
                  <TableHead>Total remitted</TableHead>
                  <TableHead>Standing</TableHead>
                  <TableHead>Collection account</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-bold">
                      <Link href={`/admin/agents/${agent.id}`} className="hover:underline">
                        {agent.fullName}
                      </Link>
                      <div className="mt-0.5 text-[11.5px] font-medium text-text-faint">{agent.email}</div>
                    </TableCell>
                    <TableCell className="text-text-soft">{agent.region}</TableCell>
                    <TableCell className="font-semibold">{agent.driverCount}</TableCell>
                    <TableCell className="font-semibold">{agent.vehicleCount}</TableCell>
                    <TableCell className="font-bold">
                      <AnimatedNumber value={agent.totalRemitted} format="naira" />
                    </TableCell>
                    <TableCell>
                      {agent.isDelinquent ? (
                        <Badge variant="bad">{agent.daysSinceLastRemittance}d since remit</Badge>
                      ) : agent.daysSinceLastRemittance === null ? (
                        <Badge variant="neutral">No remittances yet</Badge>
                      ) : (
                        <Badge variant="good">Current</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {agent.collectionAccount ? (
                        <div className="flex flex-col">
                          <Badge variant="good" className="w-fit">
                            Active
                          </Badge>
                          <span className="mt-1 text-[11.5px] text-text-faint">
                            {agent.collectionAccount.accountNumber} · {agent.collectionAccount.bankName}
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="pending" className="w-fit">
                            Not set up
                          </Badge>
                          <form action={retryAgentCollectionAccount}>
                            <input type="hidden" name="agentId" value={agent.agentId} />
                            <SubmitButton size="sm" variant="outline">
                              Create
                            </SubmitButton>
                          </form>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/agents/${agent.id}`} className="font-semibold text-accent-dark hover:underline">
                        View
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
