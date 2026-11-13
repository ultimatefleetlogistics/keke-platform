import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Package,
  Bus,
  Truck,
  Mail,
  ShoppingBag,
  TrendingUp,
  Wallet,
  ShieldCheck,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";

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

          {/* 2026-11-13: Keke / Tricycle, the client's requested
              centrepiece — see KEKE_OPTIONS's own comment above for the
              source and open questions on images/CTA.
              2026-11-13 (later same day): restyled off ServiceCard's
              bordered/shadowed, hover-lifting treatment per Saidu's own
              call — that hover behavior signals "clickable," which these
              three no longer are now that their CTA is gone. Matches
              FleetShowcase's bare floating-image treatment instead (same
              ground-shadow-blur + drop-shadow + group-hover scale), the
              existing precedent on this same page for purely
              informational vehicle imagery. */}
          <div className="mt-10">
            <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent-dark">
              Keke / Tricycle
            </p>
            <div className="mt-6 grid gap-8 sm:grid-cols-3">
              {KEKE_OPTIONS.map((option, i) => (
                <Reveal key={option.title} delay={i * 110} className="group flex flex-col items-center text-center">
                  <div className="relative flex h-32 w-full items-center justify-center sm:h-44">
                    <div className="absolute bottom-1 h-3 w-2/3 rounded-full bg-accent-charcoal/15 blur-md transition-all duration-300 ease-out group-hover:w-3/4 group-hover:bg-accent-charcoal/25" />
                    <Image
                      src={option.image}
                      alt=""
                      width={477}
                      height={523}
                      className="relative h-full w-full object-contain drop-shadow-xl transition-transform duration-300 ease-out group-hover:scale-[1.06]"
                    />
                  </div>
                  <div className="mt-4 flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent-dark transition-transform duration-300 group-hover:scale-110">
                    <option.icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                  </div>
                  <h3 className="mt-3 text-[15px] font-extrabold text-text">{option.title}</h3>
                  <p className="mt-1.5 max-w-[230px] text-[13.5px] leading-relaxed text-text-soft">
                    {option.description}
                  </p>
                </Reveal>
              ))}
            </div>
          </div>

          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
        {/* 2026-11-13: rebuilt entirely with the client's exact Why
            Choose Us wording, pasted in full by Saidu. Dropped the old
            photo-backdrop banner treatment (interstate-bus.jpg + dark
            overlay) — that was sized and contrasted for one short line
            of white text over a photo, not an intro paragraph plus four
            feature blocks; a plain surface section, same convention as
            TechSection/AudienceSection right above it, is what actually
            holds this much copy legibly. bg-background (not bg-surface)
            specifically so it contrasts with AudienceSection just above
            it — TechSection and AudienceSection already sit back to back
            as two bg-surface sections with only their border-y lines
            between them; stacking a third same-colored section here
            would run three together. Confirmed via a repo-wide
            search: public/marketing/interstate-bus.jpg is now unused by
            any page — left on disk rather than deleted, since this
            bridge has no delete permission on Saidu's machine from
            here anyway (same situation as van.png, see
            fleet-showcase.tsx's own comment). */}
        <section className="border-t border-border bg-background">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <Reveal>
              <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent">Why Choose Us</p>
              <h2 className="mt-2 max-w-2xl text-[26px] font-extrabold leading-tight text-text">
                Why Choose Ultimate Fleet Logistics?
              </h2>
              <p className="mt-4 max-w-2xl text-[14.5px] leading-relaxed text-text-soft">{WHY_CHOOSE_INTRO}</p>
            </Reveal>

            <div className="mt-10 grid gap-5 sm:grid-cols-2">
              {WHY_CHOOSE_FEATURES.map((feature, i) => (
                <Reveal key={feature.title} delay={i * 110}>
                  <div className="flex h-full items-start gap-4 rounded-2xl border border-border bg-surface p-5 shadow-card">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-dark">
                      <feature.icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-[14.5px] font-extrabold text-text">{feature.title}</h3>
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-soft">{feature.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={440} className="mt-8 rounded-2xl bg-accent-charcoal px-6 py-6 sm:px-8">
              <p className="text-[12.5px] font-bold uppercase tracking-[0.15em] text-accent">
                More Than Transportation
              </p>
              <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-white/85">
                Our services extend beyond tricycles to include bikes, cars, delivery services and
                interstate transportation.
              </p>
            </Reveal>

            <Reveal delay={440}>
              <Button asChild size="lg" className="mt-8 hover:scale-[1.03]">
                <a href={`mailto:${CONTACT_EMAIL}?subject=Partnership%20Enquiry`}>Partner With Us</a>
              </Button>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        {/* 2026-11-13: see FAQS's own comment above — client's exact
            wording, placed right after Why Choose Us per the source
            recommendation. bg-surface so it contrasts with Why Choose
            Us's bg-background just above it and the Final CTA strip's
            bg-background right below. Plain <details>/<summary>, no JS
            state needed — same accordion pattern already used on
            app/admin/audit-log/page.tsx, just styled for the public
            site instead of the internal one. */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-3xl px-5 py-20">
            <Reveal>
              <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent">FAQ</p>
              <h2 className="mt-2 text-[26px] font-extrabold text-text">Frequently Asked Questions</h2>
            </Reveal>
            <div className="mt-8 flex flex-col gap-3">
              {FAQS.map((faq, i) => (
                <Reveal key={faq.question} delay={i * 80}>
                  <details className="group rounded-2xl border border-border bg-background p-5 [&::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[14.5px] font-extrabold text-text marker:content-none">
                      {faq.question}
                      <ChevronDown
                        className="h-4 w-4 shrink-0 text-text-faint transition-transform duration-200 group-open:rotate-180"
                        aria-hidden="true"
                      />
                    </summary>
                    <p className="mt-3 text-[13.5px] leading-relaxed text-text-soft">{faq.answer}</p>
                  </details>
                </Reveal>
              ))}
            </div>
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
 * 2026-11-13: FAQ content, the client's exact wording, pasted in full by
 * Saidu, same source thread as WHY_CHOOSE_FEATURES above — the original
 * recommendation from that thread ("Habitat Ultimate Fleet MODERNGAZE")
 * was explicit: "let the FAQs answer the questions that might stop
 * someone from making an enquiry," which is why this sits right after
 * Why Choose Us and right before the final CTA, on both this page and
 * the /services page's own copy.
 */
const FAQS = [
  {
    question: "What services does Ultimate Fleet Logistics offer?",
    answer:
      "We provide tricycle sales, fleet management, tricycle investment arrangements, hire-purchase options, delivery services and interstate transportation.",
  },
  {
    question: "Can I invest in a tricycle without managing its daily operations?",
    answer:
      "Yes. Through our tricycle investment arrangement, clients can fund a tricycle while Ultimate Fleet Logistics handles the agreed operational and fleet management responsibilities.",
  },
  {
    question: "How do investors receive their payments?",
    answer:
      "Investors receive weekly payments in accordance with their agreed investment terms and payment schedule. Payments commence one week after the agreed commencement date.",
  },
  {
    question: "How long does a tricycle investment arrangement last?",
    answer:
      "The duration depends on the selected investment arrangement and is clearly stated in the applicable investment agreement.",
  },
  {
    question: "Can I monitor my investment?",
    answer:
      "Yes. Our investor platform provides access to relevant investment information, payment records and fleet performance updates, subject to the features available to your account.",
  },
  {
    question: "How can I get started?",
    answer:
      "Getting started is simple. Contact our team to discuss available tricycle investment opportunities, understand the applicable terms and complete the necessary documentation.",
  },
];

/**
 * 2026-11-13: Why Choose Us content, the client's exact wording, pasted
 * in full by Saidu rather than paraphrased. Replaces the old short
 * banner copy ("Technology. Reliability. Partnership.") entirely — see
 * the section itself, below, for the layout change that came with it
 * (dropped the photo-backdrop banner treatment for a plain content
 * section, since that backdrop was sized for one short line, not an
 * intro paragraph plus four feature blocks).
 */
const WHY_CHOOSE_INTRO =
  "At Ultimate Fleet Logistics, we combine practical fleet management, structured investment opportunities and reliable operational support to create value for individuals, businesses and fleet owners.";

const WHY_CHOOSE_FEATURES = [
  {
    icon: TrendingUp,
    title: "Structured Investment Opportunities",
    body: "Explore tricycle investment opportunities with clearly defined payment arrangements and documented agreements.",
  },
  {
    icon: Truck,
    title: "Professional Fleet Management",
    body: "We coordinate tricycle operations, rider supervision and fleet activities to support efficient day-to-day management.",
  },
  {
    icon: SlidersHorizontal,
    title: "Flexible Ownership Options",
    body: "Whether you want to purchase a tricycle for personal or commercial use, invest in one, or acquire one through hire purchase, we provide options to suit different needs.",
  },
  {
    icon: ShieldCheck,
    title: "Transparent Records and Accountability",
    body: "We place importance on proper documentation, payment monitoring and organised operational records.",
  },
];

/**
 * 2026-11-13: added per the client's direct request, relayed by Saidu
 * from a WhatsApp exchange — three ways to engage with a tricycle
 * specifically, shown as its own labeled "Keke / Tricycle" row leading
 * the Our Services section (the client's own wording was "Our Service...
 * under 'KEKE/TRICYCLE'"). Copy is the client's exact wording, confirmed
 * word-for-word from that chat, not paraphrased.
 *
 * 2026-11-13 (later same day): the client confirmed these three are
 * purely informational, no enquiry link at all — dropped `cta`/`href`
 * entirely rather than leaving a mailto in place. ServiceCard's CTA row
 * just doesn't render without them (see that component's own comment).
 * `image` still reuses the same /fleet/keke.png cutout for all three as
 * a placeholder — still no distinct per-card photo on file.
 */
const KEKE_OPTIONS = [
  {
    icon: ShoppingBag,
    title: "Purchase",
    description: "Own a tricycle for personal or commercial use.",
    image: "/fleet/keke.png",
  },
  {
    icon: TrendingUp,
    title: "Invest",
    description: "Explore tricycle investment arrangements with managed operations.",
    image: "/fleet/keke.png",
  },
  {
    icon: Wallet,
    title: "Hire Purchase",
    description: "Explore structured payment options for acquiring a tricycle.",
    image: "/fleet/keke.png",
  },
];

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
// 2026-11-13: reordered per the client's direct request (relayed by
// Saidu) — keke/tricycle fleet management is the business's primary
// focus, so Fleet Platform leads the list now instead of trailing it.
// Delivery Services and Interstate Transport keep their relative order,
// just pushed down one slot each.
const SERVICES = [
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
    //
    // 2026-11-13: TODO — the client asked this card's full detail page
    // (/services#fleet-platform) to lead with a STANDALONE keke image,
    // not this trio, since keke is the business's primary focus. Pending
    // confirmation on whether to reuse the existing AI-generated
    // /fleet/keke.png or wait for a real photo Saidu is deciding on. This
    // homepage card's own image is left as the trio for now since it's
    // meant as a quick "all three vehicle types" summary, not the
    // keke-specific "closer look" — revisit together with the /services
    // page change once the keke image question is settled.
    image: "/marketing/fleet-trio-cutout.png",
    pending: false,
  },
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
];
