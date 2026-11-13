import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  Package,
  Bus,
  Truck,
  CheckCircle2,
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
import { Reveal } from "@/components/marketing/reveal";

/**
 * 2026-11-13: same three Keke/Tricycle options as app/page.tsx's
 * KEKE_OPTIONS (that file's own comment has the full context: client's
 * exact wording, source WhatsApp thread, and the open questions on
 * per-card images and the "Invest" CTA target). Kept as its own copy
 * here rather than a shared import since this page already duplicates
 * SERVICES separately from the homepage rather than importing it —
 * following this file's existing convention, not introducing a new one.
 *
 * 2026-11-13 (later same day): client confirmed these three are purely
 * informational, no enquiry link — `cta`/`href` dropped entirely rather
 * than left as a mailto. Same change made in app/page.tsx's own copy.
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
 * 2026-11-13: same Why Choose Us content as app/page.tsx's own copy —
 * that file's comment has the full context (client's exact wording,
 * pasted in full). This page had no Why Choose Us section at all before
 * today; added at the end, after every service is explained, as a
 * closing credibility section ahead of the Back/CTA strip — same spot
 * in the page flow the homepage uses it (after the service/capability
 * sections, before the final CTA).
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
 * 2026-11-13: same FAQ content as app/page.tsx's own copy (that file's
 * comment has the full context — client's exact wording, placed right
 * after Why Choose Us per the original recommendation to let the FAQs
 * answer the questions that might stop someone from making an enquiry).
 * Same spot here: right after Why Choose Us, right before Back/CTA.
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

export const metadata: Metadata = {
  title: "Our Services | Ultimate Fleet Logistics",
  description:
    "A closer look at Ultimate Fleet Logistics' fleet management platform, delivery services, and interstate transport.",
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

        {/* Keke / Tricycle */}
        {/* 2026-11-13: the client's requested centrepiece, leading the
            page ahead of even Fleet Platform — see KEKE_OPTIONS's own
            comment above for source and open questions.
            2026-11-13 (later same day): restyled off ServiceCard's
            bordered/hover-lifting treatment per Saidu's call — same
            reasoning and same bare floating-image style as app/page.tsx's
            own copy of this section, matching FleetShowcase's precedent.
            2026-11-13 (later still): eyebrow changed from "Our Services"
            to "We Do It All" — Saidu flagged that this section and the
            intro section right above it both said "OUR SERVICES," which
            read as repetitive back to back on the page. */}
        <section id="keke-tricycle" className="scroll-mt-16 border-b border-border">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
            <Reveal>
              <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent">We Do It All</p>
              <h2 className="mt-2 text-[24px] font-extrabold text-text">Keke / Tricycle</h2>
            </Reveal>
            <div className="mt-8 grid gap-8 sm:grid-cols-3">
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
        </section>

        {/* Fleet Platform */}
        {/* 2026-11-13: moved to lead the page (was last) per the client's
            direct request, relayed by Saidu — keke/tricycle fleet
            management is the business's primary focus, so this section
            goes first now, Delivery Services and Interstate Transport
            follow in their previous relative order. See app/page.tsx's
            SERVICES array, reordered the same way and on the same date. */}
        <section id="fleet-platform" className="scroll-mt-16 border-b border-border bg-surface">
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
                  just the correct semantic for "don't crop").
                  2026-11-13: TODO — client wants this swapped for a
                  STANDALONE keke photo with more supporting detail, since
                  keke is the business's primary focus, not this
                  keke+bike+car trio. Pending: confirm with Saidu whether
                  to reuse the existing AI-generated /fleet/keke.png now or
                  wait for a real keke photo — see chat thread 2026-11-13.
                  Left as the trio image until that's settled. */}
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

        {/* Why Choose Us */}
        {/* 2026-11-13: see WHY_CHOOSE_FEATURES's own comment above for
            context. bg-background (not bg-surface) so it contrasts with
            Interstate Transport's bg-surface right above it. */}
        <section className="border-t border-border bg-background">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
            <Reveal>
              <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent">Why Choose Us</p>
              <h2 className="mt-2 max-w-2xl text-[24px] font-extrabold leading-tight text-text">
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
          </div>
        </section>

        {/* FAQ */}
        {/* 2026-11-13: see FAQS's own comment above. bg-surface so it
            contrasts with Why Choose Us's bg-background right above it;
            Back/CTA right below switches to bg-background to keep the
            alternation going. */}
        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-3xl px-5 py-20">
            <Reveal>
              <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent">FAQ</p>
              <h2 className="mt-2 text-[24px] font-extrabold text-text">Frequently Asked Questions</h2>
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

        {/* Back / CTA */}
        <section className="border-t border-border bg-background">
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
