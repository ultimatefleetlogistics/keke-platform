"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

export type AuthSlide = {
  src: string;
  alt: string;
  /** Optional: pages that don't need per-slide copy (e.g. forgot-password) can omit these and just get photo variety. */
  headline?: string;
  subhead?: string;
};

/**
 * The three vehicle categories the app tracks, shared across every auth
 * screen so the file paths live in one place. Each page composes its own
 * headline/subhead around these.
 *
 * keke/bike deliberately point at "-8.jpg" filenames, not the original
 * keke-hero.jpg/bike-hero.jpg: those went through several revisions at
 * the same path while chasing a crop bug, and Next's image optimizer
 * caches a transformed copy per path — it doesn't reliably notice the
 * file underneath changed, so browsers kept showing a stale, long-since-
 * fixed crop no matter how many times the underlying image was replaced.
 * A new filename forces a fresh cache entry. If these ever need
 * reprocessing again, bump the suffix again rather than overwriting in
 * place.
 *
 * -8.jpg widens further than -7.jpg but switches technique: -6/-7 used a
 * uniform horizontal stretch, which widens the wheels by the same
 * percentage as everything else — fine at ~17%, but pushing it further
 * starts turning circular wheels into visible ovals. -8.jpg instead uses
 * a horizontal warp that concentrates the added width in the body/engine
 * area between the wheels and tapers to ~0 extra stretch right at the
 * wheels/mirror tips, so the silhouette reads noticeably wider (keke
 * ~57% of canvas width, bike ~65%, up from ~51%/59% at -7.jpg) without
 * the wheels visibly distorting — checked with close crops before
 * shipping. Vertical position/size are unchanged from -7.jpg (that
 * margin was already at its safe limit), so this is a width-only change.
 * An ultrawide 21:9 monitor (2560x1080-class) can still clip slightly —
 * that's been true since -4.jpg, not introduced here.
 */
export const VEHICLE_PHOTOS: Pick<AuthSlide, "src" | "alt">[] = [
  { src: "/onboarding/keke-hero-8.jpg", alt: "A yellow keke tricycle" },
  { src: "/onboarding/bike-hero-8.jpg", alt: "A red commercial motorcycle" },
  { src: "/onboarding/car-hero.jpg", alt: "A red commercial car" },
];

const SLIDE_DURATION_MS = 5200;

function useSlideRotation(count: number) {
  const [active, setActive] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion || count <= 1) return;

    timerRef.current = setInterval(() => {
      setActive((i) => (i + 1) % count);
    }, SLIDE_DURATION_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [count]);

  function goTo(index: number) {
    setActive(index);
    if (timerRef.current) clearInterval(timerRef.current);
    if (count > 1) {
      timerRef.current = setInterval(() => {
        setActive((i) => (i + 1) % count);
      }, SLIDE_DURATION_MS);
    }
  }

  return { active, goTo };
}

/**
 * The photo layer alone: a slow crossfade across VEHICLE_PHOTOS with a dark
 * wash for legibility, no text or dots. Used standalone as a full-bleed
 * page background (app/admin-sign-in/page.tsx, a single centered card
 * rather than a split panel) and internally by AuthHeroCarousel below.
 * Runs its own independent timer, so two instances on the same page (there
 * never are, but in principle) would drift out of sync with each other,
 * that's fine, nothing here depends on a shared clock.
 */
export function AuthHeroBackground({ className = "" }: { className?: string }) {
  const { active } = useSlideRotation(VEHICLE_PHOTOS.length);

  return (
    <div className={`absolute inset-0 overflow-hidden bg-[#12100A] ${className}`}>
      {/*
       * Back to plain object-cover, full-bleed, no crop tricks: the CSS
       * approaches (shifted crop position, then object-contain, then a
       * fixed-aspect box) were all fighting the same underlying problem —
       * the keke and bike source photos had the vehicle sitting too low in
       * their own 1600x2000 canvas, so any viewport-driven crop or scale
       * cut into the wheels or shrank the whole photo trying to avoid it.
       * Fixed at the source instead: keke-hero.jpg and bike-hero.jpg were
       * regenerated with the vehicle repositioned higher in the frame (car
       * untouched, it was already fine), so a plain cover crop now leaves
       * the tires in frame the same way it always did for the car photo.
       */}
      {VEHICLE_PHOTOS.map((s, i) => (
        <Image
          key={s.src}
          src={s.src}
          alt={s.alt}
          fill
          priority={i === 0}
          sizes="100vw"
          className={`object-cover transition-opacity duration-[1400ms] ease-in-out ${i === active ? "opacity-100" : "opacity-0"}`}
        />
      ))}
      <div className="absolute inset-0 bg-black/45" />
      <div className="absolute inset-0 bg-[linear-gradient(195deg,rgba(18,16,10,0.55)_0%,rgba(18,16,10,0.35)_38%,rgba(18,16,10,0.82)_100%)]" />
    </div>
  );
}

