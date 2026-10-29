"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export type AdminSearchResult = {
  investors: { id: string; fullName: string; email: string }[];
  vehicles: { id: string; assetTag: string; type: string }[];
  batches: { id: string; periodLabel: string; status: string }[];
};

const EMPTY_RESULT: AdminSearchResult = { investors: [], vehicles: [], batches: [] };

/**
 * Backs the admin dashboard's global search box
 * (components/admin/global-search.tsx), a Server Action called directly
 * from that client component rather than a new `/api` route, the same way
 * every other admin mutation in this app already works. Direct feedback:
 * "the search bar on the admin side is not searchable or clickable," it
 * had never been wired to anything, just a decorative `<div>` with
 * placeholder text and a magnifier icon next to it.
 *
 * Each of the three sections is only searched at all if the signed-in
 * staff member actually holds the matching *_VIEW permission, the same
 * gate the three list pages this feeds into
 * (/admin/investors, /admin/fleet, /admin/payments/batches) already
 * enforce, a search box should never surface a result someone couldn't
 * otherwise see by browsing to that list directly. Capped at 5 rows per
 * section and only run once the query is at least 2 characters, both to
 * keep this cheap enough to call on every debounced keystroke.
 */
export async function searchAdmin(query: string): Promise<AdminSearchResult> {
  const user = await getCurrentUser();
  if (!user) return EMPTY_RESULT;

  const q = query.trim();
  if (q.length < 2) return EMPTY_RESULT;

  const [investors, vehicles, batches] = await Promise.all([
    user.permissions.has(PERMISSIONS.INVESTORS_VIEW)
      ? prisma.investorProfile.findMany({
          where: {
            user: {
              OR: [
                { fullName: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            },
          },
          include: { user: true },
          take: 5,
        })
      : Promise.resolve([]),
    user.permissions.has(PERMISSIONS.FLEET_VIEW)
      ? prisma.vehicle.findMany({
          where: {
            OR: [
              { assetTag: { contains: q, mode: "insensitive" } },
              { plateNumber: { contains: q, mode: "insensitive" } },
              { frameNumber: { contains: q, mode: "insensitive" } },
            ],
          },
          take: 5,
        })
      : Promise.resolve([]),
    user.permissions.has(PERMISSIONS.PAYMENTS_VIEW)
      ? prisma.paymentBatch.findMany({
          where: { periodLabel: { contains: q, mode: "insensitive" } },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  return {
    investors: investors.map((i) => ({ id: i.id, fullName: i.user.fullName, email: i.user.email })),
    vehicles: vehicles.map((v) => ({ id: v.id, assetTag: v.assetTag, type: v.type })),
    batches: batches.map((b) => ({ id: b.id, periodLabel: b.periodLabel, status: b.status })),
  };
}
