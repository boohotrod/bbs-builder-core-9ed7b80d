# Deploy to cPanel (Node / Passenger)

Builder Core v0.2 deploy útmutató cPanel Node.js Selector + Passenger
környezetre. **DB migráció és valódi secret beállítás csak akkor történik,
amikor a B-3 nyitásakor explicit jóváhagyod.**

## Build target — Node server (NEM Cloudflare)

A `vite.config.ts` a Nitro **`node-server`** presetjét használja. Ez egy
natív Node HTTP szervert állít elő, ami közvetlenül kompatibilis cPanel
Passengerrel, PM2-vel, systemd-vel. **NEM** Cloudflare Worker / fetch-only
bundle. A korábbi `dist/server/server.js` (fetch export) helyett a build
most az alábbi struktúrát adja:

```
.output/
├── server/
│   └── index.mjs          ← Node HTTP server entry (listens on process.env.PORT)
├── public/                ← statikus kliens assetek (CSS, JS, képek, fontok)
│   ├── _build/            ← Vite hash-elt JS/CSS chunkok
│   └── ...
└── nitro.json             ← preset metadata
```

A repo gyökerében van egy `app.js` wrapper, ami csak ennyit csinál:

```js
import("./.output/server/index.mjs");
```

Ez a **cPanel Passenger startup file** — egyetlen stabil belépési pont,
amit nem ír felül a build. A `.output/` minden buildkor újragenerálódik.

---

## 0. Előfeltételek

- cPanel hozzáférés Node.js App támogatással (Setup Node.js App / Passenger).
- Node.js **>= 20.11** elérhető a cPanel Node Selector-ban.
- (B-3+) MySQL 8.x adatbázis és user létrehozva.
- GitHub repo connect-elve (lásd `docs/GITHUB_EXPORT.md`).

## 1. Aldomain és könyvtárszerkezet (javasolt)

| Környezet | Aldomain | DocRoot | App Root | Branch |
|-----------|----------|---------|----------|--------|
| Live | `builder.bbs-europe.eu` | `/home/<user>/apps/builder-live/public` | `/home/<user>/apps/builder-live` | `main` |
| Test | `test.builder.bbs-europe.eu` | `/home/<user>/apps/builder-test/public` | `/home/<user>/apps/builder-test` | `develop` |

Live és test **külön Node.js App**, **külön DB**, **külön env változók**.

## 2. Repo letöltése a szerverre

SSH-val:

```bash
cd ~/apps
git clone git@github.com:<org>/<repo>.git builder-live
cd builder-live
git checkout main
```

(Test app-hoz ugyanez `builder-test` + `develop` branch.)

## 3. Node.js App létrehozása cPanel-en

1. cPanel → **Setup Node.js App** → **Create Application**.
2. Node.js version: **20.x** (vagy újabb LTS).
3. Application mode: **Production**.
4. Application root: `apps/builder-live` (relatív a home-hoz).
5. Application URL: `builder.bbs-europe.eu`.
6. Application startup file: **`app.js`** (a repo gyökerében; ez tölti be a `.output/server/index.mjs`-t).
7. Passenger log file: hagyd a default-ot.

## 4. Environment Variables (cPanel UI)

A `Setup Node.js App` → app → **Environment variables** szekcióban add hozzá
a `.env.example` szerinti változókat valós értékekkel:

```
NODE_ENV=production
DATABASE_URL=mysql://USER:PASS@localhost:3306/bbs_builder_live   # csak B-3+
SESSION_SECRET=<openssl rand -hex 32>
INVITE_SIGNING_KEY=<openssl rand -hex 32>
AUDIT_CHAIN_SECRET=<openssl rand -hex 32>
FEDERATION_SIGNING_KEY=<openssl rand -hex 32>
AI_GATEWAY_KEY=                                                   # csak ha aktív
```

**Ne** tölts fel `.env` fájlt FTP-vel — cPanel csak az UI-ban beállított env
változókat injektálja a Passenger process-be.

## 5. Build és start

cPanel app oldalon → **Run NPM Install** (vagy SSH-ban):

```bash
cd ~/apps/builder-live
source ~/nodevenv/apps/builder-live/20/bin/activate    # a cPanel által megadott aktiváló script
npm install --omit=dev                                  # vagy: bun install --production
npm run build                                           # → .output/
```

Majd cPanel → **Restart Application**.

### Parancsok összefoglalása

| Cél | Parancs |
|-----|---------|
| Install | `bun install` (lokál) / `npm install` (cPanel) |
| Build | `bun run build` (lokál) / `npm run build` (cPanel) |
| Start (prod, cPanel) | `app.js` (Passenger indítja) |
| Start (prod, manuális) | `node .output/server/index.mjs` |
| Dev | `bun run dev` (csak lokál) |

> A `npm install --omit=dev` itt **nem ajánlott**: `vite` és `nitro`
> build-time függőségek a `devDependencies`-ben vannak, és kellenek a
> `npm run build`-hez. A `.output/` futtatásához már nincs szükség
> `node_modules`-ra (Nitro mindent bele bundle-öl), de a build lépéshez igen.

## 6. Apache / Passenger útválasztás

A `Setup Node.js App` automatikusan generálja a `.htaccess`-t a doc root-ba,
ami minden requestet a Node app-ra irányít (Passenger proxy). A statikus
assetek (`/assets/...`, `/_build/...`) is a Node szerveren mennek keresztül
— a Nitro `node-server` preset beépített static file middleware-rel szolgálja
ki a `.output/public/` tartalmát. **Nincs szükség** külön
`public/_redirects`, `vercel.json` vagy `BrowserRouter` konfigurációra.

