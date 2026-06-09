
# B-3 — Valódi MySQL bekötés (előkészítés)

Cél: a Builder Core v0.2 mock-store módban fut tovább, de a kódbázis és a cPanel környezet készen áll arra, hogy egyetlen kapcsolóval, jóváhagyásod után, kontrollált módon átálljunk valódi MySQL adatbázisra. Egyetlen lépés sem ír éles DB-be jóváhagyás nélkül, és minden lépés visszafordítható.

---

## B-3.1 — Drizzle migrációk generálása (lokál, repo commit)

- Cél: a `src/db/schema/**` Drizzle séma alapján reprodukálható SQL migrációs fájlok keletkezzenek a `drizzle/` mappában, és bekerüljenek a GitHub repóba.
- Lépések:
  1. `drizzle.config.ts` ellenőrzése — már `dialect: "mysql"`, output `./drizzle`, OK.
  2. Lokálisan (NEM a szerveren) futtatás: `bunx drizzle-kit generate` — ez csak SQL fájlokat ír, DB-hez **nem nyúl**.
  3. A generált `drizzle/0000_*.sql` fájl review-ja: kompatibilis-e cPanel MySQL 8.x-szel (utf8mb4, InnoDB, nincs PG-specifikus szintaxis).
  4. Commit + push a GitHubra. Szerveren csak `git pull`, futtatás NINCS.
- Eredmény: a migrációs SQL verziókövetett, de **nem fut le** sehol.

## B-3.2 — DB connection healthcheck oldal

- Cél: új admin-only oldal (`/admin/db-health`) ami megmondja:
  - aktív-e a `DATABASE_URL`,
  - sikerült-e a `SELECT 1`,
  - melyik módban fut az app (`mock` / `real`),
  - hány migráció van a `drizzle/` mappában vs. mit lát a DB `__drizzle_migrations` táblája.
- Implementáció:
  - `src/lib/api/db-health.functions.ts` — `createServerFn` + `requireSupabaseAuth`-helyett a meglévő admin guard. **Csak olvas**, `SELECT 1`, semmi DDL.
  - `src/routes/admin.db-health.tsx` — magyar UI: „Adatbázis állapot", „Kapcsolat", „Mód", „Migrációk".
  - Csak SuperAdmin láthatja.
- Eredmény: bármikor látható, hogy a DB kapcsolat él-e, **anélkül** hogy bármit írna.

## B-3.3 — Mock-store / real-db kapcsoló

- Cél: egyetlen, jól látható kapcsoló dönti el, hogy az app a meglévő `src/lib/mock-store.ts`-t használja vagy a Drizzle DB-t.
- Implementáció:
  - Új env: `STORE_MODE=mock|real` (default: `mock`). Bekerül `.env.example`-be és `src/lib/server/env.ts` Zod sémájába.
  - Új modul: `src/lib/server/store/index.ts` — `getStore()` ami `STORE_MODE` és `DATABASE_URL` jelenléte alapján vagy a `mock-store`-t, vagy a Drizzle adaptert adja vissza.
  - Real adapter (`src/lib/server/store/db-store.ts`) **csak interfész + stub** ebben a körben. Tényleges query implementáció B-3.4-ben jön, csak a `users` táblához.
  - Safety: ha `STORE_MODE=real` de `DATABASE_URL` üres → fail-fast hibaüzenet, automatikus fallback **NINCS** (nehogy észrevétlenül mock-ot használjunk élesben).
- Eredmény: a teljes app mock módban marad, amíg az env-ben explicit át nem kapcsoljuk.

## B-3.4 — `users` + `profiles` első valódi táblák

- Cél: a két legkisebb, legjobban körülhatárolt tábla a `db-store` adapteren keresztül valódi DB-ből olvasson — **de csak akkor**, ha `STORE_MODE=real`.
- Hatókör:
  - `users` (már létezik: `src/db/schema/identity/users.ts`).
  - `profiles` (már létezik: `src/db/schema/identity/profiles.ts`).
  - Csak READ operációk az első körben (lista + detail). WRITE (CREATE/UPDATE/DELETE) a B-3 lezárása után, külön körben.
- Egyéb modulok (roles, permissions, modules, registry, audit, decisions, memory) **maradnak mockban** — őket B-4+ kapcsolja át.
- Eredmény: ellenőrizhetjük a valódi DB-t egy biztonságos, kis felületen, mielőtt bármit átírnánk.

## B-3.5 — SuperAdmin seed CLI véglegesítése

