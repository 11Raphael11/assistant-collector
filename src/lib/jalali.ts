import jalaali from "jalaali-js";

const TEHRAN_TZ = "Asia/Tehran";
const PERSIAN_ZERO = 0x06f0;

function toPersianDigits(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code >= 0x30 && code <= 0x39) {
      out += String.fromCharCode(PERSIAN_ZERO + (code - 0x30));
    } else {
      out += s[i];
    }
  }
  return out;
}

function tehranParts(date: Date): { gy: number; gm: number; gd: number } {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TEHRAN_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  return { gy: Number(map.year), gm: Number(map.month), gd: Number(map.day) };
}

function tehranOffsetMinutes(utcMs: number): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TEHRAN_TZ,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(new Date(utcMs));
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = p.value;
  }
  const asIfUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return (asIfUTC - utcMs) / 60000;
}

export function toJalali(date: Date): { jy: number; jm: number; jd: number } {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("INVALID_DATE");
  }
  const { gy, gm, gd } = tehranParts(date);
  return jalaali.toJalaali(gy, gm, gd);
}

export function toGregorian(jy: number, jm: number, jd: number): Date {
  if (!jalaali.isValidJalaaliDate(jy, jm, jd)) {
    throw new Error("INVALID_JALALI_DATE");
  }
  const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
  const utcMidnight = Date.UTC(gy, gm - 1, gd, 0, 0, 0);
  const offset = tehranOffsetMinutes(utcMidnight);
  return new Date(utcMidnight - offset * 60000);
}

function jalaliMonthLength(jy: number, jm: number): number {
  if (jm >= 1 && jm <= 6) return 31;
  if (jm >= 7 && jm <= 11) return 30;
  return jalaali.isLeapJalaaliYear(jy) ? 30 : 29;
}

export function addJalaliMonths(date: Date, months: number): Date {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error("INVALID_DATE");
  }
  if (!Number.isInteger(months)) {
    throw new Error("INVALID_MONTHS");
  }
  const { jy, jm, jd } = toJalali(date);
  const zeroBased = jy * 12 + (jm - 1) + months;
  const targetY = Math.floor(zeroBased / 12);
  const targetM = ((zeroBased % 12) + 12) % 12 + 1;
  const maxDay = jalaliMonthLength(targetY, targetM);
  const targetD = Math.min(jd, maxDay);
  return toGregorian(targetY, targetM, targetD);
}

export function formatJalali(date: Date): string {
  const { jy, jm, jd } = toJalali(date);
  const s = `${String(jy).padStart(4, "0")}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`;
  return toPersianDigits(s);
}
