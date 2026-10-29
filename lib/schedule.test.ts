import { describe, it, expect } from "vitest";

import { generateScheduleDates } from "@/lib/schedule";

describe("generateScheduleDates: WEEKLY", () => {
  it("produces roughly 52 installments a year, one every 7 days", () => {
    const dates = generateScheduleDates(new Date(2026, 0, 5), "WEEKLY", 12);
    expect(dates).toHaveLength(52);
    for (let i = 1; i < dates.length; i++) {
      const diffDays = (dates[i].getTime() - dates[i - 1].getTime()) / 86_400_000;
      expect(diffDays).toBe(7);
    }
  });

  it("the first due date is the start date itself", () => {
    const start = new Date(2026, 0, 5);
    const dates = generateScheduleDates(start, "WEEKLY", 3);
    expect(dates[0].getTime()).toBe(start.getTime());
  });
});

describe("generateScheduleDates: BIWEEKLY", () => {
  it("produces roughly 26 installments a year, one every 14 days", () => {
    const dates = generateScheduleDates(new Date(2026, 0, 5), "BIWEEKLY", 12);
    expect(dates).toHaveLength(26);
    for (let i = 1; i < dates.length; i++) {
      const diffDays = (dates[i].getTime() - dates[i - 1].getTime()) / 86_400_000;
      expect(diffDays).toBe(14);
    }
  });
});

describe("generateScheduleDates: MONTHLY", () => {
  it("produces exactly one installment per month in the term", () => {
    const dates = generateScheduleDates(new Date(2026, 2, 5), "MONTHLY", 6);
    expect(dates).toHaveLength(6);
    expect(dates.map((d) => d.getMonth())).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it("lands on the same day of month each time when that day exists everywhere", () => {
    const dates = generateScheduleDates(new Date(2026, 2, 5), "MONTHLY", 4);
    expect(dates.every((d) => d.getDate() === 5)).toBe(true);
  });

  it("clamps to month-end instead of overflowing into the next month for a 31st start date", () => {
    // 31 Jan 2026. Naively calling setMonth(getMonth() + 1) rolls this
    // into 3 Mar (Feb has no 31st), skipping February's due date and
    // doubling up March's, see the comment in lib/schedule.ts.
    const dates = generateScheduleDates(new Date(2026, 0, 31), "MONTHLY", 4);
    expect(dates.map((d) => d.getMonth())).toEqual([0, 1, 2, 3]); // Jan, Feb, Mar, Apr, no repeats or gaps
    expect(dates[1].getDate()).toBe(28); // Feb 2026 is not a leap year
    expect(dates[2].getDate()).toBe(31); // Mar has 31 days, no clamping needed
    expect(dates[3].getDate()).toBe(30); // Apr has 30 days
  });

  it("clamps correctly across a leap year February", () => {
    const dates = generateScheduleDates(new Date(2028, 0, 31), "MONTHLY", 2); // 2028 is a leap year
    expect(dates[1].getDate()).toBe(29);
  });

  it("preserves the time of day from the start date", () => {
    const start = new Date(2026, 2, 5, 14, 30);
    const dates = generateScheduleDates(start, "MONTHLY", 3);
    expect(dates.every((d) => d.getHours() === 14 && d.getMinutes() === 30)).toBe(true);
  });
});
