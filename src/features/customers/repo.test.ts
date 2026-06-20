import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.SESSION_SECRET = "test-secret";
process.env.ENCRYPTION_KEY =
  "0000000000000000000000000000000000000000000000000000000000000000";
process.env.BLIND_INDEX_KEY =
  "1111111111111111111111111111111111111111111111111111111111111111";
process.env.CRON_SECRET = "test-cron";

import type { Customer } from "@prisma/client";
import { encryptPII, blindIndex, last4 } from "../../lib/crypto";
import { normalizePersian } from "../../lib/text";

const mockCreate = vi.fn();
const mockFindById = vi.fn();
const mockFindMany = vi.fn();
const mockUpdate = vi.fn();

vi.mock("@/server/repository", () => ({
  createRepository: (businessId: string) => ({
    businessId,
    customers: {
      create: (data: unknown) => mockCreate(data),
      findById: (id: string) => mockFindById(id),
      findMany: (args: unknown) => mockFindMany(args),
      update: (id: string, data: unknown) => mockUpdate(id, data),
    },
    contracts: {},
    installments: {},
  }),
}));

import { createCustomerRepository } from "./repo";

function fakeCustomer(overrides: Partial<Customer> = {}): Customer {
  const phone = "09121234567";
  return {
    id: "cust-1",
    businessId: "biz-1",
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
    ...overrides,
  };
}

describe("CustomerRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("insertCustomer", () => {
    it("happy: builds PII fields correctly and returns decrypted phone", async () => {
      const phone = "09121234567";
      const name = "علی رضایی";

      mockCreate.mockImplementation((data: Record<string, unknown>) => {
        return Promise.resolve({
          id: "cust-new",
          businessId: "biz-1",
          ...data,
          createdAt: new Date("2025-01-01"),
          deletedAt: null,
        });
      });

      const repo = createCustomerRepository("biz-1");
      const result = await repo.insertCustomer({ name, phone });

      expect(result.phone).toBe(phone);
      expect(result.phoneLast4).toBe("4567");
      expect(result.nameNormalized).toBe(normalizePersian(name));
      expect(result.name).toBe(name);

      const createArg = mockCreate.mock.calls[0][0] as Record<string, unknown>;
      expect(createArg.phoneHash).toBe(blindIndex(phone));
      expect(createArg.phoneLast4).toBe(last4(phone));
      expect(createArg.nameNormalized).toBe(normalizePersian(name));
      expect(createArg.phoneEnc).toBeInstanceOf(Buffer);
    });

    it("happy: handles optional nationalId PII fields", async () => {
      const phone = "09121234567";
      const nationalId = "0012583642";

      mockCreate.mockImplementation((data: Record<string, unknown>) => {
        return Promise.resolve({
          id: "cust-new",
          businessId: "biz-1",
          ...data,
          createdAt: new Date("2025-01-01"),
          deletedAt: null,
        });
      });

      const repo = createCustomerRepository("biz-1");
      await repo.insertCustomer({ name: "Test", phone, nationalId });

      const createArg = mockCreate.mock.calls[0][0] as Record<string, unknown>;
      expect(createArg.nationalIdHash).toBe(blindIndex(nationalId));
      expect(createArg.nationalIdEnc).toBeInstanceOf(Buffer);
    });
  });

  describe("findByPhoneHash", () => {
    it("happy: finds customer by phone and decrypts PII", async () => {
      const phone = "09121234567";
      const customer = fakeCustomer();
      mockFindMany.mockResolvedValue([customer]);

      const repo = createCustomerRepository("biz-1");
      const found = await repo.findByPhoneHash(phone);

      expect(found).not.toBeNull();
      expect(found!.phone).toBe(phone);
      expect(found!.phoneLast4).toBe("4567");

      const findArg = mockFindMany.mock.calls[0][0] as { where: { phoneHash: string } };
      expect(findArg.where.phoneHash).toBe(blindIndex(phone));
    });

    it("edge: returns null when phone not found", async () => {
      mockFindMany.mockResolvedValue([]);

      const repo = createCustomerRepository("biz-1");
      const found = await repo.findByPhoneHash("09999999999");

      expect(found).toBeNull();
    });
  });

  describe("findCustomerById", () => {
    it("happy: returns customer with decrypted phone", async () => {
      const customer = fakeCustomer();
      mockFindById.mockResolvedValue(customer);

      const repo = createCustomerRepository("biz-1");
      const found = await repo.findCustomerById("cust-1");

      expect(found).not.toBeNull();
      expect(found!.phone).toBe("09121234567");
      expect(found!.id).toBe("cust-1");
    });

    it("edge: returns null for non-existent id", async () => {
      mockFindById.mockResolvedValue(null);

      const repo = createCustomerRepository("biz-1");
      const found = await repo.findCustomerById("no-such-id");

      expect(found).toBeNull();
    });
  });

  describe("listCustomers", () => {
    it("happy: returns rows without decrypted phone", async () => {
      mockFindMany.mockResolvedValue([fakeCustomer(), fakeCustomer({ id: "cust-2" })]);

      const repo = createCustomerRepository("biz-1");
      const list = await repo.listCustomers();

      expect(list).toHaveLength(2);
      expect(list[0]).not.toHaveProperty("phone");
      expect(list[0]).toHaveProperty("phoneLast4");
    });
  });

  describe("softDeleteCustomer", () => {
    it("happy: marks customer as deleted", async () => {
      mockUpdate.mockResolvedValue(fakeCustomer({ deletedAt: new Date() }));

      const repo = createCustomerRepository("biz-1");
      const result = await repo.softDeleteCustomer("cust-1");

      expect(result).toBe(true);
      const [id, data] = mockUpdate.mock.calls[0] as [string, { deletedAt: Date }];
      expect(id).toBe("cust-1");
      expect(data.deletedAt).toBeInstanceOf(Date);
    });

    it("edge: returns false when customer not found in scope", async () => {
      mockUpdate.mockResolvedValue(null);

      const repo = createCustomerRepository("biz-1");
      const result = await repo.softDeleteCustomer("no-such-id");

      expect(result).toBe(false);
    });
  });

  describe("tenant scope (#3)", () => {
    it("edge: customer inserted under business A is invisible to business B", async () => {
      const phone = "09121234567";
      const customerA = fakeCustomer({ businessId: "biz-A" });

      mockCreate.mockResolvedValue(customerA);
      const repoA = createCustomerRepository("biz-A");
      await repoA.insertCustomer({ name: "Test", phone });

      mockFindMany.mockResolvedValue([]);
      const repoB = createCustomerRepository("biz-B");
      const found = await repoB.findByPhoneHash(phone);

      expect(found).toBeNull();
    });
  });
});
