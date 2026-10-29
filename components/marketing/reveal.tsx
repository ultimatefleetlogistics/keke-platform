"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Module: public homepage. 2026-10-22: added so sections animate in as a
 * visitor scrolls, instead of the whole page just sitting there static
 * (direct feedback: "the site doesn't still feel attractive"). Plain
 * IntersectionObserver, no animation library — this is the only thing on
 * the page that needed one, not worth a new dependency (and this device
 * has no way to run `npm install` from here, so a new package would have
 * meant asking Saidu to install it before the site would even build).
 *
 * `.reveal` / `.reveal.is-visible` live in globals.css, including the
 * `prefers-reduced-motion` override — a visitor with that preference set
 * sees everything already in place, this component's JS state doesn't
 * matter for them either way.
 */
export function Reveal({
  children,
  delay = 0,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ transitionDelay: delay ? `${delay}ms` : undefined }}
    >
      {children}
    </div>
  );
}
