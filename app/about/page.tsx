import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { MapPin, ShieldCheck, Users, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter, CONTACT_EMAIL } from "@/components/marketing/site-footer";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "About Us | Ultimate Fleet Logistics",
  description:
    "Who Ultimate Fleet Logistics is, what we do, and where to find our office.",
};

/**
 * Module: public About page. Added 2026-10-23, off Saidu's direct
 * request for a dedicated page explaining the company in more detail and
 * carrying the office location. The nav/footer "About" link used to
 * point at the homepage's "Who We Serve" section (app/page.tsx,
 * id="about") — that section is still there (it's about audience, a
 * different thing from company info), but "About" now leads here
 * instead; see the 2026-10-23 comment on NAV_LINKS in site-header.tsx.
 *
 * Office address: Saidu supplied a Google Maps link
 * (https://maps.app.goo.gl/jWERQ1nPaZa7y24a9) rather than typed text.
 * That link only resolves to coordinates (9.1043291, 7.4116956 — Abuja)
 * when fetched outside a browser; Maps renders the actual place name and
 * street address client-side, which an automated fetch can't read. The
 * OFFICE_ADDRESS lines below were a placeholder in the meantime. The
 * "Get Directions" button already used his real link either way, so the
 * map destination itself was correct even before the text was filled in.
 *
 * 2026-10-28: real street address confirmed by Saidu: "Plot C8, 521
 * Road, 5th Avenue off 1st Avenue, Gwarinpa, Gwarinpa". Split below as
 * "Gwarinpa, Abuja" (the prominent line) plus the plot/road detail
 * underneath — the trailing second "Gwarinpa" in what Saidu sent is
 * dropped from line 2 since it's already said once as the headline,
 * not because anything was assumed about the address itself. Flag if
 * that split reads wrong. Also added an embedded map alongside the
 * existing "Get Directions" link, pinned to the same coordinates
 * above so the two can't disagree with each other.
 */
const OFFICE_ADDRESS_LINE_1 = "Gwarinpa, Abuja";
const OFFICE_ADDRESS_LINE_2 = "Plot C8, 521 Road, 5th Avenue off 1st Avenue";
const OFFICE_MAPS_URL = "https://maps.app.goo.gl/jWERQ1nPaZa7y24a9";
// Keyless Google Maps embed (no Maps Embed/JavaScript API key or billing
// account needed) pinned to the same coordinates as OFFICE_MAPS_URL.
const OFFICE_MAP_EMBED_URL = "https://www.google.com/maps?q=9.1043291,7.4116956&output=embed";

const WHAT_WE_DO = [
  {
    title: "Delivery Services",
    body: "Parcel, business, and individual deliveries by dispatch rider.",
    href: "/services#delivery",
  },
  {
    title: "Interstate Transport",
    body: "Passenger transport across interstate routes, with a trusted operator.",
    href: "/services#interstate",
  },
  {
    title: "Fleet Platform",
    body: "Our own investor and fleet management platform for keke, bike, and car fleets.",
    href: "/services#fleet-platform",
  },
];

