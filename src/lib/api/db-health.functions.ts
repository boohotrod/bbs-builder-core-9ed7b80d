import { createServerFn } from "@tanstack/react-start";

import { getServerEnv } from "@/lib/server/env";
import { resolveStoreMode } from "@/lib/server/store";

// READ-only DB healthcheck (B-3.2). Performs `SELECT 1` if DATABASE_URL is set.
// Never executes DDL, never writes. Safe to call from the admin UI at any time.

export type DbHealthResult = {
  mode: "mock" | "real";
  databaseConfigured: boolean;
  connectionOk: boolean | null; // null = not attempted (no DATABASE_URL)
  serverVersion: string | null;
  errorMessage: string | null;
  checkedAt: string;
};

export const getDbHealth = createServerFn({ method: "GET" }).handler(async (): Promise<DbHealthResult> => {
  const env = getServerEnv();
  const checkedAt = new Date().toISOString();

  let mode: "mock" | "real" = "mock";
  let resolveError: string | null = null;
  try {
    mode = resolveStoreMode().mode;
  } catch (e) {
    resolveError = e instanceof Error ? e.message : String(e);
  }

  const databaseConfigured = Boolean(env.DATABASE_URL);
  if (!databaseConfigured) {
    return {
      mode,
      databaseConfigured: false,
      connectionOk: null,
      serverVersion: null,
      errorMessage: resolveError,
      checkedAt,
    };
  }

  // Lazy import so the bundle stays clean when mysql2 is not needed.
  try {
    const mysql = await import("mysql2/promise");
    const conn = await mysql.createConnection({
      uri: env.DATABASE_URL!,
      connectTimeout: 5_000,
    });
    try {
      const [rows] = await conn.query<{ v: number; ver: string }[] & import("mysql2").RowDataPacket[]>(
        "SELECT 1 AS v, VERSION() AS ver",
      );
      const first = Array.isArray(rows) ? (rows[0] as { v?: number; ver?: string } | undefined) : undefined;
      return {
        mode,
        databaseConfigured: true,
        connectionOk: first?.v === 1,
        serverVersion: first?.ver ?? null,
        errorMessage: resolveError,
        checkedAt,
      };
    } finally {
      await conn.end().catch(() => undefined);
    }
  } catch (e) {
    return {
      mode,
      databaseConfigured: true,
      connectionOk: false,
      serverVersion: null,
      errorMessage: e instanceof Error ? e.message : String(e),
      checkedAt,
    };
  }
});
