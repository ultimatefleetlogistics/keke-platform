"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { cn } from "@/lib/utils";
import type { NavGroup } from "@/components/layout/app-shell";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("shrink-0 text-text-faint transition-transform duration-200 ease-out", open && "rotate-90")}
    >
      <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Split out of AppShell (a Server Component) because deciding which nav
 * item is "active" needs the current pathname, and a plain Server
 * Component layout has no equivalent to usePathname(), it only knows
 * what it was given at request time, not what gets clicked afterward.
 *
 * Previously every portal layout.tsx (admin, agent, investor, driver)
 * hardcoded `active: true` on its own Dashboard item and left every
 * other item without one at all, a static value baked into the nav data
 * itself that never changed no matter what page was actually open, and
 * AppShell rendered plain `<a>` tags instead of next/link's `<Link>`, so
 * every click away from Dashboard was also a full page reload rather
 * than a client-side transition. Both fixed here: real client-side
 * navigation, and the active item recomputed from the real current URL
 * on every change instead of frozen at whatever it was set to once.
 *
 * Matching is prefix-based, a route "owns" every path under it, so
 * /admin/wallet/withdrawals still lights up "Wallet", but more than one
 * nav item can validly prefix-match the same URL when one item's own
 * href is itself a prefix of another's in the same sidebar (/admin/settings
 * and /admin/settings/staff both being real hrefs here, for instance).
 * Only the single longest, most specific match should light up, not
 * both, hence picking the longest matching href across the whole nav
 * rather than testing each item in isolation. Children now feed into
 * that same longest-match pool, so a child page lights up the child row
 * (and, once expanded, only the child, not both).
 *
 * Module 45: direct feedback that a parent item with real sub-pages
 * (Payments, Wallet, Settings, each already several distinct routes
 * crammed into one top-level row before this) should read as a proper
 * collapsible group with an animated open/close, indented children on a
 * connecting rail, rather than every sub-page getting its own permanent
 * top-level row. `expanded` is a set of parent hrefs, multiple can be
 * open at once, nothing here is a strict accordion. The section holding
 * the active route opens itself the moment it becomes active (the same
 * "derive during render, don't setState in an effect" pattern AppShell
 * already uses to close the mobile drawer on navigation), but a section
 * opened by hand otherwise stays open across further clicks elsewhere,
 * so drilling into "Wallet -> Funding" doesn't fight you the moment you
 * also glance at "Dashboard". The height animation itself is CSS only,
 * a `grid-template-rows` 0fr/1fr transition on a wrapper around an
 * `overflow-hidden` inner div, no measured pixel height and no
 * animation library needed for something this small.
 */
export function SidebarNav({ navGroups }: { navGroups: NavGroup[] }) {
  const pathname = usePathname();

  const allHrefs = navGroups.flatMap((group) =>
    group.items.flatMap((item) => [item.href, ...(item.children?.map((child) => child.href) ?? [])])
  );
  const activeHref = allHrefs
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const group of navGroups) {
      for (const item of group.items) {
        if (item.children?.some((child) => child.href === activeHref)) {
          initial.add(item.href);
        }
      }
    }
    return initial;
  });

  // Derived-during-render sync (see comment above): whichever parent owns
  // the newly active route gets added to `expanded` the moment the active
  // href changes, without waiting on an effect or forcing an extra render.
  const [lastActiveHref, setLastActiveHref] = useState(activeHref);
  if (activeHref !== lastActiveHref) {
    setLastActiveHref(activeHref);
    const owner = navGroups.flatMap((group) => group.items).find((item) => item.children?.some((child) => child.href === activeHref));
    if (owner && !expanded.has(owner.href)) {
      setExpanded(new Set(expanded).add(owner.href));
    }
  }

  function toggle(href: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(href)) {
        next.delete(href);
      } else {
        next.add(href);
      }
      return next;
    });
  }

  return (
    <nav className="flex flex-1 flex-col gap-5">
      {navGroups.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <div className="px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">
            {group.label}
          </div>
          {group.items.map((item) => {
            if (!item.children || item.children.length === 0) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-[11px] px-3 py-2.5 text-[13.5px] font-semibold text-text-soft transition-colors hover:bg-background",
                    item.href === activeHref && "bg-accent-soft text-accent-dark hover:bg-accent-soft"
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            }

            const isOpen = expanded.has(item.href);

            return (
              <div key={item.href}>
                <div
                  className={cn(
                    "flex items-center rounded-[11px] text-[13.5px] font-semibold text-text-soft transition-colors hover:bg-background",
                    item.href === activeHref && "bg-accent-soft text-accent-dark hover:bg-accent-soft"
                  )}
                >
                  <Link href={item.href} className="flex flex-1 items-center gap-3 px-3 py-2.5">
                    {item.icon}
                    {item.label}
                  </Link>
                  <button
                    type="button"
                    onClick={() => toggle(item.href)}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? "Collapse" : "Expand"} ${item.label}`}
                    className="flex h-9 items-center px-2.5 text-text-faint transition-colors hover:text-text"
                  >
                    <ChevronIcon open={isOpen} />
                  </button>
                </div>

                <div
                  className={cn(
                    "grid transition-[grid-template-rows] duration-200 ease-out",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  )}
                >
                  <div className="overflow-hidden">
                    <div className="ml-[18.5px] flex flex-col gap-0.5 border-l border-border py-1 pl-4">
                      {item.children.map((child) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={cn(
                            "rounded-[9px] px-3 py-2 text-[13px] font-semibold text-text-soft transition-colors hover:bg-background",
                            child.href === activeHref && "bg-accent-soft text-accent-dark hover:bg-accent-soft"
                          )}
                        >
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
