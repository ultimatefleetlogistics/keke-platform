import type { VehicleType } from "@prisma/client";

import { cn } from "@/lib/utils";

/**
 * Module 42: flat, multi-color vehicle illustrations, the web sibling of
 * `keke-mobile/src/components/vehicle-icons.tsx`'s `VehicleTypeIllustration`
 * family (ported here shape for shape, same coordinates, same palette,
 * `<Svg>`/`<Path>`/etc. swapped for plain lowercase `<svg>`/`<path>`/etc.
 * since this runs in a browser, not react-native-svg). Direct feedback:
 * "the vehicle icon or image we use is showing on the mobile app but not
 * on the web", meaning the web app only ever had `VehicleTypeIcon`
 * (`vehicle-icons.tsx` in this folder), a small single-tone line glyph
 * meant for compact badges (a fleet detail header, a driver dashboard
 * tile), it was never meant to be the "picture of the vehicle" a fleet
 * or investment card wants. That one is untouched and still exactly
 * right for those compact spots. This file is the wide, landscape,
 * self-colored illustration for anywhere a specific vehicle is the
 * subject of the card, `components/fleet/keke-card.tsx` and the investor
 * dashboard's "My vehicles" cards.
 *
 * Every shape is drawn from scratch, not traced from or copied off a real
 * product photo, generic silhouettes rather than a specific
 * manufacturer's model, same reasoning the mobile file documents: it
 * stays clear of anyone's trademarked bodywork and fairly represents any
 * investor's actual vehicle regardless of brand.
 *
 * `viewBox` is a fixed 128x80 (8:5 landscape) on all three, so `className`
 * controls the rendered box (width via a Tailwind class, e.g. `w-24`) and
 * the SVG's own `preserveAspectRatio` (default) keeps the drawing
 * proportional inside it. No `color` prop, unlike `VehicleTypeIcon`,
 * these are self-colored illustrations, not a recolorable glyph.
 */
const VIEWBOX_WIDTH = 128;
const VIEWBOX_HEIGHT = 80;

interface IllustrationProps {
  className?: string;
}

export function KekeIllustration({ className }: IllustrationProps) {
  return (
    <svg className={cn("shrink-0", className)} viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} fill="none">
      <ellipse cx="66" cy="72" rx="54" ry="5" fill="#1F1A12" opacity="0.1" />

      <path d="M26 50 L33 22" stroke="#1F1A12" strokeWidth="5" strokeLinecap="round" />
      <path d="M22 22 L44 22" stroke="#1F1A12" strokeWidth="5" strokeLinecap="round" />

      <path d="M46 66 L46 32 Q46 24 54 24 L100 24 Q110 24 110 34 L110 66 Z" fill="#C9820A" />

      <path
        d="M48 26 Q49 14 62 14 L100 14 Q113 14 115 30 L108 30 Q106 20 97 20 L62 20 Q53 20 51 30 Z"
        fill="#1F1A12"
      />

      <path d="M52 30 L52 58 L69 58 L69 30 Z" fill="#F5E9D6" />
      <rect x="75" y="30" width="29" height="20" rx="2" fill="#F5E9D6" opacity="0.92" />

      <circle cx="26" cy="60" r="13" fill="#1F1A12" />
      <circle cx="26" cy="60" r="5.5" fill="#F5E9D6" />

      <circle cx="94" cy="68" r="13" fill="#1F1A12" />
      <circle cx="94" cy="68" r="5.5" fill="#F5E9D6" />
      <circle cx="112" cy="68" r="13" fill="#1F1A12" />
      <circle cx="112" cy="68" r="5.5" fill="#F5E9D6" />

      <circle cx="109" cy="40" r="3" fill="#FFE9A8" />
    </svg>
  );
}

export function BikeIllustration({ className }: IllustrationProps) {
  return (
    <svg className={cn("shrink-0", className)} viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} fill="none">
      <ellipse cx="64" cy="72" rx="54" ry="5" fill="#1F1A12" opacity="0.1" />

      <path d="M26 52 Q28 36 42 36 L42 42 Q32 42 30 54 Z" fill="#1F1A12" />

      <path d="M32 38 Q34 32 42 32 L54 32 L54 40 L34 40 Q31 40 32 38 Z" fill="#1F1A12" />

      <path d="M50 38 Q50 22 66 22 Q80 22 80 33 Q80 40 71 40 L54 40 Q50 40 50 38 Z" fill="#C9820A" />

      <rect x="54" y="44" width="22" height="15" rx="3" fill="#1F1A12" />
      <rect x="58" y="49" width="14" height="3" fill="#C9820A" opacity="0.75" />

      <path d="M78 33 L100 52" stroke="#1F1A12" strokeWidth="6" strokeLinecap="round" />
      <path d="M92 30 L104 24" stroke="#1F1A12" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M78 33 L92 30" stroke="#1F1A12" strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="88" cy="32" r="3.4" fill="#FFE9A8" />

      <path d="M22 56 L52 56" stroke="#1F1A12" strokeWidth="6" strokeLinecap="round" />
      <circle cx="20" cy="56" r="3.6" fill="#1F1A12" />

      <circle cx="26" cy="58" r="16" fill="#1F1A12" />
      <circle cx="26" cy="58" r="6.5" fill="#F5E9D6" />
      <circle cx="102" cy="58" r="16" fill="#1F1A12" />
      <circle cx="102" cy="58" r="6.5" fill="#F5E9D6" />
    </svg>
  );
}

export function CarIllustration({ className }: IllustrationProps) {
  return (
    <svg className={cn("shrink-0", className)} viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`} fill="none">
      <ellipse cx="64" cy="70" rx="56" ry="5" fill="#1F1A12" opacity="0.1" />

      <path
        d="M14 58 L14 46 Q14 40 20 38 L34 30 Q40 22 52 22 L82 22 Q92 22 98 30 L108 38 Q116 40 116 48 L116 58 Z"
        fill="#C9820A"
      />

      <path d="M38 30 L46 22 L82 22 L94 30 Z" fill="#1F1A12" />
      <path d="M41 30 L47 24 L62 24 L62 30 Z" fill="#F5E9D6" />
      <path d="M66 24 L81 24 L91 30 L66 30 Z" fill="#F5E9D6" opacity="0.92" />

      <rect x="14" y="52" width="102" height="8" fill="#1F1A12" />

      <circle cx="34" cy="62" r="14" fill="#1F1A12" />
      <circle cx="34" cy="62" r="6" fill="#F5E9D6" />
      <circle cx="96" cy="62" r="14" fill="#1F1A12" />
      <circle cx="96" cy="62" r="6" fill="#F5E9D6" />

      <circle cx="112" cy="46" r="2.6" fill="#FFE9A8" />
      <circle cx="18" cy="46" r="2.6" fill="#FFE9A8" />
    </svg>
  );
}

/**
 * Renders directly rather than handing back a component reference, same
 * reasoning as `VehicleTypeIcon` in `vehicle-icons.tsx`: picking a
 * component dynamically and assigning it to a variable resets that
 * component's state on every render.
 */
export function VehicleTypeIllustration({ type, className }: IllustrationProps & { type: VehicleType }) {
  if (type === "CAR") return <CarIllustration className={className} />;
  if (type === "BIKE") return <BikeIllustration className={className} />;
  return <KekeIllustration className={className} />;
}
