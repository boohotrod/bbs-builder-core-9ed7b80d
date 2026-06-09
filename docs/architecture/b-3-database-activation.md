# B-3 — Adatbázis aktiválás (lépcsőzetes)

> Státusz: **előkészítés kész**, futtatás jóváhagyásra vár.
> Builder Core v0.2 lezárt, mock-store módban él. Ez a dokumentum a `mock → real`
> átállás kontrollált, visszafordítható menetét írja le.

## Alapelvek

1. **Adatvesztés nulla tolerancia.** Minden lépés előtt full DB dump.
2. **Automatikus migráció TILTOTT.** Migráció csak manuális SSH + kifejezett jóváhagyás után fut.
3. **Fail-fast.** Ha `STORE_MODE=real` de `DATABASE_URL` üres → az app indításkor hibázik.
   Nincs csendes mock fallback.
4. **Rollback < 60 másodperc.** cPanel env `STORE_MODE=mock` + Restart → kész.

## Lépcsők

### B-3.1 — Migrációk generálása (lokálisan)

```bash
# csak az SQL fájlokat írja, DB-hez NEM nyúl
bunx drizzle-kit generate
git add drizzle/
git commit -m "B-3.1: generated drizzle migrations"
git push
```

Review szempontok a `drizzle/0000_*.sql`-ben:
- minden tábla `ENGINE=InnoDB` + `DEFAULT CHARSET=utf8mb4`,
- nincs PostgreSQL-specifikus szintaxis,
- MySQL 8.x kompatibilis.

### B-3.2 — Healthcheck oldal

Új admin-only route: `/admin/db-health`.
Csak SuperAdmin / builder_admin látja. Egyetlen művelet: `SELECT 1` + `VERSION()`.
Bármikor használható — még mock módban is mutatja a DB elérhetőséget.

### B-3.3 — Store mód kapcsoló

Új env: `STORE_MODE=mock|real` (default: `mock`).
Kódban: `src/lib/server/store/index.ts` → `resolveStoreMode()`.

```
STORE_MODE=mock                → mock-store (jelenlegi)
STORE_MODE=real + DATABASE_URL → Drizzle / MySQL
STORE_MODE=real + üres DB URL  → indításkor hibázik (szándékos)
```

### B-3.4 — `users` + `profiles` valódi tábla (READ only)

Csak ez a két tábla olvas valódi DB-ből. Minden más modul (roles, permissions,
modules, registry, audit, decisions, memory) **mock marad**, amíg a B-4+ át nem
kapcsolja őket.

WRITE műveletek (CREATE / UPDATE / DELETE) **nem** ebben a körben.

### B-3.5 — SuperAdmin seed CLI

`scripts/seed-superadmin.mjs` — idempotens, argon2id hash, kétszer nem fut le.
Manuális, SSH-ból futtatandó, kizárólag a B-3.1 migrációk lefutása után.
Telepítendő egyszeri csomag: `npm i @node-rs/argon2`.

### B-3.6 — Rollback

Bármelyik lépés visszafordítható:

1. **App szintű rollback (azonnali):**
   - cPanel → Setup Node.js App → Environment variables.
   - `STORE_MODE=mock`, `DATABASE_URL` törlése.
   - Restart Application. Az app azonnal mock-ra vált, kód deploy nem kell.
2. **DB szintű rollback:** mindig a `phpMyAdmin → Export` dumpból állítjuk vissza
   a táblákat, amit a B-3.4 _előtt_ készítettünk. A `drizzle/rollback/` mappa
   manuálisan írt `DROP TABLE` listát tartalmazhat — de **csak teszt DB-n**.
3. **Audit chain védelem (B-3.4 után):**
   ```sql
   REVOKE UPDATE, DELETE ON bbs_builder_test.audit_events FROM '<user>'@'localhost';
   ```

## Aktiválási sorrend (operátori checklist)

- [ ] B-3.1: `drizzle/` commit + push, review zöld.
- [ ] cPanel → MySQL Databases → új DB + user, `ALL PRIVILEGES`.
- [ ] phpMyAdmin → Export → backup mentve.
- [ ] SSH: `mysql -u <user> -p <db> < drizzle/0000_*.sql`.
- [ ] cPanel env: `DATABASE_URL=mysql://...`, `STORE_MODE=mock` (még!).
- [ ] Restart Application.
- [ ] `/admin/db-health` → `Connection alive (SELECT 1 OK)`, MySQL verzió látszik.
- [ ] `npm i @node-rs/argon2` (egyszeri, manuális).
- [ ] `node scripts/seed-superadmin.mjs` — SuperAdmin létrehozva.
- [ ] cPanel env: `STORE_MODE=real`. Restart Application.
- [ ] `/users` oldal → valódi DB-ből olvas (1 sor: SuperAdmin, invisible).
- [ ] `REVOKE UPDATE, DELETE ON audit_events`.

Ha bármely lépésnél hiba → B-3.6 rollback, hibajelentés, javítás, újrafutás.

## Mit NE csinálj

- ❌ Ne állítsd `STORE_MODE=real`-re az élest, amíg a teszt env nem zöld.
- ❌ Ne futtass migrációt automatikusan deploy script részeként.
- ❌ Ne futtasd a seed CLI-t kétszer (úgyis megtagadja, de a hibajelentés zaj).
- ❌ Ne kapcsold ki a fail-fast viselkedést.