/**
 * The sign-in page's left hero panel (app/sign-in/page.tsx) used to be a
 * flat charcoal-to-amber gradient with an abstract keke watermark. This
 * replaces it with a slow auto-advancing carousel across real photos of
 * the three vehicle categories the app actually tracks, keke/bike/car,
 * each on the same premium spotlight backdrop (charcoal fading to an
 * amber glow, generated to match this app's own --accent/--accent-charcoal
 * tokens rather than a stock background) so the photography reads as part
 * of this brand rather than a pasted-in product shot. Now shared by every
 * split-panel auth screen (sign-in, sign-up, forgot-password), each
 * passing its own `slides` copy and `bullets` so the photography and
 * rotation mechanics are common but the words stay specific to what that
 * page is actually asking the person to do.
 *
 * Auto-advance pauses for anyone with prefers-reduced-motion set (same
 * discipline as components/ui/animated-number.tsx), the dots stay
 * clickable either way so the carousel is never actually stuck. `logo`
 * and `footer` are passed in rather than owned here since they're
 * identical page furniture, not carousel content.
 */
export function AuthHeroCarousel({
  slides,
  bullets = [],
  logo,
  footer,
}: {
  slides: AuthSlide[];
  bullets?: string[];
  logo: React.ReactNode;
  footer: React.ReactNode;
}) {
  const { active, goTo } = useSlideRotation(slides.length);
  const slide = slides[active];

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#12100A]">
      {slides.map((s, i) => (
        <Image
          key={s.src}
          src={s.src}
          alt={s.alt}
          fill
          priority={i === 0}
          sizes="560px"
          className={`object-cover transition-opacity duration-[1400ms] ease-in-out ${i === active ? "opacity-100" : "opacity-0"}`}
        />
      ))}

      {/* Dark wash so white text stays legible over any part of any photo, plus a bottom-heavy gradient so the copy block always sits on the darkest part of the image. */}
      <div className="absolute inset-0 bg-black/38" />
      <div className="absolute inset-0 bg-[linear-gradient(195deg,rgba(18,16,10,0.55)_0%,rgba(18,16,10,0.30)_38%,rgba(18,16,10,0.88)_100%)]" />

      <div className="relative z-10 flex h-full flex-col justify-between p-12 text-white">
        <div className="z-10">{logo}</div>

        <div className="z-10 max-w-[420px]">
          {slide.headline ? (
            <div key={slide.headline} className="animate-card-in text-[32px] font-bold leading-[1.25] tracking-tight">
              {slide.headline}
            </div>
          ) : null}
          {slide.subhead ? (
            <div key={slide.subhead} className="animate-card-in mt-3.5 max-w-[400px] text-sm leading-6 text-[#F5E4C3]">
              {slide.subhead}
            </div>
          ) : null}

          {slides.length > 1 ? (
            <div className="mt-7 flex items-center gap-2">
              {slides.map((s, i) => (
                <button
                  key={s.src}
                  type="button"
                  aria-label={`Show ${s.alt}`}
                  onClick={() => goTo(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === active ? "w-7 bg-accent" : "w-1.5 bg-white/35 hover:bg-white/55"
                  }`}
                />
              ))}
            </div>
          ) : null}

          {bullets.length > 0 ? (
            <div className="mt-8 flex flex-col gap-4">
              {bullets.map((line) => (
                <div key={line} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-white">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="m5 12 5 5L20 7" stroke="#C9820A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="pt-1 text-[13.5px] text-[#E4F6EA]">{line}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="z-10">{footer}</div>
      </div>
    </div>
  );
}
