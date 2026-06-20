import { createRepository } from "../../server/repository";
import { encryptPII, decryptPII, blindIndex, last4 } from "../../lib/crypto";
import { normalizePersian } from "../../lib/text";
import type { Result } from "../../lib/result";
import { ok, err } from "../../lib/result";
import type { Customer } from "@prisma/client";

export interface CustomerRow {
  id: string;
  businessId: string;
  name: string;
  nameNormalized: string;
  phoneLast4: string;
  nationalIdHash: string | null;
  note: string | null;
  createdAt: Date;
  deletedAt: Date | null;
}

export interface CustomerRowWithPhone extends CustomerRow {
  phone: string;
}

interface InsertCustomerInput {
  name: string;
  phone: string;
  nationalId?: string;
  note?: string;
}

interface UpdateCustomerInput {
  name?: string;
  phone?: string;
  nationalId?: string;
  note?: string;
}

export function toRow(c: Customer): CustomerRow {
  return {
    id: c.id,
    businessId: c.businessId,
    name: c.name,
    nameNormalized: c.nameNormalized,
    phoneLast4: c.phoneLast4,
    nationalIdHash: c.nationalIdHash,
    note: c.note,
    createdAt: c.createdAt,
    deletedAt: c.deletedAt,
  };
}

function toRowWithPhone(c: Customer): Result<CustomerRowWithPhone> {
  const phoneResult = decryptPII(
    (c.phoneEnc as Buffer).toString("utf8"),
  );
  if (!phoneResult.ok) {
    return err("DECRYPT_FAILED", "failed to decrypt phone");
  }
  return ok({
    ...toRow(c),
    phone: phoneResult.value,
  });
}

export interface CustomerRepository {
  insertCustomer(input: InsertCustomerInput): Promise<CustomerRowWithPhone>;
  findCustomerById(id: string): Promise<CustomerRowWithPhone | null>;
  findByPhoneHash(phone: string): Promise<CustomerRowWithPhone | null>;
  listCustomers(opts?: {
    take?: number;
    skip?: number;
  }): Promise<CustomerRow[]>;
  updateCustomer(id: string, input: UpdateCustomerInput): Promise<CustomerRowWithPhone | null>;
  softDeleteCustomer(id: string): Promise<boolean>;
}

export function createCustomerRepository(
  businessId: string,
): CustomerRepository {
  const repo = createRepository(businessId);

  return {
    async insertCustomer(input) {
      const phoneEncStr = encryptPII(input.phone);
      const phoneHash = blindIndex(input.phone);
      const phoneLast4Val = last4(input.phone);
      const nameNormalized = normalizePersian(input.name);

      const data: Record<string, unknown> = {
        name: input.name,
        nameNormalized,
        phoneEnc: Buffer.from(phoneEncStr, "utf8"),
        phoneHash,
        phoneLast4: phoneLast4Val,
      };

      if (input.nationalId) {
        data.nationalIdEnc = Buffer.from(
          encryptPII(input.nationalId),
          "utf8",
        );
        data.nationalIdHash = blindIndex(input.nationalId);
      }

      if (input.note !== undefined) {
        data.note = input.note;
      }

      const customer = await repo.customers.create(data);

      const result = toRowWithPhone(customer);
      if (!result.ok) {
        throw new Error(result.error.message);
      }
      return result.value;
    },

    async findCustomerById(id) {
      const customer = await repo.customers.findById(id);
      if (!customer) return null;
      const result = toRowWithPhone(customer);
      if (!result.ok) return null;
      return result.value;
    },

    async findByPhoneHash(phone) {
      const hash = blindIndex(phone);
      const results = await repo.customers.findMany({
        where: { phoneHash: hash },
      });
      if (results.length === 0) return null;
      const result = toRowWithPhone(results[0]);
      if (!result.ok) return null;
      return result.value;
    },

    async listCustomers(opts = {}) {
      const customers = await repo.customers.findMany({
        take: opts.take,
        skip: opts.skip,
        orderBy: { createdAt: "desc" },
      });
      return customers.map(toRow);
    },

    async updateCustomer(id, input) {
      const data: Record<string, unknown> = {};

      if (input.name !== undefined) {
        data.name = input.name;
        data.nameNormalized = normalizePersian(input.name);
      }

      if (input.phone !== undefined) {
        data.phoneEnc = Buffer.from(encryptPII(input.phone), "utf8");
        data.phoneHash = blindIndex(input.phone);
        data.phoneLast4 = last4(input.phone);
      }

      if (input.nationalId !== undefined) {
        data.nationalIdEnc = Buffer.from(encryptPII(input.nationalId), "utf8");
        data.nationalIdHash = blindIndex(input.nationalId);
      }

      if (input.note !== undefined) {
        data.note = input.note;
      }

      const updated = await repo.customers.update(id, data);
      if (!updated) return null;

      const result = toRowWithPhone(updated);
      if (!result.ok) return null;
      return result.value;
    },

    async softDeleteCustomer(id) {
      const updated = await repo.customers.update(id, {
        deletedAt: new Date(),
      });
      return updated !== null;
    },
  };
}
