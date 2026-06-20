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

const mockUpdate = vi.fn();
const mockFindMany = vi.fn();
const mockFindById = vi.fn();

vi.mock("@/server/repository", () => ({
  createRepository: (businessId: string) => ({
    businessId,
    customers: {
      create: vi.fn(),
      findById: (id: string) => mockFindById(id),
      findMany: (args: unknown) => mockFindMany(args),
      update: (id: string, data: unknown) => mockUpdate(id, data),
    },
    contracts: {},
    installments: {},
  }),
}));

import { updateCustomer, softDeleteCustomer } from "./update";

function fakeCustomerRecord(
  overrides: Partial<{
    id: string;
    name: string;
    phone: string;
    businessId: string;
  }> = {},
) {
  const phone = overrides.phone ?? "09123456789";
  const name = overrides.name ?? "علی رضایی";
  return {
    id: overrides.id ?? "cust-1",
    businessId: overrides.businessId ?? "biz-1",
    name,
    nameNormalized: normalizePersian(name),
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

describe("updateCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy: changing the name updates nameNormalized", async () => {
    const newName = "مریم احمدی";

    mockFindMany.mockResolvedValue([]);
    mockUpdate.mockImplementation(
      (_id: string, data: Record<string, unknown>) =>
        Promise.resolve({
          ...fakeCustomerRecord(),
          ...data,
          name: data.name ?? "علی رضایی",
        }),
    );

    const result = await updateCustomer("biz-1", "cust-1", {
      name: newName,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.name).toBe(newName);
    expect(result.value.nameNormalized).toBe(normalizePersian(newName));
    expect(mockUpdate).toHaveBeenCalledOnce();

    const updateCall = mockUpdate.mock.calls[0];
    expect(updateCall[0]).toBe("cust-1");
    expect(updateCall[1]).toHaveProperty("nameNormalized", normalizePersian(newName));
  });

  it("happy: changing the phone re-derives all PII fields", async () => {
    const newPhone = "09187654321";

    mockFindMany.mockResolvedValue([]);
    mockUpdate.mockImplementation(
      (_id: string, data: Record<string, unknown>) =>
        Promise.resolve({
          ...fakeCustomerRecord({ phone: newPhone }),
          ...data,
        }),
    );

    const result = await updateCustomer("biz-1", "cust-1", {
      phone: newPhone,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.phone).toBe(newPhone);
    expect(result.value.phoneLast4).toBe("4321");

    const updateData = mockUpdate.mock.calls[0][1] as Record<string, unknown>;
    expect(updateData.phoneHash).toBe(blindIndex(newPhone));
    expect(updateData.phoneLast4).toBe(last4(newPhone));
    expect(updateData.phoneEnc).toBeDefined();
  });

  it("edge: updating to a phone that collides with another customer returns CUSTOMER_EXISTS", async () => {
    const collidingPhone = "09187654321";

    mockFindMany.mockResolvedValue([
      fakeCustomerRecord({ id: "cust-other", phone: collidingPhone }),
    ]);

    const result = await updateCustomer("biz-1", "cust-1", {
      phone: collidingPhone,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("CUSTOMER_EXISTS");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("edge: updating phone to same number (own record) succeeds", async () => {
    const samePhone = "09123456789";

    mockFindMany.mockResolvedValue([
      fakeCustomerRecord({ id: "cust-1", phone: samePhone }),
    ]);
    mockUpdate.mockImplementation(
      (_id: string, data: Record<string, unknown>) =>
        Promise.resolve({
          ...fakeCustomerRecord({ phone: samePhone }),
          ...data,
        }),
    );

    const result = await updateCustomer("biz-1", "cust-1", {
      phone: samePhone,
    });

    expect(result.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalledOnce();
  });

  it("edge: updating a non-existent customer returns NOT_FOUND", async () => {
    mockFindMany.mockResolvedValue([]);
    mockUpdate.mockResolvedValue(null);

    const result = await updateCustomer("biz-1", "cust-missing", {
      name: "تست",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("edge: empty patch returns VALIDATION error", async () => {
    const result = await updateCustomer("biz-1", "cust-1", {});

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("VALIDATION");
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe("softDeleteCustomer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy: soft-deleted customers disappear from list but rows remain", async () => {
    mockUpdate.mockImplementation(
      (_id: string, data: Record<string, unknown>) =>
        Promise.resolve({
          ...fakeCustomerRecord(),
          ...data,
        }),
    );

    const result = await softDeleteCustomer("biz-1", "cust-1");

    expect(result.ok).toBe(true);
    expect(mockUpdate).toHaveBeenCalledOnce();

    const updateCall = mockUpdate.mock.calls[0];
    expect(updateCall[0]).toBe("cust-1");
    expect(updateCall[1]).toHaveProperty("deletedAt");
    expect(updateCall[1].deletedAt).toBeInstanceOf(Date);
  });

  it("edge: soft-deleting a non-existent customer returns NOT_FOUND", async () => {
    mockUpdate.mockResolvedValue(null);

    const result = await softDeleteCustomer("biz-1", "cust-missing");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });
});
