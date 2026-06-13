import { describe, it, expect } from "vitest";
import { rialToToman, tomanToRial, formatToman, parseTomanInput } from "./money";
import { isOk } from "./result";

describe("rialToToman", () => {
  it("happy: converts rial to toman", () => {
    expect(rialToToman(12_000_000)).toBe(1_200_000);
    expect(rialToToman(0)).toBe(0);
    expect(rialToToman(10)).toBe(1);
  });
});

describe("tomanToRial", () => {
  it("happy: converts toman to rial", () => {
    expect(tomanToRial(1_200_000)).toBe(12_000_000);
    expect(tomanToRial(0)).toBe(0);
    expect(tomanToRial(1)).toBe(10);
  });
});

describe("formatToman", () => {
  it("happy: formats rial as toman with thousands separators", () => {
    expect(formatToman(12_000_000)).toBe("1,200,000");
    expect(formatToman(0)).toBe("0");
    expect(formatToman(10)).toBe("1");
    expect(formatToman(100)).toBe("10");
    expect(formatToman(10_000)).toBe("1,000");
  });

  it("edge: handles very large values", () => {
    expect(formatToman(1_000_000_000_000)).toBe("100,000,000,000");
  });
});

describe("parseTomanInput", () => {
  it("happy: parses plain Latin digits to rial", () => {
    const r = parseTomanInput("1200000");
    expect(r.ok).toBe(true);
    if (isOk(r)) expect(r.value).toBe(12_000_000);
  });

  it("happy: parses with comma separators", () => {
    const r = parseTomanInput("1,200,000");
    expect(r.ok).toBe(true);
    if (isOk(r)) expect(r.value).toBe(12_000_000);
  });

  it("happy: parses Persian digits with separators", () => {
    const r = parseTomanInput("۱٬۲۰۰٬۰۰۰");
    expect(r.ok).toBe(true);
    if (isOk(r)) expect(r.value).toBe(12_000_000);
  });

  it("happy: parses Arabic digits", () => {
    const r = parseTomanInput("٥٠٠٠");
    expect(r.ok).toBe(true);
    if (isOk(r)) expect(r.value).toBe(50_000);
  });

  it("happy: very large value keeps integer precision", () => {
    const r = parseTomanInput("100000000000");
    expect(r.ok).toBe(true);
    if (isOk(r)) {
      expect(r.value).toBe(1_000_000_000_000);
      expect(Number.isSafeInteger(r.value)).toBe(true);
    }
  });

  it("edge: rejects empty input", () => {
    const r = parseTomanInput("");
    expect(r.ok).toBe(false);
  });

  it("edge: rejects negative input", () => {
    const r = parseTomanInput("-500");
    expect(r.ok).toBe(false);
  });

  it("edge: rejects fractional input", () => {
    const r = parseTomanInput("1200.5");
    expect(r.ok).toBe(false);
  });

  it("edge: rejects non-numeric input", () => {
    const r = parseTomanInput("abc");
    expect(r.ok).toBe(false);
  });

  it("edge: rejects mixed text and digits", () => {
    const r = parseTomanInput("12abc34");
    expect(r.ok).toBe(false);
  });

  it("edge: handles whitespace in input", () => {
    const r = parseTomanInput("1 200 000");
    expect(r.ok).toBe(true);
    if (isOk(r)) expect(r.value).toBe(12_000_000);
  });
});
