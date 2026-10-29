import { redirect } from "next/navigation";

import { AppShell, type NavGroup } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isAgentDriverPortalEnabled } from "@/lib/config/portal-access";
import { getInitials } from "@/lib/utils";

const navGroups: NavGroup[] = [
  {
    label: "Agent",
    items: [
      {
        label: "Dashboard",
        href: "/agent/dashboard",
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
        label: "My Vehicles",
        href: "/agent/vehicles",
        icon: (
          <svg key="my-vehicles-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
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
        label: "Remittances",
        href: "/agent/remittances",
        icon: (
          <svg key="remittances-icon" width="17" height="17" viewBox="0 0 24 24" fill="none">
            <rect x="2.5" y="6" width="19" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
            <path d="M2.5 10h19" stroke="currentColor" strokeWidth="1.7" />
          </svg>
        ),
      },
      {
        label: "Settings",
        href: "/agent/settings",
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

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  // Module 58: defense-in-depth, not the primary path — `resolvePortalDestination`
  // (lib/actions/auth.ts) already stops a fresh agent sign-in before it
  // ever reaches here when this flag is off. This covers a session that
  // was already signed in before the flag flipped, or a direct/bookmarked
  // navigation to this URL. See lib/config/portal-access.ts.
  if (!isAgentDriverPortalEnabled()) redirect("/sign-in");
  if (user.mustChangePassword) redirect("/change-password");

  return (
    <AppShell
      navGroups={navGroups}
      userName={user.fullName}
      userRole="Agent"
      userInitials={getInitials(user.fullName)}
      profileHref="/agent/settings"
    >
      {children}
    </AppShell>
  );
}
