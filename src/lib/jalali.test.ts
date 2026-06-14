import { describe, it, expect } from "vitest";
import { toJalali, toGregorian, formatJalali } from "./jalali";

describe("toJalali", () => {
  it("happy: converts a known UTC date to Jalali parts at Tehran tz", () => {
    // 2024-03-20 00:00 Tehran (UTC+3:30) === 2024-03-19 20:30 UTC
    const date = new Date(Date.UTC(2024, 2, 19, 20, 30, 0));
    expect(toJalali(date)).toEqual({ jy: 1403, jm: 1, jd: 1 });
  });

  it("happy: round-trips through toGregorian", () => {
    const parts = { jy: 1403, jm: 1, jd: 1 };
    const back = toJalali(toGregorian(parts.jy, parts.jm, parts.jd));
    expect(back).toEqual(parts);
  });

  it("edge: respects Tehran tz at day boundary (UTC date != Tehran date)", () => {
    // 2024-03-19 21:00 UTC is already 2024-03-20 00:30 Tehran -> 1403/01/01
    const date = new Date(Date.UTC(2024, 2, 19, 21, 0, 0));
    expect(toJalali(date)).toEqual({ jy: 1403, jm: 1, jd: 1 });
    // 2024-03-19 20:00 UTC is still 2024-03-19 23:30 Tehran -> 1402/12/29 (1402 is not leap)
    const earlier = new Date(Date.UTC(2024, 2, 19, 20, 0, 0));
    expect(toJalali(earlier)).toEqual({ jy: 1402, jm: 12, jd: 29 });
  });
});

describe("toGregorian", () => {
  it("happy: 1403/01/01 -> 2024-03-20 Tehran midnight (UTC)", () => {
    const d = toGregorian(1403, 1, 1);
    expect(d.toISOString()).toBe("2024-03-19T20:30:00.000Z");
  });

  it("edge: leap year 1403/12/30 is valid and round-trips", () => {
    const d = toGregorian(1403, 12, 30);
    expect(toJalali(d)).toEqual({ jy: 1403, jm: 12, jd: 30 });
  });

  it("edge: invalid Jalali date 1403/13/01 is rejected", () => {
    expect(() => toGregorian(1403, 13, 1)).toThrow("INVALID_JALALI_DATE");
  });

  it("edge: invalid leap-day 1402/12/30 (non-leap year) is rejected", () => {
    expect(() => toGregorian(1402, 12, 30)).toThrow("INVALID_JALALI_DATE");
  });
});

describe("formatJalali", () => {
  it("happy: renders YYYY/MM/DD with Persian digits", () => {
    const date = new Date(Date.UTC(2024, 2, 19, 20, 30, 0));
    expect(formatJalali(date)).toBe("۱۴۰۳/۰۱/۰۱");
  });

  it("edge: pads single-digit month and day", () => {
    // 1403/02/05 -> 2024-04-24 Tehran midnight
    const d = toGregorian(1403, 2, 5);
    expect(formatJalali(d)).toBe("۱۴۰۳/۰۲/۰۵");
  });
});
