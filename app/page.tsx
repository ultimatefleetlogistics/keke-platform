import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Package, Bus, Truck, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter, CONTACT_EMAIL } from "@/components/marketing/site-footer";
import { ServiceCard } from "@/components/marketing/service-card";
import { TechSection } from "@/components/marketing/tech-section";
import { AudienceSection } from "@/components/marketing/audience-section";
import { FleetShowcase } from "@/components/marketing/fleet-showcase";
import { TrustStrip } from "@/components/marketing/trust-strip";
import { Reveal } from "@/components/marketing/reveal";
import { resolvePortalDestination } from "@/lib/actions/auth";

/**
 * Module: public homepage. "/" used to be a blind redirect(/sign-in) —
 * fine while this was only ever a signed-in app, wrong now that it's
 * also Ultimate Fleet Logistics' public corporate hub (see
 * claude/feature-brainstorm-outcomes.md and the website-brief decision
 * logged 2026-10-22): a signed-out visitor should see the company and
 * its services, not get bounced straight to a login form.
 *
 * A signed-in visitor is different — they almost certainly meant to
 * reach their own dashboard, not browse the marketing site, so this
 * reuses resolvePortalDestination() (the exact same function
 * /sign-in's own server action calls after a successful login,
 * lib/actions/auth.ts) to send them straight there. Anyone it can't
 * resolve a destination for — signed out, or a "path" the lookup
 * couldn't give one to — falls through to the public page below rather
 * than seeing a raw error, which matches how this page is meant to
 * behave for the general public.
 */
