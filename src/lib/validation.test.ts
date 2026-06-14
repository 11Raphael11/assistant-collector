import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  zPersianDigits,
  zRialAmount,
  parseOrError,
} from "./validation";
import { isOk } from "./result";

describe("zPersianDigits", () => {
  it("happy: converts Persian digits to Latin before validation", () => {
    const schema = zPersianDigits.pipe(z.string().regex(/^\d{11}$/));
    const result = parseOrError(schema, "۰۹۱۲۳۴۵۶۷۸۹");

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toBe("09123456789");
    }
  });

  it("happy: accepts already-Latin digits unchanged", () => {
    const result = parseOrError(zPersianDigits, "12345");
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBe("12345");
  });

  it("edge: non-string input fails with VALIDATION error", () => {
    const result = parseOrError(zPersianDigits, 123);
    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(result.error.code).toBe("VALIDATION");
    }
  });
});

describe("zRialAmount", () => {
  it("happy: accepts a positive integer number", () => {
    const result = parseOrError(zRialAmount, 50000);
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBe(50000);
  });

  it("happy: parses Persian-digit numeric strings to positive integer", () => {
    const result = parseOrError(zRialAmount, "۱۰۰۰۰۰");
    expect(isOk(result)).toBe(true);
    if (isOk(result)) expect(result.value).toBe(100000);
  });

  it("edge: rejects zero", () => {
    const result = parseOrError(zRialAmount, 0);
    expect(isOk(result)).toBe(false);
    if (!isOk(result)) expect(result.error.code).toBe("VALIDATION");
  });

  it("edge: rejects negative integers", () => {
    const result = parseOrError(zRialAmount, -100);
    expect(isOk(result)).toBe(false);
  });

  it("edge: rejects non-integer numbers", () => {
    const result = parseOrError(zRialAmount, 12.5);
    expect(isOk(result)).toBe(false);
  });

  it("edge: rejects non-numeric strings", () => {
    const result = parseOrError(zRialAmount, "abc");
    expect(isOk(result)).toBe(false);
    if (!isOk(result)) expect(result.error.code).toBe("VALIDATION");
  });
});

describe("parseOrError", () => {
  it("happy: returns ok(value) when schema matches", () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const result = parseOrError(schema, { name: "Ali", age: 30 });

    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value).toEqual({ name: "Ali", age: 30 });
    }
  });

  it("edge: returns err('VALIDATION', ...) and does NOT throw on invalid payload", () => {
    const schema = z.object({ name: z.string(), age: z.number() });

    expect(() => parseOrError(schema, { name: 1, age: "x" })).not.toThrow();

    const result = parseOrError(schema, { name: 1, age: "x" });
    expect(isOk(result)).toBe(false);
    if (!isOk(result)) {
      expect(result.error.code).toBe("VALIDATION");
      expect(result.error.message.length).toBeGreaterThan(0);
    }
  });

  it("edge: never throws on null/undefined input", () => {
    const schema = z.string();
    expect(() => parseOrError(schema, null)).not.toThrow();
    expect(() => parseOrError(schema, undefined)).not.toThrow();

    const r1 = parseOrError(schema, null);
    const r2 = parseOrError(schema, undefined);
    expect(isOk(r1)).toBe(false);
    expect(isOk(r2)).toBe(false);
  });
});
