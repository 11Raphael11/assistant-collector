import { pingDb } from "@/server/db";
import { logger } from "@/lib/logger";

async function checkDb(): Promise<boolean> {
  const up = await pingDb();
  if (!up) {
    logger.error(
      {
        action: "health_check",
        result: "db_down",
      },
      "health check: database unreachable",
    );
  }
  return up;
}

export async function GET(): Promise<Response> {
  const dbUp = await checkDb();
  if (dbUp) {
    return Response.json({ status: "ok", db: "up" }, { status: 200 });
  }
  return Response.json({ status: "degraded", db: "down" }, { status: 503 });
}
