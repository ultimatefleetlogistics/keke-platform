"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { VehicleType } from "@prisma/client";

import { Card } from "@/components/ui/card";
import { VehicleCard } from "@/components/fleet/keke-card";
import { VEHICLE_TYPE_LABELS } from "@/lib/vehicle-types";

type FleetStatus = "ACTIVE" | "MAINTENANCE" | "UNASSIGNED" | "PENDING" | "RETIRED";

type Vehicle = {
  id: string;
  assetTag: string;
  type: VehicleType;
  status: FleetStatus;
  location: string;
  agent: string;
  driver: string;
};

type StatusCounts = { all: number; active: number; maintenance: number; unassigned: number; pending: number };

const SELECT_CLASS =
  "flex h-11 items-center rounded-[11px] border border-border bg-surface px-3.5 text-[13px] font-bold text-text outline-none focus:border-accent focus:ring-4 focus:ring-accent-soft";

/**
 * Module 28: the fleet toolbar (status pills, search box, "Filters", and
 * "Location") used to be entirely decorative markup, none of it had any
 * state or handler wired up at all, "All" was the only pill ever marked
 * active (a hardcoded `active: true`, never recomputed), the search box
 * was a styled `<div>` with placeholder text rather than a real `<input>`,
 * and both "Filters" and "Location" were plain unclickable `<div>`s.
 * Reported directly: "the filter does not work, you can filter anything
 * the filed doesn't work and i'm sure the location button did not work
 * also." All four are now real, client-side (the fleet list is small
 * enough that filtering the already-fetched array beats a server round
 * trip per keystroke): the pills filter by status, "Filters" became a
 * vehicle-type filter (keke/car/bike, there was no other control for
 * this anywhere), "Location" is a dropdown of the locations actually
 * present in the fleet, and the search box is a real input matching
 * asset tag, agent, driver, or location, case-insensitively.
 */
export function FleetBrowser({ vehicles, statusCounts }: { vehicles: Vehicle[]; statusCounts: StatusCounts }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | FleetStatus>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | VehicleType>("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");

  const locations = useMemo(
    () =>
      Array.from(new Set(vehicles.map((v) => v.location).filter((loc) => loc && loc !== "Not set"))).sort((a, b) =>
        a.localeCompare(b)
      ),
    [vehicles]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (statusFilter !== "ALL" && v.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && v.type !== typeFilter) return false;
      if (locationFilter !== "ALL" && v.location !== locationFilter) return false;
      if (query) {
        const haystack = `${v.assetTag} ${v.agent} ${v.driver} ${v.location}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  }, [vehicles, statusFilter, typeFilter, locationFilter, search]);

  const filterPills: Array<{ key: "ALL" | FleetStatus; label: string; count: number }> = [
    { key: "ALL", label: "All", count: statusCounts.all },
    { key: "ACTIVE", label: "Active", count: statusCounts.active },
    { key: "MAINTENANCE", label: "Maintenance", count: statusCounts.maintenance },
    { key: "UNASSIGNED", label: "Unassigned", count: statusCounts.unassigned },
    { key: "PENDING", label: "Pending", count: statusCounts.pending },
  ];

  const hasActiveFilter = statusFilter !== "ALL" || typeFilter !== "ALL" || locationFilter !== "ALL" || search.trim() !== "";

  return (
    <>
      <div className="mt-4.5 flex flex-wrap gap-2.5">
        {filterPills.map((pill) => (
          <button
            key={pill.key}
            type="button"
            onClick={() => setStatusFilter(pill.key)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-bold transition-colors ${
              statusFilter === pill.key ? "bg-accent text-white" : "bg-[#F0F2ED] text-text-soft hover:bg-[#E7E9E4]"
            }`}
          >
            {pill.label}
            <span
              className="rounded-full px-1.5 py-0.5 text-[11px] font-extrabold"
              style={{ background: "rgba(255,255,255,0.6)", color: statusFilter === pill.key ? "var(--accent-dark)" : undefined }}
            >
              {pill.count}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3.5 flex flex-wrap gap-3">
        <div className="flex flex-1 min-w-[220px] items-center gap-2 rounded-[11px] border border-border bg-surface px-3.5 py-2.5">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0">
            <circle cx="11" cy="11" r="7" stroke="var(--text-faint)" strokeWidth="1.8" />
            <path d="m20 20-3.5-3.5" stroke="var(--text-faint)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vehicle ID, agent, driver, location..."
            className="w-full bg-transparent text-[13px] font-medium text-text outline-none placeholder:text-text-faint"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as "ALL" | VehicleType)}
          className={SELECT_CLASS}
        >
          <option value="ALL">All types</option>
          {Object.entries(VEHICLE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="ALL">All locations</option>
          {locations.map((loc) => (
            <option key={loc} value={loc}>
              {loc}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="px-0 py-16">
          <Card className="p-10 text-center text-[13px] text-text-soft">
            {hasActiveFilter ? "No vehicles match these filters." : "No vehicles yet."}
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5 py-5 md:grid-cols-2">
          {filtered.map((vehicle) => (
            <Link key={vehicle.id} href={`/admin/fleet/${vehicle.id}`} className="block">
              <VehicleCard
                assetTag={vehicle.assetTag}
                type={vehicle.type}
                status={vehicle.status}
                location={vehicle.location}
                agent={vehicle.agent}
                driver={vehicle.driver}
              />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