const WHY_US = [
  {
    icon: MapPin,
    title: "One platform, three vehicle types",
    body: "Keke, bike, and car fleets managed from the same place, not a keke-only tool.",
  },
  {
    icon: Wallet,
    title: "Payments you can trace",
    body: "Investor payments and remittances run through Paystack, tracked end to end.",
  },
  {
    icon: ShieldCheck,
    title: "Role-based access",
    body: "Separate investor, admin, agent, and driver portals: nobody sees more than they should.",
  },
  {
    icon: Users,
    title: "Built for the people who use it",
    body: "Delivery customers, interstate passengers, fleet owners, drivers, and corporate clients alike.",
  },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Intro */}
        <section className="relative overflow-hidden bg-accent-charcoal">
          <Image
            src="/marketing/fleet-lineup.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-center"
          />
          {/* 2026-10-23: overlay lightened from /88 to /65 (same request
              as the homepage's hero and Why Choose Us banner), with
              text-shadow added below to keep the heading/copy readable
              at the lower opacity.
              2026-10-24: darkened to /75 and switched from
              --accent-charcoal to --photo-overlay — same "too light" /
              "blue wash doesn't look cool" feedback and the same fix as
              the homepage's hero and Why Choose Us banner, see
              --photo-overlay's comment in globals.css. */}
          <div className="absolute inset-0 bg-photo-overlay/75" />
          <div className="relative mx-auto max-w-6xl px-5 py-20 sm:py-24">
            <Reveal>
              <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">About Us</p>
              <h1 className="mt-2 max-w-2xl text-[30px] font-extrabold leading-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.55)] sm:text-[36px]">
                Ultimate Fleet Logistics Ltd
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-white/85 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]">
                We&apos;re a Nigerian logistics and fleet management company. We move parcels, move
                people, and run the technology behind a growing fleet of keke, bikes, and cars. Not
                a keke-only operation, a hub for all three.
              </p>
            </Reveal>
          </div>
        </section>

        {/* What we do */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <Reveal>
            <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent">What We Do</p>
            <h2 className="mt-2 max-w-xl text-[24px] font-extrabold text-text">Three connected lines of business</h2>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {WHAT_WE_DO.map((item, i) => (
              <Reveal key={item.title} delay={i * 110}>
                <Link
                  href={item.href}
                  className="group block h-full rounded-2xl border border-border bg-surface p-5 shadow-card transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-card-hover"
                >
                  <h3 className="text-[15px] font-extrabold text-text">{item.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-soft">{item.body}</p>
                  <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-bold text-accent">
                    Learn more{" "}
                    <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover:translate-x-1">
                      &rarr;
                    </span>
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Why us */}
        <section className="border-y border-border bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
            <Reveal>
              <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent">Why Ultimate Fleet</p>
              <h2 className="mt-2 max-w-xl text-[24px] font-extrabold text-text">What makes us different</h2>
            </Reveal>

            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {WHY_US.map((item, i) => (
                <Reveal key={item.title} delay={i * 90} className="flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-dark">
                    <item.icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="text-[14.5px] font-extrabold text-text">{item.title}</h3>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-text-soft">{item.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Office / headquarters */}
        <section className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
          <Reveal className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent">Our Office</p>
              <h2 className="mt-2 text-[24px] font-extrabold text-text">Where to find us</h2>
              <div className="mt-4 flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-accent" strokeWidth={1.8} aria-hidden="true" />
                <div>
                  <p className="text-[14.5px] font-bold text-text">{OFFICE_ADDRESS_LINE_1}</p>
                  <p className="text-[13px] text-text-faint">{OFFICE_ADDRESS_LINE_2}</p>
                </div>
              </div>
              <p className="mt-4 max-w-md text-[13.5px] leading-relaxed text-text-soft">
                Reach out by phone or email any time, or get directions to the office below.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Button asChild size="lg" className="hover:scale-[1.03]">
                <a href={OFFICE_MAPS_URL} target="_blank" rel="noopener noreferrer">
                  Get Directions
                </a>
              </Button>
              <Button asChild size="lg" variant="outline" className="hover:scale-[1.03]">
                <a href="tel:+2349019505552">Call Us</a>
              </Button>
              <Button asChild size="lg" variant="outline" className="hover:scale-[1.03]">
                <a href={`mailto:${CONTACT_EMAIL}`}>Email Us</a>
              </Button>
            </div>
          </Reveal>

          {/* 2026-10-28: embedded map, added once the real street address
              was confirmed. Pinned to the same coordinates as
              OFFICE_MAPS_URL above (see that constant's comment), so the
              pin shown here and the "Get Directions" destination always
              agree. */}
          <Reveal delay={120} className="mt-10 overflow-hidden rounded-2xl border border-border shadow-card">
            <iframe
              src={OFFICE_MAP_EMBED_URL}
              className="h-[320px] w-full border-0 sm:h-[380px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Ultimate Fleet Logistics office location"
            />
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
