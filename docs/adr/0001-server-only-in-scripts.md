# ADR 0001 – `server-only` in tsx- und payload-CLI-Skripten

- **Status:** angenommen (27.09.2026, P1.5)
- **Kontext:** Serverseitige Module beginnen mit `import 'server-only'` (ARCHITEKTUR §2.2). Das Paket wirft außerhalb
  der `react-server`-Bedingung beim Import. Skripte (`pnpm payload …`, `tsx scripts/*.ts`, Seed-CLI) laden aber
  `src/payload.config.ts` und damit `src/lib/env.ts`.
- **Optionen:**
  1. `NODE_OPTIONS=--conditions=react-server` – löst auch `react`/`react-dom` in ihre Server-Varianten auf; Payload-CLI
     und Lexical brauchen die normalen Builds → riskant.
  2. Import-Hook `scripts/lib/register-server-only.mjs` (`node:module` `register`), der nur den Bezeichner
     `server-only` auf einen leeren Stub (`scripts/lib/server-only-stub.mjs`) umleitet.
- **Entscheidung:** Option 2. Alle Skripte, die App-Code laden, starten mit
  `--import=./scripts/lib/register-server-only.mjs` (in `package.json` für `payload`, `generate:*`, `env:example`,
  `check:*`, `db:*`, später `seed*`, `jobs:run`). Vitest löst `server-only` per Alias auf
  `tests/helpers/server-only-stub.ts` auf.
- **Folgen:** Im Next.js-Build bleibt der Schutz voll wirksam (Client-Import von Server-Modulen = Build-Fehler). Der
  Hook ist die einzige `.mjs`-Datei in `scripts/lib/` neben dem Stub (erlaubt laut ARCHITEKTUR §2.2).
- **Geprüft:** `pnpm generate:types`, `pnpm payload migrate`, `pnpm payload migrate:create`, `pnpm check:migrations`
  laufen mit `src/lib/env.ts` (Import von `server-only`) fehlerfrei.
