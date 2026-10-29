import { MapPin, ShieldCheck, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/marketing/reveal";

/**
 * Module: public homepage. "Smart Fleet Management" section, added
 * 2026-10-22 to match the reference layout Saidu sent (a laptop/tablet
 * mockup of a dashboard next to the copy). This deliberately does NOT
 * use a fake or mocked-up screenshot — there's no real screenshot of
 * the actual investor/admin dashboard available yet, and shipping a
 * generic stock dashboard image here would misrepresent what the real
 * product looks like, the same reasoning as the image-sourcing calls
 * made across SERVICES in app/page.tsx. The three rows below are real
 * capabilities of the actual app (see lib/actions/auth.ts for the
 * investor/admin/agent/driver portals, lib/payments/ for Paystack),
 * described honestly rather than illustrated with a fabricated UI.
 * Swap this for a real product screenshot (ask Saidu to grab one from
 * the live dashboard) once one exists.
 */
const CAPABILITIES = [
  {
    icon: MapPin,
    title: "Fleet visibility",
    body: "See every keke, bike, and car in one place, with live status for each.",
  },
  {
    icon: Wallet,
    title: "Secure payments",
    body: "Investor payments and remittances run through Paystack, tracked end to end.",
  },
  {
    icon: ShieldCheck,
    title: "Built-in accountability",
    body: "Role-based access for investors, agents, drivers, and staff, so nobody sees more than they should.",
  },
];

export function TechSection() {
  return (
    <section className="bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 lg:grid-cols-2 lg:items-center lg:gap-16">
        <Reveal className="order-2 lg:order-1">
          <div className="space-y-3 rounded-2xl border border-border bg-background p-2 shadow-card">
            {CAPABILITIES.map((item) => (
              <div
                key={item.title}
                className="flex items-start gap-4 rounded-xl p-4 transition-colors duration-200 hover:bg-accent-soft/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-dark">
                  <item.icon className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-[14px] font-extrabold text-text">{item.title}</h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-text-soft">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>

        <Reveal delay={120} className="order-1 lg:order-2">
          <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent">Our Technology</p>
          <h2 className="mt-2 text-[26px] font-extrabold leading-tight text-text">
            Smart Fleet Management for Greater Efficiency
          </h2>
          <p className="mt-4 text-[14.5px] leading-relaxed text-text-soft">
            Our own keke, bike, and car fleet management platform helps investors and fleet owners
            track, manage, and stay on top of their fleet in real time, for better visibility and
            more reliable returns.
          </p>
          <Button asChild size="lg" className="mt-6 hover:scale-[1.03]">
            <a href="/sign-in">Learn More About Fleet Management</a>
          </Button>
        </Reveal>
      </div>
    </section>
  );
}
