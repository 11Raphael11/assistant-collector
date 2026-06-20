import { PrismaClient } from "@prisma/client";

// IMPORTANT: instantiate PrismaClient FIRST so it auto-loads `.env` into
// process.env before any module that reads ENCRYPTION_KEY / BLIND_INDEX_KEY
// is imported. The crypto/phone utils below read env at call time, but env
// validation in `lib/env` would otherwise fail when `.env` was not yet loaded.
const prisma = new PrismaClient();

import { encryptPII, blindIndex, last4 } from "../src/lib/crypto";
import { normalizePhone } from "../src/lib/phone";
import { normalizePersian } from "../src/lib/text";

type DemoCustomer = {
  id: string;
  name: string;
  rawPhone: string;
};

const DEMO_BUSINESS_ID = "demo_business_seed";
const DEMO_PLAN_ID = "demo_plan_starter";
const DEMO_SUBSCRIPTION_ID = "demo_subscription_seed";
const DEMO_OWNER_USER_ID = "demo_user_owner_seed";

const DEMO_CUSTOMERS: DemoCustomer[] = [
  { id: "demo_customer_1", name: "علی رضایی", rawPhone: "09120000001" },
  { id: "demo_customer_2", name: "زهرا کریمی", rawPhone: "09120000002" },
  { id: "demo_customer_3", name: "حسین موسوی", rawPhone: "09120000003" },
  { id: "demo_customer_4", name: "نرگس صادقی", rawPhone: "09120000004" },
  { id: "demo_customer_5", name: "رضا قاسمی", rawPhone: "09120000005" },
];

const DEMO_CONTRACT_A_ID = "demo_contract_a";
const DEMO_CONTRACT_B_ID = "demo_contract_b";

function buildPiiFields(rawPhone: string): {
  phoneEnc: Buffer;
  phoneHash: string;
  phoneLast4: string;
} {
  const normalized = normalizePhone(rawPhone);
  if (!normalized.ok) {
    throw new Error(
      `seed: invalid phone ${rawPhone}: ${normalized.error.message}`,
    );
  }
  const phone = normalized.value;
  return {
    phoneEnc: Buffer.from(encryptPII(phone), "utf8"),
    phoneHash: blindIndex(phone),
    phoneLast4: last4(phone),
  };
}

