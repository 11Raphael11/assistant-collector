import { toLatinDigits } from "./digits";
import { type Result, ok, err } from "./result";

const CANONICAL_RE = /^09\d{9}$/;

function expandScientific(s: string): string {
  const match = s.match(/^(\d+(?:\.\d+)?)[eE]\+?(\d+)$/);
  if (!match) return s;
  const [, base, exp] = match;
  const parts = base.split(".");
  const intPart = parts[0];
  const decPart = parts[1] ?? "";
  const shift = Number(exp);
  const digits = intPart + decPart;
  const totalLen = intPart.length + shift;
  return totalLen <= digits.length
    ? digits.slice(0, totalLen)
    : digits + "0".repeat(totalLen - digits.length);
}

export function normalizePhone(raw: string): Result<string> {
  if (raw == null || typeof raw !== "string" || raw.trim().length === 0) {
    return err("INVALID_PHONE", "Phone input is empty");
  }

  let s = toLatinDigits(raw.trim());
  s = s.replace(/[\s\-()]/g, "");
  s = expandScientific(s);
  s = s.replace(/\./g, "");
  s = s.replace(/^(\+98|0098|98)/, "0");

  if (!s.startsWith("0") && s.length === 10 && /^9\d{9}$/.test(s)) {
    s = "0" + s;
  }

  if (!CANONICAL_RE.test(s)) {
    return err("INVALID_PHONE", `Invalid Iranian mobile number: ${raw.trim()}`);
  }

  return ok(s);
}
