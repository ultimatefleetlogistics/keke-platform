import { NextResponse } from "next/server";

import { formatDateTime } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getPartnerStatement, type PartnerKind } from "@/lib/data/reports";
import { PERMISSIONS } from "@/lib/rbac/permissions";

function isPartnerKind(value: string): value is PartnerKind {
  return value === "agent" || value === "driver" || value === "investor";
}

function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Wraps a CSV field in quotes and escapes any quote it contains, only needed for the free-text columns (name, type label), amounts and dates never contain a comma or quote. */
function csvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * The CSV/"Excel" side of Module 33's account statement export, the
 * partner statement page's own Print button covers the PDF side (the
 * browser's "Save as PDF" in its print dialog, no PDF library needed).
 * Same getPartnerStatement call the page itself renders from, so what
 * downloads always matches what was on screen when the link was clicked,
 * including whichever from/to range was applied.
 */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return new NextResponse("Sign in required.", { status: 401 });
  }
  if (!user.permissions.has(PERMISSIONS.REPORTS_VIEW)) {
    return new NextResponse("Your role doesn't include permission to view reports.", { status: 403 });
  }

  const { kind, id } = await params;
  if (!isPartnerKind(kind)) {
    return new NextResponse("Unknown partner type.", { status: 404 });
  }

  const url = new URL(request.url);
  const from = parseDateParam(url.searchParams.get("from"));
  const to = parseDateParam(url.searchParams.get("to"));
  const range = from && to ? { from, to } : undefined;

  const statement = await getPartnerStatement({ kind, id, range });
  if (!statement) {
    return new NextResponse("Not found.", { status: 404 });
  }

  const lines = [
    "Date,Type,Direction,Amount (NGN)",
    ...statement.transactions.map((t) =>
      [csvField(formatDateTime(t.createdAt)), csvField(t.sourceLabel), t.direction, t.amount.toFixed(2)].join(",")
    ),
    "",
    `Total inflow,,,${statement.summary.totalInflow.toFixed(2)}`,
    `Total outflow,,,${statement.summary.totalOutflow.toFixed(2)}`,
    `Net,,,${statement.summary.net.toFixed(2)}`,
  ];

  const fileSafeName = statement.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "statement";
  const csv = `﻿${lines.join("\r\n")}\r\n`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileSafeName}-statement.csv"`,
    },
  });
}
