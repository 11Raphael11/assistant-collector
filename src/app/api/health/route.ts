import { PrismaClient } from "@prisma/client";
import { logger } from "@/lib/logger";

const prisma = new PrismaClient();

async function checkDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.error(
      {
        action: "health_check",
        result: "db_down",
        error: err instanceof Error ? err.message : String(err),
      },
      "health check: database unreachable",
    );
    return false;
  }
}

export async function GET(): Promise<Response> {
  const dbUp = await checkDb();
  if (dbUp) {
    return Response.json({ status: "ok", db: "up" }, { status: 200 });
  }
  return Response.json({ status: "degraded", db: "down" }, { status: 503 });
}