- Cél: a meglévő `scripts/seed-superadmin.mjs` stub helyett valódi, idempotens seed:
  - Csatlakozik `DATABASE_URL`-en.
  - Ellenőrzi, hogy van-e már `is_global_superadmin = true` user → ha igen, **megtagadja** és kilép (no double-seed).
  - Argon2id jelszó hash (`@node-rs/argon2`, már bundling-safe Node 22-n).
  - Beszúr 1 sort a `users` táblába `is_invisible = true`-val.
  - Interaktív promptok **magyarul**: „SuperAdmin felhasználónév", „E-mail", „Jelszó (min. 12 karakter)".
- Futtatás kizárólag manuálisan, SSH-ból, B-3.1 migráció lefutása után. **Most NEM futtatjuk.**
- Eredmény: van egy biztonságos, egyszer-futtatható módja a kezdeti admin létrehozásnak.

## B-3.6 — Rollback terv

Minden lépés visszafordítható. Ha bármi gond van a real DB-vel, a workflow:

1. cPanel → Setup Node.js App → Environment variables → `STORE_MODE=mock`, `DATABASE_URL` törlése.
2. Restart Application. Az app azonnal visszaáll a mock-store-ra, kód deploy nem kell.
3. Ha a DB séma is rontott: a `drizzle/0000_*.sql` mellé `drizzle/rollback/0000_down.sql` (manuálisan írt `DROP TABLE` lista, fordított dependency sorrendben). SSH-ból futtatható, de **csak teszt DB-n**.
4. DB szintű backup: cPanel → MySQL → phpMyAdmin → Export (full SQL dump) **mielőtt** bármilyen migrációt futtatnánk élesen. Ez a leggyorsabb visszaállás.
5. Audit chain védelem (B-3.1 utáni teendő, már dokumentálva `DEPLOY_CPANEL.md` 7. pontban): `REVOKE UPDATE, DELETE ON audit_events` — csak az első sikeres deploy után.

---

## Mellékelt dokumentáció-frissítések

- `.env.example`:
  - új `STORE_MODE=mock` sor + magyarázat,
  - `DATABASE_URL` melletti komment: „B-3.4 aktiváláshoz kötelező, addig hagyd üresen".
- `docs/DEPLOY_CPANEL.md`:
  - új „11. B-3 aktiválás lépcsőzetesen" szekció: az 5 fenti lépés sorrendje, mikor kell `git pull` / build / restart, mikor NEM.
  - rollback eljárás 3 paranccsal.
- `docs/architecture/b-3-database-activation.md` (új): a teljes B-3 terv archiválva, hivatkozik a fenti lépcsőkre.

## Mit NEM teszünk ebben a körben

- ❌ Valódi DB-be írás (sem seed, sem migráció futtatás).
- ❌ Jelszó/secret bekérés chatben.
- ❌ Új business modul vagy UI feature.
- ❌ Roles/permissions/audit/registry átírása real DB-re — azok B-4+.
- ❌ Automatikus fallback mock-ra, ha real DB hibázik — ez szándékos fail-fast.

## Mit fogsz Te csinálni jóváhagyás után

1. Approve a tervet.
2. Lokálisan: `bunx drizzle-kit generate` → commit/push.
3. cPanel teszt DB létrehozása (külön DB user, `ALL PRIVILEGES`).
4. SSH-ból manuálisan: `mysql ... < drizzle/0000_*.sql`.
5. cPanel env: `DATABASE_URL=...`, `STORE_MODE=mock` (még!).
6. Restart → `/admin/db-health` ellenőrzés (mock módban is mutatja a kapcsolatot).
7. Csak ha minden zöld → `STORE_MODE=real` → Restart → users/profiles olvasás teszt.
8. Ha bármi gond → B-3.6 rollback, 30 másodperc alatt.

## Hatókör (file-szinten, becslés)

- Új fájlok: `src/lib/server/store/index.ts`, `src/lib/server/store/mock-store.ts` (wrap), `src/lib/server/store/db-store.ts`, `src/lib/api/db-health.functions.ts`, `src/routes/admin.db-health.tsx`, `docs/architecture/b-3-database-activation.md`.
- Módosított: `src/lib/server/env.ts` (+ `STORE_MODE`), `.env.example`, `docs/DEPLOY_CPANEL.md`, `scripts/seed-superadmin.mjs`, `src/i18n/locales/{hu,en,no}.json` (új kulcsok az új oldalhoz, **magyar default**).
- Schema: változatlan (már létezik).
- Migráció futtatás: **0 db** ebben a körben.

