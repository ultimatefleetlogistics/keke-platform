"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";

import { searchAdmin, type AdminSearchResult } from "@/lib/actions/search";
import { VEHICLE_TYPE_LABELS } from "@/lib/vehicle-types";

const EMPTY_RESULT: AdminSearchResult = { investors: [], vehicles: [], batches: [] };

const BATCH_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  PARTIALLY_FAILED: "Partially failed",
  REJECTED: "Rejected",
};

/**
 * The admin dashboard's global search box. Direct feedback: "the search
 * bar on the admin side is not searchable or clickable," what was there
 * before was a plain decorative `<div>` with placeholder text and a
 * magnifier icon, nothing behind it at all. A Server Component page can't
 * hold input state, so this is a small client island the dashboard page
 * renders in its place, calling the `searchAdmin` Server Action
 * (`lib/actions/search.ts`) directly rather than standing up a new API
 * route, the same pattern this app already uses for every other read that
 * needs to happen from client-side interaction.
 *
 * Debounced 250ms so typing doesn't fire a query per keystroke, and a
 * monotonically increasing request id discards a stale response that
 * resolves after a newer keystroke's request, the same reasoning as
 * keke-mobile's payment-history.tsx requestIdRef.
 */
export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminSearchResult>(EMPTY_RESULT);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const pathname = usePathname();
  const isFirstPathname = useRef(true);
  // Round four: which result was clicked, kept highlighted with a spinner
  // until the route actually changes (see the Link onClick handlers
  // below). Prefixed with its section ("investor:<id>") since an
  // investor, vehicle, and batch id are never guaranteed distinct from
  // one another.
  const [navigatingKey, setNavigatingKey] = useState<string | null>(null);

  // Now doing real work, not just a backstop: a clicked result no longer
  // closes the dropdown on click (see below), so this is what actually
  // clears it, once the URL genuinely changes, direct feedback asked for
  // "some clickable effect and animations after clicking," and a dropdown
  // that vanishes the instant you click, with nothing on screen until the
  // next page happens to finish loading, reads as "nothing happened."
  // This is also still the belt-and-suspenders it started as, in case a
  // result's navigation ever raced past its own click handler's state
  // updates. Skipped on the very first render, there's no prior route to
  // have navigated away from yet.
  useEffect(() => {
    if (isFirstPathname.current) {
      isFirstPathname.current = false;
      return;
    }
    setOpen(false);
    setQuery("");
    setResults(EMPTY_RESULT);
    setNavigatingKey(null);
  }, [pathname]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      requestIdRef.current += 1;
      // Same documented "fetch when a dependency changes" shape as
      // keke-mobile's payment-history.tsx effect, see its own comment:
      // this clears a previous query's results once the box is emptied
      // out or dropped back below the 2-character threshold, there is no
      // external system to subscribe to here instead.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults(EMPTY_RESULT);
      return;
    }
    const requestId = ++requestIdRef.current;
    const timeout = setTimeout(() => {
      startTransition(async () => {
        const res = await searchAdmin(trimmed);
        if (requestIdRef.current === requestId) setResults(res);
      });
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const trimmed = query.trim();
  const hasQuery = trimmed.length >= 2;
  const totalResults = results.investors.length + results.vehicles.length + results.batches.length;

  function closeAndReset() {
    setOpen(false);
    setQuery("");
    setResults(EMPTY_RESULT);
    setNavigatingKey(null);
  }

  /**
   * Replaces the old `onClick={closeAndReset}` on every result `<Link>`.
   * The dropdown now stays open with this one row highlighted and
   * spinning (see ResultRow below) instead of disappearing outright, the
   * `usePathname()` effect above is what actually closes it, once the
   * route has genuinely changed.
   */
  function navigateTo(key: string) {
    setNavigatingKey(key);
  }

  return (
    <div ref={containerRef} className="relative mx-6 max-w-[340px] flex-1">
      <div className="flex items-center gap-2 rounded-[11px] bg-[#F3F5F0] px-3.5 py-2.5">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0">
          <circle cx="11" cy="11" r="7" stroke="var(--text-faint)" strokeWidth="1.8" />
          <path d="m20 20-3.5-3.5" stroke="var(--text-faint)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeAndReset();
          }}
          placeholder="Search investors, vehicles, batches..."
          className="w-full bg-transparent text-[13px] text-text outline-none placeholder:text-text-faint"
        />
      </div>

      {open && hasQuery ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-20 max-h-[380px] overflow-y-auto rounded-xl border border-border bg-surface p-2 shadow-card-hover">
          {totalResults === 0 ? (
            <div className="px-3 py-4 text-center text-[12.5px] text-text-soft">
              {isPending ? "Searching…" : `No matches for "${trimmed}".`}
            </div>
          ) : (
            <>
              {results.investors.length > 0 ? (
                <ResultGroup label="Investors">
                  {results.investors.map((investor) => {
                    const rowKey = `investor:${investor.id}`;
                    return (
                      <ResultRow
                        key={rowKey}
                        rowKey={rowKey}
                        href={`/admin/investors/${investor.id}`}
                        navigatingKey={navigatingKey}
                        onNavigate={navigateTo}
                      >
                        <div className="text-[13px] font-bold">{investor.fullName}</div>
                        <div className="text-[11.5px] text-text-faint">{investor.email}</div>
                      </ResultRow>
                    );
                  })}
                </ResultGroup>
              ) : null}
              {results.vehicles.length > 0 ? (
                <ResultGroup label="Vehicles">
                  {results.vehicles.map((vehicle) => {
                    const rowKey = `vehicle:${vehicle.id}`;
                    return (
                      <ResultRow
                        key={rowKey}
                        rowKey={rowKey}
                        href={`/admin/fleet/${vehicle.id}`}
                        navigatingKey={navigatingKey}
                        onNavigate={navigateTo}
                      >
                        <div className="text-[13px] font-bold">{vehicle.assetTag}</div>
                        <div className="text-[11.5px] text-text-faint">
                          {VEHICLE_TYPE_LABELS[vehicle.type as keyof typeof VEHICLE_TYPE_LABELS] ?? vehicle.type}
                        </div>
                      </ResultRow>
                    );
                  })}
                </ResultGroup>
              ) : null}
              {results.batches.length > 0 ? (
                <ResultGroup label="Payment batches">
                  {results.batches.map((batch) => {
                    const rowKey = `batch:${batch.id}`;
                    return (
                      <ResultRow
                        key={rowKey}
                        rowKey={rowKey}
                        href={`/admin/payments/batches/${batch.id}`}
                        navigatingKey={navigatingKey}
                        onNavigate={navigateTo}
                      >
                        <div className="text-[13px] font-bold">{batch.periodLabel}</div>
                        <div className="text-[11.5px] text-text-faint">
                          {BATCH_STATUS_LABEL[batch.status] ?? batch.status}
                        </div>
                      </ResultRow>
                    );
                  })}
                </ResultGroup>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ResultGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-1 last:mb-0">
      <div className="px-3 py-1 text-[10.5px] font-bold uppercase tracking-wide text-text-faint">{label}</div>
      {children}
    </div>
  );
}

/**
 * One clickable search result. `active:scale-[0.97]` is the same pure-CSS
 * press feedback `components/ui/button.tsx` already uses on every
 * `Button`, it fires the instant a mouse or tap goes down, before any
 * JavaScript runs. Once clicked, the row switches to an accent-tinted
 * highlight with a small spinner in place of stacking a second visual
 * state on top of the hover style, so it's obvious which result is being
 * navigated to versus which ones are just sitting there, direct feedback
 * asked for exactly this: "add some clickable effect and animations after
 * clicking on the investor from the search bar."
 */
function ResultRow({
  rowKey,
  href,
  navigatingKey,
  onNavigate,
  children,
}: {
  rowKey: string;
  href: string;
  navigatingKey: string | null;
  onNavigate: (key: string) => void;
  children: ReactNode;
}) {
  const isNavigating = navigatingKey === rowKey;
  return (
    <Link
      href={href}
      onClick={() => onNavigate(rowKey)}
      aria-busy={isNavigating || undefined}
      className={
        "flex items-center justify-between gap-2 rounded-lg px-3 py-2 transition-[color,background-color,transform] duration-150 active:scale-[0.97] active:duration-100" +
        (isNavigating ? " bg-accent-soft" : " hover:bg-background")
      }
    >
      <div className="min-w-0 flex-1">{children}</div>
      {isNavigating ? <RowSpinner /> : null}
    </Link>
  );
}

const RowSpinner = () => (
  <svg className="h-3.5 w-3.5 shrink-0 animate-spin text-accent" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
    <path
      className="opacity-90"
      d="M21 12a9 9 0 0 0-9-9"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);
