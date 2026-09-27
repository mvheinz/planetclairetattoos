# Fortschritt

Neueste Einträge oben. Format: `## YYYY-MM-DD – Phase/Aufgabe` + was erledigt wurde + wie getestet.

## 2026-09-27 – P1.16

- `src/collections/Products.ts` mit Tabs Basis/Pflichtangaben/Bilder/Verkauf/Intern, Feldern aus DATENMODELL §6.6.1 (inkl. R-043–R-048), Bedingungen je Kategorie, Zugriff §6.6.9, keine Versionen; Migration `p1_products` (inkl. Index category/status).
- Hooks (`src/collections/hooks/products.ts`): Trimmen, Kategorie-Voreinstellungen nur für leere Felder (DE und EN), Leeren fremder Angaben beim Kategoriewechsel, `hasDeviation` aus `deviationDecision`, Pflicht-Warnhinweise (Kleinteile, Glasrahmen) nicht entfernbar, Kategorie nur im Entwurf, Preis/Versandklasse gesperrt bei reserviert/verkauft, Audit Anlage/Preis, Cache.
- `src/lib/products/`: `characteristics.ts` (`buildCharacteristics`), `fibers.ts` (`formatFibers`), `categoryRules.ts`, `warnings.ts`, `itemNumber.ts` (Format); Medien-/Upload-Referenzen registriert.
- Tests: unit `tests/unit/products/characteristics.unit.spec.ts` (6, Snapshot DE/EN), int `tests/int/collections/products-fields.int.spec.ts` (12: DM-PROD-07, DM-MEDIA-05, Voreinstellungen, Kategorie-Sperre, DM-PROD-08); pnpm check, test:int, build grün.

## 2026-09-27 – P1.15

- Collection `categories`: 6 feste Schlüssel, Name aus den Labels (DE/EN), Slug je Sprache eindeutig (Index + Prüfung), Anlegen/Löschen nur mit Seed-Kontext, `key` unveränderlich, Versionen 10, Cache-Tag `categories`. Slugs stehen nicht im Code (kommen mit dem Grund-Seed P1.29).\n- Collection `conformity-declarations`: Laborbericht privat (nur Zweck `lab_report`), Erklärung als öffentliches PDF (Art `conformity_declaration`), öffentlich nur aktive ohne Labor/Notizen; Statuswechsel nur mit Übergang `revokeConformityDeclaration` (Service und Stück-Sperre in P1.19). Verwendete Dateien sind löschgesperrt; `private-uploads.relatedDeclaration` ergänzt.\n- Migration `p1_categories`.\n- Tests: int `categories.int.spec.ts` (4) und `conformity.int.spec.ts` (4, R-044 Teil), alle grün.

## 2026-09-27 – P1.25

- Global `settings` (alle Felder aus DATENMODELL §7.1 mit Standardwerten, Beispiel-IBAN, Versionen max. 50) mit Regeln in `src/lib/settings/rules.ts`: Steuermodus nur mit Begründung + „mit Steuerberatung abgestimmt“, IBAN-Prüfsumme, DE-Pflicht und EU-Sperre, Tarife je Zone, Verpackung genau 1 je Versandklasse, Umsatzwächter-Reihenfolge u. a.; Audit `settings_changed` (maskiert), `tax_mode_changed`, `retention_setting_changed`.\n- Global `site-texts` (DE/EN-Standardtexte, Navigation, Mail-Texte je Vorlage), öffentlich lesbar.\n- `src/lib/legal/constants.ts` (Bestell-Button, „Vertrag widerrufen“, „Widerruf bestätigen“, Kleinunternehmer-Satz); `getPublicSettings()` ans Global angeschlossen; `retention.invoiceYears` wirkt auf Beleg-PDFs; AV-Verträge sperren das Löschen ihrer Datei.\n- Migration `p1_globals`.\n- Tests: int `tests/int/globals/settings.int.spec.ts` (11 grün, R-032), unit `legal/constants` (4) und `settings/rules` (6).

## 2026-09-27 – P1.14

