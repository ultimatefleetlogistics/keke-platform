import type { SVGProps } from "react";
import Image from "next/image";
import Link from "next/link";

import { NewsletterForm } from "@/components/marketing/newsletter-form";

/**
 * Module: public homepage, footer. lucide-react dropped its brand/logo
 * icons (Facebook, Instagram, Twitter, etc.) a while back — importing
 * them now breaks the build ("Export Facebook doesn't exist"). These
 * two are hand-drawn to match lucide's own stroke style (1.5–1.8px
 * round-cap outline) so they still sit visually with the rest of the
 * icon set used across the site.
 */
function FacebookIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3.5l.5-4H14V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function InstagramIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

/**
 * Module: public homepage. Confirmed 2026-10-22: info@, not admin@ —
 * every contact link on this page reads from this one constant, so
 * updating the mailbox later only ever means changing this line.
 */
export const CONTACT_EMAIL = "info@ultimatefleetlogisticsltd.com";

/**
 * Module: public homepage, footer. 2026-10-22: dark navy footer to
 * match the reference layout, with a Quick Links / Services / Stay
 * Connected column split and a newsletter field — see
 * newsletter-form.tsx for why that field opens a mailto rather than
 * pretending to subscribe anyone.
 *
 * Social icons are intentionally NOT links yet. The Facebook Page and
 * Instagram account are still being set up (Facebook kept rejecting
 * Page creation on the new account as of this session) — there's no
 * confirmed, live URL for either one to point to. They render as
 * plain, non-clickable chips for now; swap the <span> wrapper below
 * for a real <a href> the moment both pages are live and confirmed.
 */
const SOCIALS = [
  { icon: FacebookIcon, label: "Facebook (coming soon)" },
  { icon: InstagramIcon, label: "Instagram (coming soon)" },
];

export function SiteFooter() {
  return (
    <footer id="contact" className="bg-accent-charcoal">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Image
              src="/brand/logo-horizontal-light.png"
              alt="Ultimate Fleet Logistics"
              width={1787}
              height={483}
              className="h-7 w-auto"
            />
            <p className="mt-3 max-w-xs text-[13px] leading-relaxed text-white/60">
              Fleet investment, logistics, and mobility services, built and run from Nigeria.
            </p>
          </div>

          <div>
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-white/40">Quick Links</h4>
            <ul className="mt-3 space-y-2 text-[13.5px] text-white/70">
              <li>
                <Link href="/" className="hover:text-white">Home</Link>
              </li>
              <li>
                {/* 2026-10-22: these were bare "#services"/"#about" — fine
                    while this footer only ever rendered on "/", broken
                    once it also started rendering on /services (that page
                    has no id="services"/"about" of its own, so the link
                    just did nothing there). "/#id" always resolves against
                    the homepage regardless of which page the footer is on;
                    "#contact" is untouched since id="contact" lives on
                    this very <footer>, present on every page already. */}
                <a href="/#services" className="hover:text-white">Services</a>
              </li>
              <li>
                {/* 2026-10-23: now the dedicated About page, see the same
                    note on NAV_LINKS in site-header.tsx. */}
                <Link href="/about" className="hover:text-white">About Us</Link>
              </li>
              <li>
                <a href="#contact" className="hover:text-white">Contact</a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-white/40">Our Services</h4>
            <ul className="mt-3 space-y-2 text-[13.5px] text-white/70">
              <li>
                {/* 2026-10-22: point straight at each service's own detail
                    section on /services (added this session) instead of
                    both just landing on the homepage's Services grid. */}
                <Link href="/services#delivery" className="hover:text-white">Delivery Services</Link>
              </li>
              <li>
                <Link href="/services#interstate" className="hover:text-white">Interstate Transport</Link>
              </li>
              <li>
                <Link href="/sign-in" className="hover:text-white">Fleet Platform</Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-[12px] font-bold uppercase tracking-wider text-white/40">Stay Connected</h4>
            <div className="mt-3 flex gap-2">
              {SOCIALS.map((s) => (
                <span
                  key={s.label}
                  title={s.label}
                  aria-label={s.label}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white/50"
                >
                  <s.icon className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                </span>
              ))}
            </div>

            <a href={`mailto:${CONTACT_EMAIL}`} className="mt-4 block text-[13px] text-white/70 hover:text-white">
              {CONTACT_EMAIL}
            </a>
            {/* 2026-10-28: real number confirmed by Saidu, replacing the
                "coming soon" placeholder. tel: href uses the +234
                international form (works correctly if a visitor taps it
                from outside Nigeria too), the visible text keeps the
                familiar local 0-prefixed format. */}
            <a href="tel:+2349019505552" className="mt-1 block text-[13px] text-white/70 hover:text-white">
              0901 950 5552
            </a>

            <p className="mt-5 text-[12px] font-semibold uppercase tracking-wider text-white/40">
              Subscribe for updates
            </p>
            <div className="mt-2">
              <NewsletterForm contactEmail={CONTACT_EMAIL} />
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-[12px] text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; {new Date().getFullYear()} Ultimate Fleet Logistics Ltd. All rights reserved.</span>
          <span>Nigeria</span>
        </div>
      </div>
    </footer>
  );
}
