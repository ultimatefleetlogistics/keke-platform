import { redirect } from "next/navigation";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PERMISSIONS } from "@/lib/rbac/permissions";

const SECTIONS = [
  {
    href: "/admin/settings/security",
    // No permission gate: this is about the signed-in account's own
    // security, not something requiring a manage-permission over other
    // people's records, every staff, agent, or Admin account sees it.
    permission: null as null,
    title: "Security",
    description: "Turn on two-factor authentication for your own sign in.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3 5 6.5v5c0 4.7 3 8.5 7 9.5 4-1 7-4.8 7-9.5v-5L12 3Z"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="m9 12 2 2 4-4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/admin/settings/roles",
    permission: PERMISSIONS.RBAC_MANAGE,
    title: "Roles & permissions",
    description: "Create roles, decide what each one can do, and see who holds it.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
        <path
          d="M12 3v2.2M12 18.8V21M4.9 4.9l1.55 1.55M17.55 17.55 19.1 19.1M3 12h2.2M18.8 12H21M4.9 19.1l1.55-1.55M17.55 6.45 19.1 4.9"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: "/admin/settings/staff",
    permission: PERMISSIONS.STAFF_MANAGE,
    title: "Staff",
    description: "See every operations console account, and create new ones. Field agents live under Agents instead.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M16 9a2.6 2.6 0 1 0 0-5.2M18 20c0-2.6-1.8-4.4-4-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/admin/settings/contract-terms",
    permission: PERMISSIONS.SETTINGS_MANAGE,
    title: "Contract defaults",
    description: "Change the numbers that pre-fill a new keke, car, or bike contract, no code change needed.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 8h8M8 12h8M8 16h5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default async function SettingsHubPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  const availableSections = SECTIONS.filter((section) => !section.permission || user.permissions.has(section.permission));

  return (
    <>
      <header className="border-b border-border px-8 py-5">
        <div className="text-[19px] font-extrabold tracking-tight">Settings</div>
        <div className="mt-0.5 text-[13px] text-text-soft">
          Everything here changes app-wide behavior, not one specific record. More sections land here over time as
          settings move from code into the database.
        </div>
      </header>

      <div className="px-8 py-6">
        {availableSections.length === 0 ? (
          <Card className="max-w-[560px] p-10 text-center text-[13px] text-text-soft">
            Your role doesn&apos;t include permission to manage any settings section.
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
