#!/usr/bin/env node
/**
 * Superadmin seed CLI — interactive, idempotent.
 *
 *   node scripts/seed-superadmin.mjs
 *
 * Creates the single Global SuperAdmin in the configured MySQL database.
 * Refuses to run twice (checks for any existing is_global_superadmin = 1).
 *
 * Requirements:
 *   - DATABASE_URL in env
 *   - Migrations already applied (drizzle/0000_*.sql must have created `users`)
 *   - npm i @node-rs/argon2 (only required on the machine running this CLI)
 *
 * Safety:
 *   - DOES NOT auto-run anywhere. Operator must SSH into cPanel and invoke it
 *     manually, exactly once, after B-3.1 migrations have been applied.
 *   - Refuses to insert if any SuperAdmin already exists.
 *   - Password minimum 12 characters; argon2id hashing.
 */
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { randomUUID } from "node:crypto";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("HIBA: DATABASE_URL nincs beállítva. Megszakítva.");
    process.exit(2);
  }

  let argon2;
  try {
    argon2 = await import("@node-rs/argon2");
  } catch {
    console.error(
      "HIBA: @node-rs/argon2 nincs telepítve.\n" +
        "  Telepítsd: npm i @node-rs/argon2\n" +
        "  Majd futtasd újra a seed CLI-t.",
    );
    process.exit(4);
  }

  let mysql;
  try {
    mysql = await import("mysql2/promise");
  } catch {
    console.error("HIBA: mysql2 nincs telepítve. Futtasd: npm install");
    process.exit(4);
  }

  const rl = readline.createInterface({ input, output });
  const username = (await rl.question("SuperAdmin felhasználónév: ")).trim();
  const email = (await rl.question("SuperAdmin e-mail: ")).trim();
  const password = await rl.question("SuperAdmin jelszó (min. 12 karakter): ");
  rl.close();

  if (!username || !email || !password || password.length < 12) {
    console.error("HIBA: érvénytelen adatok. Felhasználó/e-mail kötelező; jelszó min. 12 karakter.");
    process.exit(3);
  }

  const conn = await mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 10_000 });
  try {
    const [existing] = await conn.query(
      "SELECT id, username FROM users WHERE is_global_superadmin = 1 LIMIT 1",
    );
    if (Array.isArray(existing) && existing.length > 0) {
      console.error(
        `HIBA: már létezik SuperAdmin (${existing[0].username}). A seed nem futtatható kétszer.`,
      );
      process.exit(5);
    }

    const passwordHash = await argon2.hash(password, {
      algorithm: argon2.Algorithm?.Argon2id ?? 2,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });

    const id = randomUUID();
    await conn.execute(
      `INSERT INTO users
         (id, username, email, password_hash, is_global_superadmin, is_invisible, status, locale)
       VALUES (?, ?, ?, ?, 1, 1, 'active', 'hu')`,
      [id, username, email, passwordHash],
    );

    console.log("\nKész. SuperAdmin létrehozva.");
    console.log("  id:       ", id);
    console.log("  username: ", username);
    console.log("  invisible:", true);
  } finally {
    await conn.end().catch(() => undefined);
  }
}

void main().catch((err) => {
  console.error("Váratlan hiba:", err?.message ?? err);
  process.exit(1);
});
