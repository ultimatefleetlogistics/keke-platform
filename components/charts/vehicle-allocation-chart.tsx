"use client";

import { useMemo, useState } from "react";
import type { VehicleType } from "@prisma/client";

import { VEHICLE_TYPE_LABELS, VEHICLE_TYPES } from "@/lib/vehicle-types";

/**
 * A small SVG donut chart showing how an investor's vehicles split across
 * KEKE/CAR/BIKE, the "am I diversified or all-in on one type" question
 * asked directly of the investor dashboard (Module 51). Lives alongside
 * AreaTrendChart (components/charts/area-trend-chart.tsx) as this app's
 * second chart component, deliberately not sharing code with it: a
 * part-to-whole donut and a weekly line trend don't share any geometry,
 * only the same card-header visual language.
 *
 * Colors are fixed hex, the same convention AreaTrendChart's own
 * `accentColor` prop uses (see that file), not CSS vars: this SVG does
 * not re-theme for dark mode either. Keke keeps the brand gold since
 * it's the type almost every investor holds at least one of; car and
 * bike reuse this app's existing violet/teal tokens (app/globals.css),
 * the same pair already used elsewhere on this dashboard for icon chips.
 * Run through the dataviz skill's validate_palette.js before shipping:
 * all three pairs clear the colorblind-separation (CVD) and lightness
 * checks; teal lands a hair under the 3:1 contrast-vs-surface floor,
 * which is why every slice gets a direct count label and a legend row
 * rather than leaning on the fill alone (a flagged WARN, not a FAIL, but
 * treated as a requirement rather than dismissed).
 */
const SLICE_COLORS: Record<VehicleType, string> = {
  KEKE: "#C9820A",
  CAR: "#7C5CFC",
  BIKE: "#0EA5A5",
};

const SIZE = 200;
const CENTER = SIZE / 2;
const OUTER_R = 86;
const INNER_R = 54;
// The angular equivalent of the 2px surface-color gap every other chart
// in this app uses to separate touching marks (see area-trend-chart.tsx's
// sibling components and marks-and-anatomy.md), converted from a linear
// px gap to radians via the arc length at the outer radius.
const GAP_ANGLE = 2 / OUTER_R;

function polarToCartesian(radius: number, angle: number) {
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle),
  };
}

