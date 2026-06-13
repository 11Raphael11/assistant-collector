import { describe, it, expect } from "vitest";
import { normalizePersian } from "./text";

describe("normalizePersian", () => {
  it("happy: converts Arabic ي to Persian ی", () => {
    expect(normalizePersian("علي")).toBe("علی");
  });

  it("happy: converts Arabic ك to Persian ک", () => {
    expect(normalizePersian("كتاب")).toBe("کتاب");
  });

  it("happy: converts Arabic ة to Persian ه", () => {
    expect(normalizePersian("خانة")).toBe("خانه");
  });

  it("happy: removes tatweel (kashida)", () => {
    expect(normalizePersian("کتـــاب")).toBe("کتاب");
  });

  it("happy: collapses repeated whitespace", () => {
    expect(normalizePersian("علی   احمدی")).toBe("علی احمدی");
  });

  it("happy: trims leading/trailing whitespace", () => {
    expect(normalizePersian("  سلام  ")).toBe("سلام");
  });

  it("happy: lowercases Latin letters", () => {
    expect(normalizePersian("Ali Ahmadi")).toBe("ali ahmadi");
  });

  it("happy: mixed Latin/Persian normalizes both sides", () => {
    expect(normalizePersian("Ali علي")).toBe("ali علی");
  });

  it("edge: empty string returns empty", () => {
    expect(normalizePersian("")).toBe("");
  });

  it("edge: idempotent — normalizing twice gives same result", () => {
    const input = "  علي  كتـاب  Ali  ";
    const once = normalizePersian(input);
    const twice = normalizePersian(once);
    expect(twice).toBe(once);
  });

  it("edge: preserves legitimate spaces between words", () => {
    expect(normalizePersian("سلام دوست من")).toBe("سلام دوست من");
  });

  it("edge: does not convert digits", () => {
    expect(normalizePersian("۱۲۳")).toBe("۱۲۳");
  });
});
