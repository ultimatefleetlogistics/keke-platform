import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNaira(amount: number | string): string {
  const value = typeof amount === "string" ? Number(amount) : amount;
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Same as formatDate but with the time of day, for logs and activity feeds where two entries on the same day still need telling apart. */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-NG", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Monday 00:00 of the week containing the given date, used to bucket
 * payments into weekly totals for charts and "this week" comparisons.
 */
export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Midnight of the given date, used to bucket money-flow rows into daily totals on /admin/reports. */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Short label like "02 Sep" for a daily chart/table axis, deliberately shorter than formatDate's full year. */
export function dayLabel(date: Date): string {
  return new Intl.DateTimeFormat("en-NG", { day: "2-digit", month: "short" }).format(date);
}

/** ISO-week-ish short label like "W34" for chart axes. */
export function weekLabel(date: Date): string {
  const firstJan = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - firstJan.getTime()) / 86_400_000);
  const week = Math.ceil((days + firstJan.getDay() + 1) / 7);
  return `W${week}`;
}

/** "Aisha Oyelaran" -> "AO", used for avatar fallbacks. */
export function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