- Collections `documents` (öffentliche PDFs, nur PDF ≤ 20 MB, sha256, Rechtstext-PDFs nie löschbar) und `private-uploads` (privater Speicher, nur angemeldet, ≤ 10 MB, Typprüfung am Inhalt, Bilder gedreht/≤ 2560 px/JPEG q85 ohne Metadaten, Vorschau `thumb`).\n- Aufbewahrung je Zweck in `src/lib/retention/policy.ts` (`privateUploadRetention`): `deleteAfter` nur verkürzbar, `retainUntil` für Belege eingefroren, Löschsperre davor (außer Seed); Verweis-Register `src/lib/uploads/references.ts`; Audit `private_upload_deleted`. Bezüge (Bestellung, Anfrage, Rechnung …) verdrahten die späteren Aufgaben.\n- Migration `p1_documents`.\n- Tests: int `private-uploads.int.spec.ts` (14 grün, s3-Teil ohne MinIO übersprungen: DM-PRIV-01/-02, R-135, R-136), unit Fristen je Zweck (4 neu).

## 2026-09-27 – P1.13

- `media` laut DATENMODELL §6.2: Felder (Alt-Text DE Pflicht mit Regeln, EN optional; `showsPerson`, `restricted`, `source`, `enhance`, `derivativesVersion`, LQIP, Dominanzfarbe), öffentlich nur nicht gesperrte Bilder – auch über die Dateiroute; Migration `p1_media`.
- Bildpipeline (`src/lib/media/pipeline.ts`): nur JPEG/PNG/WebP (Inhalt geprüft), Orientierung + sRGB, alle Metadaten weg, Original WebP q90 ≤ 2560 px, Dateiname mit Inhalts-Hash; Größen `thumb`/`card` (4:5 am Fokuspunkt), `detail`, `zoom`, `og` (JPEG) – zu kleine Größen entfallen, nie hochskaliert.
- Admin: `DownscaleUpload` verkleinert große Fotos im Browser auf 2560 px (JPEG 0,85); `beforeDelete` prüft Verweise über `src/lib/media/references.ts`.
- Fixtures per `scripts/fixtures/make-exif-fixture.ts`: `gps-orientation-6.jpg` (GPS, Orientation 6, XMP, IPTC), `landscape-small.jpg`.
- Tests: int `tests/int/collections/media.int.spec.ts` (13 Fälle: DM-MEDIA-01…04, R-135, T-05, GIF/SVG, Verweise), unit `tests/unit/media/pipeline.unit.spec.ts`; Upload über die Verwaltung im Browser geprüft; `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P1.12

- Spike B-01 Soll erfüllt: `src/proxy.ts` schreibt `ADMIN_ROUTE/*` intern auf den Ordner `admin/` um, `/admin` und `/admin/*` → 404; `routes.admin` aus `getEnv()`, Import-Map-Pfad fest (ARCHITEKTUR Anhang B).
- GraphQL-Routen gelöscht (`/api/graphql` → 404); `GET /api/health` ohne DB (`{ status, version, appEnv }`, no-store).
- JSON-Felder in der Verwaltung ohne Monaco: Nur-Lese-Anzeige `JsonPreview` (auch für `payload-jobs`).
- `pnpm check:external --built` (Grundgerüst): Verwaltungspfad in keiner Datei unter `.next/static`/öffentlichem HTML.
- Playwright-Projekte desktop/iphone-15/pixel-7 (§7.3), E2E gegen die Test-DB; `test.fixme` in `admin.e2e.spec.ts` entfernt.
- Tests: e2e `admin-route.e2e.spec.ts` @smoke + `admin.e2e.spec.ts` (30/30 grün in 3 Projekten, `pnpm dev`; desktop auch gegen `pnpm start`), int `tests/int/api/health.int.spec.ts`, unit Proxy + check:external; `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P1.11

- Konto `users` laut DATENMODELL §6.1: genau ein Konto (Access + Hook, auch Local API), Passwortregel (auch beim Zurücksetzen), Sperre 5/15 min, Cookie SameSite=Strict, `lastLoginAt` + Audit `login_succeeded`.
- „Passwort vergessen“ (A17): deutsche Mail mit Link unter `ADMIN_ROUTE`, 1 h gültig; `email-log` `admin_password_reset` ohne Token, Audit `password_reset_requested`.
- Rate-Limit-Tabelle `rate_limit_hits` (Migration `p1_rate_limit`) + `src/lib/security/rateLimit.ts`: `admin_login` 10/15 min, `forgot_password` 3/h → 429 mit Retry-After; Migration `p1_users`.
- `pnpm admin:create` (interaktiv, verweigert zweites Konto) und `pnpm admin:unlock`.
- Tests: int `tests/int/collections/users.int.spec.ts` (17 Fälle: DM-USER-01…03, AK-A-8-03, R-136, A17, Unlock, Reset hebt Sperre auf); `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P1.10

- `src/lib/payments/` (Schnittstelle vollständig nach ARCHITEKTUR §3.5, `getPaymentsAdapter()`, Mock mit `cs_mock_`/`pi_mock_`/`re_mock_`/`evt_mock_`, HMAC-Webhook-Prüfung, in Produktion verboten; `stripe/` als Gerüst mit ConfigError ohne Schlüssel), `src/lib/translation/` (Mock "[EN] " + Text mit `usage`, DeepL-Gerüst), `src/lib/carrier/` (`manual`, `trackingUrl`, `validateTrackingNumber`).
- `docker-compose.yml`: Profil `payments` (stripe-mock); DHL-Verfolgungslink in der URL-Allowlist von `check:static`.
- Mock-Zustand bis P4.4 im Prozess-Speicher hinter `MockPaymentsStore` (OFFENE-PUNKTE).
- Tests: int payments/translation/carrier.contract (20; stripe-mock-Teil nur wenn erreichbar, lokal geprüft); `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P1.9

- `src/lib/email/` (Treiber file/smtp/memory/log, eine Transport-Fabrik `createMailTransport` auch für Payloads eigene Mails, Unterdrückung R-180 und Umleitung im Transport), Outbox `outbox.ts`, `tests/helpers/outbox.ts`; `@payloadcms/email-nodemailer` 3.90.2, `nodemailer` 9.1.1.
- Jobs: `src/jobs/index.ts` (alle Slugs aus A.3 mit Queue und Phase), Task `sendEmail` (P1: `admin_alert`), `jobs` in payload.config (vier Queues, autoRun nur bei JOBS_AUTORUN, access.run Admin oder Bearer), Migration `p1_jobs`; Job-Wecker `src/lib/jobs/alarm.ts`, Routen `/api/cron/tick` und `/api/cron/run/[task]` (Gerüst), `pnpm jobs:run <task> [--now=<ISO>]`.
- Spike B-09: Soll erfüllt (handleSchedules/run/runByID in 3.90.2, auch mit vorgestellter Uhr).
- Tests: int email.contract (18, SMTP gegen lokalen Fake-Server), jobs/send-email (5), jobs/tick (7, Pool-Zähler), spikes/b09-jobs (2); unit jobs/slugs (3); `pnpm check`, `pnpm test:int`, `pnpm build` grün; Routen zusätzlich per `pnpm start` geprüft (401/200/204/409).

## 2026-09-27 – P1.8

- `src/lib/storage/`: `uploadStorage(area)` (staticDir `.data/{media,documents,private}`, Datei-Handler mit dokumentabhängigen Cache-Headern), `storagePlugins()` mit zwei Instanzen `@payloadcms/storage-s3` 3.90.2 (öffentlich/privat, signierte Downloads 300 s), `systemFiles.ts`, `signed.ts`; `media` nutzt es; Migration `p1_storage` (Felder `prefix`, `_objectKey`).
- `docker-compose.yml`: Profil `s3` (MinIO + Bucket-Anlage).
- Spike B-02: Soll erfüllt (gegen RustFS als MinIO-Ersatz, siehe OFFENE-PUNKTE).
- Tests: int `tests/int/adapters/storage.contract.int.spec.ts` (11 Tests: local immer, s3 gegen lokalen S3-Dienst inkl. Ablauf 403); `pnpm check`, `pnpm test:int`, `pnpm build` grün.

## 2026-09-27 – P1.7

- Protokoll-Collections `audit-log`, `email-log`, `consent-log`, `webhook-events`, `deletion-log` (Gruppe „System“, nur lesen; Anlegen/Ändern/Löschen nur über Server-Code; unveränderliche Felder per Hook gesperrt); Migration `p1_logs`.\n- `src/lib/retention/policy.ts` mit allen Fristen als L-Konstanten und `retainUntil()` (Berliner Kalender, Jahresende-Regel); `writeAudit()` maskiert E-Mail, IBAN, Namen und Adressen; `getStatusHistory()`; `writeDeletionLog()` in der Transaktion des Aufrufers.\n- Tests: unit policy (47, Fristen aus LOESCHKONZEPT geparst), int logs (43: anonymes REST verboten, Local API ohne overrideAccess verboten, Maskierung, ruleId-Muster, Fristen, Rollback); pnpm check, test:int, build grün.

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
