import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Package, Bus, Truck, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter, CONTACT_EMAIL } from "@/components/marketing/site-footer";
import { Reveal } from "@/components/marketing/reveal";

export const metadata: Metadata = {
  title: "Our Services | Ultimate Fleet Logistics",
  description:
    "A closer look at Ultimate Fleet Logistics' delivery services, interstate transport, and fleet management platform.",
};

/**
 * Module: public services page. Added 2026-10-22, off Saidu's direct
 * request — the homepage's three service cards are a quick summary, this
 * is where each one gets the fuller explanation. Linked from the
 * homepage's "View All Services" link and each ServiceCard's own "Full
 * service details" link (see app/page.tsx, components/marketing/
 * service-card.tsx), with ids below matching the `detailsHref` anchors
 * those links point at.
 *
 * Kept as honest as the homepage copy: Delivery Services and Interstate
 * Transport are both still pending real partner/vendor confirmation (see
 * claude/client-decisions-log.md), so this page says so directly instead
 * of describing routes, pricing, or timelines that don't exist yet.
 */
export default function ServicesPage() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Intro */}
        <section className="border-b border-border bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
            <Reveal>
              <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent">Our Services</p>
              <h1 className="mt-2 max-w-2xl text-[30px] font-extrabold leading-tight text-text sm:text-[36px]">
                A closer look at what we do
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-text-soft">
                Ultimate Fleet Logistics Ltd runs three connected lines of business: moving parcels,
                moving people, and managing the keke, bike, and car fleets behind both. Here&apos;s how
                each one actually works.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Delivery Services */}
        <section id="delivery" className="scroll-mt-16 border-b border-border">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
            <Reveal className="order-2 lg:order-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-dark">
                <Package className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-[24px] font-extrabold text-text">Delivery Services</h2>
              <p className="mt-3 text-[14.5px] leading-relaxed text-text-soft">
                Parcel and package delivery by dispatch rider, for individuals and businesses who need
                something moved across town reliably, not just quickly.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "Dispatch riders on standard commuter motorcycles, the same class of bike used across our fleet",
                  "Suited to one-off sends and recurring business deliveries alike",
                  "Enquire by email for now while partner booking integration is finalized",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-text-soft">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-5 inline-flex w-fit items-center rounded-full bg-pending-soft px-2.5 py-1 text-[11px] font-semibold text-pending">
                Partner integration coming soon, booking is by enquiry for now
              </p>
              <div className="mt-6">
                <Button asChild size="lg" className="hover:scale-[1.03]">
                  <a href={`mailto:${CONTACT_EMAIL}?subject=Delivery%20Services%20Enquiry`}>Book / Enquire</a>
                </Button>
              </div>
            </Reveal>
            <Reveal delay={120} className="order-1 lg:order-2">
              {/* 2026-10-24: swapped the plain white-background bike photo
                  (dispatch-bike.jpg, a bare product shot of the motorcycle
                  model only, no rider) for a branded rider-in-action photo
                  Saidu supplied directly — he pointed out this section
                  still didn't actually show a dispatch rider, which was
                  the original ask from a few rounds back. Cropped to the
                  same panel ratio as the Interstate Transport photo below
                  (object-cover, bg-background, no white letterbox) rather
                  than the old object-contain/bg-surface treatment, since
                  this is a full photo now, not an isolated product shot. */}
              <div className="relative overflow-hidden rounded-2xl border border-border bg-background shadow-card">
                <Image
                  src="/marketing/dispatch-rider.jpg"
                  alt="An Ultimate Fleet Logistics dispatch rider making a delivery by motorcycle"
                  width={1176}
                  height={862}
                  className="h-auto w-full object-cover"
                />
              </div>
            </Reveal>
          </div>
        </section>

        {/* Interstate Transport */}
        <section id="interstate" className="scroll-mt-16 border-b border-border bg-surface">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
            <Reveal>
              <div className="relative overflow-hidden rounded-2xl border border-border bg-background shadow-card">
                <Image
                  src="/marketing/interstate-van.jpg"
                  alt="A Toyota Hiace, the vehicle type used for Ultimate Fleet Logistics interstate transport"
                  width={1176}
                  height={862}
                  className="h-auto w-full object-cover"
                />
              </div>
            </Reveal>
            <Reveal delay={120}>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-dark">
                <Bus className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-[24px] font-extrabold text-text">Interstate Transport</h2>
              <p className="mt-3 text-[14.5px] leading-relaxed text-text-soft">
                Passenger transport across interstate routes, run in partnership with a trusted
                operator using Toyota Hiace buses, the vehicle actually used for commuter and
                interstate travel on these routes, not a generic coach stand-in.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "Interstate and intercity routes, operated with a partner transport company",
                  "Hiace buses rather than private cars, for a full, shared passenger run",
                  "Route list and online booking are being finalized with the operator",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-text-soft">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-5 inline-flex w-fit items-center rounded-full bg-pending-soft px-2.5 py-1 text-[11px] font-semibold text-pending">
                Partner integration coming soon, enquire for current routes
              </p>
              <div className="mt-6">
                <Button asChild size="lg" className="hover:scale-[1.03]">
                  <a href={`mailto:${CONTACT_EMAIL}?subject=Interstate%20Transport%20Enquiry`}>View Routes / Book</a>
                </Button>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Fleet Platform */}
        <section id="fleet-platform" className="scroll-mt-16">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
            <Reveal className="order-2 lg:order-1">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-dark">
                <Truck className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              </div>
              <h2 className="mt-4 text-[24px] font-extrabold text-text">Fleet Platform</h2>
              <p className="mt-3 text-[14.5px] leading-relaxed text-text-soft">
                Our own investor and fleet management platform, not keke-only, it manages keke,
                bike, and car fleets under one account, built for existing fleet owners, investors,
                and corporate clients.
              </p>
              <ul className="mt-5 space-y-2.5">
                {[
                  "Live fleet visibility: see every keke, bike, and car in one place, with status for each",
                  "Investor payments and remittances tracked end to end through Paystack",
                  "Separate investor, admin, agent, and driver portals: role-based access, so nobody sees more than they should",
                  "New investor? Create an account straight from the sign-in page",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-text-soft">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2} aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <Button asChild size="lg" className="hover:scale-[1.03]">
                  <Link href="/sign-in">Access Platform</Link>
                </Button>
              </div>
            </Reveal>
            <Reveal delay={120} className="order-1 lg:order-2">
              {/* 2026-10-24: direct feedback not to crop this one, use it
                  as supplied. The old 1688x620 wide-banner box (left over
                  from the original composite image this replaced) forced
                  every replacement into that shape via object-cover;
                  switched to this photo's own native 1200x1200 square so
                  nothing gets cut off, object-contain instead of
                  object-cover since the box now matches the image's own
                  ratio exactly (no crop happens either way, contain is
                  just the correct semantic for "don't crop"). */}
              <div className="relative overflow-hidden rounded-2xl border border-border bg-accent-charcoal shadow-card">
                <Image
                  src="/marketing/fleet-trio.jpg"
                  alt="A keke, a dispatch motorcycle, and a car, the fleet types managed on the platform"
                  width={1200}
                  height={1200}
                  className="h-auto w-full object-contain"
                />
              </div>
            </Reveal>
          </div>
        </section>

        {/* Back / CTA */}
        <section className="border-t border-border bg-surface">
          <Reveal className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-5 py-12 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[16px] font-extrabold text-text">Still have a question?</h2>
              <p className="mt-1 text-[13.5px] text-text-soft">Reach out directly and we&apos;ll get back to you.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="hover:scale-[1.03]">
                <Link href="/#services">Back to Homepage</Link>
              </Button>
              <Button asChild className="hover:scale-[1.03]">
                <a href={`mailto:${CONTACT_EMAIL}`}>Contact Us</a>
              </Button>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
