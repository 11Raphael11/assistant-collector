import type { Prisma, Customer, Contract, Installment } from "@prisma/client";
import { prisma } from "./db";

type CustomerCreateInput = Omit<
  Prisma.CustomerUncheckedCreateInput,
  "businessId"
> & { businessId?: string };

type ContractCreateInput = Omit<
  Prisma.ContractUncheckedCreateInput,
  "businessId"
> & { businessId?: string };

type InstallmentCreateInput = Omit<
  Prisma.InstallmentUncheckedCreateInput,
  "businessId"
> & { businessId?: string };

export interface CustomerAccessor {
  findById(id: string): Promise<Customer | null>;
  findMany(args?: {
    where?: Prisma.CustomerWhereInput;
    orderBy?: Prisma.CustomerOrderByWithRelationInput;
    take?: number;
    skip?: number;
  }): Promise<Customer[]>;
  create(data: CustomerCreateInput): Promise<Customer>;
  update(
    id: string,
    data: Prisma.CustomerUpdateInput,
  ): Promise<Customer | null>;
}

export interface ContractAccessor {
  findById(id: string): Promise<Contract | null>;
  findMany(args?: {
    where?: Prisma.ContractWhereInput;
    orderBy?: Prisma.ContractOrderByWithRelationInput;
    take?: number;
    skip?: number;
  }): Promise<Contract[]>;
  create(data: ContractCreateInput): Promise<Contract>;
  update(
    id: string,
    data: Prisma.ContractUpdateInput,
  ): Promise<Contract | null>;
}

export interface InstallmentAccessor {
  findById(id: string): Promise<Installment | null>;
  findMany(args?: {
    where?: Prisma.InstallmentWhereInput;
    orderBy?: Prisma.InstallmentOrderByWithRelationInput;
    take?: number;
    skip?: number;
  }): Promise<Installment[]>;
  create(data: InstallmentCreateInput): Promise<Installment>;
  update(
    id: string,
    data: Prisma.InstallmentUpdateInput,
  ): Promise<Installment | null>;
}

export interface ScopedRepository {
  readonly businessId: string;
  readonly customers: CustomerAccessor;
  readonly contracts: ContractAccessor;
  readonly installments: InstallmentAccessor;
}

export function createRepository(businessId: string): ScopedRepository {
  if (typeof businessId !== "string" || businessId.length === 0) {
    throw new Error("createRepository: businessId must be a non-empty string");
  }

  const scope = { businessId, deletedAt: null } as const;

  const customers: CustomerAccessor = {
    findById: (id) =>
      prisma.customer.findFirst({ where: { id, ...scope } }),
    findMany: (args = {}) =>
      prisma.customer.findMany({
        ...args,
        where: { ...(args.where ?? {}), ...scope },
      }),
    create: (data) =>
      prisma.customer.create({ data: { ...data, businessId } }),
    update: async (id, data) => {
      const existing = await prisma.customer.findFirst({
        where: { id, ...scope },
        select: { id: true },
      });
      if (!existing) return null;
      return prisma.customer.update({
        where: { id },
        data: { ...data, businessId },
      });
    },
  };

  const contracts: ContractAccessor = {
    findById: (id) =>
      prisma.contract.findFirst({ where: { id, ...scope } }),
    findMany: (args = {}) =>
      prisma.contract.findMany({
        ...args,
        where: { ...(args.where ?? {}), ...scope },
      }),
    create: (data) =>
      prisma.contract.create({ data: { ...data, businessId } }),
    update: async (id, data) => {
      const existing = await prisma.contract.findFirst({
        where: { id, ...scope },
        select: { id: true },
      });
      if (!existing) return null;
      return prisma.contract.update({
        where: { id },
        data: { ...data, businessId },
      });
    },
  };

  const installments: InstallmentAccessor = {
    findById: (id) =>
      prisma.installment.findFirst({ where: { id, ...scope } }),
    findMany: (args = {}) =>
      prisma.installment.findMany({
        ...args,
        where: { ...(args.where ?? {}), ...scope },
      }),
    create: (data) =>
      prisma.installment.create({ data: { ...data, businessId } }),
    update: async (id, data) => {
      const existing = await prisma.installment.findFirst({
        where: { id, ...scope },
        select: { id: true },
      });
      if (!existing) return null;
      return prisma.installment.update({
        where: { id },
        data: { ...data, businessId },
      });
    },
  };

  return { businessId, customers, contracts, installments };
}
