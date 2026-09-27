# Fortschritt

Neueste Einträge oben. Format: `## YYYY-MM-DD – Phase/Aufgabe` + was erledigt wurde + wie getestet.

## 2026-09-27 – P1.6

- Zugriffsschicht `src/access` (isAdmin, none, publicRead mit Seed-Filter, adminField), Kontext-Flags `AppContext`/`withSystem`, `getPublicPayload()`/`getPublicSettings()` mit Whitelist, Cache-Tags und Revalidierung (nichts bei `context.seed`).\n- Feldbausteine `src/fields/` (seedField, privacyFields, addressFields, internalLinkFields, moneyField mit Admin-Komponente EuroInput, sortOrderField).\n- Payload: Sprachen de/en mit Rückfall, Verwaltung nur Deutsch (`@payloadcms/translations` 3.90.2), GraphQL aus, Avatar ohne Gravatar; Migration `p1_localization` (Enum `_locales`).\n- Tests: unit access (8), money-field mit jsdom (5), seed-field (4); pnpm check, test:int, build grün.

## 2026-09-27 – P1.5

- `scripts/db-ensure.ts` (`db:ensure`), `scripts/db-reset.ts` (`db:reset --test`, nur `*_test`, nicht bei `APP_ENV=production` oder markierter DB), `src/lib/db/guard.ts` (`isProductionDatabase`, gemeinsame Sperrregel).
- `payload.config.ts`: Pool `max = DB_POOL_MAX`, Push nur mit `PAYLOAD_DB_PUSH` in `development`, `migrationDir`; erste Migration `p1_baseline`.
- `scripts/check-migration-drift.ts` (`check:migrations`); `ci.yml` Schritt 6 (migrate + Drift). Gegenprobe: ein Feld ohne Migration lässt die Prüfung scheitern.
- Int-Setup (`tests/int/setup/global.ts`, `env.ts` → immer `DATABASE_URL_TEST`), Helfer `getTestPayload()`/`withClock()`; Netzwerk-Wächter `tests/setup/network-guard.ts` (Socket, `http(s).request`, `fetch`) in Unit und Int.
- Spike `server-only` in Skripten → ADR `docs/adr/0001-server-only-in-scripts.md` (Import-Hook).
- Tests: int `tests/int/db/reset-guard.int.spec.ts`, `tests/int/db/migrate.int.spec.ts` (DM-P1-01), unit `tests/unit/setup/network-guard.unit.spec.ts`; `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P1.4

- `src/lib/time.ts` (Uhr, Berliner Tag/Monat/Jahr, Zeitumstellung korrekt, `formatBerlin`) mit `date-fns`/`@date-fns/tz` (exakt gepinnt); `src/lib/money.ts` (`formatMoney` full/tag, `parseEuroInput`, `assertCents`, ohne Fließkomma-Rechnung).
- `src/lib/monitoring/logger.ts` (JSON-Zeilen, `LOG_LEVEL`) mit `src/lib/security/redact.ts` (Schlüsselliste §8.11, E-Mail, IBAN, 43-Zeichen-Token, Telefonnummern).
- `src/lib/enums.ts` wörtlich aus DATENMODELL §4 (inkl. 64 Fasern), `src/lib/enumLabels.ts` (DE für alle, EN für öffentliche Enums).
- `src/lib/security/keys.ts` (HKDF, feste Bezeichner), `ipHash.ts` (täglich wechselnd), `tokens.ts` (Zufalls-Token, Hash, konstanter Vergleich).
- Tests: `tests/unit/lib/{time,money,logger,enums,keys}.unit.spec.ts`; `pnpm check` grün.

## 2026-09-27 – P1.3

- `src/lib/env.schema.ts` (Registry aller Variablen aus ARCHITEKTUR §5.2 mit Beschreibung, Beispiel, Geheimnis-Kennung, „Seit“) und `src/lib/env.ts` (`getEnv()` gecacht, `collectEnvViolations`/`assertProductionEnv` sammeln alle Verstöße, `seedPreviewModeActive`); `src/instrumentation.ts` prüft beim Start (Produktion ohne `APP_ENV` bricht ab).
- `pnpm env:example` erzeugt `.env.example`; `pnpm check:static` mit Teilprüfungen `versions`, `env-example`, `import-rules`, `stripe-import`, `external-urls`; `pnpm check` enthält sie; `ci.yml` Schritt 4.
- ESLint: `process.env` nur in `src/lib/env.ts`/`instrumentation.ts`; `getPayload` nicht in öffentlichen Seiten. `payload.config.ts` nutzt `getEnv()`.
- Import-Hook `scripts/lib/register-server-only.mjs` macht `server-only` in CLI-Skripten (payload, tsx) ladbar.
- Tests: `tests/unit/env/assert-production.unit.spec.ts` (T-17, AK-A-3-02, AK-1-02, AK-SEED-16), `tests/unit/env/env-example.unit.spec.ts` (AK-A-5-01), Lint-Regeltest (AK-A-5-02); `pnpm check`, `pnpm test:int`, `pnpm build` grün, `pnpm dev` startet.

## 2026-09-27 – P1.2

- Prüfstellen abgeglichen (Liste im PR-Text). Korrigiert: DATENMODELL §6.12 (Begriffe laut R-012/R-002), SEED-SPEC §1.4, §1.8, §2.1.
- OFFENE-PUNKTE §4: fehlende IDs C-28 und SE-14 ergänzt; alle W-, C-, DM-, DA-, KA-, SE-IDs vorhanden. ENTSCHEIDUNGEN unverändert.
- Tests: `tests/unit/docs/resolutions.unit.spec.ts` (W-IDs in OFFENE-PUNKTE); `pnpm test:unit` grün.

## 2026-09-27 – P1.1b

- `scripts/check-versions.ts` (`pnpm check:versions`): `@payloadcms/*` = `payload`, `eslint-config-next` = `next`, `react` = `react-dom`, kein `^`/`~` bei Laufzeit-Abhängigkeiten; ab 30.09.2026 Warnung bei `next` < 16.3.7.
- Next.js-Patch: 16.3.7 ist noch nicht erschienen, 16.3.6 ist der neueste 16.3.x-Patch → bleibt; Zeile in OFFENE-PUNKTE.
- Tests: `tests/unit/tooling/check-versions.unit.spec.ts` (AK-A-1-01/-02); `pnpm check` grün.

## 2026-09-27 – P1.1a

- `ci.yml` nach ARCHITEKTUR §6.3: Job `quick`, nur `pull_request`/`workflow_dispatch` (kein `push`), Wegwerf-DB `planetclaire_test`, `TZ=UTC`, `DB_POOL_MAX`, `SEED_*`, `NEXT_PUBLIC_LEASH_DEBUG`, `E2E_SERVER`; Schritt „Kennung“ überspringt bei `[ci:update-snapshots]`/`[ci:art]`.
- Test-Helfer (`tests/helpers/adminEnv.ts`, `login.ts`, `seedUser.ts`) nutzen `ADMIN_ROUTE` und `SEED_ADMIN_*`; `admin.e2e.spec.ts` bis P1.12 als `fixme`.
- Tests: YAML lokal geparst (Auslöser, Job `quick`); `pnpm check` grün.

## 2026-09-27 – P1.1

- tsconfig: `noUncheckedIndexedAccess`, `noImplicitOverride`; `.npmrc` `save-exact=true`; `cross-env`, `graphql`, `eslint`, `prettier` exakt gepinnt.
- ESLint nach ARCHITEKTUR §15: `no-explicit-any` als Fehler, `no-console` in `src/` (außer Logger), Uhr-Verbot (`new Date()`, `Date.now()`) in commerce/jobs/legal, `toFixed` in commerce, framework-freie `behaviors`/`leash`/`preview-runtime`. `pnpm lint` prüft zusätzlich das Format (`.prettierignore` für Doku und generierte Dateien).
- Vitest: Int-Tests nacheinander (`fileParallelism: false`), `server-only` → Stub in beiden Konfigurationen.
- P0-Prüfpunkte bestätigt (`.gitattributes` lf/binary, `.gitignore`, `next.config.ts`, Build-Speicher).
- Tests: `tests/unit/lint/rules.unit.spec.ts` (AK-A-15-01); `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P0 abgeschlossen (P0.8 GitHub)

- Plan zu einer Datei `PLAN.md` zusammengeführt (P0 erledigt, P1–P10: 329 offene Aufgaben, P11 mit Jutta);
  `bash scripts/cloud-setup.sh --plan-status` → erste offene Aufgabe P1.1.
- GitHub-Beschriftungen am 27.09.2026 nachgeprüft und in CLOUD-SETUP, ANLEITUNGEN, AUFGABEN, ARCHITEKTUR,
  OFFENE-PUNKTE korrigiert (Squash-Einstellung „Default to pull request title and description“, CLOUD-SETUP F-31).
- Privates Repository `planetclairetattoos` angelegt, `main` gepusht; erster CI-Lauf (Lint, Typen, Unit,
  Integrationstest gegen Postgres 17, Build) grün – von Jutta im Reiter „Actions“ bestätigt.
- `pnpm check` und `pnpm build` lokal grün.
- Nächster Schritt: Jutta richtet die Cloud ein (`docs/CLOUD-SETUP.md` §1–§2) und startet die erste Cloud-Session;
  sie beginnt mit P1.1.

## 2026-09-26 – P0 Fundament (lokal)

- Interview mit Jutta (13 Fragerunden) und Recherche (Recht, Produkt-Compliance, Technik, Zahlung/Versand, Design,
  Tattoo, Cloud-Arbeitsweise) mit Faktencheck; Ergebnisse in `docs/research/`.
- Konzept freigegeben („Freigabe, Instagram-Bilder darfst du herunterladen“); Entscheidungen in `docs/ENTSCHEIDUNGEN.md`.
- 22 Instagram-Bilder (öffentlich sichtbar, mit Erlaubnis) in `content/seed/instagram/` + `manifest.json`.
- Fachdokumente: KONZEPT, DATENMODELL, ARCHITEKTUR, DESIGN + KUNST-QA, Recht (Anforderungen, Kanzlei-Briefing,
  Dienste, Löschkonzept), Aufgaben & Anleitungen für Jutta, Cloud-Setup, Beispielbestand-Spezifikation, PLAN.md.
- App-Gerüst: Next.js 16.3.6 + Payload 3.90.2 (Postgres), pnpm 10.34.5; Lint, Typprüfung, Unit-Test und Build
  lokal grün; CI-Workflow (inkl. Integrationstest gegen Postgres) angelegt.
- Nächster Schritt: Session in die Cloud verschieben, dort P1 starten (siehe `docs/CLOUD-SETUP.md`).
