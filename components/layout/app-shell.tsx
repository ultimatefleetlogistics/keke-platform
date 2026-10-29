"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export interface NavChildItem {
  label: string;
  href: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  // Module 45: an item with children renders as a collapsible parent row
  // in SidebarNav instead of a plain link, its own href still goes
  // somewhere real (a hub or overview page), the children are its real
  // sub-pages rather than a second copy of the same destination.
  children?: NavChildItem[];
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

/**
 * Module 42: two changes bundled into one file since both touch the same
 * markup. First, responsiveness: this was a fixed 240px sidebar plus a
 * `flex` row with no narrower layout at all, direct feedback "make the
 * web highly responsive" and this shell wraps every portal's every page,
 * so it was the single biggest win available. Below the `lg` breakpoint
 * the sidebar becomes an off-canvas drawer (a real client state, hence
 * this file moving from a Server to a Client Component) behind a
 * hamburger button in a new mobile-only top bar, sliding in over a
 * backdrop rather than squeezing page content into an unreadable strip.
 * `usePathname()` closes it automatically on navigation, the same
 * pathname SidebarNav already reads for its own active-item logic, a
 * drawer that stayed open after a link click would just be in the way of
 * the page it navigated to. Second, `ThemeToggle`
 * (components/layout/theme-toggle.tsx): every logged-in page in the app
 * renders through this shell, so this is the one place a toggle reaches
 * every portal at once instead of needing one per layout.
 */
