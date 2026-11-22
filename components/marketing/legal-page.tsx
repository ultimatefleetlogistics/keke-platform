import type { ReactNode } from "react";

import { SiteHeader } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";

/**
 * Module: public legal pages (privacy policy now, terms later). One
 * shared shell so every legal page gets the same header, footer, reading
 * width and typography, instead of each one re-inventing them. Plain
 * long-form text on the normal page background, deliberately no photo
 * banner: these pages are for reading, not for selling.
 */
export function LegalPage({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
          <p className="text-[12.5px] font-bold uppercase tracking-[0.2em] text-accent-dark">{eyebrow}</p>
          <h1 className="mt-2 text-[30px] font-extrabold leading-tight text-text sm:text-[36px]">{title}</h1>
          <p className="mt-3 text-[13px] text-text-faint">Last updated: {updated}</p>
          <div className="mt-10 space-y-10">{children}</div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-[20px] font-extrabold text-text">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-text-soft">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
