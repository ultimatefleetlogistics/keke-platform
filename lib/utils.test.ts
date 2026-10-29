import { describe, it, expect } from "vitest";

import { formatNaira, formatDate, formatDateTime, startOfWeek, addDays, weekLabel, getInitials } from "@/lib/utils";

describe("formatNaira", () => {
  it("formats a whole naira amount with the naira sign and no decimals", () => {
    expect(formatNaira(1234567)).toBe("₦1,234,567");
  });

  it("rounds off decimals rather than showing kobo", () => {
    expect(formatNaira(1500.75)).toBe("₦1,501");
  });

  it("accepts a numeric string the same way it accepts a number", () => {
    expect(formatNaira("1234567")).toBe(formatNaira(1234567));
  });

  it("formats zero", () => {
    expect(formatNaira(0)).toBe("₦0");
  });
});

describe("formatDate / formatDateTime", () => {
  // Built with the local Date constructor (not an ISO string) so the
  // wall-clock date is the same no matter which timezone this runs in.
  const someDate = new Date(2026, 2, 5, 10, 0); // 5 Mar 2026, 10:00 local

  it("formats a date as day, short month, year", () => {
    expect(formatDate(someDate)).toBe("05 Mar 2026");
  });

  it("accepts an ISO string the same way it accepts a Date", () => {
    expect(formatDate(someDate.toISOString())).toBe(formatDate(someDate));
  });

  it("formatDateTime adds the time of day to formatDate's output", () => {
    expect(formatDateTime(someDate)).toBe("05 Mar 2026, 10:00");
  });
});

describe("startOfWeek", () => {
  it("returns the same Monday when given a Monday", () => {
    const monday = new Date(2026, 2, 2); // 2 Mar 2026 is a Monday
    const result = startOfWeek(monday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(2);
  });

  it("rolls a Sunday back to the Monday that started its week, not forward", () => {
    const sunday = new Date(2026, 2, 8); // 8 Mar 2026 is a Sunday
    const result = startOfWeek(sunday);
    expect(result.getDay()).toBe(1);
    expect(result.getDate()).toBe(2);
  });

  it("rolls a mid-week day back to that week's Monday", () => {
    const thursday = new Date(2026, 2, 5); // 5 Mar 2026 is a Thursday
    const result = startOfWeek(thursday);
    expect(result.getDate()).toBe(2);
  });

  it("zeroes out the time of day", () => {
    const result = startOfWeek(new Date(2026, 2, 5, 14, 37, 22));
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
  });

  it("does not mutate the date it was given", () => {
    const original = new Date(2026, 2, 5, 14, 0);
    const originalTime = original.getTime();
    startOfWeek(original);
    expect(original.getTime()).toBe(originalTime);
  });
});

describe("addDays", () => {
  it("adds a positive number of days", () => {
    const result = addDays(new Date(2026, 2, 5), 3);
    expect(result.getDate()).toBe(8);
  });

  it("subtracts with a negative number of days", () => {
    const result = addDays(new Date(2026, 2, 5), -3);
    expect(result.getDate()).toBe(2);
  });

  it("rolls over into the next month correctly", () => {
    const result = addDays(new Date(2026, 2, 30), 3); // 30 Mar + 3
    expect(result.getMonth()).toBe(3); // April
    expect(result.getDate()).toBe(2);
  });

  it("does not mutate the date it was given", () => {
    const original = new Date(2026, 2, 5);
    const originalTime = original.getTime();
    addDays(original, 10);
    expect(original.getTime()).toBe(originalTime);
  });
});

describe("weekLabel", () => {
  it("labels the first week of January as W1", () => {
    expect(weekLabel(new Date(2026, 0, 1))).toBe("W1");
  });

  it("produces a stable, increasing label across the year", () => {
    const early = weekLabel(new Date(2026, 1, 1));
    const late = weekLabel(new Date(2026, 10, 1));
    const earlyNum = Number(early.slice(1));
    const lateNum = Number(late.slice(1));
    expect(lateNum).toBeGreaterThan(earlyNum);
  });
});

describe("getInitials", () => {
  it("takes the first letter of the first and last name", () => {
    expect(getInitials("Aisha Oyelaran")).toBe("AO");
  });

  it("uses the first two letters of a single name", () => {
    expect(getInitials("Aisha")).toBe("AI");
  });

  it("ignores extra whitespace between names", () => {
    expect(getInitials("  Aisha   Oyelaran  ")).toBe("AO");
  });

  it("uses first and last of three or more names, ignoring the middle", () => {
    expect(getInitials("Aisha Bello Oyelaran")).toBe("AO");
  });

  it("falls back to a question mark for an empty name", () => {
    expect(getInitials("")).toBe("?");
    expect(getInitials("   ")).toBe("?");
  });
});
