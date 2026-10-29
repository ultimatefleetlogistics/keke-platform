"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";

/**
 * 2026-10-22: these were bare "#services"/"#about"/"#contact" until this
 * site had only one page — a bare hash resolves against whatever page
 * you're currently on, so clicking "About" from /services (which has no
 * id="about" anywhere on it) just did nothing, same for "Services"
 * there. Now that app/services/page.tsx exists and shares this header,
 * every link is "/#id" instead: from "/" that's still a same-page jump
 * (same path, browser just scrolls, no reload), and from anywhere else
 * it navigates back to the homepage and then to that section.
 *
 * 2026-10-23: "About" now goes to the dedicated app/about/page.tsx
 * instead of "/#about" — Saidu asked for a full page explaining the
 * company (what we do, why us, office location), not just the
 * homepage's "Who We Serve" audience chips. That section is still on
 * the homepage (id="about" is still there, it's just not what this nav
 * link points at anymore).
 */
const NAV_LINKS = [
  { href: "/#services", label: "Services" },
  { href: "/about", label: "About" },
  { href: "/#contact", label: "Contact" },
];

/**
 * Module: public homepage. The signed-out, public-facing nav — separate
 * from AppShell/SidebarNav (components/layout/app-shell.tsx), which is
 * only ever rendered behind a portal layout for a signed-in user. This
 * one has no auth dependency at all, it has to render for anyone,
 * anywhere, including the very first paint of "/".
 *
 * Uses the real logo file (public/brand/logo-horizontal.png) instead of
 * an icon chip + text wordmark — once the client supplied the actual
 * logo there was no reason to keep approximating it. 2026-10-22: dropped
 * "Login" as the nav CTA's label — per-the-client request, "Access
 * Platform" is the one piece of login wording used anywhere on the
 * public site, here and on the Fleet Platform service card alike, so a
 * visitor never sees two different words for the same destination.
 *
 * 2026-10-22 (later): became a client component for one reason only — a
 * scroll listener that deepens the header's border/shadow once the page
 * has scrolled past the top, so it reads as "lifted" above the content
 * instead of a flat bar. Everything else here is exactly as static as
 * it was before.
 *
 * 2026-10-26: the header's own CTA stopped being a direct "Access
 * Platform" link to /sign-in — Saidu's point was that this site is
 * meant to be Ultimate's general hub, not a front door for one single
 * product, and a persistent sitewide nav button pointing straight at
 * the keke/fleet investment app's sign-in contradicted that. The
 * "Access Platform" wording stays exactly where it already made sense
 * (the Fleet Platform card on app/services/page.tsx, and the footer's
 * "Fleet Platform" link) since both of those are clearly scoped to that
 * one product already, not presented as the whole site's purpose. Here,
 * it's replaced with a "Platforms" dropdown that currently lists Fleet
 * Platform as its one entry — same destination, but framed as one
 * product among others rather than the site's single reason to exist,
 * and the menu shape is ready for a second entry whenever there is one,
 * with no further restructuring needed then.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-surface/90 backdrop-blur transition-shadow duration-300 supports-[backdrop-filter]:bg-surface/75 ${
        scrolled ? "border-border shadow-[0_2px_16px_-6px_rgba(31,26,18,0.18)]" : "border-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center">
          <Image
            src="/brand/logo-horizontal.png"
            alt="Ultimate Fleet Logistics"
            width={1787}
            height={483}
            priority
            className="h-8 w-auto"
          />
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="relative text-[13.5px] font-semibold text-text-soft transition-colors after:absolute after:-bottom-1 after:left-0 after:h-[2px] after:w-0 after:bg-accent after:transition-[width] after:duration-300 hover:text-text hover:after:w-full"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button size="sm" className="gap-1.5 hover:scale-[1.04]">
                Platforms
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={10}
                className="z-50 w-72 rounded-xl border border-border bg-surface p-1.5 shadow-card animate-card-in"
              >
                {/* Fleet Platform is the only entry today — the keke/bike/car
                    investment and fleet management app this company already
                    runs. The menu shape itself is what matters here: adding
                    a second DropdownMenu.Item is all a future platform needs,
                    nothing about this header has to change again for that. */}
                <DropdownMenu.Item asChild className="cursor-pointer outline-none">
                  <Link
                    href="/sign-in"
                    className="flex flex-col gap-0.5 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-background focus:bg-background"
                  >
                    <span className="text-[13.5px] font-semibold text-text">Fleet Platform</span>
                    <span className="text-[12px] text-text-soft">
                      Keke, bike and car investment and fleet management
                    </span>
                  </Link>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </header>
  );
}