> Ha az assetek 404-et adnak vagy az oldal csupasz HTML CSS nélkül, az
> szinte mindig azt jelenti, hogy a régi `dist/server/server.js`
> (Cloudflare fetch) bundle fut még. Ellenőrizd, hogy a `vite.config.ts`-ben
> `nitro: { preset: "node-server" }` szerepel, futtass
> `rm -rf .output dist && npm run build`-et, majd Restart App.

## 7. Adatbázis (B-3+, MOST NE FUSSON)

Amikor a B-3 nyit:

1. cPanel → **MySQL Databases** → új DB + új user, `ALL PRIVILEGES`.
2. `DATABASE_URL` beállítása az env változókban.
3. Migrációk generálása lokálisan: `bunx drizzle-kit generate` (commitold a `drizzle/` mappát).
4. SSH-val a szerveren a generált SQL futtatása: `mysql -u <user> -p <db> < drizzle/0000_*.sql`.
5. SuperAdmin seed: `node scripts/seed-superadmin.mjs` (interaktív).
6. **Az első deploy után:** `REVOKE UPDATE, DELETE ON bbs_builder_live.audit_events FROM '<user>'@'localhost';`
   — az audit chain immutability-jét DB szinten is kikényszeríti.

## 8. Deploy workflow (kézi, CI nélkül)

```bash
# lokálisan
git push origin main

# szerveren
ssh user@host
cd ~/apps/builder-live
git pull
source ~/nodevenv/.../activate
npm install --omit=dev
npm run build
# cPanel UI → Restart Application
```

Test app-hoz ugyanez `builder-test` + `develop` branch-ből.

## 9. Ellenőrzőlista deploy után

- [ ] `https://builder.bbs-europe.eu/` → 200, dashboard betölt.
- [ ] `https://builder.bbs-europe.eu/login` → működik a login form.
- [ ] `https://builder.bbs-europe.eu/modules` → katalógus render.
- [ ] `https://builder.bbs-europe.eu/registry/fields` → 200.
- [ ] Passenger error log üres.
- [ ] Browser console nincs hibával.

## 9b. Ismert SSR hiba — `jsxDEV is not a function`

Ha a Passenger error log ezt mutatja:

```
TypeError: jsxDevRuntimeExports.jsxDEV is not a function
    at RootShell (.output/server/_ssr/router-*.mjs)
```

akkor a build dev JSX runtime hívásokkal készült. Ez akkor fordul elő, ha az
`npm run build` `NODE_ENV=production` nélkül futott. A repo már védve van
ellene három rétegben (`package.json` build script, `vite.config.ts` `react.jsxDev: false`,
`esbuild.jsxDev: false`, és `define`-on keresztüli `process.env.NODE_ENV` injekció),
de ha mégis előjön, tisztán újra kell buildelni:

```bash
cd ~/apps/boo-base-core-test
source ~/nodevenv/apps/boo-base-core-test/22/bin/activate
rm -rf .output dist node_modules
npm install
npm run build
# cPanel UI → Restart Application
```


## 10. Most NE csináld

- Ne futtass valódi DB migrációt.
- Ne állíts be `DATABASE_URL`-t éles DB-vel.
- Ne tölts fel OpenAI / Anthropic kulcsot.
- Ne kapcsold be a federation peer trafficot.

Mindezek a **B-3 nyitásakor** kerülnek elő, külön jóváhagyással.

## 11. B-3 aktiválás lépcsőzetesen (előkészítve, futtatás jóváhagyásra vár)

Részletes terv: `docs/architecture/b-3-database-activation.md`.

Új env változó (`.env.example`-ben is): `STORE_MODE=mock|real` (default `mock`).
Ha `STORE_MODE=real` de `DATABASE_URL` üres → az app **indításkor hibázik**
(szándékos fail-fast, nincs csendes mock fallback).

### Aktiválási checklist (sorrend kötelező)

1. Lokálisan: `bunx drizzle-kit generate` → `drizzle/` commit + push. **Csak SQL fájl, DB-hez nem nyúl.**
2. cPanel → MySQL Databases → új DB + user (`ALL PRIVILEGES`).
3. phpMyAdmin → Export → teljes backup mentve (B-3.6 rollback alapja).
4. SSH-ból manuálisan: `mysql -u <user> -p <db> < drizzle/0000_*.sql`.
5. cPanel env: `DATABASE_URL=mysql://...`, **`STORE_MODE=mock` MARAD**. Restart.
6. `/admin/db-health` → `Connection alive`, MySQL verzió látszik. Még mock módban!
7. `npm i @node-rs/argon2` (egyszeri, csak a seed CLI-hez).
8. `node scripts/seed-superadmin.mjs` (interaktív, magyar promptok, idempotens).
9. cPanel env: `STORE_MODE=real`. Restart Application.
10. `/users` valódi DB-ből olvas. Ha minden zöld → `REVOKE UPDATE, DELETE ON audit_events`.

### Rollback (< 60 másodperc)

```
cPanel → Setup Node.js App → Environment variables
  STORE_MODE=mock
  DATABASE_URL=              # töröld
→ Restart Application
```

Kód deploy NEM kell. Az app azonnal visszaáll mock-store-ra.
DB séma rontás esetén: phpMyAdmin → Import → 3. pontban mentett dump.