export default async function HomePage() {
  const destination = await resolvePortalDestination();
  if ("path" in destination) {
    redirect(destination.path);
  }

  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-accent-charcoal">
          {/* 2026-10-22: full-bleed again, per Saidu's direct "the hero
              image should fill the entire section rather [than] caving
              it out" — this had briefly been a contained two-column
              panel over resolution concerns (the supplied photo is
              native ~757x512). Fixed by upscaling it instead of shrinking
              the layout: public/marketing/fleet-hero-trio.jpg is now a
              Lanczos-upscaled + lightly sharpened 2200px-wide version of
              the same photo (see the image-sourcing notes in the chat for
              how it was built), full-bleed with the same dark-left
              gradient this hero used before, so the headline stays
              readable over it.
              2026-10-23: that gradient was lightened on request ("a
              little lighter... but make the text readable") — each stop
              dropped roughly 15-20 points. A text-shadow was added to the
              headline/body copy below to hold readability at the lower
              opacity instead of leaning on a darker overlay for it.
              2026-10-24: swung back the other way per direct feedback
              ("a bit too light... make them a bit dim") and switched the
              tint from --accent-charcoal (brand navy, now meant for flat
              panels only) to --photo-overlay (near-black, barely tinted)
              — a flat navy wash read as an odd color cast over the photo
              rather than a deliberate dim, see that token's own comment
              in globals.css. Stops went from 75/55/10 to 88/68/22. */}
          <Image
            src="/marketing/fleet-hero-trio.jpg"
            alt="A keke, a dispatch motorcycle, and a passenger car, the vehicle types Ultimate Fleet Logistics manages"
            fill
            priority
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-photo-overlay/88 via-photo-overlay/68 to-photo-overlay/22" />

          <div className="relative mx-auto max-w-6xl px-5 py-24 sm:py-28">
            <p className="animate-hero-fade-up text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">
              Logistics &middot; Transport &middot; Technology
            </p>
            <h1
              className="animate-hero-fade-up mt-4 max-w-2xl text-[34px] font-extrabold leading-[1.15] text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.55)] sm:text-[44px]"
              style={{ animationDelay: "90ms" }}
            >
              Moving People, Connecting Businesses.{" "}
              <span className="text-accent">Managing Fleets.</span>
            </h1>
            <p
              className="animate-hero-fade-up mt-5 max-w-xl text-[15px] leading-relaxed text-white/85 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]"
              style={{ animationDelay: "180ms" }}
            >
              Ultimate Fleet Logistics Ltd provides reliable and efficient logistics and fleet
              solutions, from deliveries to interstate transport, and smart fleet management for
              keke, bikes, and cars.
            </p>
            <div className="animate-hero-fade-up mt-8 flex flex-wrap gap-3" style={{ animationDelay: "270ms" }}>
              <Button asChild size="lg" className="hover:scale-[1.03]">
                <a href="#services">Explore Our Services</a>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/25 bg-transparent text-white hover:scale-[1.03] hover:bg-white/10"
              >
                {/* 2026-10-28: was href="#contact", a scroll down to the
                    footer rather than anything that actually contacted
                    anyone — Saidu pointed out "Contact Us" should contact
                    us. Now a real mailto, same pattern as "Partner With
                    Us"/"Get in Touch" below. This needs no Resend
                    integration: a mailto link opens the visitor's own
                    mail client client-side, nothing is sent through our
                    backend, so it works today regardless of whether
                    Resend is configured yet. */}
                <a href={`mailto:${CONTACT_EMAIL}`}>Contact Us</a>
              </Button>
            </div>
          </div>
        </section>

        {/* 2026-10-29: trust strip, right under the hero — see that
            component's own comment for why it's built from facts already
            true today (CAC, Paystack) rather than invented numbers. */}
        <TrustStrip />

        {/* One Platform — keke / bike / car, floating cutouts */}
        <FleetShowcase />

        {/* Services */}
        <section id="services" className="mx-auto max-w-6xl px-5 py-20">
          <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent">Our Services</p>
              <h2 className="mt-2 max-w-xl text-[26px] font-extrabold text-text">
                Comprehensive Fleet &amp; Logistics Solutions
              </h2>
              <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-text-soft">
                We provide a range of services designed to keep people and goods moving: safely,
                efficiently, and on time.
              </p>
            </div>
            {/* 2026-10-22: added per Saidu's request — a quick 3-card
                summary here, a fuller explanation of each service on its
                own page (app/services/page.tsx). Each card's own "Full
                service details" link (below) lands on that same page's
                matching section. */}
            <Link
              href="/services"
              className="group/view inline-flex shrink-0 items-center gap-1.5 text-[13.5px] font-bold text-accent hover:text-accent-dark"
            >
              View All Services{" "}
              <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover/view:translate-x-1">
                &rarr;
              </span>
            </Link>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service, i) => (
              <Reveal key={service.title} delay={i * 110} className="h-full">
                <ServiceCard {...service} />
              </Reveal>
            ))}
          </div>
        </section>

        {/* Smart Fleet Management */}
        <TechSection />

        {/* Who We Serve */}
        <AudienceSection />

        {/* Why choose us */}
        <section className="relative overflow-hidden bg-accent-charcoal">
          {/* 2026-10-22: swapped the background photo from fleet-lineup.jpg
              (reused twice already — the same shot as the old Fleet
              Platform card art) to public/marketing/interstate-bus.jpg, a
              higher-resolution intercity-coach photo Saidu supplied
              specifically for this folder. It's mood/texture for a CTA
              banner, heavily overlaid, not a literal claim about the exact
              vehicle on any one route.
              2026-10-23: overlay lightened (same request as the hero
              above) from /85 to /60, text-shadow added to keep the
              heading/copy readable at the lower opacity.
              2026-10-24: darkened again to /72 and switched from
              --accent-charcoal to --photo-overlay, same reasoning as the
              hero's gradient above — see that token's comment in
              globals.css. The section's own bg-accent-charcoal (behind
              the <Image>, visible only as a flash before it loads) stays
              navy on purpose, that's a flat panel, not a photo wash. */}
          <Image
            src="/marketing/interstate-bus.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-photo-overlay/72" />

          <div className="relative mx-auto max-w-6xl px-5 py-20">
            <Reveal>
              <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent [text-shadow:0_1px_8px_rgba(0,0,0,0.5)]">Why Choose Us</p>
              <h2 className="mt-2 max-w-lg text-[26px] font-extrabold leading-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.55)]">
                Technology. Reliability. Partnership.
              </h2>
              <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-white/85 [text-shadow:0_1px_10px_rgba(0,0,0,0.5)]">
                We combine technology and experience to deliver flexible, scalable, and
                cost-effective logistics and fleet solutions.
              </p>
              <Button asChild size="lg" className="mt-6 hover:scale-[1.03]">
                <a href={`mailto:${CONTACT_EMAIL}?subject=Partnership%20Enquiry`}>Partner With Us</a>
              </Button>
            </Reveal>
          </div>
        </section>

        {/* Final CTA strip */}
        <section className="bg-background">
          <Reveal className="mx-auto flex max-w-6xl flex-col items-start gap-6 border-t border-border px-5 py-12 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-dark">
                <Mail className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-[18px] font-extrabold text-text">Let&apos;s Move Forward Together</h2>
                <p className="mt-1 max-w-md text-[13.5px] leading-relaxed text-text-soft">
                  Have a project, partnership, or service enquiry? We&apos;d love to hear from you.
                </p>
              </div>
            </div>
            <Button asChild size="lg" className="w-full hover:scale-[1.03] sm:w-auto">
              <a href={`mailto:${CONTACT_EMAIL}`}>Get in Touch</a>
            </Button>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

