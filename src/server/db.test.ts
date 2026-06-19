import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { prisma, pingDb } from "./db";

describe("server/db prisma singleton", () => {
  it("happy: importing prisma twice returns the same instance", async () => {
    const mod = await import("./db");
    const again = await import("./db");
    expect(mod.prisma).toBe(prisma);
    expect(again.prisma).toBe(prisma);
    expect(mod.prisma).toBe(again.prisma);
  });

  it("happy: pingDb returns true against the live database", async () => {
    const up = await pingDb();
    expect(up).toBe(true);
  });

  it("edge: only server/db.ts constructs the PrismaClient under src/", () => {
    const srcDir = resolve(__dirname, "..");
    const allowed = new Set([
      resolve(__dirname, "db.ts"),
      resolve(__filename),
    ]);
    const needle = new RegExp(["new", "\\s+", "Prisma", "Client", "\\s*\\("].join(""));
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        const st = statSync(full);
        if (st.isDirectory()) {
          if (entry === "node_modules" || entry === ".next") continue;
          walk(full);
          continue;
        }
        if (!/\.(ts|tsx|mts|cts)$/.test(entry)) continue;
        if (allowed.has(resolve(full))) continue;
        const content = readFileSync(full, "utf8");
        if (needle.test(content)) {
          offenders.push(full);
        }
      }
    };

    walk(srcDir);
    expect(offenders).toEqual([]);
  });
});