export function AppShell({
  navGroups,
  userName,
  userRole,
  userInitials,
  profileHref,
  children,
}: {
  navGroups: NavGroup[];
  userName: string;
  userRole: string;
  userInitials: string;
  // Round twelve: direct feedback, "group them accordinly when one
  // click on profile like that," after keke-mobile's own Profile tab
  // got a GTBank-style grouped rebuild (see
  // `components/design-system/settings-list.tsx`'s own comment). The
  // sidebar's avatar/name block was previously just a static display
  // next to the theme toggle, nothing to click. Each portal layout
  // passes its own settings page here (`/driver/settings`,
  // `/agent/settings`, `/investor/settings`, `/admin/settings` for
  // staff/Admin, a hub rather than the security sub-page directly, see
  // app/admin/layout.tsx's own comment on why), the same page the
  // sidebar's "Settings" nav item already links to for the three
  // non-admin portals.
  profileHref: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Closing the drawer on navigation is state derived from a prop change,
  // not a side effect: adjusting it during render (comparing against the
  // last-seen pathname, React's own recommended pattern for this) avoids
  // the extra render an effect-based reset would cost, and keeps a linter
  // rule (react-hooks/set-state-in-effect) happy about not calling
  // setState synchronously inside a useEffect body.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileNavOpen(false);
  }

  const sidebarContent = (
    <>
      {/* Module 60: the client's real logo. Two earlier passes fixed here
          based on direct feedback. First pass used the full two-line
          horizontal lockup image (icon + "ULTIMATE FLEET" / "LOGISTICS")
          — at this header's actual on-screen height (24px) the
          "LOGISTICS" subtitle line was only a few pixels tall and read as
          illegible mush, confirmed by rendering the source lockup at its
          real display height and inspecting it pixel by pixel. Second
          pass dropped to just "Ultimate" as real (never-blurry) text, but
          the client wants the full name here, same as the earlier
          recommendation. Current shape: real two-line text, "Ultimate
          Fleet" over a smaller letter-spaced "Logistics", mirroring the
          lockup's own typographic structure without its legibility
          problem, since real text stays crisp at any size no matter how
          small. The icon now sits in a small white plate with a hairline
          ring, not bare against the sidebar background like the first
          two passes — this app has a real dark theme (`ThemeToggle`,
          `ultimate.dark`'s `--surface: #241e14`), and the icon's blue
          only has ~1.9:1 contrast against that dark surface (measured,
          WCAG relative-luminance formula) vs 8.8:1 on the light surface,
          i.e. the shield nearly disappears in dark mode with no plate
          behind it. The plate is plain `bg-white` with no dark-mode
          variant, on purpose: this codebase has no `dark:` Tailwind
          variant wired up anywhere (theming here is entirely the
          `--surface`/`--text`/etc. custom-property swap in globals.css),
          and white-on-white is exactly what every other light-surface
          placement in this app already does (see the auth pages below,
          and `admin-sign-in`'s identical `bg-white` plate on its own
          already-light `bg-surface` card) — the same plate then does
          double duty as the needed contrast backing the moment the
          surface goes dark, no theme-conditional class required. The
          `ring-1 ring-border` gives the plate a visible edge in light
          mode where it would otherwise blend perfectly into the
          sidebar's own white background. */}
      <div className="flex items-center gap-2.5 px-1.5 pb-6">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white shadow-sm ring-1 ring-border">
          <img src="/brand/icon.png" alt="" className="h-5 w-auto" />
        </div>
        {/* `flex flex-col` here (not a plain block stack) is deliberate:
            with no explicit width, a column flex container sizes to its
            widest child ("Ultimate Fleet"), and `align-items: stretch`
            (flex's own default, not set explicitly) then stretches the
            narrower "Logistics" line to that same width. That's what
            lets `[text-align-last:justify] [text-justify:inter-character]`
            below spread LOGISTICS's inter-character spacing to exactly
            span the width of the line above it, matching how the
            client's own PDF lockup sets the subtitle — done with real
            CSS justification rather than a hand-picked letter-spacing
            number, so it stays correct at every font size instead of
            only the one size it was eyeballed at. text-brand (blue,
            defined in globals.css) only appears in the headline: it's
            the logo's own blue, safe here because this plate is always
            white in both themes, but it isn't this app's general text
            color, so the subtitle stays on the normal muted token. */}
        <div className="flex min-w-0 flex-col">
          <div className="truncate whitespace-nowrap text-[14px] font-extrabold text-brand">Ultimate Fleet</div>
          <div className="truncate whitespace-nowrap text-[9.5px] font-bold uppercase tracking-[0.03em] text-text-faint [text-align-last:justify] [text-justify:inter-character]">
            Logistics
          </div>
        </div>
      </div>

      {/* Module 48: direct feedback, expanding a parent item (Payments,
          Wallet, Settings) could push everything below it, including
          "Audit log" at the very bottom of the list, past the sidebar's
          own height with no way to reach it, the whole `<aside>` had no
          `overflow` set so it just clipped rather than scrolling. Only
          this middle section scrolls, not the logo header above or the
          profile/settings/sign-out block below, both stay pinned in
          place the way a normal app shell's chrome does. `min-h-0` is
          required, not decorative: a flex child defaults to a minimum
          height of its own content, which silently defeats
          `overflow-y-auto` inside a flex column unless it's overridden. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <SidebarNav navGroups={navGroups} />
      </div>

      <div className="mt-auto flex flex-col gap-2.5 border-t border-border pt-4">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <Link
            href={profileHref}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[11px] transition-colors hover:text-text"
          >
            <Avatar>
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-bold">{userName}</div>
              <div className="text-[11px] text-text-faint">{userRole}</div>
            </div>
          </Link>
          <ThemeToggle className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-text-faint transition-colors hover:bg-background hover:text-text" />
        </div>
        {/* Module 49: direct feedback, "move this change password to
            inside the security menu." Dropped as its own footer row:
            every portal's own settings/security page already carries a
            "Password" row pointing at this exact same /change-password
            route (SettingsRow with LockFieldIcon, see
            app/admin/settings/security/page.tsx and the investor/agent/
            driver equivalents), so this was a second, permanently-visible
            copy of a link that already lives one click away behind the
            avatar/name row just above (`profileHref`), not a second
            destination. */}
        <SignOutButton />
      </div>
    </>
  );

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background print:h-auto print:overflow-visible lg:flex-row">
      {/* Mobile-only top bar: the sidebar below is off-canvas under `lg`,
          this is what replaces it as the always-visible chrome, and
          where the hamburger that opens the drawer lives. */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-surface px-4 py-3 print:hidden lg:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border text-text"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
          </svg>
        </button>
        {/* Same reasoning as the desktop sidebar header above: real
            two-line text (never blurry, unlike a raster lockup shrunk to
            this bar's height) plus a white plate behind the icon (this
            bar is `bg-surface` too, same dark-mode contrast problem). */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] bg-white shadow-sm ring-1 ring-border">
            <img src="/brand/icon.png" alt="" className="h-[17px] w-auto" />
          </div>
          <div className="flex min-w-0 flex-col">
            <div className="truncate whitespace-nowrap text-[13px] font-extrabold text-brand">Ultimate Fleet</div>
            <div className="truncate whitespace-nowrap text-[8.5px] font-bold uppercase tracking-[0.03em] text-text-faint [text-align-last:justify] [text-justify:inter-character]">
              Logistics
            </div>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Backdrop, mobile drawer only, sits under the sliding sidebar and
          above the page content. */}
      {mobileNavOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[82vw] shrink-0 -translate-x-full flex-col border-r border-border bg-surface px-4 py-6 transition-transform duration-200 ease-out print:hidden lg:static lg:z-auto lg:w-60 lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : ""
        }`}
      >
        {sidebarContent}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto print:overflow-visible">{children}</main>
    </div>
  );
}