export async function seed(): Promise<void> {
  await prisma.business.upsert({
    where: { id: DEMO_BUSINESS_ID },
    update: { name: "فروشگاه دمو وصول‌یار", type: "retail" },
    create: {
      id: DEMO_BUSINESS_ID,
      name: "فروشگاه دمو وصول‌یار",
      type: "retail",
    },
  });

  await prisma.plan.upsert({
    where: { id: DEMO_PLAN_ID },
    update: {
      name: "Starter",
      customerCap: 100,
      smsQuota: 500,
      monthlyPriceRial: 1_000_000,
      features: { portal: true, ai: false },
    },
    create: {
      id: DEMO_PLAN_ID,
      name: "Starter",
      customerCap: 100,
      smsQuota: 500,
      monthlyPriceRial: 1_000_000,
      features: { portal: true, ai: false },
    },
  });

  const startsAt = new Date("2026-01-01T00:00:00.000Z");
  const endsAt = new Date("2027-01-01T00:00:00.000Z");
  await prisma.subscription.upsert({
    where: { id: DEMO_SUBSCRIPTION_ID },
    update: {
      businessId: DEMO_BUSINESS_ID,
      planId: DEMO_PLAN_ID,
      status: "active",
      startsAt,
      endsAt,
    },
    create: {
      id: DEMO_SUBSCRIPTION_ID,
      businessId: DEMO_BUSINESS_ID,
      planId: DEMO_PLAN_ID,
      status: "active",
      startsAt,
      endsAt,
    },
  });

  const ownerPii = buildPiiFields("09120000000");
  await prisma.user.upsert({
    where: { id: DEMO_OWNER_USER_ID },
    update: {
      businessId: DEMO_BUSINESS_ID,
      phoneEnc: ownerPii.phoneEnc,
      phoneHash: ownerPii.phoneHash,
      phoneLast4: ownerPii.phoneLast4,
      role: "owner",
    },
    create: {
      id: DEMO_OWNER_USER_ID,
      businessId: DEMO_BUSINESS_ID,
      phoneEnc: ownerPii.phoneEnc,
      phoneHash: ownerPii.phoneHash,
      phoneLast4: ownerPii.phoneLast4,
      // Placeholder — real bcrypt hashing is wired up in a later step.
      passwordHash: "bcrypt$placeholder$seed",
      role: "owner",
    },
  });

  for (const c of DEMO_CUSTOMERS) {
    const pii = buildPiiFields(c.rawPhone);
    await prisma.customer.upsert({
      where: { id: c.id },
      update: {
        businessId: DEMO_BUSINESS_ID,
        name: c.name,
        nameNormalized: normalizePersian(c.name),
        phoneEnc: pii.phoneEnc,
        phoneHash: pii.phoneHash,
        phoneLast4: pii.phoneLast4,
      },
      create: {
        id: c.id,
        businessId: DEMO_BUSINESS_ID,
        name: c.name,
        nameNormalized: normalizePersian(c.name),
        phoneEnc: pii.phoneEnc,
        phoneHash: pii.phoneHash,
        phoneLast4: pii.phoneLast4,
      },
    });
  }

  const contractA = {
    id: DEMO_CONTRACT_A_ID,
    customerId: DEMO_CUSTOMERS[0].id,
    totalAmountRial: 60_000_000,
    downPaymentRial: 0,
    installmentCount: 6,
    intervalMonths: 1,
    startDate: new Date("2026-03-01T00:00:00.000Z"),
  };
  const contractB = {
    id: DEMO_CONTRACT_B_ID,
    customerId: DEMO_CUSTOMERS[1].id,
    totalAmountRial: 40_000_000,
    downPaymentRial: 10_000_000,
    installmentCount: 4,
    intervalMonths: 1,
    startDate: new Date("2026-04-01T00:00:00.000Z"),
  };
  for (const k of [contractA, contractB]) {
    await prisma.contract.upsert({
      where: { id: k.id },
      update: {
        businessId: DEMO_BUSINESS_ID,
        customerId: k.customerId,
        totalAmountRial: k.totalAmountRial,
        downPaymentRial: k.downPaymentRial,
        installmentCount: k.installmentCount,
        intervalMonths: k.intervalMonths,
        startDate: k.startDate,
        status: "active",
      },
      create: {
        id: k.id,
        businessId: DEMO_BUSINESS_ID,
        customerId: k.customerId,
        totalAmountRial: k.totalAmountRial,
        downPaymentRial: k.downPaymentRial,
        installmentCount: k.installmentCount,
        intervalMonths: k.intervalMonths,
        startDate: k.startDate,
        status: "active",
      },
    });
  }

  const baseA = contractA.startDate.getTime();
  const installmentsA = [
    { seq: 1, status: "paid" as const, dueOffsetDays: 0, paid: true },
    { seq: 2, status: "overdue" as const, dueOffsetDays: 30, paid: false },
    { seq: 3, status: "due_soon" as const, dueOffsetDays: 60, paid: false },
    { seq: 4, status: "pending" as const, dueOffsetDays: 90, paid: false },
    { seq: 5, status: "pending" as const, dueOffsetDays: 120, paid: false },
    { seq: 6, status: "pending" as const, dueOffsetDays: 150, paid: false },
  ];
  const amountA = contractA.totalAmountRial / contractA.installmentCount;

  const baseB = contractB.startDate.getTime();
  const installmentsB = [
    { seq: 1, status: "paid" as const, dueOffsetDays: 0, paid: true },
    { seq: 2, status: "partially_paid" as const, dueOffsetDays: 30, paid: false },
    { seq: 3, status: "promised" as const, dueOffsetDays: 60, paid: false },
    { seq: 4, status: "pending" as const, dueOffsetDays: 90, paid: false },
  ];
  const amountB =
    (contractB.totalAmountRial - contractB.downPaymentRial) /
    contractB.installmentCount;

  const installmentData = [
    ...installmentsA.map((i) => {
      const dueDate = new Date(baseA + i.dueOffsetDays * 86_400_000);
      return {
        id: `demo_inst_a_${i.seq}`,
        businessId: DEMO_BUSINESS_ID,
        contractId: contractA.id,
        seq: i.seq,
        amountRial: amountA,
        paidAmountRial: i.paid ? amountA : 0,
        paidAt: i.paid ? dueDate : null,
        dueDate,
        status: i.status,
      };
    }),
    ...installmentsB.map((i) => {
      const dueDate = new Date(baseB + i.dueOffsetDays * 86_400_000);
      const paidAmountRial = i.paid
        ? amountB
        : i.status === "partially_paid"
          ? Math.floor(amountB / 2)
          : 0;
      return {
        id: `demo_inst_b_${i.seq}`,
        businessId: DEMO_BUSINESS_ID,
        contractId: contractB.id,
        seq: i.seq,
        amountRial: amountB,
        paidAmountRial,
        paidAt: i.paid ? dueDate : null,
        dueDate,
        status: i.status,
      };
    }),
  ];

  // Delete then recreate to guarantee idempotent count regardless of prior state.
  await prisma.installment.deleteMany({ where: { businessId: DEMO_BUSINESS_ID } });
  await prisma.installment.createMany({ data: installmentData });
}

async function main(): Promise<void> {
  try {
    await seed();
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun =
  typeof process.argv[1] === "string" &&
  /seed\.(ts|js|mjs|cjs)$/.test(process.argv[1]);

if (isDirectRun) {
  main().catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
}

export {
  prisma,
  DEMO_BUSINESS_ID,
  DEMO_PLAN_ID,
  DEMO_SUBSCRIPTION_ID,
  DEMO_OWNER_USER_ID,
  DEMO_CUSTOMERS,
  DEMO_CONTRACT_A_ID,
  DEMO_CONTRACT_B_ID,
};
