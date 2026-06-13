import { type Result, ok, err } from "./result";
import { toLatinDigits } from "./digits";

export function rialToToman(rial: number): number {
  return rial / 10;
}

export function tomanToRial(toman: number): number {
  return toman * 10;
}

export function formatToman(rial: number): string {
  const toman = rialToToman(rial);
  const parts: string[] = [];
  const str = String(toman);
  const isNeg = str.startsWith("-");
  const digits = isNeg ? str.slice(1) : str;

  for (let i = digits.length; i > 0; i -= 3) {
    const start = Math.max(0, i - 3);
    parts.unshift(digits.slice(start, i));
  }

  const formatted = parts.join(",");
  return isNeg ? `-${formatted}` : formatted;
}

export function parseTomanInput(raw: string): Result<number> {
  const latin = toLatinDigits(raw);
  const cleaned = latin.replace(/[,٬\s_]/g, "");

  if (cleaned === "") {
    return err("INVALID_AMOUNT", "Empty input");
  }

  if (!/^\d+$/.test(cleaned)) {
    return err("INVALID_AMOUNT", "Input must be a non-negative integer");
  }

  const toman = Number(cleaned);

  if (!Number.isSafeInteger(toman)) {
    return err("INVALID_AMOUNT", "Amount exceeds safe integer range");
  }

  const rial = toman * 10;

  if (!Number.isSafeInteger(rial)) {
    return err("INVALID_AMOUNT", "Rial amount exceeds safe integer range");
  }

  return ok(rial);
}
