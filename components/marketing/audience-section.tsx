import type { ComponentType } from "react";

import { Briefcase, Bus, Building2, Package } from "lucide-react";

import { KekeIcon } from "@/components/design-system/keke-icon";
import { Reveal } from "@/components/marketing/reveal";

/**
 * Module: public homepage. "Who We Serve" section, added 2026-10-22 to
 * match the reference layout Saidu sent. Five audience types, matching
 * the three real service lines plus the investor/corporate angle —
 * "Logistics Partners" (from the original website-brief mockup) was
 * deliberately left out here too, consistent with it being dropped as
 * its own service card earlier, see claude/client-decisions-log.md.
 */
// Typed to only require `className` — the one prop every icon here
// actually gets passed below — since KekeIcon's own prop type is
// stricter than lucide-react's LucideIcon and doesn't declare the
// DOM attributes (aria-hidden, strokeWidth) a generic render would
// otherwise try to forward to both icon types uniformly.
const AUDIENCES: { icon: ComponentType<{ className?: string }>; title: string; body: string }[] = [
  { icon: Package, title: "Delivery Customers", body: "Individuals & businesses" },
  { icon: Bus, title: "Interstate Passengers", body: "Travel safely & comfortably" },
  { icon: Building2, title: "Fleet Owners / Investors", body: "Operate or invest in fleets" },
  { icon: KekeIcon, title: "Keke Drivers", body: "Join our growing network" },
  { icon: Briefcase, title: "Corporate Clients", body: "Tailored logistics & fleet solutions" },
];

export function AudienceSection() {
  return (
    <section id="about" className="border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-20">
        <Reveal>
          <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent">Our Audience</p>
          <h2 className="mt-2 text-[26px] font-extrabold text-text">Who We Serve</h2>
          <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-text-soft">
            We work with individuals, businesses, and partners across different sectors.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {AUDIENCES.map((item, i) => (
            <Reveal key={item.title} delay={i * 80} className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-white transition-transform duration-300 hover:scale-110 hover:rotate-6">
                <item.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-3 text-[13.5px] font-extrabold text-text">{item.title}</h3>
              <p className="mt-1 text-[12px] leading-snug text-text-soft">{item.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
