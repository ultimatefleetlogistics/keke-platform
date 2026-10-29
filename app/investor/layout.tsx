import { redirect } from "next/navigation";

import { AppShell, type NavGroup } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getInitials } from "@/lib/utils";

/**
 * Module 44: "Documents" and "Payout details" dropped from this sidebar,
 * moved inside `/investor/settings` as two new `SettingsRow`s instead
 * (see that page's own comment for the full reasoning). Their routes
 * (`/investor/documents`, `/investor/payout-details`) are unchanged and
 * still reachable from other links in the app, they just aren't
 * top-level nav items anymore, the same way `/change-password` never
 * was one.
 */
const navGroups: NavGroup[] = [
  {
    label: "Investor Portal",
    items: [
      {
        label: "Dashboard",
        href: "/investor/dashboard",
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
        label: "My Investments",
        href: "/investor/investments",
        icon: (
          <svg key="my-investments-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
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
        label: "Payments",
        href: "/investor/payments",
        icon: (
          <svg key="payments-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
            <rect x="2.5" y="6" width="19" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="M2.5 10h19" stroke="currentColor" strokeWidth="1.7" />
          </svg>
        ),
      },
      {
        label: "Wallet",
        href: "/investor/wallet",
        icon: (
          <svg key="wallet-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
            <rect x="2.5" y="5.5" width="19" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="M2.5 10.5h19" stroke="currentColor" strokeWidth="1.7" />
            <circle cx="17.5" cy="14.5" r="1.4" fill="currentColor" />
          </svg>
        ),
      },
      {
        label: "Settings",
        href: "/investor/settings",
        icon: (
          <svg key="security-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3 5 6.5v5c0 4.7 3 8.5 7 9.5 4-1 7-4.8 7-9.5v-5L12 3Z"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
            />
          </svg>
        ),
      },
    ],
  },
];

export default async function InvestorLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  if (user.mustChangePassword) redirect("/change-password");

  return (
    <AppShell
      navGroups={navGroups}
      userName={user.fullName}
      userRole="Investor"
      userInitials={getInitials(user.fullName)}
      profileHref="/investor/settings"
    >
      {children}
    </AppShell>
  );
}
