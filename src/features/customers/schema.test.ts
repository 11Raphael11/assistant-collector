import { describe, it, expect } from "vitest";
import {
  createCustomerSchema,
  updateCustomerSchema,
  nationalIdSchema,
} from "./schema";

describe("nationalIdSchema", () => {
  it("happy: accepts a valid national id", () => {
    const result = nationalIdSchema.safeParse("0012583642");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("0012583642");
    }
  });

  it("happy: normalizes Persian digits before validation", () => {
    const result = nationalIdSchema.safeParse("۰۰۱۲۵۸۳۶۴۲");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("0012583642");
    }
  });

  it("edge: rejects a national id with wrong check digit", () => {
    const result = nationalIdSchema.safeParse("0012583649");
    expect(result.success).toBe(false);
  });

  it("edge: rejects all-same-digit national ids", () => {
    const result = nationalIdSchema.safeParse("1111111111");
    expect(result.success).toBe(false);
  });

  it("edge: rejects too-short input", () => {
    const result = nationalIdSchema.safeParse("12345");
    expect(result.success).toBe(false);
  });

  it("edge: rejects non-numeric input", () => {
    const result = nationalIdSchema.safeParse("abcdefghij");
    expect(result.success).toBe(false);
  });
});

describe("createCustomerSchema", () => {
  it("happy: parses valid input with name, phone, and optional nationalId", () => {
    const result = createCustomerSchema.safeParse({
      name: "علی رضایی",
      phone: "۰۹۱۲۱۲۳۴۵۶۷",
      nationalId: "۰۰۱۲۵۸۳۶۴۲",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("علی رضایی");
      expect(result.data.phone).toBe("09121234567");
      expect(result.data.nationalId).toBe("0012583642");
    }
  });

  it("happy: parses valid input without nationalId", () => {
    const result = createCustomerSchema.safeParse({
      name: "مریم",
      phone: "09121234567",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nationalId).toBeUndefined();
    }
  });

  it("edge: rejects invalid phone number", () => {
    const result = createCustomerSchema.safeParse({
      name: "تست",
      phone: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("edge: rejects empty name", () => {
    const result = createCustomerSchema.safeParse({
      name: "",
      phone: "09121234567",
    });
    expect(result.success).toBe(false);
  });

  it("edge: rejects name longer than 100 characters", () => {
    const result = createCustomerSchema.safeParse({
      name: "ا".repeat(101),
      phone: "09121234567",
    });
    expect(result.success).toBe(false);
  });

  it("edge: rejects national id with bad check digit", () => {
    const result = createCustomerSchema.safeParse({
      name: "تست",
      phone: "09121234567",
      nationalId: "0012583649",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateCustomerSchema", () => {
  it("happy: parses partial update with only name", () => {
    const result = updateCustomerSchema.safeParse({ name: "نام جدید" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("نام جدید");
      expect(result.data.phone).toBeUndefined();
    }
  });

  it("happy: parses empty object (no fields required)", () => {
    const result = updateCustomerSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("edge: still validates phone when provided", () => {
    const result = updateCustomerSchema.safeParse({ phone: "invalid" });
    expect(result.success).toBe(false);
  });
});
