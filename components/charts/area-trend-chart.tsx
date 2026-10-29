/**
 * A small SVG line-and-area trend chart: weekly amounts with a filled
 * gradient beneath the line, week labels along the bottom, and a callout
 * badge on the most recent point. Originally built inline for the admin
 * dashboard's "realized payments" chart (Module 3), extracted here in
 * Module 20 so the investor and agent dashboards can show their own
 * trends (payouts realized, remittances collected) in the same visual
 * language without duplicating the SVG math three times.
 *
 * `gradientId` must be unique per chart rendered on the same page, SVG
 * `<defs>` ids are global to the document, two charts sharing one id
 * would silently reuse whichever gradient painted first.
 *
 * Module 42: reported as "occupying the entire card" on some screens.
 * The previous markup put the aspect ratio only on the `viewBox` while
 * the `<svg>` itself took `width: 100%` from a class and a fixed
 * `height: 200` from an inline style, two independent sizing rules that
 * only agree when the rendered width happens to be exactly 560px; at any
 * other width, the box and the `viewBox`'s 560x200 ratio disagree and
 * the browser is free to resolve that however its `preserveAspectRatio`
 * default lands, which is where the reported oversized chart came from.
 * The fix is a wrapping element sized with a CSS `aspect-ratio` that
 * matches the `viewBox` exactly (14/5 = 560/200), so the rendered box's
 * ratio can never drift from the drawing's own coordinate system no
 * matter how wide the card is; the `<svg>` inside just fills that box
 * at `h-full w-full` with `preserveAspectRatio="none"`, which is safe
 * here specifically because the ratios are guaranteed to already match.
 *
 * Module 42 (follow-up, round two): "the chart is still not filling in."
 * The wrapper below used to be sized purely by `aspect-[14/5]`, height
 * following width at a fixed 2.8:1 ratio with nothing capping it. That
 * looks right on a narrow card, but the admin dashboard's chart card runs
 * the full content width on a wide desktop screen, at ~930px wide that
 * ratio computes a ~330px tall box, and since `chartMax` scales the
 * plotted line to the data's own highest point (not to the box's full
 * height), most weeks in a typical trend sit well below that highest
 * point, leaving a very large blank gap above the line that reads as "the
 * chart isn't filling the card." `preserveAspectRatio="none"` below (the
 * Module 42 fix that let the SVG stretch non-uniformly to any box without
 * distortion) makes it safe to cap the wrapper's height independent of
 * its width, so a `max-h` now keeps this box from growing past a
 * reasonable chart height no matter how wide its card is; the aspect
 * ratio itself still governs sizing below that cap, where it never
 * mattered anyway.
 *
 * Module 42 (follow-up): reported as "gibberish" on `/admin/reports`,
 * whose "Inflow/Outflow by day" charts pass one label per day in the
 * selected range (30 by default), unlike the dashboards' 8-week charts
 * this component was built for. Every label used to render regardless
 * of how many there were, so 30 short date strings landed on top of
 * each other in the same 540px of axis. `MAX_LABELS` now caps how many
 * of `weeks` actually get a `<text>`, evenly sampled (always keeping
 * the first and last points, the two ends of the range) rather than
 * showing every single one; the line and area themselves are unaffected,
 * this only thins the labels underneath them.
 */
const MAX_LABELS = 7;
export function AreaTrendChart({
  weeks,
  amounts,
  latestLabel,
  latestAmount,
  formatAmount,
  emptyMessage,
  gradientId,
  accentColor = "#C9820A",
}: {
  weeks: string[];
  amounts: number[];
  latestLabel: string;
  latestAmount: number;
  formatAmount: (amount: number) => string;
  emptyMessage: string;
  gradientId: string;
  accentColor?: string;
}) {
  if (amounts.every((a) => a === 0)) {
    return (
      <div className="flex h-[200px] items-center justify-center text-[13px] text-text-soft">{emptyMessage}</div>
    );
  }

  const chartMax = Math.max(...amounts, 1);
  const points = amounts.map((amount, index) => {
    const x = 10 + (index * 540) / Math.max(amounts.length - 1, 1);
    const y = 170 - (amount / chartMax) * 116;
    return { x, y };
  });
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1]?.x ?? 550},170 L10,170 Z`;
  const lastPoint = points[points.length - 1];

  // Evenly sample at most MAX_LABELS indices to actually label, always
  // including the first and last point (the two ends of the range),
  // rather than one label per data point, see the doc comment above for
  // why: this is what keeps a 30-day range legible instead of stacking
  // 30 short date strings on top of each other.
  const labelIndices =
    weeks.length <= MAX_LABELS
      ? weeks.map((_, index) => index)
      : Array.from(new Set(
          Array.from({ length: MAX_LABELS }, (_, i) => Math.round((i * (weeks.length - 1)) / (MAX_LABELS - 1))),
        ));

  return (
    <div className="relative mt-2 aspect-[14/5] w-full max-h-[200px]">
      <svg viewBox="0 0 560 200" preserveAspectRatio="none" className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accentColor} stopOpacity="0.22" />
            <stop offset="100%" stopColor={accentColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="10" y1="170" x2="550" y2="170" stroke="#E7E9E4" strokeWidth="1" />
        <line x1="10" y1="107" x2="550" y2="107" stroke="#F0F2ED" strokeWidth="1" />
        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path d={linePath} fill="none" stroke={accentColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {lastPoint ? <circle cx={lastPoint.x} cy={lastPoint.y} r="4.5" fill={accentColor} stroke="white" strokeWidth="2" /> : null}
        <g fontSize="11" fill="#8A8F86" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="600">
          {labelIndices.map((index) => {
            const week = weeks[index];
            const x = 10 + (index * 540) / Math.max(weeks.length - 1, 1);
            const anchor = index === 0 ? "start" : index === weeks.length - 1 ? "end" : "middle";
            return (
              <text key={`${week}-${index}`} x={x} y="188" textAnchor={anchor}>
                {week}
              </text>
            );
          })}
        </g>
        <g transform="translate(420,6)">
          <rect x="0" y="0" width="128" height="46" rx="10" fill="#14171A" />
          <text x="12" y="18" fill="#F5E4C3" fontSize="10.5" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="600">
            {latestLabel}
          </text>
          <text x="12" y="35" fill="white" fontSize="14" fontFamily="Plus Jakarta Sans, sans-serif" fontWeight="800">
            {formatAmount(latestAmount)}
          </text>
        </g>
      </svg>
    </div>
  );
}
