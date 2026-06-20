import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.SESSION_SECRET = "test-secret";
process.env.ENCRYPTION_KEY =
  "0000000000000000000000000000000000000000000000000000000000000000";
process.env.BLIND_INDEX_KEY =
  "1111111111111111111111111111111111111111111111111111111111111111";
process.env.CRON_SECRET = "test-cron";

import { encryptPII, blindIndex, last4 } from "../../lib/crypto";
import { normalizePersian } from "../../lib/text";

const mockCreate = vi.fn();
const mockFindMany = vi.fn();

vi.mock("@/server/repository", () => ({
  createRepository: (businessId: string) => ({
    businessId,
    customers: {
      create: (data: unknown) => mockCreate(data),
      findById: vi.fn(),
      findMany: (args: unknown) => mockFindMany(args),
      update: vi.fn(),
    },
    contracts: {},
    installments: {},
  }),
}));

import { createCustomer } from "./create";

function fakeCustomerRecord(phone: string, businessId: string) {
  return {
    id: "cust-1",
    businessId,
    name: "علی رضایی",
    nameNormalized: normalizePersian("علی رضایی"),
    phoneEnc: Buffer.from(encryptPII(phone), "utf8"),
    phoneHash: blindIndex(phone),
    phoneLast4: last4(phone),
    nationalIdEnc: null,
    nationalIdHash: null,
    note: null,
    createdAt: new Date("2025-01-01"),
    deletedAt: null,
  };
}

describe("createCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy: adding '0912 345 67 89' inserts and returns customer", async () => {
    const phone = "09123456789";

    mockFindMany.mockResolvedValue([]);
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve({
        id: "cust-new",
        businessId: "biz-1",
        ...data,
        createdAt: new Date("2025-01-01"),
        deletedAt: null,
      }),
    );

    const result = await createCustomer("biz-1", {
      name: "علی رضایی",
      phone: "0912 345 67 89",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.phone).toBe(phone);
    expect(result.value.phoneLast4).toBe("6789");
    expect(result.value.name).toBe("علی رضایی");

    expect(mockFindMany).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("edge: adding the same number again returns CUSTOMER_EXISTS (#4)", async () => {
    const phone = "09123456789";

    mockFindMany.mockResolvedValue([]);
    mockCreate.mockImplementation((data: Record<string, unknown>) =>
      Promise.resolve({
        id: "cust-1",
        businessId: "biz-1",
        ...data,
        createdAt: new Date("2025-01-01"),
        deletedAt: null,
      }),
    );

    const first = await createCustomer("biz-1", {
      name: "علی رضایی",
      phone: "0912 345 67 89",
    });
    expect(first.ok).toBe(true);

    mockFindMany.mockResolvedValue([fakeCustomerRecord(phone, "biz-1")]);

    const second = await createCustomer("biz-1", {
      name: "مریم احمدی",
      phone: "0912 345 67 89",
    });

    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.error.code).toBe("CUSTOMER_EXISTS");
    expect(second.error.message).toContain("قبلاً ثبت شده");

    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("edge: DB unique constraint race mapped to CUSTOMER_EXISTS, not crash (#4)", async () => {
    mockFindMany.mockResolvedValue([]);

    const prismaUniqueError = Object.assign(new Error("Unique constraint"), {
      code: "P2002",
    });
    mockCreate.mockRejectedValue(prismaUniqueError);

    const result = await createCustomer("biz-1", {
      name: "سارا محمدی",
      phone: "09123456789",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CUSTOMER_EXISTS");
    expect(result.error.message).toContain("قبلاً ثبت شده");
  });

  it("edge: invalid phone is rejected with validation error", async () => {
    const result = await createCustomer("biz-1", {
      name: "تست",
      phone: "12345",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("edge: non-P2002 DB errors are re-thrown", async () => {
    mockFindMany.mockResolvedValue([]);
    mockCreate.mockRejectedValue(new Error("Connection lost"));

    await expect(
      createCustomer("biz-1", {
        name: "تست",
        phone: "09123456789",
      }),
    ).rejects.toThrow("Connection lost");
  });
});
