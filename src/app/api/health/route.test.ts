import { describe, it, expect, vi, beforeEach } from "vitest";

const { queryRawMock, loggerErrorMock } = vi.hoisted(() => ({
  queryRawMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    $queryRaw = queryRawMock;
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: loggerErrorMock,
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    queryRawMock.mockReset();
    loggerErrorMock.mockReset();
  });

  it("happy: returns 200 with { status: 'ok', db: 'up' } when DB is reachable", async () => {
    queryRawMock.mockResolvedValueOnce([{ "?column?": 1 }]);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    await expect(res.json()).resolves.toEqual({ status: "ok", db: "up" });
    expect(queryRawMock).toHaveBeenCalledTimes(1);
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it("edge: returns 503 with { status: 'degraded', db: 'down' } on DB failure and logs the error without leaking internals to the body", async () => {
    const secret = "secret-host:5432 connection refused";
    queryRawMock.mockRejectedValueOnce(new Error(secret));

    const res = await GET();

    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body).toEqual({ status: "degraded", db: "down" });

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("secret-host");
    expect(serialized).not.toContain("connection refused");
    expect(serialized).not.toMatch(/stack|Error:/i);

    expect(loggerErrorMock).toHaveBeenCalledTimes(1);
    const [logArg] = loggerErrorMock.mock.calls[0]!;
    expect(logArg).toMatchObject({ action: "health_check", result: "db_down" });
  });
});
