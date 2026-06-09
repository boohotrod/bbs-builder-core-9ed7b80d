# BBS AI Builder Platform — v0.2

Constitutional builder platform that designs, documents and later operates the
BBS Hot Rod & Kustom Europe portal.

> **Status:** Builder Core v0.2 lezárva (B-0 → B-2.4).
> Preview mock-store alapon fut, valódi DB migráció **még nem futott**.
> Részletek: [`docs/architecture/builder-core-v0.2-closing.md`](docs/architecture/builder-core-v0.2-closing.md).

---

## Tech stack

- **Framework:** TanStack Start v1 (React 19) + Vite 7
- **Styling:** Tailwind CSS v4 + shadcn/ui + Radix
- **i18n:** i18next (HU / EN / NO; 26-nyelv skeleton)
- **ORM (előkészített, nem migrált):** Drizzle ORM → MySQL
- **Runtime cél:** Node.js / cPanel Passenger (preview: Cloudflare Worker)
- **Package manager:** Bun (npm-mel is működik)

## Requirements

| Eszköz | Verzió |
|--------|--------|
| Node.js | **>= 20.11** (LTS ajánlott) |
| Bun | >= 1.1 (opcionális, gyorsabb) |
| MySQL | 8.x (csak B-3+ deploy-hoz) |

---

## Helyi futtatás

```bash
bun install         # vagy: npm install
cp .env.example .env   # üresen is működik a preview mock-store-ral
bun run dev         # http://localhost:8080
```

## Build és production start

```bash
bun run build                   # Vite + Nitro (node-server preset) build
node .output/server/index.mjs   # natív Node HTTP server, listens on PORT
```

A build a Nitro **`node-server`** presetjét használja — natív Node entry,
nem Cloudflare/fetch-only worker. Output:

```
.output/server/index.mjs   ← Node startup (listens on process.env.PORT)
.output/public/**          ← statikus assetek (CSS / JS / képek)
app.js                     ← cPanel Passenger wrapper (importálja a fentit)
```

cPanel Node.js App-ban a **startup file** mindig `app.js`.

---

## GitHub indítási lépések

1. **Connect GitHub** — a Lovable szerkesztőben: `+` menü → **GitHub → Connect project**.
2. **Repository létrehozása** — válaszd ki a GitHub szervezetet, majd **Create Repository**.
3. **Klónozás** lokálisan:
   ```bash
   git clone git@github.com:<org>/<repo>.git
   cd <repo>
   bun install
   cp .env.example .env
   ```
4. **Bidirectional sync** — minden Lovable change automatikusan push-ol, és minden GitHub push automatikusan sync-el a Lovable preview-ba.
5. **Branch stratégia (javasolt):**
   - `main` → live (csak release-ek)
   - `develop` → test / staging
   - `feature/*` → fejlesztés, PR-en át merge-elve
6. **Mit ne commit-olj:** `.env`, `node_modules/`, `.output/`, `dist/`, `tsconfig.tsbuildinfo` — mind benne van a `.gitignore`-ban.

A teljes export terv: [`docs/GITHUB_EXPORT.md`](docs/GITHUB_EXPORT.md).

---

## Environment változók

Lásd: [`.env.example`](.env.example).

| Változó | Cél | Mikor kell |
|---------|-----|-----------|
| `NODE_ENV` | runtime mód | mindig |
| `PORT` | szerver port | helyi dev; cPanel automatikusan adja |
| `DATABASE_URL` | MySQL connection | **B-3+ (még nem)** |
| `SESSION_SECRET` | session aláírás | első élesítés előtt |
| `INVITE_SIGNING_KEY` | invite token aláírás | első élesítés előtt |
| `AUDIT_CHAIN_SECRET` | audit hash-chain só | első élesítés előtt |
| `FEDERATION_SIGNING_KEY` | federation peer aláírás | federation aktiválásakor |
| `AI_GATEWAY_KEY` | AI provider gateway | csak ha valódi AI provider él |

Titkok generálása: `openssl rand -hex 32`.

---

## Aldomain struktúra (javasolt)

| Környezet | Aldomain | Forrás branch | DB |
|-----------|----------|---------------|-----|
| Live | `builder.bbs-europe.eu` (vagy gyökér) | `main` | `bbs_builder_live` |
| Test | `test.builder.bbs-europe.eu` | `develop` | `bbs_builder_test` |
| Preview | `id-preview--<id>.lovable.app` | Lovable auto | mock-store |

Live és test **külön cPanel Node.js App**-ban fut, külön DB-vel, külön env változókkal.

---

## cPanel deploy

Részletes lépések: [`docs/DEPLOY_CPANEL.md`](docs/DEPLOY_CPANEL.md).

Röviden:
1. cPanel → **Setup Node.js App** → új app, Node >= 20 (test alatt Node 22 igazolt).
2. Application root: a repo gyökere (git-pull / git clone után).
3. Application startup file: **`app.js`** (a repo gyökerében; ez importálja a build által generált `.output/server/index.mjs`-t). NE add meg közvetlenül a `.output/...` útvonalat — azt a build minden alkalommal újragenerálja, az `app.js` viszont stabil belépési pont.
4. Environment Variables → másold a `.env.example` listát, valódi értékekkel.
5. `npm install --include=dev --legacy-peer-deps --package-lock=false` → `npm run build` → **Restart Application**.

---

## Dokumentáció

- [`docs/architecture/overview.md`](docs/architecture/overview.md)
- [`docs/architecture/b-2.1-federation-and-tenant-audit.md`](docs/architecture/b-2.1-federation-and-tenant-audit.md)
- [`docs/architecture/b-2.2-dynamic-field-registry.md`](docs/architecture/b-2.2-dynamic-field-registry.md)
- [`docs/architecture/b-2.3-bbs-seed-modules.md`](docs/architecture/b-2.3-bbs-seed-modules.md)
- [`docs/architecture/b-2.4-module-namespace-binding.md`](docs/architecture/b-2.4-module-namespace-binding.md)
- [`docs/architecture/builder-core-v0.2-closing.md`](docs/architecture/builder-core-v0.2-closing.md)
- [`docs/GITHUB_EXPORT.md`](docs/GITHUB_EXPORT.md)
- [`docs/DEPLOY_CPANEL.md`](docs/DEPLOY_CPANEL.md)

---

## Mit NEM csinál még a v0.2

- Valódi DB migráció (Drizzle séma kész, futtatás B-3+).
- Valódi AI provider hívás (csak dummy entry).
- BBS portál üzleti modulok (garage, media, support, travel — stub).
- Workflow / GDPR / Backup / Export Engine.
- AI Translation Cache (külön döntés).
