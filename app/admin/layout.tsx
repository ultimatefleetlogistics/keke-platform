import { redirect } from "next/navigation";

import { AppShell, type NavGroup } from "@/components/layout/app-shell";
import { KekeIcon } from "@/components/design-system/keke-icon";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getInitials } from "@/lib/utils";

const navGroups: NavGroup[] = [
  {
    label: "Operations",
    items: [
      {
        label: "Dashboard",
        href: "/admin/dashboard",
        icon: (
          <svg key="dashboard-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <rect x="14" y="3" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <rect x="3" y="14" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <rect x="14" y="14" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        ),
      },
      {
        label: "Fleet",
        href: "/admin/fleet",
        icon: (
          <svg key="fleet-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
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
        label: "Drivers",
        href: "/admin/drivers",
        icon: (
          <svg key="drivers-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
            <circle cx="12" cy="12" r="2.3" stroke="currentColor" strokeWidth="1.7" />
            <path d="M12 3.5v6.2M12 14.3v6.2M20.5 12h-6.2M9.7 12H3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        // Module 51: direct feedback, "separate staff and agent" — agents
        // used to be reachable only through Settings > Staff & agents,
        // buried alongside operations-console staff accounts with none of
        // an agent's own fleet/driver/remittance detail visible from
        // there. Now its own top-level destination, next to Drivers,
        // since drivers report to agents, see lib/data/agents.ts.
        label: "Agents",
        href: "/admin/agents",
        icon: (
          <svg key="agents-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.7" />
          </svg>
        ),
      },
      {
        label: "Investors",
        href: "/admin/investors",
        icon: (
          <svg key="investors-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.7" />
            <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        label: "Payments",
        href: "/admin/payments/batches",
        icon: (
          <svg key="payments-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
            <rect x="2.5" y="6" width="19" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="M2.5 10h19" stroke="currentColor" strokeWidth="1.7" />
          </svg>
        ),
        children: [
          { label: "Batches", href: "/admin/payments/batches" },
          { label: "Reconciliation", href: "/admin/payments/reconciliation" },
        ],
      },
      {
        label: "Transfers",
        href: "/admin/transfers",
        icon: <KekeIcon key="transfers-icon" className="h-[17px] w-[17px]" strokeWidth={1.7} />,
      },
      {
        label: "Wallet",
        href: "/admin/wallet",
        icon: (
          <svg key="wallet-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
            <rect x="2.5" y="5.5" width="19" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="M2.5 10.5h19" stroke="currentColor" strokeWidth="1.7" />
            <circle cx="17.5" cy="14.5" r="1.4" fill="currentColor" />
          </svg>
        ),
        children: [
          { label: "Funding", href: "/admin/wallet/funding" },
          { label: "Withdrawals", href: "/admin/wallet/withdrawals" },
          { label: "Bank change requests", href: "/admin/wallet/bank-change-requests" },
        ],
      },
      {
        label: "KYC",
        href: "/admin/kyc",
        icon: (
          <svg key="kyc-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
            <rect x="3.5" y="4" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
            <circle cx="9.5" cy="10" r="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M6.5 16c.6-2 2-3 3-3s2.4 1 3 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M14.5 9h3M14.5 12h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        label: "Settings",
        href: "/admin/settings",
        icon: (
          <svg key="settings-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
            <path
              d="M12 3v2.2M12 18.8V21M4.9 4.9l1.55 1.55M17.55 17.55 19.1 19.1M3 12h2.2M18.8 12H21M4.9 19.1l1.55-1.55M17.55 6.45 19.1 4.9"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
        ),
        // Module 45: was a separate "Staff & agents" top-level row plus
        // this one, both really just sub-pages of Settings (the hub at
        // /admin/settings already links to all four of these, see its
        // own SECTIONS list). Folded into children instead of a second
        // permanent top-level row, same four destinations, reached by
        // expanding "Settings" now rather than scrolling past it.
        // Module 51: "Staff & agents" is just "Staff" now, agents moved
        // to their own top-level "Agents" row above, see its own comment.
        children: [
          { label: "Security", href: "/admin/settings/security" },
          { label: "Roles & permissions", href: "/admin/settings/roles" },
          { label: "Staff", href: "/admin/settings/staff" },
          { label: "Contract defaults", href: "/admin/settings/contract-terms" },
        ],
      },
      {
        label: "Reports",
        href: "/admin/reports",
        icon: (
          <svg key="reports-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M4 20V10M11 20V4M18 20v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M2.5 20h19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        label: "Audit log",
        href: "/admin/audit-log",
        icon: (
          <svg key="audit-log-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M8 3h8l4 4v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
            <path d="M8 11h8M8 15h5M8 7h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.mustChangePassword) redirect("/change-password");

  const role = user.staff?.jobTitle || "Staff";

  return (
    <AppShell
      navGroups={navGroups}
      userName={user.fullName}
      userRole={role}
      userInitials={getInitials(user.fullName)}
      profileHref="/admin/settings"
    >
      {children}
    </AppShell>
  );
}