/**
 * Logistics Partners (from the website-brief visual concept) was
 * deliberately dropped here per the 2026-10-22 decision, see
 * claude/client-decisions-log.md. Fleet Solutions started as its own
 * fourth card too, but the client found it redundant with Fleet
 * Platform and asked for one card instead — see that entry's own
 * comment below. Delivery Services and Interstate Transport are
 * `pending: true`: the real partner/vendor links weren't confirmed with
 * the client as of this decision, so both render a "coming soon" badge
 * with a mailto fallback (see ServiceCard) instead of a fabricated or
 * dead URL. Flip `pending` to `false` and swap `href` to the real link
 * for each one as soon as it's confirmed.
 *
 * 2026-10-22 (later): card images swapped from full-bleed contextual
 * photos to background-removed cutouts (public/fleet/), per Saidu's
 * request. Worth flagging the trade-off honestly: Interstate Transport's
 * cutout is the SAME real Hiace photo as before with the background
 * removed, no authenticity lost. Delivery Services moved off the real
 * dispatch-bike.jpg photo onto an AI-generated motorcycle cutout
 * for visual consistency with the other cards — still not a real photo
 * of the actual bike model. Fleet Platform's image is a new composite
 * of all three cutouts side by side (public/marketing/fleet-trio-
 * cutout.png), mixing the real van cutout with the two AI vehicle
 * renders.
 *
 * 2026-10-29: Delivery Services' image moved from /fleet/bike.png to
 * /fleet/dispatch-rider.png. Round two of the FleetShowcase rework
 * (see that component's own comment) reassigned bike.png back to a
 * plain parked bike with no rider and moved the branded rider-in-
 * action cutout to its own dispatch-rider.png filename — a parked bike
 * is a weaker image for a card about delivery than an actual rider
 * making a delivery, so this card follows the rider, not the filename
 * it used to share with it. Still the same AI-generated image, same
 * not-a-real-photo caveat as before.
 */
const SERVICES = [
  {
    icon: Package,
    title: "Delivery Services",
    description:
      "Parcel, business, and individual deliveries by dispatch rider: fast, reliable, and trackable.",
    cta: "Book / Enquire",
    href: `mailto:${CONTACT_EMAIL}?subject=Delivery%20Services%20Enquiry`,
    detailsHref: "/services#delivery",
    // AI-generated rider-in-action cutout, not a photo of the actual
    // bike model (that was dispatch-bike.jpg, now unused). See the
    // 2026-10-29 note in the comment above this list.
    image: "/fleet/dispatch-rider.png",
    pending: true,
  },
  {
    icon: Bus,
    title: "Interstate Transport",
    description:
      "Passenger transport across interstate routes, run in partnership with a trusted operator.",
    cta: "View Routes / Book",
    href: `mailto:${CONTACT_EMAIL}?subject=Interstate%20Transport%20Enquiry`,
    detailsHref: "/services#interstate",
    // Same real Toyota Hiace photo as before, background removed — the
    // vehicle type actually used for interstate/commuter transport in
    // Nigeria, supplied by Saidu, not stock art.
    image: "/fleet/van.png",
    pending: true,
  },
  {
    icon: Truck,
    // 2026-10-22: renamed from "Keke Fleet Platform" — the platform isn't
    // keke-only, it manages keke, bike, and car fleets, per the client's
    // correction. "Fleet Platform" is accurate across all three.
    //
    // 2026-10-22 (later same day): this card was "Fleet Solutions" was
    // a separate card too, but the client pointed out they read as the
    // same thing — merged into one. "Access Platform" (not a mailto) is
    // the single CTA: /sign-in already has "New investor? Create an
    // account" for anyone arriving as a prospective fleet owner/investor
    // rather than an existing user, so this one destination covers both
    // without a second, redundant "Get in Touch" card.
    title: "Fleet Platform",
    description:
      "Manage and grow a keke, bike, or car fleet with our own investor and fleet management platform, built for existing fleet owners, investors, and corporate clients alike.",
    cta: "Access Platform",
    href: "/sign-in",
    detailsHref: "/services#fleet-platform",
    // Three cutouts side by side (keke / bike / van) — visibly backs up
    // "all three vehicle types" rather than just naming them.
    image: "/marketing/fleet-trio-cutout.png",
    pending: false,
  },
];