function donutSlicePath(startAngle: number, endAngle: number) {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const outerStart = polarToCartesian(OUTER_R, startAngle);
  const outerEnd = polarToCartesian(OUTER_R, endAngle);
  const innerStart = polarToCartesian(INNER_R, endAngle);
  const innerEnd = polarToCartesian(INNER_R, startAngle);
  return [
    `M ${outerStart.x.toFixed(2)} ${outerStart.y.toFixed(2)}`,
    `A ${OUTER_R} ${OUTER_R} 0 ${largeArc} 1 ${outerEnd.x.toFixed(2)} ${outerEnd.y.toFixed(2)}`,
    `L ${innerStart.x.toFixed(2)} ${innerStart.y.toFixed(2)}`,
    `A ${INNER_R} ${INNER_R} 0 ${largeArc} 0 ${innerEnd.x.toFixed(2)} ${innerEnd.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

export function VehicleAllocationChart({ vehicles }: { vehicles: { type: VehicleType }[] }) {
  const [activeType, setActiveType] = useState<VehicleType | null>(null);

  const { slices, total } = useMemo(() => {
    const total = vehicles.length;
    const counts = VEHICLE_TYPES.map((type) => ({
      type,
      count: vehicles.filter((v) => v.type === type).length,
    })).filter((entry) => entry.count > 0);

    let angle = -Math.PI / 2; // 12 o'clock start, same convention as a clock face
    const slices = counts.map(({ type, count }) => {
      const fraction = total > 0 ? count / total : 0;
      // A single 100%-share slice would otherwise draw an arc whose start
      // and end point are numerically identical (a full 2*PI sweep from
      // angle back to angle), which SVG renders as nothing at all -
      // pulled a hair short of a full circle so it always draws.
      const sweep =
        counts.length === 1 ? Math.PI * 2 - 0.001 : fraction * Math.PI * 2;
      const hasGap = counts.length > 1;
      const startAngle = angle + (hasGap ? GAP_ANGLE / 2 : 0);
      const endAngle = angle + sweep - (hasGap ? GAP_ANGLE / 2 : 0);
      angle += sweep;
      const midAngle = (startAngle + endAngle) / 2;
      return {
        type,
        count,
        percent: total > 0 ? Math.round(fraction * 100) : 0,
        path: startAngle < endAngle ? donutSlicePath(startAngle, endAngle) : null,
        labelPoint: polarToCartesian((OUTER_R + INNER_R) / 2, midAngle),
        sweepDegrees: (sweep * 180) / Math.PI,
      };
    });

    return { slices, total };
  }, [vehicles]);

  if (total === 0) {
    return (
      <div className="flex h-[168px] items-center justify-center text-[13px] text-text-soft">
        No vehicles yet
      </div>
    );
  }

  const active = slices.find((slice) => slice.type === activeType) ?? null;

  return (
    <div className="mt-2 flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
      <div className="relative h-[168px] w-[168px] shrink-0">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-full w-full"
          role="img"
          aria-label={`Vehicle allocation: ${slices
            .map((slice) => `${VEHICLE_TYPE_LABELS[slice.type]} ${slice.count} of ${total} (${slice.percent}%)`)
            .join(", ")}`}
        >
          {slices.map((slice) =>
            slice.path ? (
              <path
                key={slice.type}
                d={slice.path}
                fill={SLICE_COLORS[slice.type]}
                opacity={activeType === null || activeType === slice.type ? 1 : 0.35}
                className="cursor-pointer outline-none transition-opacity duration-150"
                tabIndex={0}
                onMouseEnter={() => setActiveType(slice.type)}
                onMouseLeave={() => setActiveType(null)}
                onFocus={() => setActiveType(slice.type)}
                onBlur={() => setActiveType(null)}
              >
                <title>
                  {VEHICLE_TYPE_LABELS[slice.type]}: {slice.count} of {total} ({slice.percent}%)
                </title>
              </path>
            ) : null
          )}
          {/* Direct labels ride the marks, but only where a slice is wide
              enough to hold a short count without crowding (see
              marks-and-anatomy.md's "label selectively" rule) - a slim
              sliver relies on the legend to the side instead. */}
          {slices
            .filter((slice) => slice.path && slice.sweepDegrees > 40)
            .map((slice) => (
              <text
                key={`label-${slice.type}`}
                x={slice.labelPoint.x}
                y={slice.labelPoint.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="15"
                fontWeight="800"
                fill="white"
                className="pointer-events-none select-none"
              >
                {slice.count}
              </text>
            ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[20px] font-extrabold">{active ? active.count : total}</div>
          <div className="text-[11px] font-semibold text-text-faint">
            {active ? VEHICLE_TYPE_LABELS[active.type] : total === 1 ? "vehicle" : "vehicles"}
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col gap-1.5 sm:w-auto">
        {slices.map((slice) => (
          <button
            key={slice.type}
            type="button"
            onMouseEnter={() => setActiveType(slice.type)}
            onMouseLeave={() => setActiveType(null)}
            onFocus={() => setActiveType(slice.type)}
            onBlur={() => setActiveType(null)}
            className={`flex items-center justify-between gap-6 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 ${
              activeType === slice.type ? "bg-background" : ""
            }`}
          >
            <span className="flex items-center gap-2 text-[13px] font-semibold text-text-soft">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: SLICE_COLORS[slice.type] }}
              />
              {VEHICLE_TYPE_LABELS[slice.type]}
            </span>
            <span className="text-[13px] font-bold text-text">
              {slice.count} <span className="font-semibold text-text-faint">({slice.percent}%)</span>
            </span>
          </button>
        ))}
      </div>

      {/* Screen-reader-only table fallback so the allocation is available
          as data, not just as color - the same "a table view exists"
          accessibility bar every chart in the dataviz skill is checked
          against. */}
      <table className="sr-only">
        <caption>Vehicle asset allocation</caption>
        <thead>
          <tr>
            <th>Vehicle type</th>
            <th>Count</th>
            <th>Share</th>
          </tr>
        </thead>
        <tbody>
          {slices.map((slice) => (
            <tr key={`row-${slice.type}`}>
              <td>{VEHICLE_TYPE_LABELS[slice.type]}</td>
              <td>{slice.count}</td>
              <td>{slice.percent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
