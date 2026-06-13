import { describe, it, expect } from "vitest";
import { toLatinDigits } from "./digits";

describe("toLatinDigits", () => {
  it("happy: converts Persian digits to ASCII", () => {
    expect(toLatinDigits("۱۲۳")).toBe("123");
  });

  it("happy: converts Arabic-Indic digits to ASCII", () => {
    expect(toLatinDigits("١٢٣")).toBe("123");
  });

  it("happy: converts mixed Persian text with digits", () => {
    expect(toLatinDigits("سفارش ۴۲")).toBe("سفارش 42");
  });

  it("happy: ASCII digits pass through unchanged", () => {
    expect(toLatinDigits("123")).toBe("123");
  });

  it("happy: mixed Persian, Arabic-Indic, and ASCII digits", () => {
    expect(toLatinDigits("۱٢3")).toBe("123");
  });

  it("edge: empty string returns empty string", () => {
    expect(toLatinDigits("")).toBe("");
  });

  it("edge: string with no digits is returned unchanged", () => {
    expect(toLatinDigits("سلام دنیا")).toBe("سلام دنیا");
  });

  it("edge: all ten Persian digits map correctly", () => {
    expect(toLatinDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });

  it("edge: all ten Arabic-Indic digits map correctly", () => {
    expect(toLatinDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });
});
