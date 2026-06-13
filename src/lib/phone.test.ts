import { describe, it, expect } from "vitest";
import { normalizePhone } from "./phone";
import { isOk } from "./result";

const CANONICAL = "09123456789";

describe("normalizePhone", () => {
  describe("happy: valid formats (≥25 variants)", () => {
    const validCases: [string, string][] = [
      ["09123456789", "plain canonical"],
      ["9123456789", "bare without leading zero"],
      ["+989123456789", "+98 prefix"],
      ["00989123456789", "0098 prefix"],
      ["989123456789", "98 prefix no plus"],
      ["0912 345 6789", "spaces"],
      ["0912-345-6789", "dashes"],
      ["0912.345.6789", "dots"],
      ["(0912) 345-6789", "parens and dash"],
      ["0912 - 345 - 6789", "spaced dashes"],
      [" 09123456789 ", "leading/trailing whitespace"],
      ["09123456789", "already canonical"],
      ["+98 912 345 6789", "+98 with spaces"],
      ["0098-912-345-6789", "0098 with dashes"],
      ["98 912 345 6789", "98 with spaces"],
      ["9.123456789E+9", "Excel scientific notation"],
      ["9.123456789e+9", "lowercase sci notation"],
      ["9.123456789E9", "sci notation no plus"],
      ["۰۹۱۲۳۴۵۶۷۸۹", "Persian digits"],
      ["٠٩١٢٣٤٥٦٧٨٩", "Arabic digits"],
      ["+۹۸۹۱۲۳۴۵۶۷۸۹", "Persian +98 prefix"],
      ["0912(345)6789", "parens mid-number"],
      [" +98 912 345 6789 ", "+98 spaces with outer whitespace"],
      ["0098 9123456789", "0098 space bare"],
      ["98-912-345-6789", "98 dashes"],
      ["09351234567", "different operator (Irancell)"],
      ["09011234567", "different operator (MCI 0901)"],
      ["09221234567", "different operator (0922)"],
    ];

    it.each(validCases)("normalizes %j (%s)", (input) => {
      const result = normalizePhone(input);
      expect(result.ok).toBe(true);
      if (isOk(result)) {
        const expected = input.includes("0935")
          ? "09351234567"
          : input.includes("0901")
            ? "09011234567"
            : input.includes("0922")
              ? "09221234567"
              : CANONICAL;
        expect(result.value).toBe(expected);
      }
    });

    it("all variants of the same number canonicalize identically", () => {
      const sameNumber = [
        "09123456789",
        "+989123456789",
        "00989123456789",
        "989123456789",
        "9123456789",
        "0912 345 6789",
        "9.123456789E+9",
        "۰۹۱۲۳۴۵۶۷۸۹",
      ];
      const results = sameNumber.map((s) => normalizePhone(s));
      for (const r of results) {
        expect(r.ok).toBe(true);
        if (isOk(r)) {
          expect(r.value).toBe(CANONICAL);
        }
      }
    });
  });

  describe("edge: invalid inputs", () => {
    it("empty string returns error", () => {
      const result = normalizePhone("");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INVALID_PHONE");
    });

    it("whitespace-only returns error", () => {
      const result = normalizePhone("   ");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("INVALID_PHONE");
    });

    it("too short number returns error", () => {
      const result = normalizePhone("0912");
      expect(result.ok).toBe(false);
    });

    it("alphabetic input returns error", () => {
      const result = normalizePhone("abcdefghijk");
      expect(result.ok).toBe(false);
    });

    it("landline number (021) returns error", () => {
      const result = normalizePhone("02112345678");
      expect(result.ok).toBe(false);
    });

    it("too long number returns error", () => {
      const result = normalizePhone("091234567890");
      expect(result.ok).toBe(false);
    });

    it("never throws on any invalid input", () => {
      const badInputs = ["", "abc", "0912", "021-12345678", null as unknown as string];
      for (const input of badInputs) {
        expect(() => {
          try {
            normalizePhone(input);
          } catch {
            throw new Error("normalizePhone threw!");
          }
        }).not.toThrow();
      }
    });

    it("null/undefined returns error without throwing", () => {
      expect(() => normalizePhone(null as unknown as string)).not.toThrow();
      expect(() => normalizePhone(undefined as unknown as string)).not.toThrow();
      expect(normalizePhone(null as unknown as string).ok).toBe(false);
      expect(normalizePhone(undefined as unknown as string).ok).toBe(false);
    });
  });
});
