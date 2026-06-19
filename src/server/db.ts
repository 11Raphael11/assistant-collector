import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __prismaSingleton: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__prismaSingleton ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prismaSingleton = prisma;
}

export async function pingDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
