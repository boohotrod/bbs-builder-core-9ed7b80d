// Drizzle-backed store adapter (B-3.4 placeholder).
//
// READ-only interface stubs. The actual `users` + `profiles` query
// implementation lands in B-3.4 once the migrations have run on the cPanel
// test DB and the seed has been verified. Until then this module exports
// only types so the rest of the codebase can compile against a stable shape.

export type DbUserRow = {
  id: string;
  username: string;
  email: string;
  isGlobalSuperadmin: boolean;
  isInvisible: boolean;
  status: string;
  locale: string;
};

export type DbStore = {
  listUsers: () => Promise<DbUserRow[]>;
  getUserById: (id: string) => Promise<DbUserRow | null>;
};

export function createDbStore(): DbStore {
  // Stub — wired in B-3.4. Throwing here is intentional: nothing should call
  // this path until the activation checklist has passed.
  const notImplemented = (): never => {
    throw new Error("db-store: not yet implemented (B-3.4)");
  };
  return {
    listUsers: () => Promise.resolve(notImplemented()),
    getUserById: () => Promise.resolve(notImplemented()),
  };
}
