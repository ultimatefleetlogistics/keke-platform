import Image from "next/image";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

interface ServiceCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  cta: string;
  href: string;
  /**
   * Module: public homepage. Path under public/ for the card's header
   * tile. 2026-10-22: switched from a full-bleed contextual photo to a
   * background-removed vehicle cutout, centered on the card's own
   * charcoal tile (object-contain, not object-cover) — per Saidu's
   * request, "swap... use... those with out the background." See the
   * SERVICES list in app/page.tsx for which cutout is real (background
   * removed from an actual photo) versus AI-generated vehicle art.
   */
  image?: string;
  /**
   * Module: public homepage. True for a service line whose real partner
   * link hasn't been confirmed with the client yet (Delivery Services,
   * Interstate Transport at launch) — renders a "coming soon" badge and
   * a mailto fallback instead of a CTA link, so this never ships a dead
   * or fabricated vendor URL. Flip to false once the real link lands,
   * see the SERVICES list in app/page.tsx.
   */
  pending?: boolean;
  /**
   * Module: public homepage. 2026-10-22: added so this card's title can
   * also lead to the dedicated /services page's detail section for this
   * line, per Saidu's request for services to link through to a fuller
   * explanation rather than living only as a homepage summary. Separate
   * from `href` (the booking/access CTA) on purpose — this is a "read
   * more," not another way to book.
   */
  detailsHref?: string;
}

/**
 * Module: public homepage. 2026-10-22: restyled to match the reference
 * layout Saidu sent — the icon badge now sits as a ring cut into the
 * card, straddling the photo's bottom edge, and every CTA is a plain
 * text link with an arrow (no button) whether the card is pending or
 * not, instead of the old photo-then-button layout.
 *
 * 2026-10-22 (later): added a hover lift (card rises + shadow deepens)
 * plus a slow photo zoom-in behind an overflow-hidden wrapper —
 * `group`/`group-hover` so the image reacts to hovering the whole card,
 * not just itself. The lift+shadow both run off one explicit
 * `transition-[transform,box-shadow]` rather than Card's own base
 * `transition-shadow` plus a second `transition-transform` utility here
 * — `cn()` uses tailwind-merge, which treats those as the same
 * "transition-property" group and keeps only the last one, silently
 * dropping whichever loses (see the same note on components/ui/button.tsx).
 * Spelling both properties out in one utility avoids that.
 *
 * 2026-10-22 (later): the header tile switched from a full-bleed photo
 * (object-cover) to a centered, background-removed vehicle cutout
 * (object-contain) against the same charcoal tile plus a soft gold glow
 * behind it — a cleaner, more "product shot" look Saidu asked for over
 * the busier contextual photos.
 */
export function ServiceCard({
  icon: Icon,
  title,
  description,
  cta,
  href,
  image,
  pending = false,
  detailsHref,
}: ServiceCardProps) {
  return (
    <Card className="group relative flex h-full flex-col overflow-visible p-0 transition-[transform,box-shadow] duration-300 hover:-translate-y-1.5 hover:shadow-card-hover">
      <div className="relative h-40 w-full overflow-hidden rounded-t-2xl bg-accent-charcoal">
        {image ? (
          <>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(201,130,10,0.22),transparent_62%)]" />
            <Image
              src={image}
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-contain p-7 drop-shadow-xl transition-transform duration-700 ease-out group-hover:scale-110"
            />
          </>
        ) : null}
      </div>

      <div
        className="absolute left-6 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border-4 border-surface bg-accent text-white shadow-card transition-transform duration-300 group-hover:scale-110"
        style={{ top: "10rem" }}
      >
        <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
      </div>

      <div className="flex flex-1 flex-col gap-3 px-6 pb-6 pt-9">
        <div className="flex-1">
          <h3 className="text-[15px] font-extrabold text-text">{title}</h3>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-text-soft">{description}</p>
          {detailsHref ? (
            <Link
              href={detailsHref}
              className="mt-2 inline-flex items-center gap-1 text-[12px] font-bold text-text-faint transition-colors hover:text-accent"
            >
              Full service details <span aria-hidden="true">&rarr;</span>
            </Link>
          ) : null}
        </div>

        {pending ? (
          <span className="inline-flex w-fit items-center rounded-full bg-pending-soft px-2.5 py-1 text-[11px] font-semibold text-pending">
            Partner integration coming soon
          </span>
        ) : null}

        {href.startsWith("/") ? (
          <Link href={href} className="group/cta inline-flex items-center gap-1 text-[13.5px] font-bold text-accent hover:text-accent-dark">
            {cta}{" "}
            <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover/cta:translate-x-1">
              &rarr;
            </span>
          </Link>
        ) : (
          <a href={href} className="group/cta inline-flex items-center gap-1 text-[13.5px] font-bold text-accent hover:text-accent-dark">
            {cta}{" "}
            <span aria-hidden="true" className="inline-block transition-transform duration-200 group-hover/cta:translate-x-1">
              &rarr;
            </span>
          </a>
        )}
      </div>
    </Card>
  );
}
