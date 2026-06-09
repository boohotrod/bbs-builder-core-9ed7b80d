// Store mode resolution (B-3.3).
//
// `mock` = in-memory mock-store (preview default, no DB required).
// `real` = Drizzle / MySQL backed store (B-3.4 activates users + profiles).
//
// Safety: if STORE_MODE=real but DATABASE_URL is missing → throws.
// No silent fallback to mock — we never want to discover in production that
// we've been reading mock data without realizing it.
import { getServerEnv } from "../env";

export type StoreMode = "mock" | "real";

export type StoreResolution = {
  mode: StoreMode;
  databaseConfigured: boolean;
};

export function resolveStoreMode(): StoreResolution {
  const env = getServerEnv();
  const databaseConfigured = Boolean(env.DATABASE_URL);

  if (env.STORE_MODE === "real" && !databaseConfigured) {
    throw new Error(
      "STORE_MODE=real requires DATABASE_URL. Set DATABASE_URL or switch STORE_MODE=mock.",
    );
  }

  return { mode: env.STORE_MODE, databaseConfigured };
}
