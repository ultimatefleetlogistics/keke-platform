import { BadgeCheck, Landmark, ShieldCheck } from "lucide-react";

import { Reveal } from "@/components/marketing/reveal";

/**
 * Module: public homepage. Added 2026-10-29, off Saidu's "the site
 * doesn't give a marketing vibe, feels thin" feedback — a slim trust
 * strip directly under the hero, before anything else asks for the
 * visitor's attention. Deliberately built from facts that are already
 * true today rather than invented numbers or quotes:
 *  - CAC Registered Business — the CAC certificate is in hand (see
 *    deployment-guide.md, Tier 1 Apple/Termii bullets), a real,
 *    checkable fact.
 *  - Paystack-Secured Payments — the Paystack business account is
 *    Pre-Approved and live-capable (deployment-guide.md, 2026-10-25),
 *    also real.
 *  - Role-Based Account Security — the platform's actual investor/
 *    admin/agent/driver portal separation, already stated plainly on
 *    both the homepage's Why Choose Us section and the About page.
 * "Built for scale from day one" is positioning copy, not a numeric
 * claim — deliberately NOT paired with a specific fleet-size or
 * deliveries-completed number, since neither is true yet (no live
 * transactions as of this date, see deployment-guide.md). A real
 * number can replace this copy the moment one exists; a testimonials
 * section was discussed for the same reason and intentionally left out
 * — Saidu asked for invented customer profiles, declined, see that
 * day's conversation. Revisit once there are real quotes to use.
 */
const TRUST_ITEMS = [
  { icon: BadgeCheck, label: "CAC Registered Business" },
  { icon: Landmark, label: "Paystack-Secured Payments" },
  { icon: ShieldCheck, label: "Account Security" },
];

export function TrustStrip() {
  return (
    <section className="border-b border-border bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-5">
        <Reveal className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p className="text-[13.5px] font-extrabold text-text">
            Built for scale from day one.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2.5 sm:justify-end">
            {TRUST_ITEMS.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-[12.5px] font-semibold text-text-soft">
                <item.icon className="h-4 w-4 shrink-0 text-accent" strokeWidth={1.8} aria-hidden="true" />
                {item.label}
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
