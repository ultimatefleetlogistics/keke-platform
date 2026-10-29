import Image from "next/image";

import { Reveal } from "@/components/marketing/reveal";

/**
 * Module: public homepage. Added 2026-10-22, directly off Saidu's
 * repeated point that this platform isn't keke-only — it manages keke,
 * bike, and car/van fleets — and his follow-up "stingy with images" note.
 * Three vehicle cutouts, gently floating, instead of another paragraph
 * making the same point in words.
 *
 * The keke render is AI-generated marketing art Saidu supplied himself
 * (public/fleet/keke.png) — not real photography, labeled only by
 * vehicle type, never claimed as "our actual unit."
 *
 * 2026-10-28, round one: bike.png and van.png were swapped for a new
 * rider-on-bike cutout and a new sedan cutout, overwriting the original
 * plain-bike and bus images with no backup kept first — a mistake,
 * caught when Saidu asked for the originals back a few minutes later.
 *
 * 2026-10-28, round two: Saidu resent the two originals (same files, same
 * bytes, confirmed against what round one had processed) plus the new
 * rider and sedan again, and asked for all five vehicles on the section
 * at once rather than a 3-for-3 swap. Filenames, to keep every slot
 * unambiguous and avoid a repeat of the round-one overwrite:
 *  - keke.png — unchanged, still the original AI-generated keke render
 *    Saidu supplied at the start (not real photography, flagged then,
 *    labeled only by vehicle type).
 *  - bike.png — restored to the plain red/empty dispatch bike (the
 *    original content this filename held before round one), already a
 *    clean transparent cutout, just resized/cropped to this section's
 *    900px-max convention.
 *  - bus.png — new filename, the white Hiace-style bus/van cutout
 *    Saidu supplied, same treatment as bike.png above.
 *  - sedan.png — the white sedan from round one, moved here from
 *    van.png so that filename doesn't collide with the restored bus.
 *    Likely AI-generated concept art, not a literal photo of an owned
 *    vehicle — flagged, not yet confirmed either way.
 *  - dispatch-rider.png — the branded rider-on-bike cutout from round
 *    one, moved here from bike.png for the same reason. Cut out with
 *    OpenCV GrabCut (the source had no alpha channel, unlike the other
 *    four). Same AI-generation flag as sedan.png, same not-yet-confirmed
 *    status.
 * van.png itself is now unused by this component but was left on disk
 * rather than deleted (this bridge has no delete permission on Saidu's
 * machine from here anyway).
 */
const FLEET = [
  { src: "/fleet/keke.png", label: "Keke / Tricycle", width: 477, height: 523, float: "animate-float-a" },
  { src: "/fleet/bike.png", label: "Bike", width: 900, height: 846, float: "animate-float-b" },
  { src: "/fleet/bus.png", label: "Bus", width: 900, height: 733, float: "animate-float-c" },
  { src: "/fleet/sedan.png", label: "Car", width: 900, height: 600, float: "animate-float-a" },
  { src: "/fleet/dispatch-rider.png", label: "Dispatch Rider", width: 900, height: 761, float: "animate-float-b" },
];

export function FleetShowcase() {
  return (
    <section className="overflow-hidden border-y border-border bg-surface">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:py-20">
        <Reveal className="text-center">
          <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent">One Platform</p>
          <h2 className="mt-2 text-[26px] font-extrabold text-text">Keke. Bike. Car. All Managed Here.</h2>
          <p className="mx-auto mt-3 max-w-xl text-[14.5px] leading-relaxed text-text-soft">
            Ultimate Fleet Logistics isn&apos;t a keke-only platform, it&apos;s the hub for every
            vehicle type we run: tricycles, dispatch bikes, and cars.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-6">
          {/* 2026-10-28, round one: added a hover response (scale up
              slightly, ground shadow widens and darkens, label brightens)
              on top of the existing float + scroll-reveal — "group" on
              the Reveal wrapper lets the image, shadow, and label all
              react together to one hover on the card, rather than each
              needing its own listener. Switched the image from w-auto to
              w-full: w-auto let a wide image (the rider/sedan cutouts are
              both landscape-shaped, more so than keke/bike/bus) size
              itself past its grid column on narrow screens, since nothing
              capped its width — w-full plus object-contain keeps every
              cutout correctly bounded by its own column at any screen
              size, keke's portrait shape included.

              Round two: grid went from a fixed 3-up to 3-up on mobile /
              5-up from sm: up, now that there are five vehicles instead
              of three — gap tightened a bit (gap-10 at 5 columns would
              have pushed the row past this section's max-w-6xl comfort
              margin) rather than shrinking the vehicle boxes themselves. */}
          {FLEET.map((item, i) => (
            <Reveal key={item.label} delay={i * 130} className="group flex flex-col items-center">
              <div className="relative flex h-32 w-full items-center justify-center sm:h-52">
                <div className="absolute bottom-1 h-3 w-2/3 rounded-full bg-accent-charcoal/15 blur-md transition-all duration-300 ease-out group-hover:w-3/4 group-hover:bg-accent-charcoal/25 sm:bottom-2" />
                <Image
                  src={item.src}
                  alt={item.label}
                  width={item.width}
                  height={item.height}
                  className={`relative h-full w-full object-contain drop-shadow-xl transition-transform duration-300 ease-out group-hover:scale-[1.06] ${item.float}`}
                />
              </div>
              <p className="mt-3 text-center text-[12.5px] font-bold text-text-soft transition-colors duration-200 group-hover:text-text sm:text-[13.5px]">
                {item.label}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
