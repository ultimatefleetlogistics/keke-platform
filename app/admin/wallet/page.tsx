import { redirect } from "next/navigation";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const SECTIONS = [
  {
    href: "/admin/wallet/withdrawals",
    permission: PERMISSIONS.WALLET_VIEW,
    title: "Withdrawal requests",
    description: "Review and approve or decline investors asking to move wallet balance to their bank account.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="2.5" y="6" width="19" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M2.5 10h19" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    ),
  },
  {
    href: "/admin/wallet/funding",
    permission: PERMISSIONS.WALLET_FUNDING_MANAGE,
    title: "Fund a vehicle from wallet",
    description: "See who has grown a large enough wallet balance, and decide whether to put it toward a new contract.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M4 17h16M6 17V9.5a2 2 0 0 1 1-1.73l4.5-2.6a2 2 0 0 1 2 0l4.5 2.6a2 2 0 0 1 1 1.73V17"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "/admin/wallet/bank-change-requests",
    permission: PERMISSIONS.INVESTORS_MANAGE,
    title: "Bank change requests",
    description: "An investor asking to change the bank account their payouts and withdrawals go to. Nothing changes until you approve it.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="3.5" y="4" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M7 9h10M7 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M15 16.5l1.5 1.5 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

export default async function WalletHubPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const availableSections = SECTIONS.filter((section) => user.permissions.has(section.permission));

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Wallet</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Every wallet balance is a ledger figure, not a separate pool of money, the real cash stays in the
          company&apos;s bank account until one of these actions moves it. An investor&apos;s payout bank account
          works the same way, on request until a staff member reviews it. Nothing here happens on its own.
        </div>
      </header>

      <div className="px-8 py-6">
        {availableSections.length === 0 ? (
          <Card className="max-w-[560px] p-10 text-center text-[13px] text-text-soft">
            Your role doesn&apos;t include permission to manage any wallet section.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {availableSections.map((section) => (
              <Link key={section.href} href={section.href}>
                <Card className="flex h-full flex-col gap-3 p-5 hover:shadow-card-hover">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-accent-soft text-accent-dark">
                    {section.icon}
                  </div>
                  <div>
                    <div className="text-[14.5px] font-extrabold">{section.title}</div>
                    <div className="mt-1 text-[12.5px] text-text-soft">{section.description}</div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
