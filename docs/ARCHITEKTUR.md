# ARCHITEKTUR – Technik, Umgebungen und Betrieb

> **Stand:** 26.09.2026 · **Version:** 1.0 (P0) · **Status:** verbindlich für P1–P11
> **Rang:** `docs/ENTSCHEIDUNGEN.md` (E-xx) > dieses Dokument = KONZEPT = DATENMODELL = DESIGN = RECHT (je Zuständigkeit)
> > `PLAN.md` > `docs/research/`. **Dieses Dokument gewinnt bei:** Namen von Umgebungsvariablen, Adaptern/Treibern,
> technischen Endpunkten, Cookies, Skripten (`pnpm …`), Ordnerstruktur, CI/CD, Umgebungen, Hosting, Sicherheits-Headern,
> Caching, Backups (KONZEPT §0.3, KA-15).
> **Leser:** autonome Claude-Code-Agenten in Cloud-Sessions (P1–P10), die niemanden fragen können (E-97). Jede Regel ist
> konkret und – wo möglich – als Akzeptanzkriterium `AK-A-<Abschnitt>-<Nr>` prüfbar.
> **Sprache:** Deutsch; Code-Bezeichner, Feldnamen, Enums, Umgebungsvariablen Englisch.
> **Pflegeregel:** Wer Verhalten, Umgebungsvariablen, Endpunkte oder Workflows ändert, ändert dieses Dokument im selben PR.
> Entscheidungen, die hier als **[Spike]** markiert sind, klärt die genannte Phase per Prototyp; das Ergebnis wird hier
> nachgetragen (Abschnitt „Ergebnis“ im jeweiligen Spike, Anhang B) und – falls es von der Soll-Variante abweicht – als ADR
> in `docs/adr/` begründet.

---

## Inhalt

0. [Grundsätze und Zuständigkeit](#0-grundsätze-und-zuständigkeit)
1. [Stack und exakte Versionen](#1-stack-und-exakte-versionen)
2. [Repository-Aufbau](#2-repository-aufbau)
3. [Adapter-Muster und Ersatzdienste](#3-adapter-muster-und-ersatzdienste)
4. [Umgebungen](#4-umgebungen)
5. [Umgebungsvariablen](#5-umgebungsvariablen)
6. [CI/CD](#6-cicd)
7. [Teststrategie und Gates](#7-teststrategie-und-gates)
8. [Sicherheit](#8-sicherheit)
9. [Performance-Architektur](#9-performance-architektur)
10. [Backups und Wiederherstellung](#10-backups-und-wiederherstellung)
11. [Monitoring und Alarme](#11-monitoring-und-alarme)
12. [Hosting, Kosten, DNS-Umstellung](#12-hosting-kosten-dns-umstellung)
13. [Docker-Exit-Pfad](#13-docker-exit-pfad)
14. [Single-File-Vorschau – Werkzeug](#14-single-file-vorschau--werkzeug)
15. [Coding-Konventionen](#15-coding-konventionen)
- [Anhang A – Namensabgleich mit anderen Dokumenten](#anhang-a--namensabgleich-mit-anderen-dokumenten)
- [Anhang B – Spikes mit Rückfallebene](#anhang-b--spikes-mit-rückfallebene)
- [Anhang C – Annahmen und offene Punkte](#anhang-c--annahmen-und-offene-punkte)

---

## 0. Grundsätze und Zuständigkeit

### 0.1 Architektur in einem Absatz

Eine einzige **Next.js-16-App mit eingebettetem Payload CMS 3** (TypeScript, pnpm) und **Postgres** (E-90). Öffentliche
Seiten (DE/EN, next-intl) werden statisch bzw. per ISR ausgeliefert und gezielt per Cache-Tag erneuert; Kasse, Warenkorb,
Token-Seiten und Formulare sind dynamisch. Der Commerce-Kern (Reservierung, Bestellung, Belege) ist selbst gebaut und
läuft in Postgres-Transaktionen (DATENMODELL §8). Alle Fremddienste (Speicher, Mail, Zahlung, Übersetzung, Versand,
Statistik, Fehlerüberwachung) hängen hinter **Adaptern mit Mock**; bis P11 existieren keine echten Konten. Produktion ab P11:
Vercel Pro (fra1) + Neon (aws-eu-central-1) + Cloudflare R2 (EU) + Stripe + Lettermint (E-91, E-92). Ein Docker-Pfad
(Hetzner) wird gepflegt.

### 0.2 Architekturprinzipien (verbindlich)

| ID | Prinzip | Folge im Code |
|---|---|---|
| A-01 | **Eine App, ein Repo, ein Deployable** (E-90) | kein Monorepo, keine zweite App, kein separater Worker in Produktion |
| A-02 | **Offline bau- und testbar** (E-97, E-99) | ohne jede Zugangsdaten-Variable laufen `pnpm build`, `pnpm test`, `pnpm test:e2e`, `pnpm preview:export` grün (AK-1-01 KONZEPT) |
| A-03 | **Jede Integration hinter einem Adapter mit Mock** | Auswahl per `*_DRIVER`-Variable; Mocks machen nie Netzwerk-Anfragen |
| A-04 | **Keine Drittanbieter-Requests auf öffentlichen Seiten** (E-43, R-131) | einzige Ausnahme: Stripe auf der Kasse |
| A-05 | **Kein Endgeräte-Speicher vor Nutzeraktion** (E-43, R-130) | erstes Cookie erst bei „In den Korb“ |
| A-06 | **Deny by default** (DATENMODELL §1.4) | jede Collection definiert alle Operationen; öffentliche Schreibwege nur über eigene Route-Handler/Server-Actions |
| A-07 | **Geld = Integer-Cent, Zeit = UTC in der DB, Berlin in der Anzeige** | `src/lib/money.ts`, `src/lib/time.ts` |
| A-08 | **Zeit ist injizierbar** | Services und Jobs bekommen `now`; SQL vergleicht mit einem Parameter `$now`, nie mit `now()` (Ausnahme: `created_at`/`updated_at`) |
| A-09 | **Statisch wo möglich, dynamisch wo nötig** | Katalog statisch/ISR, gezielte Revalidierung ≤ 5 s bei Statuswechsel |
| A-10 | **EU-Datenhaltung, Kosten ≤ 25 €/Monat** (E-05, E-91) | Neon darf im Leerlauf schlafen (§9.6); keine kostenpflichtigen Zusatzdienste ohne Entscheidung |
| A-11 | **Framework-unabhängige Verhaltensmodule** (KONZEPT §12.9) | Interaktion öffentlicher Seiten über `src/behaviors/*` mit `mount(root) → unmount()` |
| A-12 | **Keine Geheimnisse im Repo, keine Produktionsdaten in Entwicklungswerkzeugen** (DIENSTE §3.11) | GitHub und Claude-Cloud sehen nie Kundendaten; Backups laufen nicht über GitHub Actions |

### 0.3 Was dieses Dokument nicht regelt

Felder, Collections, Enums, SQL-Muster → `docs/DATENMODELL.md`. Seiten, Abläufe, Mails, Jobs fachlich → `docs/KONZEPT.md`.
Aussehen, Tuschelinie, Bewegung → `docs/design/DESIGN.md`, `docs/design/KUNST-QA.md`. Rechtliche Anforderungen (R-xxx),
Dienste-Verzeichnis, Löschfristen → `docs/recht/`. Einrichtung der Cloud-Umgebung → `docs/CLOUD-SETUP.md`. Aufgaben und
Reihenfolge → `PLAN.md`. Betriebshandbuch (Deploy, Rollback, Restore, Schlüsseltausch) → `docs/RUNBOOK.md` (entsteht in P10
aus §10–§13 dieses Dokuments); DNS-Umstellung und Start-Checkliste für P11 → `docs/GO-LIVE.md` (P10, Tabellen wörtlich aus
§12.4).

---

## 1. Stack und exakte Versionen

### 1.1 Bereits installiert (P0-Gerüst, `package.json`)

| Baustein | Paket / Werkzeug | Version (exakt) | Regel |
|---|---|---|---|
| Laufzeit | Node.js | `engines.node >=22.12.0`; `.nvmrc` = `24` | **Node 24 LTS** ist Standard (CI, Docker, Vercel, lokal). Node 22 ist Mindeststand, weil die Cloud-VM Node 22 mitbringt. Node 24 ist ab 20.10.2026 Maintenance-LTS (Support bis 30.04.2028); Node 26 (LTS ab 28.10.2026) nur per ADR. Kein Code, der Node-24-only-APIs braucht. |
| Paketmanager | pnpm | `packageManager: pnpm@10.34.5` | über Corepack (`corepack enable`); `pnpm install --frozen-lockfile` in CI; `pnpm-lock.yaml` wird immer committet |
| Framework | `next` | `16.3.6` (am 26.09.2026 die neueste Version) | **Pflicht-Update:** Für den 30.09.2026 ist das Sicherheitsrelease **16.3.7** angekündigt (laut Recherche 9 Schwachstellen, davon 1 kritisch). **Aufgabe P1.1b aktualisiert `next` und `eslint-config-next` auf den neuesten 16.3.x-Patch** (≥ 16.3.7, sobald verfügbar; exakt gepinnt, §1.3). Ist 16.3.7 beim Start von P1 noch nicht erschienen, holt die erste Session an oder nach dem 30.09.2026 das Update vor jeder anderen Arbeit nach. `check:versions` meldet einen fehlenden Pflicht-Patch nur als Warnung (§1.3), damit `pnpm check` nicht allein wegen des Stichtags rot wird. Nur 16.x; 17 nur per ADR. |
| UI | `react`, `react-dom` | `19.2.6` | 19.2.x; 19.3 erst, wenn `@payloadcms/next` sie offiziell unterstützt |
| CMS | `payload`, `@payloadcms/next`, `@payloadcms/ui`, `@payloadcms/richtext-lexical`, `@payloadcms/db-postgres` | `3.90.2` | **alle `@payloadcms/*` exakt gleiche Version wie `payload`** (Prüfskript §1.3); nur 3.x; Payload 4 (derzeit Canary) nicht einführen |
| Sprache | `typescript` | `5.7.3` (wie im Gerüst) | 5.x-Minor-Updates erlaubt; TS 6.0/7.0 nur per ADR, wenn Payload-Vorlage und Next sie offiziell nutzen |
| Bilder | `sharp` | `0.35.4` | in `pnpm.onlyBuiltDependencies`; kein HEIC (DATENMODELL §6.2) |
| Unit/Int-Tests | `vitest` 4.0.18, `@vitejs/plugin-react` 4.5.2, `vite-tsconfig-paths` 6.0.5, `jsdom` 28.0.0, `@testing-library/react` 16.3.0, `@vitest/coverage-v8` 4.0.18 (P4.25, `pnpm test:coverage`, §7.8) | exakt | Vitest 5 nur als eigenes Update mit grüner CI |
| E2E | `@playwright/test` | `1.58.2` | Minor-Updates erlaubt (Browser danach neu installieren); iPhone-15- und Pixel-7-Deskriptoren sind enthalten |
| Lint/Format | `eslint` 9 (Flat-Config), `eslint-config-next` 16.3.6, `prettier` 3 | wie `package.json` | `eslint-config-next` immer = `next` |
| Skripte | `tsx` 4.22.4, `cross-env`, `dotenv` 16.4.7 | exakt | alle Skripte in TypeScript über `tsx`, nie Bash- oder PowerShell-only |
| Datenbank-Server | PostgreSQL | **17** lokal (Docker), CI, Produktion (Neon); **16** in der Cloud-VM | Code und Migrationen müssen auf 16 **und** 17 laufen (keine 17-only-Features, z. B. kein `MERGE … RETURNING`, kein `JSON_TABLE`) |

### 1.2 Wird in Phasen ergänzt (Major-Version verbindlich, exakte Version bei Einführung pinnen)

| Paket | Version | Ab | Zweck / Regel |
|---|---|---|---|
| `@payloadcms/storage-s3` | = `payload` | P1 | R2 in Produktion, MinIO im Test (§3.3) |
| `@payloadcms/email-nodemailer`, `nodemailer` | = `payload` / 7.x | P1 | ein Transport für Payload-Mails und eigene Mails (§3.4) |
| `@payloadcms/drizzle` | = `payload` | P1 | `getTransaction` für eigenes SQL (DATENMODELL §8.3) |
| `server-only` | aktuell | P1 | Schutz serverseitiger Module |
| `zod` | 4.x | P1 | Validierung an allen Grenzen (§15) |
| `date-fns`, `@date-fns/tz` | 4.x / 1.x | P1 | Berliner Kalendertage, Monatsgrenzen (`src/lib/time.ts`) |
| `exifr` (dev) | aktuell | P1 | EXIF-Tests (R-135) |
| `yaml` (dev) | 2.x | P1 | Workflow-Test `tests/unit/ci/workflows.unit.spec.ts` parst `.github/**/*.yml` (P1.33) |
| `next-intl` | 4.x (≥ 4.14) | P2 | Routing DE/EN, Nachrichten; `localeCookie: false` (R-130) |
| `@fontsource/spectral` (5.3.0, exakt gepinnt, P12.2; löst `@fontsource/mansalva` ab), `@fontsource-variable/bricolage-grotesque`, `@fontsource/ibm-plex-mono` | aktuell | P2 | nur Quelle für das Kopierskript nach `src/styles/fonts/` (DESIGN §4.1) |
| `subset-font` (dev) | aktuell | P2 | Schrift-Subsetting in `pnpm fonts:copy` (harfbuzz-wasm, ohne Python): beschneidet Bricolage bei Bedarf auf `wght 400–700` (DESIGN §4.1); Skripte bleiben TypeScript über `tsx` |
| `@fontsource/bricolage-grotesque` (dev), `wawoff2` (dev, MIT; oder gleichwertiger WOFF2→TTF-Wandler aus npm) | 5.3.0 / 2.0.1 (exakt gepinnt, P3.14) | P3 | `pnpm fonts:copy` erzeugt daraus die TTF-Dateien für OG-Bilder in `src/og/fonts/` (Mansalva 400, Bricolage statisch 600; DESIGN §4.1, P3.14) und `src/og/fontMetrics.generated.ts` (Abdeckung, Laufweiten); **kein** Download von fonts.gstatic.com oder anderen Schrift-Servern |
| `@axe-core/playwright` (dev) | 4.x | P2 | Barrierefreiheit |
| `@lhci/cli` (dev) | aktuelle 0.x | P2 | Lighthouse-CI, nur Ziel `filesystem` (§7.7) |
| `cheerio` (dev) | 1.x | P2 | HTML-Umwandlung im Vorschau-Export (§14) |
| `esbuild` (dev, explizit) | = Version im Lockfile | P2 | Vorschau-Laufzeit bündeln (§14) |
| `svgo` (dev), `fontkit` oder `opentype.js` (dev) | aktuell | P2 | SVG-Optimierung, Glyphen-Test (DESIGN AK-DS-05) |
| `bwip-js` (dev) | 4.11.4 (exakt gepinnt, P5.14) | P5 | nur für Barcode-Test-Fixtures (`scripts/fixtures/barcodes.ts`) |
| `@zxing/browser`, `@zxing/library` | 0.2.1 / 0.23.0 (exakt gepinnt, P5.14) | P5 | Rückfall des Barcode-Scans über ein Foto (`src/admin/components/TrackingScanner.tsx`), nur als dynamisch importierter Chunk in der Versand-Ansicht (Bestell-Detail); zuerst natives `BarcodeDetector`; keine Netz-Anfragen |
| `@sentry/nextjs` | 11.4.0 (exakt gepinnt, P10.10) | P10 | Fehlerüberwachung, nur Server, nur in `instrumentation.ts` und nur mit `SENTRY_DSN` (§11.4); nie im Client-Bundle (`check:external`) |
| `potrace` (dev) | 2.1.8 | P8 | Vektorisierung der Stationszeichnungen (`art:vectorize`, DESIGN §12.4); GPL → **nur** devDependency, nie im Client-Bundle |
| `gsap` | 3.15.x | optional | kostenlos inkl. DrawSVG/ScrollTrigger. **Nur** gemäß DESIGN §9.10/DA-4: Standard ist eigener Code + WAAPI; GSAP nur per ADR als Lazy-Chunk auf R01 (≤ 30 KB gz) |
| `stripe` (Node) | 22.6.2 (exakt gepinnt, P4.5) | P4 | `apiVersion` fest gepinnt (§3.5): `2026-08-26.dahlia` = `Stripe.API_VERSION` des SDK |
| `@stripe/stripe-js` | 9.17.0 (exakt gepinnt, P4.5) | P4 | **nur** `@stripe/stripe-js/pure`, nur im Kassenmodul (R-062) |
| `@react-pdf/renderer` | 4.x | P4 | Rechnung, Gutschrift, Packzettel, Rechtstext-PDF; nur lokale TTF-Schriften |
| `qrcode`, `@types/qrcode` (dev) | 1.5.4 / 1.5.6 (exakt gepinnt, P4.2) | P4 | EPC-QR (GiroCode) als PNG/SVG, serverseitig, ohne Netz (`src/lib/commerce/qr.ts`; Byte-Segment, Fehlerkorrektur M, Version ≤ 13 nach EPC069-12) |
| `jsqr` (dev) | 1.4.0 (exakt gepinnt, P4.2) | P4 | Test: erzeugten EPC-QR (PNG und mit `sharp` gerastertes SVG) dekodieren und byte-gleich mit der Payload aus `buildEpcPayload` vergleichen |
| `pdf-parse` (dev) | aktuell | P4 | Tests: Text aus erzeugten PDFs lesen (Rechnung, Gutschrift, Rechtstext-PDF; R-120, R-002) |
| `sanitize-html`, `@types/sanitize-html` (dev) | 2.18.0 / 2.16.2 (exakt gepinnt, P6.3) | P6 | Bereinigung eingefügter Rechtstexte (`src/lib/legal/sanitize.ts`): Allowlist aus KANZLEI-BRIEFING §1.2, keine Styles/Klassen/Skripte |
| `fflate` | 0.8.2 (exakt gepinnt, P5.24) | P5 | Rechnungs-ZIP je Monat (`src/lib/export/invoiceZip.ts`), feste Zeitstempel für byte-identische Archive |
| `@aws-sdk/client-s3`, `@aws-sdk/lib-storage` | 3.x | P10 | Backup-Upload (§10); ist über `storage-s3` ohnehin im Baum |
| `age-encryption` | aktuell | P10 | Backup-Verschlüsselung (X25519, age-Format) |
| `pg-copy-streams` | 7.x | P10 | Datenbank-Dump und -Wiederherstellung per `COPY` ohne `pg_dump`-Binärdatei (§10.3) |
| `@sentry/nextjs` | 11.x | P10 | **nur serverseitig** (R-133); kein `withSentryConfig`-Client-Injekt |
| `@vercel/analytics` | aktuell | P10 | nur wenn R-132 erfüllt (§3.8) |

### 1.3 Update-Politik

- **Werkzeug:** Dependabot (in GitHub eingebaut, kein weiteres Konto – E-94). Datei `.github/dependabot.yml` (P1):
  - `npm`, wöchentlich Montag 04:00 `Europe/Berlin`, `versioning-strategy: increase`. **Bis P11 nur Sicherheits-Updates:**
    `open-pull-requests-limit: 0` für die Versions-Updates beider Ökosysteme (Sicherheits-PRs zählen nicht gegen diese
    Grenze); erst P11.2 setzt `open-pull-requests-limit: 5` (npm) bzw. `2` (`github-actions`). Grund: Versions-PRs
    kosten Actions-Minuten (§6.8) und verändern `main` während der Cloud-Phasen.
  - Gruppen: `payload` (`payload`, `@payloadcms/*`), `next` (`next`, `eslint-config-next`), `react` (`react`, `react-dom`,
    `@types/react*`), `test` (`vitest`, `@vitest/*`, `@playwright/test`, `@axe-core/*`, `@lhci/*`), `dev-minor-patch`
    (übrige devDependencies, nur minor/patch).
  - `ignore`: `payload`/`@payloadcms/*` ≥ 4, `next` ≥ 17, `react*` ≥ 20, `typescript` ≥ 6, `@types/node` ≥ 23,
    `stripe` und `@stripe/stripe-js` Major.
  - `github-actions`, monatlich.
- **Kein Automerge vor P11:** `.github/workflows/dependabot-automerge.yml` entsteht erst in P11.2. Auslöser
  `workflow_run` des CI-Workflows mit Ergebnis `success`; Bedingung: Autor `dependabot[bot]`, Update-Typ **patch** (alle
  Pakete) oder **minor bei devDependencies**; nie für `stripe`, `@stripe/stripe-js`, die Gruppe `payload` bei minor, `next`
  bei minor. Merge per `gh pr merge --squash` mit `GITHUB_TOKEN` (`permissions: contents: write, pull-requests: write`).
  Hinweis: Merges mit `GITHUB_TOKEN` lösen keine weiteren Workflows aus; Vercel deployt trotzdem (eigene GitHub-App).
- **Sicherheitsupdates binnen 48 h:** Dependabot-Sicherheits-PRs (Repo-Einstellung „Dependabot security updates“, Aufgabe
  für Jutta in P11) mergt bis P11 die Session selbst, sobald ihre CI grün ist (danach `git merge origin/main` in den
  Arbeitsbranch, §6.7); ab P11 der Automerge (Regel oben). Sind sie rot oder Major, gilt: **Jede Session prüft zu Beginn
  `pnpm audit --prod` und offene Dependabot-PRs und behebt `high`/`critical` vor jeder anderen Aufgabe.** Gibt es für
  eine Lücke keinen Fix innerhalb von Payload 3.x bzw. Next 16.3.x, gilt die dokumentierte Ausnahme aus §8.10. Nach P11:
  Verfahren „Sicherheitsupdate“ im RUNBOOK (Jutta startet eine Session).
- **Next.js-Patches** werden innerhalb von 48 h eingespielt (bis P11 durch die Session, danach Automerge Patch).
  **16.3.7** siehe §1.1.
- **Payload:** auf 3.x bleiben. Minor-Updates (3.90 → 3.9x) nur als eigener PR mit `pnpm payload migrate:create
  <phase>_payload_<version>` (Drift-Prüfung §6) und grüner Voll-CI. Payload 4: eigener Migrations-Task mit ADR nach dessen
  stabilem Release, nicht in P1–P10.
- **Versionsgleichheit** prüft `scripts/check-versions.ts` (`pnpm check:versions`, auch Teil von `check:static` und damit
  von `pnpm check`): alle `@payloadcms/*` = `payload`;
  `eslint-config-next` = `next`; `react` = `react-dom`; keine Bereichsangaben (`^`, `~`) bei Laufzeit-Abhängigkeiten
  (`.npmrc` bekommt in P1 `save-exact=true`). Diese Regeln sind Fehler. Der Next-Pflicht-Patch aus §1.1 (ab dem Stichtag
  30.09.2026 `next` ≥ 16.3.7) ist dagegen **nur eine Warnung** im Job-Summary bzw. in der Konsole; das Update selbst macht
  Aufgabe P1.1b.

### 1.4 Nicht verwenden

`@payloadcms/plugin-ecommerce` (Beta, keine Reservierung – E-90) · `@payloadcms/db-mongodb` · Payload-4-Canary ·
`next/font/google`, Google-/Adobe-Fonts, Font- oder JS-CDNs (E-43, E-79) · `@stripe/stripe-js` ohne `/pure`, Express
Checkout Element, Link, Address Element (R-062) · Sentry-Browser-SDK auf öffentlichen Seiten, Session Replay (R-133) ·
Vercel Speed Insights, jede weitere Statistik, Tracking-Pixel, Embeds, reCAPTCHA/hCaptcha/Turnstile (DIENSTE §5) ·
Tailwind oder CSS-in-JS-Laufzeit (Stil: `src/styles/tokens.css` + CSS Modules, §15) · weitere Animationsbibliotheken
außer optional GSAP (DESIGN §9.10) · three.js/WebGL (KONZEPT §13) · Redis/KV-Dienste (A-10) · Vercel Image Optimization
(`images.unoptimized: true`, Payload erzeugt die Größen selbst, §9.4).

**AK-A-1-01** `pnpm check` scheitert, wenn eine `@payloadcms/*`-Version von `payload` abweicht oder eine Laufzeit-Abhängigkeit
mit `^`/`~` eingetragen ist.
**AK-A-1-02** Sobald 16.3.7 veröffentlicht ist (angekündigt für 30.09.2026), enthält `package.json` für `next` und
`eslint-config-next` denselben neuesten 16.3.x-Patch ≥ 16.3.7 (Aufgabe P1.1b bzw. der erste PR nach dem Erscheinen). Fehlt
der Patch nach dem Stichtag, gibt `pnpm check:versions` eine Warnung aus und endet trotzdem mit Exit-Code 0 (Unit-Test).

---

## 2. Repository-Aufbau

### 2.1 Baum (Soll; fett = existiert seit P0)

```
/                                   Next.js-App im Repo-Wurzelverzeichnis (kein Monorepo)
├─ src/
│  ├─ app/
│  │  ├─ (frontend)/                öffentliche Website (P0-Platzhalter **page.tsx, styles.css** entfallen in P2; `<html>`
│  │  │                             rendert erst [locale]/layout.tsx, **layout.tsx** hier höchstens als Durchreiche)
│  │  │  ├─ [locale]/               de | en; Ordnernamen = EN-Pfade der KONZEPT-Routentabelle §2.2 (§2.3); **keine**
│  │  │  │                          Routengruppen (kein `(calm)`) – Ruhe-Seiten über Preset/Layout-Props (DESIGN §9.7)
│  │  │  │  ├─ layout.tsx           <html lang>, Kopf, Fuß, Banner, LeashLayer, Inline-Skript `pc-motion` (§8.1)
│  │  │  │  ├─ page.tsx             R01 Startseite
│  │  │  │  ├─ shop/page.tsx        R02 · shop/category/[slug]/page.tsx R03 · shop/[product]/page.tsx R04
│  │  │  │  │                       (+ actions.ts, opengraph-image.tsx) · og-image.png/route.tsx Standard-OG-Bild (P3.14)
│  │  │  │  ├─ archive/ cart/ checkout/ thank-you/[token]/ order/[token]/ commissions/
│  │  │  │  ├─ tattoo/ (flash, offers, prices, gallery, process, aftercare, faq)
│  │  │  │  ├─ about/ contact/ legal-notice/ privacy/ terms/ right-of-withdrawal/
│  │  │  │  ├─ shipping-and-payment/ withdraw-from-contract/ declarations-of-conformity/
│  │  │  │  ├─ qa/                  nur mit ART_QA=1 (KUNST-QA §3.2), sonst notFound()
│  │  │  │  ├─ not-found.tsx        R28   · error.tsx R29
│  │  │  └─ styles.css → wandert nach src/styles/ (P2)
│  │  ├─ (payload)/                 **Payload-Admin + REST** (generiert, nur gezielt ändern)
│  │  │  ├─ admin/[[...segments]]/  interner Mount-Punkt der Verwaltung (§8.4 Admin-Pfad)
│  │  │  ├─ admin/manifest.webmanifest/route.ts, admin/sw.js/route.ts   PWA (KONZEPT §7.1)
│  │  │  └─ api/[...slug]/route.ts  Payload-REST; GraphQL-Routen werden in P1 entfernt
│  │  ├─ (api)/                     eigene Route-Handler (öffentlich/System), §2.4 – auch `/api/health` liegt hier
│  │  │  ├─ api/health/route.ts · api/health/freshness/route.ts · api/stripe/webhook/route.ts
│  │  │  ├─ api/cron/tick/route.ts · api/cron/run/[task]/route.ts · api/cron/backup/route.ts
│  │  │  ├─ api/public/product-status/route.ts · api/uploads/commission/route.ts · api/client-errors/route.ts
│  │  │  ├─ api/checkout/[token]/state/route.ts · api/privacy-export/[token]/route.ts
│  │  │  ├─ api/orders/[token]/documents/[file]/route.ts · api/legal/[...slug]/route.ts
│  │  │  └─ nr/[nummer]/route.ts    R31 Kurzlink
│  │  ├─ sitemap.ts · robots.ts · global-error.tsx · icon.svg, favicon.ico, apple-icon.png (DESIGN §12.6)
│  ├─ proxy.ts                      Next-16-„Proxy“ (früher middleware.ts), §8.4, §9.5
│  ├─ instrumentation.ts            Sentry (Server), Env-Prüfung beim Start
│  ├─ payload.config.ts             **Payload-Konfiguration**
│  ├─ payload-types.ts              **generiert** (`pnpm generate:types`, committet)
│  ├─ collections/                  **29 Collections** (DATENMODELL §2), PascalCase-Dateien
│  ├─ globals/                      Settings.ts, SiteTexts.ts
│  ├─ blocks/                       Payload-Blöcke für `pages` (DATENMODELL, `src/blocks/<Name>.ts`)
│  ├─ fields/ · access/             Feldbausteine (u. a. seedField()), Zugriffsfunktionen (DATENMODELL §1.4, §5)
│  ├─ endpoints/                    Payload-Custom-Endpoints nur für angemeldete Admin-Aktionen (orders/, products/,
│  │                                admin/ = Exporte, Verpackungsbericht, Unterlagen-Vorlage, Beispieldaten; postRestore.ts; §2.5)
│  ├─ jobs/                         Payload-Tasks, ein Task je Datei, Liste index.ts (§9.6, Anhang A.3)
│  ├─ migrations/                   Payload-Migrationen (.ts + .json), nie editieren
│  ├─ admin/                        Verwaltung: views/ (Handy-Ansichten, registry.ts), components/ (alle eigenen
│  │                                Admin-Komponenten, z. B. TranslateButton, PhotoPicker/, TrackingScanner), pwa/ (Icons,
│  │                                nur unter ADMIN_ROUTE ausgeliefert, nie unter public/)
│  ├─ i18n/                         routing.ts (next-intl aus der Registry, §2.3), navigation.ts, request.ts,
│  │                                messages/de.json, messages/en.json
│  ├─ lib/
│  │  ├─ commerce/                  Warenkorb (cart.ts), Kasse (checkout.ts), Reservierung, fulfillCheckout, Versandkosten
│  │  │                             (shipping.ts), Summen, Fristen (deadlines.ts: Reservierung und Vorkasse – einzige
│  │  │                             Stelle), Statusautomaten (productTransitions.ts, orderTransitions.ts,
│  │  │                             checkoutTransitions.ts, withdrawalTransitions.ts), Belegnummern (invoiceNumber.ts),
│  │  │                             EPC-QR (epc.ts, qr.ts), Bestellanlage (createOrderFromCheckout.ts – einzige Stelle,
│  │  │                             statische Prüfung `order-create`), Status-Link (statusToken.ts: ausgeben, rotieren)
│  │  ├─ payments/                  Adapter: types.ts, index.ts, processPaymentEvent.ts, stripe/, mock/ (§3.5)
│  │  ├─ carrier/                   Versanddienst-Adapter (`CARRIER_DRIVER`): types.ts, index.ts, manual.ts (§3.7)
│  │  ├─ email/                     Transport-Fabrik, Treiber, Vorlagen (M01–M16, A01–A17), registry.ts, Outbox (§3.4)
│  │  ├─ storage/                   Speicher-Konfiguration (Payload-Plugin), signierte URLs, systemFiles.ts (§3.3)
│  │  ├─ translation/               Adapter: types.ts, index.ts, deepl.ts, mock.ts, translateDocument.ts (§3.6)
│  │  ├─ pdf/                       @react-pdf-Dokumente (Rechnung, Packzettel, Etikett, Rechtstext), Schriften
│  │  ├─ invoices/                  Belege anlegen, Gutschriften, schema.ts (DATENMODELL)
│  │  ├─ legal/                     Rechtstext-Versionen, Token-Ersetzung, snippets.ts, services.generated.ts, Widerruf
│  │  ├─ products/                  Stück-Regeln: itemNumber.ts (Nummer, Slug, formatItemNumber – einzige Stelle),
│  │  │                             validate.ts, characteristics.ts, fibers.ts
│  │  ├─ tax/                       Steuermodus und -berechnung (getTaxModeAt, computeTax) – einzige Stelle
│  │  ├─ seed/                      Grund-Seed, Beispielbestand, Entfernen, guard.ts, tokens.ts, fallbackArt.ts
│  │  │                             (DATENMODELL §13, SEED-SPEC §1); CLI in scripts/seed/
│  │  ├─ retention/                 policy.ts (alle Löschfristen, einzige Stelle, LOESCHKONZEPT), log.ts, Löschlogik der
│  │  │                             retention*-Tasks
│  │  ├─ db/                        guard.ts (isProductionDatabase, §4.8), sequences.ts
│  │  ├─ export/                    Monats-CSV, DATEV, Rechnungs-ZIP, DSGVO-Auskunft
│  │  ├─ jobs/                      Job-Wecker (alarm.ts), Tick-Logik, Lauf-Protokoll (§9.6)
│  │  ├─ backup/                    dump.ts, mirror.ts, restore.ts, Status-Datei (§10)
│  │  ├─ security/                  csp.ts, headers.ts, inlineScripts.ts (Hash `pc-motion`), keys.ts (HKDF, ipHash),
│  │  │                             rateLimit.ts, tokens.ts, redact.ts
│  │  ├─ cache/                     tags.ts, revalidate.ts, cached.ts (§9.3)
│  │  ├─ data/                      öffentliche, gecachte Lesefunktionen je Bereich
│  │  ├─ routes/                    registry.ts – Routen-Registry R01–R31, Kurz-URLs (§2.3)
│  │  ├─ seo/ · shop/ · tattoo/ · commission/ · inquiries/ · revenue/ · media/ · admin/   Fachlogik je Bereich (z. B.
│  │  │                             seo/metadata.ts, shop/format.ts, commission/submit.ts, inquiries/transitions.ts
│  │  │                             (INQUIRY_TRANSITIONS), revenue/guard.ts, media/enhance.ts, admin/today.ts)
│  │  ├─ monitoring/                logger.ts (einziger Logger, §8.11), sentry.ts, clientErrors.ts
│  │  ├─ analytics/                 AnalyticsSlot.tsx (§3.8)
│  │  ├─ payload/                   public.ts (getPublicPayload), context.ts
│  │  ├─ env.ts                     zod-Schema aller Umgebungsvariablen (Quelle für §5 und .env.example)
│  │  ├─ audit.ts                   writeAudit(), getStatusHistory() (DATENMODELL audit-log)
│  │  ├─ time.ts · money.ts (formatMoney) · enums.ts · enumLabels.ts · ids.ts
│  ├─ components/                   React-Komponenten (BehaviorHost.tsx, layout/, shop/, checkout/, commission/, tattoo/,
│  │                                ui/, icons/ = Inline-SVG-Icons aus src/art/icons/ (DESIGN §6.5), leash/ = React-Hüllen
│  │                                LeashLayer/Station um die Engine), co-lokale *.module.css
│  ├─ behaviors/                    framework-freie Module mount(root)→unmount() (KONZEPT §12.9, DESIGN §9.12);
│  │                                Dateiname kebab-case = `data-behavior` (z. B. cart-count.ts), Register index.ts, types.ts
│  ├─ leash/                        Tuschelinie-Engine (DESIGN §9.1), u. a. motion.ts, poses.ts (COCO_POSE_TO_SPRITE)
│  ├─ art/                          Zeichnungen als Code-Assets (DESIGN §6.5, §10.4, §12.3–§12.6): icons/, coco/
│  │                                (coco-sprite.svg, coco-sprite.json), stations/, placeholders/, space/, brand/
│  ├─ preview-runtime/              Laufzeit der Vorschau-Datei (Hash-Router, Dialoge), §14
│  ├─ og/                           OG-Bild-Vorlagen, fonts/ (TTF, nie an Browser)
│  └─ styles/                       tokens.css, global.css, fonts.ts (next/font/local), coco.css, fonts/ (woff2, eingecheckt)
├─ public/                          **statische Dateien** – nie Uploads, nie Referenzfotos: art/ (ausgelieferte SVG, z. B.
│                                   coco-sprite.v{N}.svg, wordmark.svg), og/default.png
├─ content/
│  ├─ seed/                         **SEED-SPEC.md**, data/ (Seed-JSON, SEED-SPEC §2.1), **instagram/** (22 Bilder +
│  │                                manifest.json), **instagram-export/** (Juttas Datenexport, Monatsordner direkt hier,
│  │                                Zuordnung über Dateiname und `uri`), instagram-export-map.json (P8), **coco/**
│  │                                (Coco-Fotos, nur Zeichenvorlage, nie veröffentlicht)
│  └─ art/                          Zeichnungsquellen (KUNST-QA): sources.json, coco-refs.json, coco/ (Charakterblatt),
│                                   placeholders/ (Motiv-Skizzen *.ts für `art:placeholders`)
├─ scripts/                         tsx-Skripte (§6.10): seed/ (cli.ts, import-instagram.ts), preview-export/, art/ (lib/,
│                                   build-sprite.ts, vectorize.ts, placeholders.ts, coco-refs.ts, build-brand.ts, …),
│                                   fonts/, handbook/, legal/, fixtures/, lib/, ci/ (minutes.ts, artifact-budget.ts),
│                                   check-*.ts, db-*.ts, admin-*.ts,
│                                   jobs-run.ts, gen-env-example.ts; **cloud-setup.sh** (einzige Bash-Datei, §2.2)
├─ tests/
│  ├─ unit/                         *.unit.spec.ts (ohne DB, ohne Netz); **smoke.unit.spec.ts**
│  ├─ int/                          *.int.spec.ts (Payload Local API gegen Postgres); setup/global.ts, helpers/
│  ├─ e2e/                          *.e2e.spec.ts (Playwright gegen laufende App); fixtures.ts (Stücke 980–999)
│  ├─ visual/                       *.visual.spec.ts + __screenshots__/ (nur Linux-Referenzen)
│  ├─ art/                          *.art.spec.ts (KUNST-QA, eigene Config)
│  ├─ perf/                         lighthouserc.cjs, budgets.json
│  ├─ setup/                        network-guard.ts (Netzwerk-Wächter, eingebunden über vitest.setup.ts, §7.2)
│  ├─ fixtures/                     images/ (EXIF/GPS), stripe/ (Events), mails/, csv/, instagram-export/, barcodes/
│  ├─ helpers/                      **login.ts, seedUser.ts** (werden in P1 an ADMIN_ROUTE angepasst), outbox.ts,
│  │                                server-only-stub.ts
│  └─ manual-checks.json            manuelle Prüfpunkte mit Begründung und Phase (P10)
├─ docs/                            Fachdokumente, adr/, owner/ (img/handbuch/), recht/, design/ (qa-log/), research/,
│                                   RUNBOOK.md und GO-LIVE.md (P10)
├─ .github/                         workflows/ (**ci.yml**, weitere laut §6.2), dependabot.yml, pull_request_template.md,
│                                   vorschau-release.json
├─ .claude/                         **settings.json** (SessionStart-Hook → scripts/cloud-setup.sh), **skills/**
├─ **Dockerfile · docker-compose.yml** · docker-compose.prod.yml (P10) · deploy/Caddyfile (P10) · vercel.json (P10)
├─ **.env.example** · **.nvmrc** · **.npmrc** · **.gitattributes** · **.prettierrc.json** · **next.config.ts** · **tsconfig.json** · **eslint.config.mjs**
├─ **playwright.config.ts** · playwright.preview.config.ts (P2, §14) · playwright.art.config.ts (P9) · **vitest.config.mts** (int) · **vitest.unit.config.mts** · **vitest.setup.ts** · **test.env**
├─ PLAN.md · **CLAUDE.md** · **README.md**
├─ .data/                           (gitignored) media/, documents/, private/, mail-outbox/, job-alarm.json, backup-status.json,
│                                   preview-export/, instagram-export/ (entpackte ZIPs, P8), art-refs/ (Coco-Vorlagen, P8)
├─ dist/                            (gitignored) planet-claire-vorschau.html + .report.json
├─ .next-preview/                   (gitignored) Build-Ordner des Vorschau-Exports (§14.3)
└─ artifacts/                       (gitignored ab P8) art-qa/, placeholders-sheet.webp
```

Wo ein Plan- oder Fachdokument für dieselbe Sache einen anderen Pfad nennt, gilt dieser Baum (Abgleich in Anhang A.4).

### 2.2 Ablage- und Importregeln

| Regel | Durchsetzung |
|---|---|
| Serverseitige Module (`src/lib/{commerce,payments,carrier,email,storage,translation,pdf,invoices,legal,seed,retention,db,export,jobs,backup,security}`, `src/lib/env.ts`, `src/lib/audit.ts`) beginnen mit `import 'server-only'`; reine Hilfsmodule ohne Server-Zugriff (`time.ts`, `money.ts`, `enums.ts`, `routes/registry.ts`, `products/itemNumber.ts`, `tax/`) bleiben importierbar für Client und Verhaltensmodule | ESLint-Regel `no-restricted-imports` für Client-Dateien + Build-Fehler von `server-only` |
| `src/behaviors/*`, `src/leash/*`, `src/preview-runtime/*` importieren **weder** `react` **noch** `next/*` noch `payload` | ESLint `no-restricted-imports` für diese Ordner |
| `src/collections/*` nehmen Enum-Werte nur aus `src/lib/enums.ts` | DATENMODELL DM-P1-05 |
| `@stripe/stripe-js` nur als `@stripe/stripe-js/pure` und nur in `src/components/checkout/`; das Node-Paket `stripe` nur unter `src/lib/payments/stripe/` | Unit-Test mit statischem Scan (R-062), Teilprüfung `stripe-import` in `check:static` |
| Öffentliche Seiten lesen Daten nur über `src/lib/data/*` (→ `getPublicPayload()`) | ESLint verbietet `getPayload` in `src/app/(frontend)/**` |
| Keine Datei unter `public/` wird zur Laufzeit geschrieben | Uploads liegen in `.data/` bzw. R2 |
| Skripte sind TypeScript über `tsx` (Import-Hooks dafür dürfen `.mjs` sein, z. B. `scripts/lib/register-server-only.mjs`); Workflows dürfen Bash nutzen; einzige Bash-Datei im Repo: `scripts/cloud-setup.sh` (Einrichtung der Linux-Cloud-VM, `docs/CLOUD-SETUP.md`) | Review-Regel, CLAUDE.md |
| Zeilenenden LF (`.gitattributes`: `* text=auto eol=lf`, Binärdateien `binary`) | `.gitattributes` existiert seit P0 |

### 2.3 Routen-Registry

Die **Routen-Registry** `src/lib/routes/registry.ts` ist im Code die **einzige Quelle** aller öffentlichen Routen R01–R31.
Je Eintrag: `id`, DE- und EN-Muster (entsprechen **exakt** der KONZEPT-Routentabelle §2.2, dort kanonisch), Seitentyp,
Preset, Rendering, `robots`, Header-Kontext (§8.1), `status` (`live`/`planned`) und Phase; dazu die Listen `shortLinks`
(Kurz-URLs) und `aliases` (feste EN-Varianten). Die Datei ist reine Daten ohne Framework-Importe und ohne Pfad-Aliasse,
damit `next.config.ts`, der Proxy, Tests und der Vorschau-Export sie importieren können. Interne Schlüssel = EN-Pfad =
Ordnername unter `[locale]/` (z. B. `/cart` → `{ de: '/warenkorb', en: '/cart' }`, `/shop/category/[slug]` →
`{ de: '/shop/kategorie/[slug]', en: '/shop/category/[slug]' }`, `/withdraw-from-contract` →
`{ de: '/vertrag-widerrufen', en: '/withdraw-from-contract' }`, `/shop/[product]` → gleich in beiden Sprachen).
`src/i18n/routing.ts` erzeugt daraus `defineRouting({ locales: ['de','en'], defaultLocale: 'de', localePrefix: 'always',
localeCookie: false, localeDetection: true, pathnames })`. Die Registry wird genutzt für: Proxy-Übersetzung,
Sprachumschalter, Sitemap, Routen-Paritätstest (KONZEPT AK-2-01), Crawler der Vorschau-Datei (§14), No-Third-Party- und
No-Cookie-Tests (§7). Seiten, die in einer Phase noch nicht gebaut sind, stehen trotzdem in der Registry mit
`status: 'planned'` (Tests überspringen sie, der Export markiert sie „noch nicht gebaut“).

**Weiterleitungen** (fachlich KONZEPT §2.4 und RECHT ANFORDERUNGEN §2; ohne DB, soweit nicht anders genannt; Reihenfolge =
Vorrang):
1. **Kurz-URLs ohne Sprachpräfix** aus `shortLinks` – genau die sieben aus RECHT R-010: `/impressum`, `/datenschutz`,
   `/agb`, `/widerrufsbelehrung`, `/versand`, `/vertrag-widerrufen`, `/widerruf` → **308** auf die kanonische DE-Route
   aus KONZEPT §2.2 (z. B. `/widerruf` → `/de/vertrag-widerrufen`, `/versand` → `/de/versand-und-zahlung`); festes Ziel
   ohne Spracherkennung, kein Cookie. Umgesetzt statisch als `redirects()` in `next.config.ts` (`permanent: true`, läuft
   vor dem Proxy). Rechtstexte und Mails nennen immer die kanonische URL (Widerrufsbelehrung:
   `https://planetclairetattoos.com/de/vertrag-widerrufen`), nie die Kurz-URL.
2. **Pfad der anderen Sprache** unter einem Sprachpräfix (z. B. `/en/vertrag-widerrufen`, `/en/impressum`) → **308** auf
   den Pfad dieser Sprache (`/en/withdraw-from-contract`, `/en/legal-notice`), im Proxy aus der Registry. Dazu feste
   Aliasse aus `aliases` für gebräuchliche EN-Varianten (z. B. `/en/imprint` → `/en/legal-notice`). Slugs aus der Datenbank (Kategorie
   `/en/shop/category/keramik` → `/en/shop/category/ceramics`, nicht kanonische Produkt-URL, KONZEPT §2.3) korrigiert nicht
   der Proxy, sondern die Seite selbst per `permanentRedirect()` (308).
3. Übrige Pfade ohne Sprachpräfix und `/` → **307** in die erkannte Sprache (KONZEPT §2.4, kein Cookie). `/nr/[nummer]`
   (R31) → 307 über den eigenen Route-Handler (§2.5), weil die Nummer in der DB nachgeschlagen wird.

### 2.4 Wohin gehört ein Endpunkt?

| Art | Umsetzung | Beispiele |
|---|---|---|
| Nur für die angemeldete Verwaltung | **Payload Custom Endpoint** (`src/endpoints/`, Auth durch Payload, `req.user` Pflicht) | Stück übernehmen, Beispieldaten entfernen, Offline verkauft, Zahlung erhalten, Export |
| Öffentlich oder System (Webhook, Cron, Token) | **Next Route Handler** in `src/app/(api)/…` mit zod-Validierung, Rate-Limit, `getPayload()` + `overrideAccess` nur im Service | Tabelle §2.5 |
| Formular-Aktionen öffentlicher Seiten | **Server Actions** (progressiv, funktionieren ohne JS) | In den Korb, Zur Kasse, Kasse absenden, Widerruf, Auftragsanfrage |

Statische Pfade in `(api)` haben Vorrang vor Payloads `api/[...slug]`; ein Integrationstest prüft, dass `/api/health`
den eigenen Handler trifft.

### 2.5 Technische Endpunkte (verbindliche Namen)

| Methode + Pfad | Zweck | Zugriff | Cache |
|---|---|---|---|
| `GET /api/health` | Lebenszeichen, **ohne** DB-Zugriff: `{status:'ok', version, appEnv}` | öffentlich | `no-store` |
| `GET /api/health?deep=1` | zusätzlich DB-Ping und Speicher-Ping | `Authorization: Bearer <CRON_SECRET>` | `no-store` |
| `GET /api/health/freshness` | Aktualität von Job-Läufen und Backup **ohne** DB (liest Systemdateien, 60 s im Prozess gecacht); 200 = frisch, 503 = überfällig (§11.3) | öffentlich (Antwort ohne Details außer `jobs`/`backup` = `ok\|late\|off`) | `no-store` |
| `POST /api/stripe/webhook` | Stripe-Events (KONZEPT §4.10); Rohkörper, Signaturprüfung | Signatur | – |
| `GET /api/cron/tick` | Vercel Cron jede Minute: Job-Wecker prüfen, ggf. Jobs ausführen (§9.6) | Bearer `CRON_SECRET` | – |
| `POST /api/cron/run/[task]` | einen Task sofort ausführen (Tests, Admin „Jetzt ausführen“) | Bearer `CRON_SECRET` oder Admin-Sitzung | – |
| `GET /api/cron/backup` | nächtliches Datenbank-Backup (§10), nur bei `APP_ENV=production` **und** `BACKUP_ENABLED=true` (bis P11 `false` → 404) | Bearer `CRON_SECRET` | – |
| `GET /api/payload-jobs/run` | Payload-Standard-Endpunkt (bleibt als Rückfall; `jobs.access.run` = Admin oder Bearer `CRON_SECRET`) | wie links | – |
| `GET /api/public/product-status?ids=1,2` | Live-Zustand von Stücken (Kauf-Knopf, Warenkorb), max. 24 IDs; Antwort `{ "12": "reserved", …, "reservedByYou": { "12": true } }` – `reservedByYou` per serverseitigem Abgleich mit der Kasse aus `pc_checkout` (ohne Cookie immer `false`; Abruf mit `credentials: 'same-origin'`, setzt nie ein Cookie; P4.7) | öffentlich, Rate-Limit | `no-store` |
| `POST /api/uploads/commission` | einzelnes Referenzbild (≤ 4 MB, multipart-Feld `file`) mit Formular-Token im Kopf `x-form-token` (vor dem Lesen des Körpers geprüft; KONZEPT §10.2); Antwort `{ uploadId, ticket }` | Formular-Token, Rate-Limit | `no-store` |
| `GET /api/checkout/[token]/state` | Zustand der Kasse bzw. der daraus entstandenen Bestellung für die wartende Danke-Seite (KONZEPT §4.12: Abfrage alle 2 s bis 60 s); Antwort nur Zustandscodes, keine Personendaten | Kassen-Token, Rate-Limit `token_pages` | `no-store` |
| `GET /api/privacy-export/[token]` | Download des DSGVO-Exports (ZIP aus `privacy-requests.exportFile`, R-150) über den Link aus Mail M14; signierter Token (§8.6) ohne Personendaten, 7 Tage gültig, danach bzw. nach Löschung der Datei (L-17) **410**; liefert die Datei aus dem privaten Speicher (`s3`: Weiterleitung auf eine signierte URL ≤ 300 s, R-136), `Content-Disposition: attachment`, `Referrer-Policy: no-referrer` | signierter Token, Rate-Limit `token_pages` | `private, no-store` |
| `GET /api/orders/[token]/documents/[file]` | Rechtstext-PDFs der Bestellung (AGB, Widerrufsbelehrung, Muster-Widerrufsformular in der Fassung der Bestellung); **keine** Rechnungen und Gutschriften – die gibt es nur als Mail-Anhang und in der Verwaltung (R-067, §8.3) | Status-Token | `private, no-store` |
| `GET /api/legal/[type].pdf?locale=de`, `/api/legal/[type]/[versionId].pdf` | aktuelle bzw. historische Rechtstext-PDFs | öffentlich | `public, max-age=3600` |
| `POST /api/client-errors` | minimale Fehlermeldungen aus dem Browser → Sentry serverseitig. **Standardmäßig aus** bis Kanzleifrage K-30 (c) beantwortet ist: nur aktiv bei `NEXT_PUBLIC_CLIENT_ERRORS_ENABLED=true` **und** `APP_ENV=production`, sonst 404 ohne Verarbeitung und kein Client-Skript. Wenn aktiv: nur first-party, gesampelt, geschwärzt, keine Cookies, keine IP-Speicherung, keine Personendaten (R-133, R-137) | öffentlich, Rate-Limit | – |
| `GET /nr/[nummer]` | Kurzlink R31 → 307 auf kanonische Produktseite | öffentlich | `no-store` |
| `GET /<Kurz-URL>` (z. B. `/widerruf`) | 308 auf die kanonische DE-Route (§2.3 Nr. 1), statisch per `redirects()` in `next.config.ts`, ohne DB | öffentlich | – |
| `GET /sitemap.xml`, `GET /robots.txt` | KONZEPT §2.5 | öffentlich | ISR, Tag `sitemap` |

**Admin-Endpunkte** (Payload Custom Endpoints unter `src/endpoints/`, §2.4; nur mit Admin-Sitzung, sonst 401;
`Cache-Control: no-store`; fachlicher Inhalt laut der genannten Quelle):

| Methode + Pfad | Zweck | Quelle |
|---|---|---|
| `/api/products/…` (u. a. `GET /api/products/next-item-number`, `GET /api/products/item-number-status?n=`, `POST /api/products/:id/publish`) | Nummernvorschlag, Live-Prüfung der Objektnummer („✓ frei“ / „✗ vergeben: Nr. 017 …“), Statuswechsel und Aktionen je Stück | DATENMODELL §6.6.4, §6.6.10 |
| `GET /api/products/:id/label.pdf` | Etikett und Beileger je Stück (R-203) | KONZEPT §7.6 |
| `POST /api/orders/:id/{packed,packing,ship,delivered,tracking,pickup-ready,picked-up,resend-email,withdraw-carrier-consent}` | Bestell-Aktionen über den Aktions-Rahmen `src/endpoints/orders/_action.ts` (eine Transaktion, Prüfung gegen `ORDER_TRANSITIONS` → 409, Historie mit `actorType = admin`, Mails nur über die Outbox; ohne Sitzung 403 wie P4.20): „Gepackt“ (O6), Checkliste/Verpackung/Packfotos speichern, „Versendet melden“ (O7 mit M06, Rückfrage `packing_photo_missing`), „Zugestellt“ (O10 manuell), Sendungsnummer korrigieren (optional neue M06), „Bereit zur Abholung“ (O8 mit M07), „Abgeholt“ (O9), Mail erneut senden (`dialogKey`), DHL-Einwilligung widerrufen (`{ confirmationMail? }` → M16, P6.18) | KONZEPT §6.1, §7.6; DATENMODELL §6.8.5, §6.23 |
| `POST /api/orders/:id/{prepayment-received,cancel,late-payment}` | Vorkasse: „Zahlung erhalten“ (O3), „Stornieren“ (O4, Grund Pflicht), „Nachträglich bezahlt“ (O5, 409 wenn ein Stück nicht mehr frei ist) bzw. „Rücküberweisung erledigt“; genutzt von der Ansicht „Vorkasse offen“ (P5.18) | KONZEPT §4.8, §7.7 |
| `POST /api/orders/:id/{complaint,complaint-reply,complaint-dispute}` | Reklamationsakte (P6.11): anlegen (`kind`, `receivedAt`, `description`, `affectedItemIds` aus der Bestellung), „Reklamation beantworten“ (M12, `repairChoiceSentAt`), „Streitbeilegungshinweis senden“ (M13, `vsbgNoticeSentAt`); `{ complaintId }`, zustandsbasiert idempotent, Mails nur über die Outbox | KONZEPT §7.8; DATENMODELL §6.29; R-110–R-112 |
| `POST /api/withdrawals/:id/receipt-copy` | „Kopie an mich“: Eingangsbestätigung M08 erneut, ausschließlich an die Verwaltungs-Adresse (`settings.adminNotificationEmail` bzw. `ADMIN_NOTIFY_EMAIL`), eine Kopie je Klick (`Idempotency-Key`); die Kundin bekommt M08 nie ein zweites Mal | KONZEPT §6.1; P6.19 |
| `POST /api/{withdrawals,inquiries}/:id/notes` | Interne Notiz (`adminNotes`) separat speichern; alle anderen Angaben bleiben unberührt (Widerruf-Erklärung unveränderlich, DM-WDR-03) | KONZEPT §7.10, §7.11 |
| `POST /api/inquiries/:id/{status,delete-now}` | Anfrage-Status nach `INQUIRY_TRANSITIONS` (409 sonst; Audit `inquiry_status_changed`, `lastActivityAt`) bzw. „Jetzt löschen“ mit Referenz als Bestätigung (Anfrage + Bilder, Audit `inquiry_deleted`, `deletion-log` `ADMIN`/`admin`) | KONZEPT §5.5, §7.11 |
| `POST /api/privacy-requests/intake` · `POST /api/privacy-requests/:id/save` | Datenschutz-Anfrage erfassen (Art, Eingangstag, Kanal, Adresse, Sprache; Nummer und Frist vom Server) bzw. Status, Identität, Verlängerung, Abschluss und Notizen speichern (Regeln im Collection-Hook, 400 mit Meldung); Ansicht `/export/datenschutz` | KONZEPT §7.15; DATENMODELL §6.26; LOESCHKONZEPT §5 |
| `POST /api/privacy-requests/:id/{search,export,send-access}` | Personensuche (E-Mail normalisiert, Bestellnummer, Name; Treffer in `matchedOrders`/`matchedWithdrawals`/`matchedInquiries`), Auskunft-Export als ZIP (`daten.json`, `auskunft.html`, Kopien der Bilder/PDFs; `private-uploads` Zweck `data_export`, Audit `data_exported`) bzw. Antwort M14 mit signiertem Download-Link (nur mit Export und geprüfter Identität, nur an `contactEmail`; setzt `answeredAt`) | KONZEPT §7.15; LOESCHKONZEPT §5.4; R-150 |
| `POST /api/privacy-requests/:id/erasure` `{ decisions, notify? }` · `POST /api/privacy-requests/:id/rectify` `{ orderId, customerName?, customerEmail?, shippingAddress?, billingAddress? }` | Löschen/Einschränken/Behalten je Datensatz nach dem Plan aus dem LOESCHKONZEPT (Bestellungen nach Fristende anonymisiert, sonst `processingRestricted` mit Entfernen von Notizen/Packfotos und Widerruf der DHL-Einwilligung; Belege unverändert; `deletion-log` `trigger = privacy_request`, `ruleId = DSGVO`; Antwort M15) bzw. Berichtigung (ohne Rechnung direkt, sonst Gutschrift `correction` + neue Rechnung `replacesInvoice`, Vermerk im Verlauf); nur mit geprüfter Identität | KONZEPT §7.15; LOESCHKONZEPT §5.5–§5.7; R-151, R-152 |
| `POST /api/globals/settings/{section,tax-mode,password}` | Einstellungen Teil 1 je Bereich speichern (Whitelist, ganzes Global, Audit über die Hooks), neuer Steuermodus, eigenes Passwort ändern (≥ 12 Zeichen, bisheriges Passwort nötig) | KONZEPT §7.14; DATENMODELL §7.1 |
| `GET /api/orders/:id/packing-slip.pdf` | Packzettel ohne Preise mit Beileger je Stück (R-203) | KONZEPT §7.6 |
| `GET /api/admin/packaging-report?year=JJJJ` | Jahres-CSV der Verpackungsmengen nach Material (R-201, E-47) | DATENMODELL §6.8.8 |
| `GET /api/admin/compliance/template.pdf?category=` | Vorlage „Technische Unterlagen je Kategorie“ (R-203) | DATENMODELL §6.4 |
| `GET /api/admin/export/{JJJJ-MM}.csv` · `.zip` · `.datev.csv` | Monats-CSV, Rechnungs-ZIP, DATEV-Stapel (R-124); Exporte enthalten nie Beispieldaten, auch nicht im Vorschau-Modus | KONZEPT §7.15 |
| `GET /api/admin/seed/summary` · `POST /api/admin/seed/remove` | Beispieldaten zählen bzw. entfernen (`{ keepTexts, confirm: 'ENTFERNEN' }`; 400 ohne Bestätigungswort, 409 mit Platzhalter-Rechtstexten, P8.19) | DATENMODELL §13.5 |
| `POST /api/{products,flash,tattoo-gallery,media}/:id/adopt` | Beispiel übernehmen (`seed = false`, referenzierte Medien mit, Audit `product_adopted`; zweites Mal 409, P8.19) | DATENMODELL §13.4 |
| `POST /api/pages/texts` · `POST /api/faqs/texts-save` | Verwaltung „Texte“ → „Seiten und FAQ“: Titel, SEO und Textblöcke jeder Seite bzw. FAQ aller Kategorien DE/EN speichern (Übernahme `seed = false`, P8.19a) | KONZEPT §7.13 |

GraphQL ist abgeschaltet (`graphQL.disable: true`; Routen `graphql` und `graphql-playground` werden in P1 gelöscht).

**AK-A-2-01** `GET /api/health` antwortet 200 in < 100 ms (lokal) und öffnet keine DB-Verbindung (Test mit Pool-Zähler).
**AK-A-2-02** `GET /api/graphql` → 404.
**AK-A-2-03** Ein Unit-Test scannt `src/behaviors`, `src/leash`, `src/preview-runtime` und findet keine Importe von `react`, `next`, `payload`.
**AK-A-2-04** Jede Kurz-URL aus `shortLinks` antwortet mit 308 und `Location` = kanonische DE-Route aus KONZEPT §2.2, ohne
`Set-Cookie`; `GET /en/vertrag-widerrufen` → 308 auf `/en/withdraw-from-contract`; ein Unit-Test gleicht die Registry mit der
KONZEPT-Routentabelle ab (jede Zeile R01–R27 in DE und EN).
**AK-A-2-05** Ohne `NEXT_PUBLIC_CLIENT_ERRORS_ENABLED=true` antwortet `POST /api/client-errors` mit 404, und keine öffentliche
Seite lädt Code zum Senden von Browserfehlern.

---

## 3. Adapter-Muster und Ersatzdienste

### 3.1 Grundmuster (für alle Adapter gleich)

```ts
// src/lib/<bereich>/types.ts      – Schnittstelle + normalisierte Datentypen (keine Anbieter-Typen nach außen)
// src/lib/<bereich>/<treiber>.ts  – je Treiber eine Implementierung
// src/lib/<bereich>/index.ts
import 'server-only'
import { getEnv } from '@/lib/env'
let instance: XAdapter | undefined
export function getXAdapter(): XAdapter {          // einmal je Prozess, aus der Umgebung
  if (!instance) instance = createXAdapter(getEnv())
  return instance
}
export function __setXAdapterForTests(a?: XAdapter) { instance = a } // nur in Tests benutzen
```

Regeln:
1. **Auswahl nur über die `*_DRIVER`-Variable** (§5). Kein Code verzweigt anhand fehlender Schlüssel; fehlt ein Schlüssel
   für einen gewählten echten Treiber → Startfehler mit klarer Meldung (außer `APP_ENV=development`: Warnung + Mock).
2. **Mocks machen keine Netzwerk-Anfragen** (DIENSTE §4). Test: Netzwerk-Wächter `tests/setup/network-guard.ts`
   (eingebunden über `vitest.setup.ts`, §7.2) wirft bei jedem `fetch`/Socket auf andere Hosts als `127.0.0.1`,
   `localhost`, `::1`.
3. **Kontrakttests:** `tests/int/adapters/<bereich>.contract.int.spec.ts` führt dieselbe Testreihe gegen jeden Treiber
   aus. Echte Treiber laufen nur, wenn ihre Zugangsdaten gesetzt sind (sonst `skip` mit Hinweis) bzw. gegen lokale
   Nachbildungen (MinIO, Mailpit, stripe-mock).
4. **Normalisierung:** Adapter geben nur eigene Typen zurück (z. B. `PaymentEvent`, nicht `Stripe.Event`).
5. **Produktionsregeln** prüft `assertProductionEnv()` beim Start (§4.3).
6. **Datensparsamkeit:** Adapter senden nur die Felder, die DIENSTE.md je Dienst nennt; Kontrakttests prüfen die
   ausgehenden Nutzdaten (z. B. DeepL erhält keine personenbezogenen Daten; Stripe erhält als Kennung nur `checkoutRef`
   (= `checkouts.reservationRef`) in `client_reference_id` und `metadata`, dazu `appEnv` – nie einen Kassen- oder
   Status-Token; einzige Stelle mit Token ist die `return_url`).

### 3.2 Übersicht

| Bereich | Variable | Treiber | Standard bis P11 | Produktion | Mock-Verhalten |
|---|---|---|---|---|---|
| Speicher | `STORAGE_DRIVER` | `local` \| `s3` | `local` (`.data/…`) | `s3` (Cloudflare R2 EU) | Dateisystem, gleiche URLs über die App-Dateiroute |
| E-Mail | `EMAIL_DRIVER` | `file` \| `smtp` \| `memory` \| `log` | `file` (`.data/mail-outbox`); lokal optional `smtp` → Mailpit | `smtp` (Lettermint) | vollständig gerenderte `.eml` + `.json`; `memory` für Unit/Int; `log` versendet nichts |
| Zahlung | `PAYMENTS_DRIVER` | `mock` \| `stripe` | `mock`; optional `stripe` mit **Test**-Schlüssel | `stripe` (Live) | Sessions, Events, Erstattungen, Gebühren aus Fixtures; Zustand in der DB |
| Übersetzung | `TRANSLATION_DRIVER` | `mock` \| `deepl` | `mock` | `deepl` (API Free) | deterministisch `"[EN] " + Text` |
| Versand | `CARRIER_DRIVER` | `manual` | `manual` | `manual` (E-26) | – (einziger Treiber; DHL-API später) |
| Statistik | `NEXT_PUBLIC_ANALYTICS_ENABLED` | `false` \| `true` (→ Vercel Web Analytics) | `false` | `false` bis Freigabe Kanzleifrage K-30 (R-132) | kein Skript |
| Fehler | `SENTRY_DSN` | leer \| DSN | leer (aus) | Sentry EU, nur Server | Logger schreibt nach stdout |
| Zeit | – | `systemClock` \| `fixedClock(iso)` | – | – | Tests/Export mit fester Uhr (A-08) |
| Rate-Limit | – | `postgres` \| `memory` | `postgres` (Int/E2E), `memory` (Unit) | `postgres` | – |

### 3.3 Speicher (`STORAGE_DRIVER`)

- **Payload-Uploads** (`media`, `documents`, `private-uploads`, DATENMODELL §6.2–6.4):
  - `local`: `upload.staticDir` = `${STORAGE_LOCAL_DIR}/media`, `…/documents`, `…/private` (Standard `STORAGE_LOCAL_DIR=.data`,
    außerhalb von `public/`, `/.data` steht seit P0 in `.gitignore`). Auslieferung über Payloads Dateirouten
    (`/api/<collection>/file/<name>`) mit Zugriffsprüfung.
  - `s3`: `@payloadcms/storage-s3` **zweimal** instanziiert **[Spike P1, B-02]**: (1) `media` + `documents` → Bucket
    `S3_BUCKET` mit Präfixen `media/`, `documents/`; (2) `private-uploads` → Bucket `S3_PRIVATE_BUCKET`, Präfix `private/`,
    `signedDownloads` mit Gültigkeit **300 s** (R-136). Konfiguration: `endpoint: S3_ENDPOINT`, `region: S3_REGION` (`auto`),
    `forcePathStyle: S3_FORCE_PATH_STYLE` (**`true` für R2 und MinIO**), `clientUploads: false` (Server muss jedes Bild neu
    kodieren, R-135). Beide Buckets sind **nicht öffentlich**; Medien werden über die App-Dateiroute ausgeliefert, weil das DNS
    bei IONOS bleibt (keine R2-Custom-Domain, E-95).
  - Rechnungs- und Gutschrift-PDFs liegen im privaten Bucket unter `private/invoices/`; ist in R2 eine **Bucket-Lock-Regel**
    je Präfix verfügbar, wird sie in P11 für `private/invoices/` gesetzt (DIENSTE §3.4 „Sperre soweit verfügbar“). Dauer =
    `settings.retention.invoiceYears` (Standard 10 Jahre, umstellbar auf 8; Entscheidung Steuerberatung/Kanzlei) – eine
    Sperre lässt sich nicht verkürzen, deshalb erst nach dieser Entscheidung setzen. Versionierung bleibt aus (Löschungen
    müssen wirken).
  - Antwort-Header der Dateirouten über `upload.modifyResponseHeaders` (in Payload 3.90.2 vorhanden): uneingeschränkte Medien
    `Cache-Control: public, max-age=31536000, immutable` + `CDN-Cache-Control: public, max-age=31536000, immutable`;
    einwilligungsabhängige Medien (`media.showsPerson = customer`; ohne Einwilligung sind sie `media.restricted = true` und
    öffentlich gar nicht abrufbar, DATENMODELL §6.2) und Seed-Medien `Cache-Control: public, max-age=300` +
    `CDN-Cache-Control: max-age=300`, nie `immutable` (Widerruf wirkt ≤ 5 min; R-172 verlangt ≤ 24 h, L-20); private
    Dateien `private, no-store`.
- **Sonstige Dateien des Systems** (Job-Wecker §9.6): Modul `src/lib/storage/systemFiles.ts` mit `readJson(key)`,
  `writeJson(key, value)`; `local` → `.data/<key>`, `s3` → Bucket `S3_PRIVATE_BUCKET`, Präfix `system/`.
- **Lokaler S3-Test:** `docker compose --profile s3 up -d` startet MinIO (`minio/minio`, Port 9000/9001) und legt per
  `minio/mc` die Buckets `pct-media-dev` und `pct-private-dev` an (P1 ergänzt das Profil in `docker-compose.yml`).
  Kontrakttest DM-PRIV-01 läuft mit `STORAGE_DRIVER=s3` gegen MinIO, wenn erreichbar. Der Test (`tests/int/adapters/storage.contract.int.spec.ts`)
  baut dafür eine eigene Payload-Instanz in einem eigenen Postgres-Schema; Ziel über `S3_TEST_ENDPOINT` (Standard
  `http://127.0.0.1:9000`, Zugang `S3_TEST_ACCESS_KEY_ID`/`S3_TEST_SECRET_ACCESS_KEY`, Standard `minioadmin`), nur lokale Hosts.
  Umsetzung: `src/lib/storage/` (`uploadStorage(area)` für die Collection, `storagePlugins()`, `systemFiles.ts`,
  `signed.ts`); bei `local` liefert ein eigener Datei-Handler die Datei mit den dokumentabhängigen Cache-Headern aus.

### 3.4 E-Mail (`EMAIL_DRIVER`)

```ts
// src/lib/email/types.ts
export type EmailDriver = 'file' | 'smtp' | 'memory' | 'log'
export interface MailMessage {
  to: string; subject: string; html: string; text: string
  from?: string; replyTo?: string                 // Standard aus MAIL_FROM / MAIL_REPLY_TO
  attachments?: { filename: string; content: Buffer; contentType: string; cid?: string }[]
  headers?: Record<string, string>
  type: EmailTemplate                             // Schlüssel aus DATENMODELL EMAIL_TEMPLATES, z. B. 'order_confirmation' (M01), 'admin_order_placed' (A01)
  idempotencyKey: string                          // Mail-Typ + Objekt-ID + Ereignis (KONZEPT §6.1)
}
export interface SendResult { messageId: string; accepted: string[]; suppressed: boolean }
export interface EmailAdapter {
  readonly driver: EmailDriver
  send(message: MailMessage): Promise<SendResult>
  transport(): import('nodemailer').Transporter  // derselbe Transport für Payloads eigene Mails (Passwort-Reset)
}
```

- **Eine Transport-Fabrik** `createMailTransport(env)` für alle Treiber; Payload bekommt sie über
  `nodemailerAdapter({ transport, defaultFromAddress, defaultFromName })`.
- `file`: schreibt `<ISO-Zeit>__<type>__<idempotencyKey>.eml` und `.json` (Metadaten, Anhangsnamen) nach `EMAIL_FILE_DIR`.
  E2E-Tests lesen über `tests/helpers/outbox.ts` (`readOutbox({ to, type })`).
- `smtp`: nodemailer SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`); lokal Mailpit
  (`127.0.0.1:1025`, Oberfläche `http://localhost:8025`), Produktion Lettermint.
- `memory`: Array im Prozess (`getMemoryOutbox()`), nur Unit/Int-Tests.
- `log`: rendert, protokolliert Kopf-Daten (ohne Empfänger-Adresse im Klartext) und versendet nichts – für Vercel-Previews.
- **Unterdrückung in allen Umgebungen:** Empfänger mit Domain `example.com`, `example.org`, `example.net` oder Endung
  `.invalid`, `.test` werden nie versendet (`suppressed: true`, `email-log.status = suppressed`) – Schutz für Seed-Daten (R-180).
- **Umleitung außerhalb Produktion:** Ist `MAIL_REDIRECT_ALL_TO` gesetzt und `APP_ENV ≠ production`, gehen alle Mails an diese
  Adresse, Betreff mit Präfix `[<APP_ENV>]`, Original-Empfänger als Header `X-Original-To`. In Produktion wird die Variable
  ignoriert und ein Fehler geloggt.
- Versand läuft über das Outbox-Muster (DATENMODELL §1.5): `email-log`-Zeile + Job `sendEmail` in derselben Transaktion,
  nach dem Commit sofortiger Versuch; Wiederholungen über den Job-Wecker (§9.6).
- Umsetzung (P1.9): Unterdrückung und Umleitung wirken im Transport (`createMailTransport`, nodemailer-`compile`-Schritt
  plus vorgeschalteter Transport), damit auch Payloads eigene Mails (Passwort-Reset) sie einhalten; unterdrückte Mails
  bauen keine Verbindung auf. Kontrakttest `tests/int/adapters/email.contract.int.spec.ts` prüft alle Treiber, SMTP gegen
  einen lokalen Fake-Server (`smtp-server`, nur Test).

### 3.5 Zahlung (`PAYMENTS_DRIVER`)

```ts
// src/lib/payments/types.ts
export type PaymentsDriver = 'mock' | 'stripe'
export interface CreateCheckoutSessionInput {
  checkoutRef: string; locale: 'de' | 'en'                                 // = checkouts.reservationRef (UUID), kein Token
  sessionSeq: number                                                       // = checkouts.stripe.sessionSeq (≥ 1), Idempotenz (P4.5)
  lineItems: { productId: number; name: string; amountCents: number }[]   // Menge immer 1 (E-10)
  shipping: { label: string; amountCents: number }                         // genau eine Option (KONZEPT §4.7)
  expiresAt: Date                                                          // ≥ 30 min nach Erstellung (Stripe)
  returnUrl: string; customerEmail?: string                                // returnUrl = Danke-Seite mit Kassen-Token (checkoutReturnUrl)
  metadata: { checkoutRef: string; appEnv: string }                        // nie ein Token (§3.1 Nr. 6)
}
export interface CheckoutSessionHandle { sessionId: string; clientSecret: string; expiresAt: Date }
export type SessionState = {
  sessionId: string; status: 'open' | 'complete' | 'expired'
  paymentStatus: 'paid' | 'unpaid' | 'no_payment_required'
  clientSecret?: string                         // nur bei 'open'; nie gespeichert – bei jedem Laden der Kasse neu geholt
  paymentIntentId?: string; amountTotalCents?: number
  paymentMethod?: { type: 'card' | 'paypal'; wallet?: 'apple_pay' | 'google_pay' }
}
export type ExpireResult = 'expired' | 'already_expired' | 'already_complete_paid' | 'already_complete_unpaid'
export type PaymentEvent = {
  id: string; provider: PaymentsDriver; livemode: boolean; createdAt: Date
  type: 'checkout.completed' | 'checkout.async_succeeded' | 'checkout.async_failed' | 'checkout.expired'
      | 'charge.refunded' | 'refund.created' | 'refund.updated' | 'refund.failed'
      | 'dispute.created' | 'dispute.closed' | 'ignored'
  data: Record<string, unknown>                 // normalisiert, zod-validiert je Typ
}
export interface PaymentsAdapter {
  readonly driver: PaymentsDriver
  readonly mode: 'mock' | 'test' | 'live'
  createCheckoutSession(i: CreateCheckoutSessionInput): Promise<CheckoutSessionHandle>
  updateShipping(sessionId: string, s: { label: string; amountCents: number }): Promise<'updated' | 'recreate_required'>
  expireCheckoutSession(sessionId: string): Promise<ExpireResult>
  getCheckoutSession(sessionId: string): Promise<SessionState>
  refund(i: { paymentIntentId: string; amountCents: number; reason: string; idempotencyKey: string }):
    Promise<{ refundId: string; status: 'pending' | 'succeeded' | 'failed' }>
  parseWebhook(rawBody: string, headers: Headers): PaymentEvent          // wirft InvalidSignatureError
  listEventsSince(since: Date): Promise<PaymentEvent[]>                 // Abgleich fehlender Webhooks (§11)
  listBalanceTransactions(i: { from: Date; to: Date }): Promise<{ id: string; sourceId: string; feeCents: number;
    netCents: number; payoutId?: string; payoutDate?: Date }[]>         // Monatsexport (KONZEPT §7.15)
}
```

**Stripe-Treiber** (`src/lib/payments/stripe/`):
- `new Stripe(STRIPE_SECRET_KEY, { apiVersion: STRIPE_API_VERSION, maxNetworkRetries: 2, timeout: 10_000, appInfo: { name:
  'planetclaire' } })`. `STRIPE_API_VERSION` ist eine Konstante in `src/lib/payments/stripe/config.ts` = die im gepinnten
  SDK hinterlegte Version (P4 trägt sie ein); der Webhook-Endpunkt bei Stripe wird mit **derselben** Version angelegt. Grund:
  `ui_mode`-Namen wechseln je API-Version (`custom` → `elements`).
- Session: `ui_mode: 'elements'`, `mode: 'payment'`, `currency: 'eur'`, **`payment_method_types: ['card', 'paypal']`**
  (R-062; keine `payment_method_configuration`, damit Dashboard-Schalter nichts freischalten), `expires_at`,
  `client_reference_id = checkoutRef`, `metadata = { checkoutRef, appEnv }`, `locale`, `return_url`
  (`{NEXT_PUBLIC_SITE_URL}/de/danke/{token}` bzw. `/en/thank-you/{token}` – die einzige Stelle, an der der Kassen-Token
  Stripe erreicht), eine `shipping_options[0].shipping_rate_data` mit `fixed_amount`. Kein `success_url`, `cancel_url`,
  `submit_type`, `after_expiration` (bei `elements` unzulässig).
- Idempotenz-Schlüssel: `checkout:<checkoutRef>:<n>` (Anlage, `n` = `checkouts.stripe.sessionSeq`, übergeben als
  `CreateCheckoutSessionInput.sessionSeq`), `refund:<orderId>:<refundSeq>` (Erstattung).
- Umsetzung (P4.5): `src/lib/payments/stripe/{config,client,index}.ts`. Parameter nur aus `buildSessionParams`
  (`src/lib/payments/checkoutSession.ts`, dieselben Regeln wie beim Mock; `return_url` über `checkoutReturnUrl`, die
  Eingabeprüfung verlangt die Danke-Seite der Sprache mit genau einem Token). `telemetry: false`. Session ohne
  `client_secret` → Fehler. `expireCheckoutSession`: lehnt Stripe ab, entscheidet der abgefragte Zustand
  (`expired` → `already_expired`, `complete` + `unpaid` → `already_complete_unpaid`, sonst `already_complete_paid`).
  `getCheckoutSession` expandiert `payment_intent.latest_charge` (Zahlart, Wallet). `parseWebhook`:
  `stripe.webhooks.constructEvent` (Kopfzeile `stripe-signature`, Toleranz 300 s, injizierte Uhr); fehlt
  `STRIPE_WEBHOOK_SECRET` → `ConfigError`; abweichende `api_version` → Warnung im Protokoll. `listEventsSince`: nur die
  zehn behandelten Typen, älteste zuerst. `listBalanceTransactions`: Buchungen des Zeitraums ohne `payout`, Auszahlung
  über automatische Payouts (`balance_transactions?payout=…`), Datum = `arrival_date`. `STRIPE_API_BASE_URL` ist in
  Produktion und mit Live-Schlüssel verboten.
- **Client-Secret:** wird nie in der Datenbank gespeichert (kein Feld in `checkouts`); die Kasse holt es bei jedem
  Seitenaufruf serverseitig über `getCheckoutSession` (`SessionState.clientSecret`). Fehlt es bei einer offenen Session,
  wird die Session mit derselben Reservierung neu angelegt (`stripe.sessionSeq + 1`, wie bei `recreate_required`).
- Versandänderung **[Spike B-07]**: `checkout.sessions.update` mit neuer `shipping_options`, falls die gepinnte API-Version das für
  `elements` erlaubt; sonst Rückgabe `recreate_required` → alte Session beenden, neue mit **derselben** Reservierung anlegen
  (KONZEPT §4.2 „die Reservierung bleibt“). Ergebnis (Anhang B): Soll `update`; lehnt Stripe mit
  `invalid_request_error` ab oder ist die Session nicht mehr offen → `recreate_required`. Schalter
  `UPDATE_SHIPPING_STRATEGY` in `stripe/config.ts` (`'recreate'` = Rückfall fest). Im Browser ruft die Kasse die
  Server-Aktion innerhalb von `checkout.runServerUpdate(…)` (Stripe.js 9.x) auf, damit das Zahlungsfeld den neuen Betrag lädt.
- Browser: `loadStripe` aus `@stripe/stripe-js/pure`, nur in `src/components/checkout/StripePaymentField.tsx`, dynamisch
  importiert; Kundendaten und Adresse werden über das Checkout-Objekt von Stripe.js gesetzt (Methodennamen laut Doku der
  gepinnten Stripe.js-Version, z. B. `updateEmail`, `updateShippingAddress`), dann `confirm({ returnUrl })`. In 9.17.0:
  `stripe.initCheckoutElementsSdk({ clientSecret, … })` für `ui_mode: 'elements'`; Aktionen `updateEmail`,
  `updateShippingAddress`, `runServerUpdate`, `confirm`.
- Schlüsselregeln (`assertProductionEnv`): `sk_live_…`/`rk_live_…` nur bei `APP_ENV=production`; in Produktion **nur**
  Live-Schlüssel. Außerhalb von Produktion nur `sk_test_…`/`rk_test_…` (inkl. Platzhalter `sk_test_proxy`, §4.5); der
  Treiber bricht ab, wenn die erste Stripe-Antwort `livemode: true` meldet. Nie Live-Schlüssel vor P11. Empfohlen: eingeschränkter Schlüssel `rk_…` mit Rechten Checkout Sessions (write), PaymentIntents (read),
  Refunds (write), Events (read), Balance Transactions (read), Payouts (read).
- Test gegen **stripe-mock** (optional): `STRIPE_API_BASE_URL=http://127.0.0.1:12111` stellt Host/Port des SDK um; Profil
  `payments` in `docker-compose.yml` (`stripe/stripe-mock:v0.205.0`, OpenAPI = gepinnte Version). Nur Form-/Parameter-Tests
  (stripe-mock ist zustandslos; seine Fixtures haben kein `client_secret`, der Kontrakttest ergänzt es). Der
  Kontrakttest `tests/int/adapters/payments.contract.int.spec.ts` läuft den Kern gegen stripe-mock, wenn erreichbar
  (sonst übersprungen mit Hinweis), und Kern + Lebenszyklus im Stripe-Testmodus nur mit `sk_test_…`/`rk_test_…` und
  `PC_TEST_ALLOW_STRIPE_API=1` (einzige Ausnahme im Netzwerk-Wächter, §7.2).

**Mock-Treiber** (`src/lib/payments/mock/`, KONZEPT §4.7):
- IDs: `cs_mock_<uuid>`, `pi_mock_<uuid>`, `re_mock_<uuid>`, `evt_mock_<uuid>`; `clientSecret = mock_secret_<uuid>`.
- **Zustand liegt in der Datenbank** (nicht im Prozess-Speicher), damit Danke-Seite, Jobs und mehrere Instanzen denselben
  Stand sehen: Die Session-Daten stehen an der Reservierung/Kasse (Felder laut DATENMODELL), erzeugte Ereignisse in
  `webhook-events` mit `provider = 'mock'`.
- Oberfläche: gleich großes Testfeld „Testmodus – keine echte Zahlung“ mit Auswahl **Erfolg** (Standard) · **Abgelehnt** ·
  **Abbruch (wie PayPal zurück)** · **Verzögert** (Kasse bleibt `confirming`, für Abgleich-Tests).
- „Erfolg“ erzeugt ein Ereignis aus `tests/fixtures/stripe/checkout.session.completed.json` (Werte ersetzt) und ruft
  **dieselbe** Verarbeitungsfunktion `processPaymentEvent()` auf wie der Webhook-Route-Handler nach der Signaturprüfung.
- Test-API (nur `APP_ENV ∈ {development, test}`): `mockPayments.emit(sessionId, type)`, `mockPayments.setNextOutcome(...)`,
  `mockPayments.completeUnpaidWithoutEvent(sessionId, method?)` (Ergebnis „Verzögert“: Session `complete`/`unpaid` ohne
  Ereignis, P4.10b).
  Umsetzung (P4.4): `emit` schreibt den Zustand fort, protokolliert das normalisierte Ereignis in `checkouts.mock.state`
  (für `listEventsSince`) und liefert `{ event, rawBody, headers }` (signiert) für `processPaymentEvent` bzw. die Webhook-Route;
  die Ablage in `webhook-events` macht die Verarbeitung. Fixtures prüft/erzeugt `pnpm stripe:fixture <name>|--all`.
- In Produktion verboten (Startfehler).

**Webhook-Route** `POST /api/stripe/webhook`: Rohkörper (`await req.text()`), `parseWebhook` (Signatur mit
`STRIPE_WEBHOOK_SECRET`), ungültig → 400; dann Idempotenz und Verarbeitung laut DATENMODELL §8.8; Fehler → 500 (Stripe
wiederholt). Laufzeit `nodejs`, `maxDuration = 60`. Payload-Körper werden nie geloggt (R-137).

### 3.6 Übersetzung (`TRANSLATION_DRIVER`)

```ts
export interface TranslationAdapter {
  readonly driver: 'mock' | 'deepl'
  translate(i: { texts: string[]; source: 'de'; target: 'en' }): Promise<string[]>   // Reihenfolge bleibt
  usage(): Promise<{ characterCount: number; characterLimit: number } | null>
}
```

- DeepL: Endpunkt `https://api-free.deepl.com/v2/translate`, wenn der Schlüssel auf `:fx` endet, sonst `api.deepl.com`;
  `target_lang: 'EN-GB'` (passend zu `og:locale en_GB`), `preserve_formatting: 1`, höchstens 50 Texte je Anfrage.
  Rich Text (Lexical): Textknoten einsammeln, gebündelt übersetzen, in dieselbe Struktur zurückschreiben (keine HTML-Umwege).
- Mock: gibt `"[EN] " + Text` zurück (deterministisch, im Test erkennbar). Der Übersetzen-Knopf setzt `enStatus = machine`.
- Produktion mit `mock`: Knopf deaktiviert mit Hinweis „Übersetzen ist noch nicht eingerichtet“; Startklar-Prüfung meldet es.
- Datensparsamkeit: nur Produkt-/Seitentexte, nie personenbezogene Daten (DIENSTE §3.9).

### 3.7 Versand (`CARRIER_DRIVER`)

```ts
// src/lib/carrier/types.ts (dazu index.ts mit getCarrierAdapter(), manual.ts) – ab P1 als Gerüst, genutzt ab P5
export type CarrierCode = 'dhl' | 'deutsche_post'
export interface CarrierAdapter {
  readonly driver: 'manual'
  trackingUrl(carrier: CarrierCode, trackingNumber: string, locale: 'de' | 'en'): string | null  // Vorlage aus settings
  validateTrackingNumber(carrier: CarrierCode, trackingNumber: string): boolean                 // Format-Plausibilität
  createLabel?(orderId: number): Promise<never>                                                  // nicht implementiert (E-26)
}
```

Tracking-Vorlagen kommen aus den Einstellungen (KONZEPT §7.14). Die Sendungsnummer ist Pflicht bei den Versandklassen
Paket klein und Keramik, bei Brief optional – ohne Nummer liefert `trackingUrl` nichts und die Versandmail enthält keinen
Verfolgungslink (KONZEPT §7.6). Ein späterer DHL-Treiber (`dhl_parcel_de`) bekommt eigene Variablen (`DHL_*`) erst mit
einer neuen Entscheidung.

### 3.8 Statistik

`src/lib/analytics/AnalyticsSlot.tsx` rendert `<Analytics />` aus `@vercel/analytics/next` nur, wenn
`NEXT_PUBLIC_ANALYTICS_ENABLED === 'true'` **und** `APP_ENV === 'production'` **und** die Admin-Einstellung
`analytics.enabled` (mit `confirmedAt`) gesetzt ist (R-132). `beforeSend` verwirft Kasse, Warenkorb, Danke-Seite,
Bestellstatus, Widerrufs-Schritte und die Admin-Pfade und entfernt alle Query-Parameter. Das Skript und die Messpunkte liegen
auf dem eigenen Origin (`/_vercel/insights/*`), damit bleibt A-04 erfüllt. Kein Speed Insights.

### 3.9 Zeitquelle und Rate-Limit

- `src/lib/time.ts`: `APP_TIME_ZONE = 'Europe/Berlin'`, `type Clock = { now(): Date }`, `systemClock`, `fixedClock(iso)`,
  Helfer `berlinDayStart(d)`, `berlinMonthRange(yyyyMm)`, `addBerlinDays(d, n)`, `formatBerlin(d, pattern, locale)`.
  Services und Jobs nehmen `now: Date` als Parameter (KONZEPT §8.1 Nr. 5).
- `src/lib/security/rateLimit.ts`: `hit(bucket, key, now): Promise<{ allowed, remaining, resetAt }>`; Postgres-Tabelle
  `rate_limit_hits (bucket text, key_hash text, window_start timestamptz, count int, PRIMARY KEY (bucket, key_hash,
  window_start))`, angelegt durch eine **eigene SQL-Migration** (keine Payload-Collection; DATENMODELL §9-Muster);
  Zählen per `INSERT … ON CONFLICT DO UPDATE SET count = count + 1 RETURNING count`. Löschung nach **24 h** (R-134, L-13a)
  durch den stündlichen Wartungs-Job. Schlüssel = `ipHash` (§8.6).

**AK-A-3-01** Mit leeren Zugangsdaten und Standardwerten aus `.env.example` laufen `pnpm build`, `pnpm test`, `pnpm test:e2e`
und `pnpm preview:export` grün; der Netzwerk-Wächter meldet keine Anfrage an fremde Hosts.
**AK-A-3-02** `APP_ENV=production` mit `PAYMENTS_DRIVER=mock`, `STORAGE_DRIVER=local`, `EMAIL_DRIVER≠smtp` oder
`STRIPE_SECRET_KEY=sk_test_…` bricht den Start mit einer Meldung ab, die alle Verstöße nennt.
**AK-A-3-03** Mock-Zahlung „Erfolg“ und ein signiertes Fixture-Event an `/api/stripe/webhook` erzeugen für dieselbe Kasse
genau eine Bestellung (gleiche Verarbeitungsfunktion, Idempotenz).
**AK-A-3-04** Eine Mail an `erika@example.com` wird mit `suppressed: true` protokolliert und nicht zugestellt (alle Treiber).

---

## 4. Umgebungen

### 4.1 Übersicht

| Umgebung | `APP_ENV` | Wo | Datenbank | Speicher | Mail | Zahlung | Übersetzung | `SEED_PREVIEW_MODE` | Jobs | Ab |
|---|---|---|---|---|---|---|---|---|---|---|
| Lokal | `development` | Windows/macOS/Linux, `pnpm dev` | Postgres 17 (Docker) oder nativ | `local` | `file` (optional `smtp`→Mailpit) | `mock` (optional Stripe-Test) | `mock` | `true` | `JOBS_AUTORUN=true` | P0 |
| Claude-Cloud-Sandbox | `development` / `test` | Ubuntu 24.04 VM (`docs/CLOUD-SETUP.md`) | Postgres 16 (Systemdienst) | `local` | `file` | `mock` (optional Stripe-Test-Schlüssel, bevorzugt als API-Credential, §4.5) | `mock` | `true` | autoRun bzw. `pnpm jobs:run` | P1 |
| CI | `test` | GitHub Actions `ubuntu-latest` | Service `postgres:17-alpine` | `local` | `file`/`memory` | `mock` | `mock` | `true` | Tests rufen Jobs direkt | P0 |
| Vorschau-Export | `preview` + `PREVIEW_EXPORT=true` | lokal/CI, Port 3999 | eigene DB `planetclaire_preview_export` | `local` | `memory` | `mock` | `mock` | `true` | keine | P2 |
| Preview-Deployment | `preview` | Vercel Preview je PR (geschützt) | Neon-Branch `preview` (nur Seed) | `s3` (`pct-media-preview`, `pct-private-preview`) | `log` | `mock` | `mock` | `true` | Cron aus | P11 |
| Staging | `staging` | Vercel, `staging.planetclairetattoos.com`, Branch `staging` (geschützt) | Neon-Branch `staging` (nur Seed) | `s3` (`pct-media-staging`, `pct-private-staging`) | `smtp` + `MAIL_REDIRECT_ALL_TO` | `stripe` **Test** + Webhook | `deepl` oder `mock` | `true` | manuell (`/api/cron/run/[task]`); Vercel Cron läuft nur in Produktion | P11 |
| Produktion | `production` | Vercel Pro fra1, Branch `main` | Neon `main` (aws-eu-central-1, PG 17) | `s3` (`pct-media-prod`, `pct-private-prod`) | `smtp` (Lettermint) | `stripe` **Live** | `deepl` | nicht gesetzt (`true` → Startabbruch, R-181) | Vercel Cron | P11 |

Vorher nicht vorhanden: Preview, Staging und Produktion existieren erst ab P11 (Konten, E-99). Bis dahin ist die
„Vorschau“ ausschließlich die Single-File-Datei (§14).

### 4.2 `APP_ENV`-Regeln

- Werte: `development | test | preview | staging | production`. `NODE_ENV` sagt nur, ob gebaut wurde; **fachliche Regeln
  hängen nur an `APP_ENV`** („Produktion“ in allen Fachdokumenten, z. B. DATENMODELL §13.7, heißt `APP_ENV=production`).
- Standard: `development`, wenn nicht gesetzt **und** `NODE_ENV ≠ production`. Ein Produktions-Build/-Start ohne `APP_ENV`
  bricht ab (verhindert, dass ein Vercel-Deployment versehentlich als `development` läuft).
- `SEED_PREVIEW_MODE` wirkt nur bei `APP_ENV ≠ production` (KONZEPT §9.7: `seedPreviewModeActive()` liefert in
  Produktion immer `false`). Ist er bei `production` auf `true` gesetzt, bricht `assertProductionEnv()` den Start mit
  Meldung ab (R-181, §4.3) – beide Sicherungen gelten.
- `robots`: nur `production` indexierbar; alle anderen senden `X-Robots-Tag: noindex, nofollow` und `robots.txt` mit
  `Disallow: /` (KONZEPT §2.5).
- Mock-Treiber sind in `production` verboten; `MAIL_REDIRECT_ALL_TO` wird in `production` ignoriert.

### 4.3 Start-Prüfung (`src/lib/env.ts`)

`getEnv()` validiert beim ersten Aufruf alle Variablen mit zod (Typen, Formate, erlaubte Werte) und liefert ein typisiertes,
eingefrorenes Objekt. `instrumentation.ts` ruft beim Serverstart `assertProductionEnv(getEnv())` auf. In `production`
Pflicht (sonst Abbruch mit Liste aller Verstöße):

| Prüfung | Bedingung |
|---|---|
| Treiber | `STORAGE_DRIVER=s3`, `EMAIL_DRIVER=smtp`, `PAYMENTS_DRIVER=stripe`; `TRANSLATION_DRIVER=deepl` **oder** Warnung (Knopf deaktiviert) |
| Stripe | `STRIPE_SECRET_KEY` beginnt mit `sk_live_` oder `rk_live_`; `STRIPE_WEBHOOK_SECRET` beginnt mit `whsec_`; `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` mit `pk_live_`; `STRIPE_API_BASE_URL` leer (P4.5) |
| Geheimnisse | `PAYLOAD_SECRET` ≥ 32 Zeichen und ≠ Wert aus `.env.example`; `CRON_SECRET` ≥ 32 Zeichen |
| Admin-Pfad | `ADMIN_ROUTE` ≠ `/admin`, ≠ `/werkstatt`, beginnt mit `/`, nur `[a-z0-9-]`, 6–40 Zeichen |
| URL | `NEXT_PUBLIC_SITE_URL` = `https://planetclairetattoos.com` (ohne `/` am Ende) |
| S3 | `S3_ENDPOINT` endet auf `.eu.r2.cloudflarestorage.com` (EU-Jurisdiktion) |
| Beispieldaten | `SEED_PREVIEW_MODE` ≠ `true` (R-181) |

Außerhalb von `production`: Verstöße gegen Formate → Abbruch; fehlende optionale Schlüssel → Warnung und Mock.

### 4.4 Lokale Entwicklung (Windows, macOS, Linux)

```bash
corepack enable                 # pnpm 10.34.5 aus packageManager
pnpm install
cp .env.example .env            # Windows PowerShell: Copy-Item .env.example .env
docker compose up -d            # postgres:17-alpine (5432) + mailpit (1025/8025)
pnpm payload migrate            # Schema (ab P1 immer über Migrationen)
pnpm seed                       # = seed:base + seed:example (ab P1 bzw. P8 vollständig)
pnpm dev                        # http://localhost:3000, Verwaltung unter ADMIN_ROUTE (Standard /werkstatt)
```

- **Windows:** Docker Desktop (WSL 2) oder PostgreSQL 17 nativ (Installer; Benutzer/Passwort wie `.env.example`).
  Alle `pnpm`-Skripte sind plattformunabhängig (`cross-env`, `tsx`, Node-APIs statt Shell-Befehlen); Pfade über
  `path.join`. `.gitattributes` erzwingt LF. Playwright-Browser: `pnpm exec playwright install chromium webkit`.
- **Optionale Profile** (P1 ergänzt in `docker-compose.yml`): `--profile s3` (MinIO + Bucket-Anlage), `--profile payments`
  (`stripe/stripe-mock`, Port 12111).
- **Datenbanken:** `planetclaire` (Entwicklung), `planetclaire_test` (Int/E2E; wird von Tests geleert), `planetclaire_preview_export`
  (Export). `scripts/db-ensure.ts` legt fehlende Datenbanken an (Teil von `pnpm test:int`, `pnpm test:e2e`, `pnpm preview:export`).
- **Schema-Push** (`PAYLOAD_DB_PUSH=true`) nur auf einer Wegwerf-Datenbank beim Prototyping; nie in `planetclaire_test`,
  CI, Staging, Produktion (DATENMODELL §10).

### 4.5 Claude-Cloud-Sandbox (Voraussetzungen, die `docs/CLOUD-SETUP.md` erfüllt)

| Punkt | Annahme dieses Dokuments |
|---|---|
| Betriebssystem | Ubuntu 24.04, ca. 4 vCPU, 16 GB RAM, 30 GB Disk |
| Node | 22 vorinstalliert (erfüllt `engines`); Setup-Skript darf Node 24 installieren |
| pnpm | über `corepack enable` (Version aus `packageManager`) |
| Postgres | 16 vorinstalliert, per `sudo service postgresql start` gestartet (SessionStart-Hook); Benutzer `postgres`/`postgres` mit Passwort-Login auf `127.0.0.1:5432`; Datenbanken `planetclaire`, `planetclaire_test` |
| Browser | Playwright Chromium (Pflicht) **und** WebKit inkl. Systemabhängigkeiten – `scripts/cloud-setup.sh` versucht beide zu installieren. Nur wenn WebKit scheitert: `PW_SKIP_WEBKIT=1` (Projekt `iphone-15` läuft dann als markierte Chromium-Emulation, §7.3) + Eintrag in `docs/OFFENE-PUNKTE.md`. CI führt WebKit immer aus und ist maßgeblich |
| Netz | Stufe „Custom“ mit Standardliste plus Playwright-Download-Domains und `api.stripe.com`/`files.stripe.com`/`js.stripe.com` (vollständige Liste in `docs/CLOUD-SETUP.md`) |
| Geheimnisse | **keine echten**. Umgebungsvariablen der Cloud-Umgebung sind für alle Nutzer lesbar → Werte aus `.env.example`. Ein Stripe-**Test**-Schlüssel ist optional: **bevorzugt** als „API credential“ der Cloud-Umgebung für `api.stripe.com` (dann `PAYMENTS_DRIVER=stripe`, `STRIPE_SECRET_KEY=sk_test_proxy` als Platzhalter; der Proxy setzt den echten Schlüssel; Prüfbefehl `livemode: false` in CLOUD-SETUP §3.9). **Rückfall**, nur wenn das Credential nicht funktioniert: `STRIPE_SECRET_KEY` als Umgebungsvariable, ausschließlich `sk_test_…`/`rk_test_…` (CLAUDE.md §6), `livemode: false` prüfen (§3.5). **Nie** Live-Schlüssel vor P11. Ohne Test-Schlüssel: `mock`. |
| Eingehende Verbindungen | keine → Stripe-Webhooks erreichen die Sandbox nicht; die App funktioniert trotzdem (Danke-Seite fragt die Session ab, Abgleich-Job, KONZEPT §4.10) |
| Git | nur der eigene Arbeitsbranch ist push-bar (E-97) |

### 4.6 CI (GitHub Actions)

Siehe §6. Umgebung: `APP_ENV=test`, alle Treiber Mock/lokal, Postgres-Service 17, `TZ=UTC`, feste `SEED_NOW`.
Keine Repository-Secrets bis P11; auch danach **keine** Produktionsdaten oder Produktions-Zugänge in GitHub (DIENSTE §3.11).

### 4.7 Preview, Staging, Produktion (ab P11)

- **Vercel-Projekt** `planetclairetattoos`, Team auf Jutta (E-94), Pro-Plan, Funktionsregion `fra1` (`vercel.json`
  `"regions": ["fra1"]` **und** Projekteinstellung), Node 24.x, Build-Befehl je Umgebung:
  - Produktion und Staging: `pnpm payload migrate && pnpm build` (Migration mit `DATABASE_URL_UNPOOLED`, §5).
  - Preview: `pnpm payload migrate && pnpm build` gegen den Neon-Branch `preview`.
  - „Ignored Build Step“: Deployment überspringen, wenn nur `docs/**`, `tests/**`, `content/art/**` geändert wurden.
- **Deployment Protection** (Vercel-Authentifizierung) für Preview und Staging; für Stripe-Webhooks an Staging wird die
  „Protection Bypass for Automation“-Kennung als Query-Parameter in der Webhook-URL hinterlegt.
- **Datenbanken:** Neon-Projekt in `aws-eu-central-1`, Postgres 17. Branch `main` = Produktion. Branches `staging` und
  `preview` werden aus einem **leeren, nur migrierten und mit `pnpm seed` gefüllten** Stand angelegt (Branch `seed-root`,
  erstellt vor dem ersten echten Auftrag) – **nie** als Kopie von `main` (DIENSTE §3.3: keine Produktionsdaten in Previews).
  Erlaubt der Neon-Tarif keine weiteren Branches kostenfrei, teilen sich Preview und Staging den Branch `staging`.
- **Stripe:** Staging und Preview im Testmodus (Preview mit `mock`), Produktion Live; Webhook-Endpunkte je Umgebung mit
  gleicher API-Version; die Domains `planetclairetattoos.com` und `staging.planetclairetattoos.com` sind als „Payment method
  domains“ registriert (Apple Pay).
- **Git-Fluss:** `main` → Produktion; `staging` → Staging (wird bei Bedarf von `main` vorgespult); PR-Branches → Preview.
  Deploy ausschließlich per Git (kein `vercel deploy` von Hand).
- **Kostenbremse:** siehe §12.3.

### 4.8 Schutz der Produktionsdatenbank

- **Markierung:** In P11 setzt `pnpm db:mark-production` einmalig `COMMENT ON DATABASE <name> IS 'planetclaire:production'`
  (über `DATABASE_URL_UNPOOLED`).
- Alle zerstörerischen Skripte (`seed`, `seed:example`, `seed:remove`, `db:reset`, Test-Setups, `retention:replay` nur mit
  `--yes-production`) lesen die Markierung (`SELECT shobj_description(oid,'pg_database') FROM pg_database WHERE datname =
  current_database()`) und brechen bei `planetclaire:production` **oder** `APP_ENV=production` mit Exit-Code 1 ab
  (KONZEPT AK-11-04). Es gibt keinen Umgehungsschalter für Seed und Reset.
- **Reihenfolge in P11** (die Seitentexte des Beispielbestands sollen in Produktion ankommen): Neon `main` migrieren und
  mit `pnpm seed` füllen, **solange** die Datenbank noch nicht markiert ist (vor dem ersten echten Auftrag, §4.7); die
  Beispieldaten entfernt später der Admin-Knopf „Beispieldaten entfernen“ mit „Texte behalten“ (in Produktion erlaubt;
  die CLI `seed:remove` bleibt dort gesperrt); danach `pnpm db:mark-production`.

**AK-A-4-01** `APP_ENV=production pnpm seed` und `pnpm seed` gegen eine als Produktion markierte DB enden mit Exit-Code 1 und
ändern nichts.
**AK-A-4-02** Ohne `APP_ENV` bricht `pnpm start` nach einem Produktions-Build ab; `pnpm dev` startet als `development`.
**AK-A-4-03** Mit `APP_ENV=staging` enthalten alle Antworten `X-Robots-Tag: noindex, nofollow`; `robots.txt` enthält `Disallow: /`.

---

## 5. Umgebungsvariablen

### 5.1 Quelle und Pflege

- **Einzige Quelle im Code:** `src/lib/env.ts` (zod-Schema; jede Variable mit `.describe()`-Text, Standardwert, Geheimnis-
  Kennzeichen). `scripts/gen-env-example.ts` erzeugt daraus `.env.example`; ein Unit-Test prüft, dass `.env.example` dem
  generierten Stand entspricht und dass jede Variable des Schemas in der Tabelle §5.2 vorkommt (Markdown-Parser).
- Server-Code liest Variablen **nur** über `getEnv()`, nie direkt über `process.env` (Ausnahmen: `next.config.ts`,
  `playwright.config.ts`, Skripte vor dem App-Start). `NEXT_PUBLIC_*` sind im Browser sichtbar – dort nie Geheimnisse.
- Legende Spalte „Pflicht“: **alle** = jede Umgebung; **dev/test** = lokal, Cloud, CI; **prev/stag/prod** = Vercel-Umgebungen;
  „wenn …“ = abhängig von einem Treiber. Spalte „Geheim“: ja = nur in `.env` (lokal), Vercel-„Sensitive“-Variablen bzw.
  gar nicht in Cloud/CI (einzige Ausnahme: Stripe-Test-Schlüssel als Rückfall in der Cloud, §4.5).

### 5.2 Tabelle

**Kern und Laufzeit**

| Name | Zweck | Beispiel / Standard | Pflicht | Geheim | Seit |
|---|---|---|---|---|---|
| `APP_ENV` | Umgebungskennung (§4.2) | `development` | CI, prev, stag, prod | nein | P1 |
| `DATABASE_URL` | Postgres-Verbindung der App (Neon: **gepoolte** URL mit `-pooler`) | `postgres://postgres:postgres@127.0.0.1:5432/planetclaire` | alle | ja (stag/prod) | P0 |
| `DATABASE_URL_UNPOOLED` | direkte Verbindung für Migrationen, Backup, `db:*`-Skripte | leer = `DATABASE_URL` | prod/stag empfohlen | ja | P1 |
| `DATABASE_URL_TEST` | Test-DB für `test:int`/`test:e2e` (wird geleert!) | `postgres://postgres:postgres@127.0.0.1:5432/planetclaire_test` | dev/test | nein | P1 |
| `DB_POOL_MAX` | Größe des pg-Pools | `10`; Int-Tests `25`; Vercel `5` | – | nein | P1 |
| `PAYLOAD_SECRET` | Payload-Signaturen; Wurzel für abgeleitete Schlüssel (HKDF, §8.6) | 64 Hex-Zeichen | alle | ja | P0 |
| `PAYLOAD_DB_PUSH` | Schema-Push, nur Wegwerf-DB lokal | `false` | – | nein | P1 |
| `NEXT_PUBLIC_SITE_URL` | kanonische Basis-URL (ohne `/` am Ende) | `http://localhost:3000` | alle | nein | P0 |
| `ADMIN_ROUTE` | Pfad der Verwaltung (§8.4) | `/werkstatt` (dev); prod eigener Wert | alle | nicht veröffentlichen | P1 |
| `CRON_SECRET` | Bearer für `/api/cron/*`, `/api/health?deep=1`, `/api/payload-jobs/run` | ≥ 32 Zeichen | stag/prod (lokal Beispielwert) | ja | P1 |
| `JOBS_AUTORUN` | Payload `jobs.autoRun` im Prozess (jede Minute) | `true` dev/Docker, `false` Vercel/Tests | – | nein | P1 |
| `LOG_LEVEL` | `debug\|info\|warn\|error` | `info` | – | nein | P1 |
| `MAINTENANCE_MODE` | Wartungsmodus (§10.5): öffentliche Seiten 503 mit Hinweis; erreichbar bleiben Impressum, Datenschutz, AGB, Widerrufsbelehrung und R26 „Vertrag widerrufen“ samt Fußlink. Die Widerrufsfunktion R26 arbeitet normal, solange die Datenbank erreichbar ist; nur ohne Datenbank zeigt R26 statt des Formulars den Widerruf per E-Mail (mailto an `MAIL_REPLY_TO`). Kasse und übrige Formulare gesperrt, Stripe-Webhook antwortet 503 (Stripe wiederholt), Tick antwortet 204; Verwaltung erreichbar | `false` | – | nein | P10 |
| `TZ` | Prozess-Zeitzone, immer `UTC` (Code rechnet mit `APP_TIME_ZONE`) | `UTC` | CI, Tests | nein | P1 |

**Beispielbestand, Vorschau, QA**

| Name | Zweck | Beispiel / Standard | Pflicht | Geheim | Seit |
|---|---|---|---|---|---|
| `SEED_PREVIEW_MODE` | Seed-Medien ohne Einwilligung + Banner zeigen (nur ≠ production; `true` in production → Startabbruch, R-181) | `true` (dev) | – | nein | P0 |
| `SEED_NOW` | Referenzzeit des Beispielbestands (ISO 8601) | leer = jetzt; CI `2026-10-15T10:00:00+02:00`; Export: Exportdatum 12:00 Berlin | – | nein | P1 |
| `SEED_ADMIN_EMAIL` | Admin-Konto des Grund-Seeds (nur ≠ production) | `admin@example.com` | dev/test | nein | P1 |
| `SEED_ADMIN_PASSWORD` | Passwort dazu (nur Testwert, ≥ 12 Zeichen) | `werkstatt-dev-2026` | dev/test | Testwert | P1 |
| `PREVIEW_EXPORT` | Export-Modus (§14): Kasse als Attrappe, keine Analytics | `false` | – | nein | P2 |
| `PREVIEW_PHASE` | Phasen-Kennung für Banner, Bericht und Artefakt-Namen (§14.9) | leer = aus `PLAN.md` ermittelt; CI aus `[ci:full pN]` | – | nein | P2 |
| `NEXT_PUBLIC_LEASH_DEBUG` | `window.__leash`/`window.__qa` einbauen (DESIGN §9.13) | leer | E2E-Build | nein | P2 |
| `ART_QA` | QA-Seiten `/{locale}/qa/*` (KUNST-QA §3.1) | leer | – | nein | P9 |

**Speicher**

| Name | Zweck | Beispiel / Standard | Pflicht | Geheim | Seit |
|---|---|---|---|---|---|
| `STORAGE_DRIVER` | `local\|s3` | `local` | alle | nein | P0 |
| `STORAGE_LOCAL_DIR` | Wurzel für `local` | `.data` | – | nein | P1 |
| `S3_ENDPOINT` | S3-Endpunkt (R2: `https://<ACCOUNT_ID>.eu.r2.cloudflarestorage.com`) | MinIO `http://127.0.0.1:9000` | wenn `s3` | nein | P0 |
| `S3_REGION` | Region | `auto` | wenn `s3` | nein | P0 |
| `S3_BUCKET` | Bucket für `media` + `documents` | `pct-media-prod` | wenn `s3` | nein | P0 |
| `S3_PRIVATE_BUCKET` | Bucket für `private-uploads` + Systemdateien | `pct-private-prod` | wenn `s3` | nein | P1 |
| `S3_ACCESS_KEY_ID` | Zugangsschlüssel (R2-Token nur für diese zwei Buckets) | – | wenn `s3` | ja | P0 |
| `S3_SECRET_ACCESS_KEY` | Geheimnis dazu | – | wenn `s3` | ja | P0 |
| `S3_FORCE_PATH_STYLE` | Pfad-Adressierung (R2/MinIO) | `true` | wenn `s3` | nein | P1 |

**E-Mail**

| Name | Zweck | Beispiel / Standard | Pflicht | Geheim | Seit |
|---|---|---|---|---|---|
| `EMAIL_DRIVER` | `file\|smtp\|memory\|log` | `file` | alle | nein | P0 |
| `EMAIL_FILE_DIR` | Ablage für `file` | `.data/mail-outbox` | – | nein | P1 |
| `SMTP_HOST` | SMTP-Server (Mailpit lokal, Lettermint prod) | `127.0.0.1` | wenn `smtp` | nein | P0 |
| `SMTP_PORT` | Port | `1025` (Mailpit), `587` (STARTTLS) oder `465` | wenn `smtp` | nein | P0 |
| `SMTP_SECURE` | `true` nur bei Port 465 | `false` | – | nein | P1 |
| `SMTP_USER` | Benutzer | leer (Mailpit) | wenn `smtp` prod | ja | P0 |
| `SMTP_PASS` | Passwort/Token | leer | wenn `smtp` prod | ja | P0 |
| `MAIL_FROM` | Absender | `Planet Claire <shop@planetclairetattoos.com>` | alle | nein | P0 |
| `MAIL_REPLY_TO` | Antwortadresse | `jutta@planetclairetattoos.com` | alle | nein | P0 |
| `ADMIN_NOTIFY_EMAIL` | Startwert/Rückfall für `settings.adminNotificationEmail` | `jutta@planetclairetattoos.com` | alle | nein | P0 |
| `MAIL_REDIRECT_ALL_TO` | alle Mails an diese Adresse (nur ≠ production) | leer; Staging `jutta@planetclairetattoos.com` | stag | nein | P11 |

**Zahlung**

| Name | Zweck | Beispiel / Standard | Pflicht | Geheim | Seit |
|---|---|---|---|---|---|
| `PAYMENTS_DRIVER` | `mock\|stripe` | `mock` | alle | nein | P0 |
| `STRIPE_SECRET_KEY` | Server-Schlüssel (`sk_test_`/`rk_test_`; Live nur prod) | leer | wenn `stripe` | ja | P0 |
| `STRIPE_WEBHOOK_SECRET` | Signatur-Geheimnis des Endpunkts | `whsec_…` | wenn `stripe` (stag/prod) | ja | P0 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Browser-Schlüssel (nur Kasse) | `pk_test_…` | wenn `stripe` | nein | P0 |
| `STRIPE_API_BASE_URL` | nur Tests gegen stripe-mock | leer; `http://127.0.0.1:12111` | – | nein | P4 |

**Übersetzung, Versand, Statistik, Monitoring**

| Name | Zweck | Beispiel / Standard | Pflicht | Geheim | Seit |
|---|---|---|---|---|---|
| `TRANSLATION_DRIVER` | `mock\|deepl` | `mock` | alle | nein | P0 |
| `DEEPL_API_KEY` | DeepL API Free (`…:fx`) | leer | wenn `deepl` | ja | P0 |
| `CARRIER_DRIVER` | `manual` | `manual` | – | nein | P1 (Adapter-Gerüst; Nutzung ab P5) |
| `NEXT_PUBLIC_ANALYTICS_ENABLED` | Vercel Web Analytics rendern (R-132, §3.8); Vorschau-Export und Docker setzen `false` | `false` | – | nein | P1 (Schema und `.env.example`; wirksam ab P10) |
| `NEXT_PUBLIC_CLIENT_ERRORS_ENABLED` | Browser-Fehlermeldungen an `POST /api/client-errors` (§2.5, M-02); wirkt nur bei `APP_ENV=production`; einschalten erst nach Antwort auf Kanzleifrage K-30 (c) | `false` | – | nein | P10 |
| `SENTRY_DSN` | Sentry EU (`https://…@o….ingest.de.sentry.io/…`), leer = aus | leer | prod/stag optional | ja | P0 |
| `SENTRY_ENVIRONMENT` | Umgebungsname in Sentry | = `APP_ENV` | – | nein | P10 |

**Backup (nur Produktion, §10)**

| Name | Zweck | Beispiel / Standard | Pflicht | Geheim | Seit |
|---|---|---|---|---|---|
| `BACKUP_ENABLED` | nächtliches Backup aktiv (Route §10.3 sonst 404) | `false`; Produktion `true` erst in P11 (mit Bucket, Token, Empfänger-Schlüssel) | prod (ab P11) | nein | P10 |
| `BACKUP_S3_BUCKET` | Backup-Bucket (EU) | `pct-backups` | wenn aktiv | nein | P10 |
| `BACKUP_S3_ACCESS_KEY_ID` | eigener R2-Token nur für `pct-backups` | – | wenn aktiv | ja | P10 |
| `BACKUP_S3_SECRET_ACCESS_KEY` | Geheimnis dazu | – | wenn aktiv | ja | P10 |
| `BACKUP_AGE_RECIPIENT` | öffentlicher age-Schlüssel (`age1…`) für die Verschlüsselung | – | wenn aktiv | nein (öffentlich) | P10 |

**Build und Test**

| Name | Zweck | Beispiel / Standard | Pflicht | Geheim | Seit |
|---|---|---|---|---|---|
| `NEXT_OUTPUT_STANDALONE` | `output: 'standalone'` (Docker) | leer; Docker `1` | Docker | nein | P0 |
| `BUILD_WITHOUT_DB` | Build ohne DB-Zugriff; DB-gestützte Seiten werden zur Laufzeit gerendert (§13) | leer; Docker `1` | Docker | nein | P10 |
| `NEXT_TELEMETRY_DISABLED` | Next-Telemetrie aus | `1` | CI, Docker | nein | P0 |
| `NEXT_DIST_DIR` | Build-Ordner (`distDir` in `next.config.ts`); der Vorschau-Export nutzt `.next-preview`, damit `.next` des Entwicklungsservers unberührt bleibt | leer = `.next` | – | nein | P2 |
| `PREVIEW_EXPORT_DB_NAME` | Nur für parallele Vorschau-Exporte auf einem Rechner: eigene Wegwerf-Datenbank (`planetclaire_…preview…`, `scripts/preview-export/env.ts`) | leer = `planetclaire_preview_export` | – | nein | P8 |
| `PREVIEW_EXPORT_PORT` | Dazu der eigene Port des Export-Servers (1024–65535) | leer = `3999` | – | nein | P8 |
| `E2E_BASE_URL` | Ziel der E2E-Tests | `http://localhost:3000` | – | nein | P1 |
| `E2E_SERVER` | `dev` (lokal) oder `start` (CI: Produktions-Build) | `dev`; CI `start` | – | nein | P1 |
| `PW_SKIP_WEBKIT` | nur wenn die WebKit-Installation scheitert (Cloud/lokal, §4.5): Projekt `iphone-15` läuft als markierte Chromium-Emulation (§7.3); in CI nie gesetzt | leer | – | nein | P1 |

Von Plattformen gesetzt und nur gelesen: `NODE_ENV`, `CI`, `VERCEL_ENV`, `VERCEL_GIT_COMMIT_SHA` (App-Version im Admin
„System“, Sentry-Release), `VERCEL_PROJECT_PRODUCTION_URL` (Vercel-Produktions-Domain für `cors`/`csrf`, §8.2). Fachliche
Bedingungen hängen nie an `NODE_ENV` oder `VERCEL_ENV`, sondern an `APP_ENV` (§4.2). Nur in `docker-compose.prod.yml`: `DOMAIN`, `POSTGRES_PASSWORD` (§13). Nur für Setup-Skript und
Hooks der Cloud-Umgebung (nie im App-Code, nicht in `src/lib/env.ts`): `PLAYWRIGHT_BROWSERS_PATH`, `GH_REPO`,
`CLAUDE_CODE_REMOTE` u. a. laut `docs/CLOUD-SETUP.md`.

Fachdokumente verwenden seit dem 26.09.2026 nur die Namen dieser Tabelle (u. a. `SEED_NOW`, `SEED_PREVIEW_MODE`,
`PREVIEW_EXPORT`, `PREVIEW_PHASE`, `NEXT_PUBLIC_ANALYTICS_ENABLED`, `*_DRIVER`); frühere Namen stehen nur noch in Anhang A.

### 5.3 Wo liegen welche Werte?

| Ort | Inhalt |
|---|---|
| `.env.example` (Repo) | alle Variablen mit ungefährlichen Standardwerten, keine Geheimnisse |
| `.env` (lokal, gitignored) | Kopie von `.env.example`, ggf. eigene Test-Schlüssel |
| Claude-Cloud-Umgebung | nur Werte aus `.env.example` (lesbar!); Stripe-**Test**-Schlüssel bevorzugt als API-Credential, Rückfall als Umgebungsvariable nur `sk_test_…`/`rk_test_…` mit `livemode: false` (§4.5); nie Live-Schlüssel |
| GitHub Actions | Klartext-`env:` im Workflow (nur Testwerte); keine Secrets bis P11; danach nur, was CI braucht (keine Produktionszugänge) |
| Vercel (ab P11) | je Umgebung (Production / Preview / Staging) getrennt; Geheimnisse als „Sensitive“ |
| Offline bei Jutta | privater age-Schlüssel (`AGE-SECRET-KEY-…`) im Passwort-Manager **und** ausgedruckt; Stripe-/R2-Wiederherstellungscodes |

**AK-A-5-01** `pnpm check` scheitert, wenn `.env.example` nicht dem aus `src/lib/env.ts` erzeugten Stand entspricht oder eine
Schema-Variable in §5.2 fehlt.
**AK-A-5-02** Kein Modul unter `src/` (außer `src/lib/env.ts`, `next.config.ts`, `instrumentation.ts`) liest `process.env.` direkt
(ESLint-Regel `no-restricted-properties`).

---

## 6. CI/CD

### 6.1 Rahmenbedingungen (GitHub Free, privates Repository)

| Grenze | Wert | Folge |
|---|---|---|
| Actions-Minuten | 2.000 min/Monat (Linux) | CI-Disziplin §6.7 (Zwischen-Commits mit `[skip ci]`), Budget und Minuten-Wächter §6.8; Ziel ≤ 1.500 min für P1–P10 zusammen und ≤ 1.500 min je Monat |
| Artefakt-Speicher | 500 MB gesamt (gelöschte Artefakte zählen bei GitHub noch einige Stunden mit) | Vorschau-Artefakte: nur die **3 neuesten** (§6.5); Fehlerberichte (`playwright-report/`, `test-results/`) nur bei Fehlschlag, 2 Tage; Traces nur `retain-on-failure`, kein Video außer `art-qa.yml`; KUNST-QA-Bündel ≤ 100 MB (KUNST-QA §8); Budget-Schritt vor jedem optionalen Upload (§6.2) |
| Runner | `ubuntu-latest` (24.04), 2 vCPU, ca. 7–8 GB RAM | Build-Heap max. 6 GB: Skript `build` mit `--max-old-space-size=6144` (seit P0) |
| Branch-Schutz / Rulesets | für **private** Repos erst ab GitHub Pro | bis dahin gilt die Merge-Regel §6.7 als verbindliche Arbeitsregel (CLAUDE.md); mit Pro: Einstellungen aus §6.7 aktivieren |
| Workflows durch `GITHUB_TOKEN`-Aktionen | lösen keine weiteren Workflows aus (Ausnahme `workflow_dispatch`) | Automerge von Dependabot (ab P11) startet auf `main` keinen Workflow; unkritisch |

### 6.2 Workflows

| Datei | Auslöser | Jobs | Dauer-Ziel | Ab |
|---|---|---|---|---|
| `ci.yml` (Workflow-Name `CI`) | `pull_request` (opened, synchronize, reopened, ready_for_review), `workflow_dispatch`; **kein** `push` | `quick` (im P0-Stand noch `checks`, §6.3); läuft nicht bei `[ci:update-snapshots]` und `[ci:art]` (Kennungen unten) | ≤ 20 min | P0 (P1 benennt um und erweitert) |
| `ci-full.yml` | `pull_request` (wie `ci.yml`), `workflow_dispatch` (Eingabe `update_snapshots: boolean`); **kein** `push`; ab P11 (nach dem Go-live) zusätzlich `schedule` Mo 03:00 UTC auf `main` | `mode` (Kennung lesen, ≤ 1 min); `e2e-full`, `quality`, ab P10 `docker` (nur bei `[ci:full` bzw. Dispatch ohne `update_snapshots`); `snapshots` (nur bei `[ci:update-snapshots]` bzw. `update_snapshots = true`, §7.6) | ≤ 35 min (parallel) | P1 als Gerüst (nur `workflow_dispatch`), ab P2 vollständig |
| `preview-export.yml` | `pull_request` (wie `ci.yml`), `workflow_dispatch`; **kein** `push`. Arbeitet **nur**, wenn der PR-Kopf-Commit `[ci:full pN]` trägt (Phasenende, §6.7) – nicht bei `[ci:full]` ohne Phase | `export` | ≤ 15 min | P2 |
| `release.yml` | `push` auf `main` (`paths-ignore: ['content/seed/instagram-export/**', 'content/seed/coco/**']` – Juttas Uploads, ANLEITUNGEN G4, starten nichts), täglicher `schedule` 06:00 UTC (`cron: '0 6 * * *'`) als Rückfall, `workflow_dispatch`; Probelauf bei `pull_request`, der `release.yml` oder `vorschau-release.json` ändert (§6.6) | `gate` (≤ 1 min), `publish`, `verify-asset` (Probelauf: nur Bauen und Tests) | `gate` Sekunden, sonst ≤ 20 min | P10 |
| `art-qa.yml` | `workflow_dispatch`; `pull_request` (`labeled`, `synchronize`, `opened`, `reopened`); arbeitet, wenn der PR-Kopf-Commit `[ci:art]` trägt oder am PR das Label `art` gesetzt ist (KUNST-QA §9) | `art-qa` | ≤ 25 min | P9 |
| `restore-drill.yml` | monatlich (1., 04:00 UTC), `workflow_dispatch`, `pull_request` mit `paths: ['src/lib/backup/**', '.github/workflows/restore-drill.yml']` | `drill` (Backup-/Restore-Code gegen **synthetische** Seed-DB) | ≤ 10 min | P10 |
| `dependabot-automerge.yml` | `workflow_run` von `CI` (completed) | `automerge` | ≤ 1 min | P11 (§1.3) |

**Kein Backup-Workflow in GitHub Actions:** Produktions-Backups laufen in der App (Vercel Cron, §10), weil GitHub keine
Produktionsdaten verarbeiten darf (DIENSTE §3.11, LOESCHKONZEPT L-23). Das weicht bewusst von der Recherche ab.

Gemeinsam für alle Workflows: `concurrency: { group: <workflow>-${{ github.ref }}, cancel-in-progress: true }` (außer
`release.yml`); `permissions` minimal (Standard `contents: read`); Actions per Major-Tag, Aktualisierung über Dependabot;
`timeout-minutes` je Job gesetzt; Node aus `.nvmrc`, pnpm über `pnpm/action-setup`, Cache für pnpm-Store, `.next/cache`
(Schlüssel: Lockfile + Hash von `src/**`) und Playwright-Browser (`~/.cache/ms-playwright`, Schlüssel: Browser-Satz + Playwright-Version, z. B.
`playwright-Linux-chromium-webkit-<version>` bzw. `…-chromium-<version>`; der Installationsschritt ruft immer
`playwright install --with-deps <browser…>` auf – bei Cache-Treffer lädt er nichts nach).

**Was auf `main` läuft:** Bis P10 läuft auf `main` nur `release.yml` (ab dem P10-Merge; es endet nach Sekunden, solange
`OFFEN_P1_P10 ≠ 0` oder das Release aktuell ist, §6.6) und monatlich `restore-drill.yml`. `ci.yml`, `ci-full.yml` und
`preview-export.yml` laufen nie bei `push` auf `main`: Der gemergte Stand ist der im PR geprüfte Stand (Merge-Regel §6.7
Nr. 3), ein zweiter Lauf kostete nur Minuten.

**Kennungen lesen:** `ci.yml`, `ci-full.yml`, `preview-export.yml` und `art-qa.yml` laufen über `pull_request`. Trägt
der Kopf-Commit des PR `[skip ci]`, startet GitHub keinen dieser Workflows – auch nicht bei Label-Ereignissen
(`labeled`). Sonst liest der erste Schritt (in `ci-full.yml` der eigene Job `mode`) ohne Checkout die Nachricht des
Kopf-Commits: `gh api repos/${{ github.repository }}/commits/${{ github.event.pull_request.head.sha }} --jq
.commit.message` (`GH_TOKEN: ${{ github.token }}`, `permissions: contents: read`), und setzt die Ausgaben `full`
(`[ci:full`), `phase` (Regex `\[ci:full\s+(p\d+)\]`, sonst `px`), `snapshots` (`[ci:update-snapshots]`) und `art`
(`[ci:art]`). Passt die Kennung nicht zum Workflow, werden die übrigen Schritte bzw. Jobs übersprungen (Ergebnis grün,
Kosten ≤ 1 min, §6.8). Bei `workflow_dispatch` gelten die Eingaben statt der Nachricht.

| Kennung im PR-Kopf-Commit | `ci.yml` (`quick`) | `ci-full.yml` | `preview-export.yml` | `art-qa.yml` |
|---|---|---|---|---|
| `[skip ci]` | – | – | – | – (auch kein Label-Ereignis) |
| ohne Kennung (z. B. Dependabot-PR) | ✓ | nur `mode` | übersprungen | nur mit Label `art` |
| `[ci:full]` (Zwischenlauf) | ✓ Kurzform (seit P14.13, §6.3) | `e2e-full` (seit P14.13 nur `desktop` + `iphone-15`, dazu die pixel-7-Gates, §6.4), `quality` (ab P10 `docker`) | übersprungen | nur mit Label `art` |
| `[ci:full pN]` (Phasenende) | ✓ Kurzform (seit P14.13, §6.3) | `e2e-full` (alle drei Geräteprofile), `quality` (ab P10 `docker`) | `export` | nur mit Label `art` |
| `[ci:update-snapshots]` | übersprungen | `snapshots` | übersprungen | nur mit Label `art` |
| `[ci:art]` (nur P9, KUNST-QA §9) | übersprungen | nur `mode` | übersprungen | `art-qa` |

**Artefakte (gemeinsame Regeln):**
- Playwright schreibt Traces nur bei Fehlschlag (`trace: 'retain-on-failure'`), Bildschirmfotos nur bei Fehlschlag, **kein
  Video** (`video: 'off'`); Videos gibt es nur in `art-qa.yml` (KUNST-QA §4).
- **Pflicht-Uploads:** Vorschau-Datei (`preview-export.yml`, §6.5), KUNST-QA-Bündel (`art-qa.yml`, ≤ 100 MB; ältere
  `art-qa-*` werden **vor** dem Upload gelöscht, KUNST-QA §8), Referenzbilder aus dem Job `snapshots` (§7.6),
  Release-Asset (`release.yml`).
- **Optionale Uploads:** Fehlerberichte (`playwright-report/`, `test-results/`, `art-qa-check-*`) nur bei Fehlschlag, mit
  `retention-days: 2`.
- **Budget-Schritt** vor jedem optionalen Upload: `pnpm ci:artifacts` (`scripts/ci/artifact-budget.ts`, §6.10) summiert
  `size_in_bytes` aller nicht abgelaufenen Artefakte (`gh api repos/{owner}/{repo}/actions/artifacts --paginate`) und
  schreibt `upload_optional=true|false` nach `$GITHUB_OUTPUT`; ab **350 MB** Summe ist es `false`, der Upload entfällt,
  und das Job-Summary sagt „Fehlerbericht nicht hochgeladen – Artefakt-Speicher fast voll (…/500 MB)“. Der Schritt
  scheitert nie (API-Fehler → `upload_optional=false`).

### 6.3 `ci.yml` – Job `quick`

**Stand P0** (`.github/workflows/ci.yml`, Workflow `CI`): Auslöser `push` auf `main` und `pull_request` (Standard-Typen);
**ein Job `checks`** („Lint, Typen, Tests, Build“, `timeout-minutes: 30`) mit Service `postgres:17-alpine` (Datenbank
`planetclaire`) und den Schritten Installation, `lint`, `typecheck`, `test:unit`, `test:int`, `build` (entspricht Nr. 1, 2,
3, 5, 7 und dem Build aus Nr. 8). Umgebung bereits: `APP_ENV=test`, `ADMIN_ROUTE=/werkstatt`, `DATABASE_URL` (…/`planetclaire`),
`PAYLOAD_SECRET=ci-only-…`, `NEXT_PUBLIC_SITE_URL`, `SEED_PREVIEW_MODE=true`, alle vier Treiber lokal/Mock,
`CRON_SECRET=ci-only-cron-secret-…` (≥ 32 Zeichen), `NEXT_TELEMETRY_DISABLED=1`. **P1 gleicht Name und Umfang an das Soll
unten an** (Anhang C, C-14); Schritte, deren Skripte noch nicht existieren, ergänzt die Phase, die das Skript anlegt.

**Soll:** Service `postgres:17-alpine` (wie P0) mit `POSTGRES_DB=planetclaire_test`. Umgebung (Klartext, nur Testwerte):
`APP_ENV=test`, `TZ=UTC`, `DATABASE_URL` und `DATABASE_URL_TEST` =
`postgres://postgres:postgres@localhost:5432/planetclaire_test` (CI nutzt eine einzige Wegwerf-DB; der Reset verweigert
Namen ohne `_test`, §7.2), `DB_POOL_MAX=25`, `PAYLOAD_SECRET=ci-only-…`,
`NEXT_PUBLIC_SITE_URL=http://localhost:3000`, `ADMIN_ROUTE=/werkstatt`, alle Treiber lokal/Mock, `EMAIL_DRIVER=file`,
`SEED_PREVIEW_MODE=true`, `SEED_NOW=2026-10-15T10:00:00+02:00`, `SEED_ADMIN_EMAIL=admin@example.com`,
`SEED_ADMIN_PASSWORD=ci-only-password-2026`, `CRON_SECRET=ci-only-cron-secret-…` (≥ 32 Zeichen),
`NEXT_PUBLIC_LEASH_DEBUG=1`, `NEXT_TELEMETRY_DISABLED=1`, `E2E_SERVER=start`. Auslöser laut §6.2 (`pull_request`,
`workflow_dispatch`). Vor Schritt 1 steht der Schritt „Kennung“ (§6.2): Trägt der PR-Kopf-Commit `[ci:update-snapshots]`
oder `[ci:art]`, werden alle folgenden Schritte übersprungen.

| # | Schritt | Befehl | Scheitert bei |
|---|---|---|---|
| 1 | Installation | `pnpm install --frozen-lockfile` | Lockfile-Abweichung |
| 2 | Lint | `pnpm lint` | Fehler (Warnungen im geänderten Code: Review) |
| 3 | Typen | `pnpm typecheck` | Fehler |
| 4 | Statische Prüfungen | `pnpm check:static` (Versionen §1.3, `.env.example` §5.1, i18n-Parität, Routen-Registry, Import-Regeln §2.2, Stripe-Import-Scan R-062, Fremd-URL-Scan im Quelltext) | jede Abweichung |
| 5 | Unit-Tests | `pnpm test:unit` | Fehler |
| 6 | Migrationen | `pnpm payload migrate` → `pnpm check:migrations` (Drift, DATENMODELL §10 Nr. 4) | Fehler, Drift |
| 7 | Integrationstests | `pnpm test:int` | Fehler |
| 8 | Seed + Build | `pnpm seed` → `pnpm build` | Fehler |
| 9 | Budgets | `pnpm check:bundle` (§7.7), `pnpm check:external --built` (Fremd-URLs in `.next/static` und erzeugtem HTML) | Überschreitung, Fremd-URL |
| 10 | E2E-Rauchtest | `pnpm test:e2e --grep @smoke --project=desktop --project=iphone-15` | Fehler |
| 11 | Geheimnis-Scan | `gitleaks detect` (CLI, gepinnte Version, nur Commits des PR) | Fund |
| 12 | Abhängigkeiten | `pnpm audit --prod --audit-level=critical` (blockiert); `high` als Warnung im Job-Summary; dokumentierte Ausnahmen laut §8.10 (`pnpm.auditConfig.ignoreCves`) | `critical` ohne Ausnahme-Eintrag |

Bei Fehler: Budget-Schritt, dann (nur bei `upload_optional=true`) Upload `playwright-report/` und `test-results/` als
Artefakt `ci-report-<sha7>` mit `retention-days: 2` (§6.2).

**Kurzform bei `[ci:full` (seit P14.13, U-62):** Trägt der Kopf-Commit `[ci:full` (Zwischenlauf oder Phasenende), setzt
die Kennung `full=true`, und `quick` lässt alles aus, was `ci-full.yml` ohnehin ausführt: Nr. 7 (Integrationstests – laufen
in `quality` als `pnpm test:coverage`, Unit + Int mit denselben Dateien und demselben DB-Reset), Nr. 8/9 (Seed + Build,
`check:bundle` und `check:external --built` – laufen in `quality` am Build ohne Debug-Schalter), Nr. 10 (`@smoke` – die
Rauchtests sind Teil der vollen Suite in `e2e-full`) samt Playwright-Installation und `.next`-Cache. Statt Nr. 5 in UTC
laufen die Unit-Tests dann einmal mit `TZ=Europe/Berlin` (P4.2/P10.1; in UTC laufen sie in `test:coverage`). Lint, Typen,
statische Prüfungen, Migrationen + Drift, Geheimnis-Scan und `pnpm audit` laufen immer. Ohne Kennung (z. B.
Dependabot-PR) und bei `workflow_dispatch` läuft `quick` vollständig wie in der Tabelle.

### 6.4 `ci-full.yml`

| Job | Inhalt | Gate |
|---|---|---|
| `e2e-full` | ab P3.16 Matrix je Playwright-Projekt `desktop`, `iphone-15` (WebKit), `pixel-7` (je Projekt zwei Playwright-Hälften `--shard=1/2`/`2/2`, also sechs parallele Jobs, `fail-fast: false`): je Job ein Build (`NEXT_PUBLIC_LEASH_DEBUG=1`), dann das Projekt mit allen Tests außer `@visual`, `@perf`; enthält die Suiten `@a11y` (axe, §7.5) und `@privacy` (No-Cookie, No-Third-Party, §7.4 T-03/T-04). Grund: ~1 400 Tests bräuchten nacheinander mit einem Worker ~55 min (> `timeout-minutes: 40`). Seit P14.13 kommt die Projektliste aus dem Job `mode` (Ausgabe `projects`): Phasenende `[ci:full pN]` und Dispatch alle drei, Zwischenlauf `[ci:full]` nur `desktop` und `iphone-15` (vier Jobs); dann prüft `desktop 1/2` zusätzlich mit `--project=pixel-7` das Kunst-Dauer-Gate (`art-gate.e2e.spec.ts`, KUNST-QA §9) und `purchase/reservation.e2e.spec.ts` (AK-3-10 läuft nur auf pixel-7). Die Unit-Tests mit `TZ=Europe/Berlin` liefen bis P14.12 in jedem dieser Jobs (6×), seit P14.13 einmal in `quick` (§6.3). Ein gemeinsamer Build als Artefakt lohnt nicht: Seed + Build dauern dank `.next/cache` ~1 min, Hoch-/Herunterladen von `.next` ebenso lange und belastete den Artefakt-Speicher | alle grün |
| `quality` (Ergänzung P14.13) | `pnpm test:coverage` ist der einzige Lauf der Integrationstests beim vollen Lauf (§6.3 Kurzform); der Schritt „Bundle-Budgets“ führt zusätzlich `pnpm check:external --built` aus | alle grün |
| `quality` | Produktions-Build **ohne** Debug-Schalter; `pnpm check:no-debug` (String `__leash` kommt im Build nicht vor, DESIGN §9.13); `pnpm test:visual` (Chromium, §7.6); `pnpm test:perf` (Lighthouse-CI, §7.7); `pnpm test:e2e --grep @perf --project=pixel-7` (INP-Ersatzmessung) | alle grün |
| `docker` (ab P10) | `docker build` (Standalone, `BUILD_WITHOUT_DB=1`), `docker compose -f docker-compose.prod.yml up -d` mit Testwerten, warten auf `/api/health`, `GET /de` = 200, `down -v` (§13) | grün |
| `snapshots` | nur bei `[ci:update-snapshots]` bzw. Dispatch mit `update_snapshots = true`: Produktions-Build ohne Debug-Schalter, `pnpm test:visual --update-snapshots` (ab P9 zusätzlich die Standbild-Referenzen aus `tests/art/`, KUNST-QA §8), Upload der Referenzordner als Artefakt `visual-snapshots-<sha7>` (`retention-days: 2`, Pflicht-Upload) | Upload vorhanden |

Alle Jobs hängen am Job `mode` (`needs: mode`, §6.2): `e2e-full`, `quality` und `docker` laufen nur, wenn der
PR-Kopf-Commit `[ci:full` enthält (bzw. bei Dispatch ohne `update_snapshots`); `snapshots` läuft nur in seinem Fall.
Phasen-Kennung: Aus `[ci:full p3]` wird `p3` gelesen (Regex `\[ci:full\s+(p\d+)\]`); fehlt sie (Zwischenlauf
`[ci:full]`, Dispatch), gilt `px`.

### 6.5 `preview-export.yml` (KONZEPT §12.8)

Läuft nur am **Phasenende** (PR-Kopf-Commit mit `[ci:full pN]`, §6.2, §6.7) oder per `workflow_dispatch` – nicht bei
Zwischenläufen `[ci:full]` und nie auf `main`. Schritte (Job mit Postgres-Service): Kennung (§6.2; ohne `[ci:full pN]`
werden alle weiteren Schritte übersprungen) → Installation → Playwright Chromium (ab P10 zusätzlich WebKit für den Portabilitätstest,
§14.10) → `pnpm preview:export` (`PREVIEW_PHASE` aus der Kennung, §14.9) → `pnpm test:preview-export` →
`actions/upload-artifact` mit Name `planet-claire-vorschau-<phase>-<sha7>` (Dateien: HTML + `report.json`),
`retention-days: 30` → Aufräumen: ältere Artefakte mit Präfix `planet-claire-vorschau-` löschen, sodass höchstens die **3
neuesten** bleiben (`gh api -X DELETE /repos/{owner}/{repo}/actions/artifacts/{id}`, `permissions: actions: write`) →
Job-Summary mit deutscher Kurzanleitung → bei PRs Kommentar anlegen/aktualisieren („Neue Vorschau-Datei für Phase P3:
Seite **Checks → Summary → Artifacts**, ZIP herunterladen, entpacken, `planet-claire-vorschau.html` doppelklicken. Nur
privat ansehen, nicht weitergeben, nicht veröffentlichen – interne Vorschau mit Beispieldaten und Platzhalter-Rechtstexten.“;
`permissions: pull-requests: write`; R-182; die PR-Nummer kommt aus dem Ereignis (`github.event.pull_request.number`),
bei `workflow_dispatch` aus `gh pr list --head <branch> --state open`). Ein roter Export-Test blockiert den Merge der
Phase ab P2; bei Fehlschlag gibt es keinen Vorschau-Upload, nur den Fehlerbericht nach dem Budget-Schritt (§6.2).

### 6.6 `release.yml` (finale Vorschau, P10)

`.github/vorschau-release.json` enthält `{ "tag": "vorschau-p10", "title": "Planet Claire – Vorschau (Stand P10)",
"notesDe": "…" }`; `notesDe` enthält die Öffnen-Anleitung (ANLEITUNGEN V1), den Hinweis „Nur privat ansehen, nicht
weitergeben, nicht veröffentlichen“ (R-182; das Repository bleibt privat) und eine Zeile „Stand: TT.MM.JJJJ“. Jeder PR,
der die finale Vorschau ändert – spätestens der PR mit dem Abschlussbericht (PLAN P10.22) –, aktualisiert die
„Stand“-Zeile.

**Auslöser** (§6.2): jeder `push` auf `main` (außer Juttas Upload-Ordnern), täglich 06:00 UTC per `schedule` als Rückfall
(greift, falls ein Push-Lauf ausfiel) und `workflow_dispatch`. Veröffentlicht wird **nur**, wenn der Plan leer ist und das
Release fehlt oder veraltet ist; sonst endet der Lauf nach dem Job `gate` (Sekunden). `concurrency: { group: release,
cancel-in-progress: false }` (Push- und Zeitplan-Lauf nie gleichzeitig). Jobs:

0. `gate` (`permissions: contents: read`, Checkout nur von `PLAN.md`, `scripts/cloud-setup.sh` und
   `.github/vorschau-release.json`): `bash scripts/cloud-setup.sh --plan-status`; zeigt die Ausgabe nicht
   `OFFEN_P1_P10=0`, Ausgabe `publish=false` mit Job-Summary „Plan noch nicht leer – nichts zu tun“. Sonst
   `gh release view <tag> --json assets,body`: fehlt das Release oder das Asset `planet-claire-vorschau.html`, oder
   enthält der Release-Text nicht den Vermerk `<!-- vorschau-config: <h> -->` mit `<h>` = die ersten 12 Zeichen des
   SHA-256 der aktuellen `vorschau-release.json`, ist das Release veraltet → `publish=true`; sonst `publish=false` mit
   „Release aktuell – nichts zu tun“. Da jede neue „Stand“-Zeile die Datei ändert, veröffentlicht der nächste Lauf nach
   jedem solchen Merge neu.
1. `publish` (`needs: gate`, nur bei `publish=true`; `permissions: contents: write`): Postgres-Service,
   `pnpm preview:export`, `pnpm test:preview-export` inkl. Portabilitätstest (§14.10), dann
   `gh release create <tag> dist/planet-claire-vorschau.html --title … --notes …` (existiert der Tag:
   `gh release upload <tag> dist/planet-claire-vorschau.html --clobber` und `gh release edit <tag> --notes …`); der
   Dateiname des Assets bleibt `planet-claire-vorschau.html`, nicht gezippt; SHA-256 der Datei als Job-Ausgabe. Die
   Notizen sind `notesDe`, die Dateigröße in MB und am Ende der unsichtbare Vermerk `<!-- vorschau-config: <h> -->`.
   Ist die Datei größer als 20 MB (`report.json` → `budget.result = 'warn'`, §14.8), hängt `publish` an `notesDe` den Satz
   „Die Datei ist zu groß für eine Mail – per Link oder USB-Stick auf einen anderen eigenen Rechner bringen.“ an (passt zu
   R-182 „nicht weitergeben“, Anhang C C-27).
2. `verify-asset` (`needs: publish`): frischer Runner, frischer Checkout ohne Postgres und ohne Build, nur Abhängigkeiten
   und Playwright-Browser; `gh release download <tag> --pattern planet-claire-vorschau.html --dir dist`, SHA-256 mit der
   Ausgabe von `publish` vergleichen, dann nur den Portabilitätstest (§14.10) gegen die heruntergeladene Datei – Nachweis
   „läuft auf einem anderen Rechner“.

**Probelauf im PR:** Ändert ein Pull Request `release.yml` oder `vorschau-release.json`, laufen nur Export und Tests (ohne
Veröffentlichung, ohne `verify-asset`, ohne `contents: write`); ein Unit-Test prüft Schema, Tag, Asset-Namen und
Hinweis-Satz der JSON-Datei. Seit P14.13 liest der Probelauf zuerst die Kennung des Kopf-Commits: Bei `[ci:full pN]`
exportiert und testet `preview-export.yml` dieselbe Datei mit denselben Befehlen, bei `[ci:art]`/`[ci:update-snapshots]`
folgt vor dem Merge ohnehin ein Phasenende-Lauf – dann prüft der Probelauf nur die Konfiguration (~3 statt ~9 min). Spätere Stände: neuer Tag `vorschau-JJJJ-MM-TT`. Die HTML-Datei wird nie committet (`dist/`
in `.gitignore`, KONZEPT AK-12-02).

**Rückfall:** Squash-Nachrichten auf `main` enthalten nie `[skip ci]` (§6.7 Nr. 3), der Push nach dem P10-Merge startet
also `release.yml`. Fällt dieser Lauf trotzdem aus, veröffentlicht der nächste `schedule`-Lauf (spätestens am folgenden
Morgen, 06:00 UTC); P11.1 prüft `publish`, `verify-asset` und das Asset und startet notfalls
`gh workflow run release.yml --ref main`.

### 6.7 Branch-, PR- und Merge-Regeln (E-97, CLAUDE.md §3)

1. Jede Cloud-Session arbeitet auf ihrem Arbeitsbranch (`claude/…`) mit **höchstens einem offenen** PR gegen `main`
   (Titel „P<n>…P<m>: <Titel>“, Beschreibung Deutsch, nach jeder Phase aktualisiert; Vorlage
   `.github/pull_request_template.md` mit Abschnitten: Phase(n), erledigte Aufgaben, AK-Nachweise, Tests,
   Doku-Änderungen, neue Einträge in `docs/OFFENE-PUNKTE.md`, Link zur Vorschau-Datei, Stand des Minuten-Wächters).
   Nach einem Squash-Merge darf dieselbe Session vom selben Branch einen neuen PR öffnen. Der PR ist spätestens vor dem
   ersten CI-Lauf einer Phase offen (Entwurf genügt), denn die CI-Workflows laufen nur über `pull_request` (§6.2).
   PR-Titel und PR-Beschreibung enthalten **nie** `[skip ci]` (auch nicht als Erklärung), weil GitHub sie beim Merge per
   Knopf als Squash-Nachricht übernimmt (Nr. 3).
2. **CI-Disziplin (gilt ab P1):** GitHub-CI ist die Abschlusskontrolle, nicht der Entwicklungs-Loop. **Vor jedem Commit**
   laufen die Prüfungen lokal in der Session: `pnpm check`, `pnpm test:int`, die betroffenen E2E-Tests, bei UI-Änderungen
   zusätzlich `pnpm build` (Gates G1/G2, §7.9). Commit-Form: Conventional Commits auf Englisch mit der Aufgaben-ID als
   Scope und genau einer Kennung:
   - **Zwischen-Commits** (nach einzelnen Aufgaben, Sicherung laufender Arbeit): `[skip ci]`, z. B.
     `feat(P1.4): add enums, money and time helpers [skip ci]` → kein Workflow.
   - **Phasenende:** `[ci:full pN]`, z. B. `chore(P3): finish phase [ci:full p3]` → `ci.yml` (`quick`), ab P2 zusätzlich
     `ci-full.yml` und `preview-export.yml`.
   - **Zwischenlauf:** höchstens **einer je Phase**, nur bei riskanten Aufgaben (Kasse, Reservierung, Webhooks, Belege):
     `[ci:full]` → `quick` und `ci-full.yml`, kein Export.
   - **Referenzbilder:** `[ci:update-snapshots]` (§7.6) nur, wenn sich visuelle Referenzen ändern → nur Job `snapshots`
     (kein `quick`); gleichwertig: `gh workflow run ci-full.yml --ref <branch> -f update_snapshots=true` (geht, sobald
     `ci-full.yml` auf `main` liegt).
   - **Kunst-QA (nur P9):** `[ci:art]` → nur `art-qa.yml` (KUNST-QA §9); ein leerer Commit genügt
     (`git commit --allow-empty -m "chore(P9.18a): run art-qa [ci:art]"`). P9 ist von der Grenze „höchstens ein
     Zwischenlauf je Phase“ ausgenommen; die Anzahl begrenzt die KUNST-QA-Obergrenze (12 Iterationen, KUNST-QA §6.6).
   - **Merge von `main` in den Arbeitsbranch:** `git merge origin/main -m "chore: merge main [skip ci]"`.
   Ein Commit ohne Kennung würde `quick` starten und ist nicht vorgesehen. Ab 1.500 Minuten im Monat entfallen
   Zwischenläufe, Referenzbild-Läufe und eigene `[ci:art]`-Läufe (Minuten-Wächter, §6.8); in P9 läuft `art-qa.yml` dann
   einmal mit dem Phasenende, indem die Session vorher das Label `art` setzt.
3. **Merge-Regel:** Maßgeblich für den Merge und für das Häkchen „CI grün“ ist der **letzte Commit ohne `[skip ci]`**;
   er muss der Phasenende-Commit `[ci:full pN]` sein (ist es ein `[ci:full]`-, `[ci:update-snapshots]`- oder
   `[ci:art]`-Commit, folgt vor dem Merge ein neuer Phasenende-Commit). Gemergt wird nur, wenn für ihn `CI / quick` und
   (ab P2) alle Jobs aus `ci-full.yml` und `export` grün sind **und** danach nur reine Doku-Commits mit `[skip ci]` folgen, die
   ausschließlich `PLAN.md`, `docs/FORTSCHRITT.md` und `docs/OFFENE-PUNKTE.md` ändern (Prüfung:
   `git diff --name-only <sha>..HEAD`). Das Häkchen „CI grün“ in `PLAN.md` setzt ein solcher Doku-Commit, **nachdem** der
   Lauf grün ist; ändert sich danach noch etwas anderes, braucht es einen neuen Phasenende-Commit. Squash-Merge immer mit
   ausdrücklicher Nachricht: `gh pr merge <nr> --squash --subject "<PR-Titel>" --body "<Kurzfassung>"` (REST-Ersatz
   CLOUD-SETUP §3.5). Die Nachricht enthält **nie** `[skip ci]` – in keiner Phase: Auf `main` startet sie nur
   `release.yml` (§6.2, §6.6), das ohne leeren Plan nach Sekunden endet. Danach
   `git fetch origin && git merge origin/main -m "chore: merge main [skip ci]"` in den Arbeitsbranch und weiterarbeiten
   (Merge-Commits von `main` in den Arbeitsbranch dürfen `[skip ci]` tragen). Wer nicht mergen darf: ganz oben im PR-Text
   „Bitte mergen – CI ist grün“ mit Link zum grünen Lauf und Kurz-SHA des geprüften Commits. Mergt Jutta per Knopf,
   nimmt GitHub dank ihrer einmaligen Einstellung (Settings → General → Pull Requests → „Allow squash merging“ →
   Auswahl „Default to pull request title and description“, CLOUD-SETUP §1) PR-Titel und PR-Beschreibung als
   Squash-Nachricht, nicht die Commit-Liste – deshalb gilt Nr. 1 (kein `[skip ci]` in Titel und Beschreibung).
4. Mit GitHub Pro (optional, Anhang C C-03): Branch-Schutz für `main` – PR Pflicht, nur Squash, kein Force-Push, kein
   Löschen, 0 Pflicht-Reviews. **Keine Pflicht-Checks**, solange Doku-Commits mit `[skip ci]` den Kopf eines PRs bilden
   (Nr. 3): GitHub ließe übersprungene Pflicht-Checks auf „Pending“ stehen und sperrte den Merge. Die Merge-Regel Nr. 3
   bleibt Arbeitsregel.
5. Migrationen sind **rückwärtsverträglich** (erst erweitern, später aufräumen): Eine Migration darf nie Spalten
   entfernen oder umbenennen, die der zuletzt deployte Code noch liest. Grund: Vercel „Instant Rollback“ rollt nur Code
   zurück, nicht die Datenbank.

### 6.8 Minuten-Budget und Minuten-Wächter

GitHub rechnet je Job auf volle Minuten auf; parallele Jobs zählen einzeln. Schätzung für **P1–P10 zusammen** (Aufgaben
laufen dank `[skip ci]` ohne CI, §6.7 Nr. 2; auf `main` läuft bis zum P10-Merge nichts, §6.2):

| Posten | Annahme | Minuten |
|---|---|---|
| Phasenende P1 | nur `quick` (`ci-full` ist in P1 ein Gerüst nur mit `workflow_dispatch`, Export erst ab P2) | ~15 |
| Phasenende P2–P10 | 9 × (`quick` ~15 + `e2e-full` ~30 (ab P3: 3 Matrix-Jobs zusammen ~60) + `quality` ~20 + `export` ~12 + `mode` ~1); P10 zusätzlich `docker` ~10, Release-Probelauf ~15 und `restore-drill` im PR ~10 | ~740 (ab P3 real ~1 000) |
| Wiederholung roter Phasenende-Läufe | ~3 × ~40 (`gh run rerun <id> --failed` wiederholt nur die roten Jobs) | ~120 |
| Zwischenläufe `[ci:full]` | höchstens 1 je Phase, realistisch P4, P5, P6 × ~65 | ~195 |
| Referenzbilder `[ci:update-snapshots]` bzw. Dispatch (§7.6) | ~3 × ~15 (nur Job `snapshots`, kein `quick`) | ~45 |
| KUNST-QA `[ci:art]`, Label oder Dispatch (P9) | realistisch ~4 × ~25 (nur für Bündel aus CI, KUNST-QA §9; Obergrenze 12 Iterationen, KUNST-QA §6.6) | ~100 |
| Kennung lesen (übersprungene Workflows, §6.2) | ~40 Pushes ohne `[skip ci]` × ~2 | ~80 |
| Dependabot-Sicherheits-PRs (`quick`) | ~4 × ~15 | ~60 |
| `release.yml` auf `main` (ab dem P10-Merge) | einmal `publish` + `verify-asset` ~20; `gate` je Push und täglich ~1 bis P11 | ~50 |
| **Summe** | | **≈ 1.405** (Ziel ≤ 1.500) |

**Stand P14.13 (U-62): gemessen und geschätzt.** Mit dem vollen Beispielbestand und den Ergänzungen aus P12/P13 lag ein
Lauf weit über den Annahmen oben. Gemessen am grünen P13-Phasenende (Läufe vom 08.10.2026, Commit `a46b29c`; je Job auf
volle Minuten aufgerundet):

| Posten (Phasenende `[ci:full pN]`) | vorher (gemessen) | nachher (geschätzt) | Änderung P14.13 |
|---|---|---|---|
| `ci.yml` `quick` | 56 (davon Int-Tests 32, Rauchtest 15, Build + Budgets 2,5) | ~8 | Kurzform §6.3: Int-Tests, Build/Budgets, Rauchtest laufen nur noch in `ci-full.yml` |
| `ci-full.yml` `mode` | 1 | 1 | – |
| `ci-full.yml` `e2e-full` (6 Jobs) | 155 (28 + 17 + 35 + 28 + 30 + 17) | ~143 | Unit-Tests in Berliner Zeit einmal in `quick` statt 6× (je 1,6–2,4 min) |
| `ci-full.yml` `quality` | 55 (davon Abdeckung 37, visuell 9) | ~56 | + `check:external --built` (Sekunden) |
| `ci-full.yml` `docker` | 4 | 4 | – |
| `preview-export.yml` | 8 | 8 | – |
| `release.yml` Probelauf (PR ändert `vorschau-release.json`) | 9 | ~3 | Export/Test nur, wenn `preview-export.yml` ihn nicht ohnehin ausführt (§6.6) |
| `art-qa.yml` (nur Kennung) | 1 | 1 | – (mit `[ci:art]`/Label `art` zusätzlich ~47) |
| **Summe Phasenende** | **≈ 289** | **≈ 224 (−22 %)** | |
| **Zwischenlauf `[ci:full]`** (ohne Export, mit Probelauf) | ≈ 282 | ≈ 188 (−33 %) | zusätzlich ohne die zwei pixel-7-Jobs (−47 min), dafür ~4 min pixel-7-Gates in `desktop 1/2` |

Der größte Kostentreiber waren **Wiederholungen roter Läufe**: Im P13-Abschluss lief `ci-full.yml` viermal (dreimal rot
durch Wackel-Tests bzw. kleine Fehler), also ≈ 4 × 289 ≈ 1.150 min für ein Phasenende. Mit der Kurzform kostet jede
Wiederholung ≈ 224 statt 289 min; P14.13 stabilisiert außerdem die beobachteten Wackler (Unit-RPC-Abbruch,
`check:bundle`-Zeitabhängigkeit, feste Wartezeiten in E2E) und senkt `retries` auf 1 (§7.2). Für eine Phase mit einem
Zwischenlauf und einem Phasenende, das einmal wiederholt werden muss, ergibt das ≈ 282 + 2 × 289 ≈ 860 min vorher und
≈ 188 + 2 × 224 ≈ 636 min nachher (−26 %); entfällt die Wiederholung dank stabiler Tests, ≈ 412 min (−52 %).
Gemessen wurde auf den 4-vCPU-Runnern des (noch) öffentlichen Repositorys. Die
Phasenende-Prüfung selbst bleibt vollständig: jede Prüfung (Lint, Typen, statisch, Unit UTC + Berlin, Migrationen/Drift,
Int + Abdeckung, Build-Budgets, Fremd-URL-Scan, alle E2E auf allen drei Geräteprofilen, visuell, Lighthouse, INP, Docker,
Export, Geheimnis-Scan, audit) läuft genau einmal.

Bewusst **nicht** umgesetzt: (a) Build einmal bauen und als Artefakt verteilen – Seed + Build dauern dank `.next/cache`
nur ~1 min je Job, Hoch-/Herunterladen von `.next` ebenso lange, und es belastete den Artefakt-Speicher (500 MB, §6.1);
(b) mehrere Playwright-Worker in `e2e-full` – einige Specs ändern gemeinsame Daten (z. B. `empty-states`, globale
Einstellungen); (c) pixel-7 auch am Phasenende auf eine Teilmenge beschränken (weitere ~45 min) – nur nach Entscheidung,
siehe `docs/OFFENE-PUNKTE.md`. **`release.yml`-Zeitplan:** Der tägliche `gate`-Lauf (06:00 UTC, ~10 s, abgerechnet 1 min)
kostet ~30 min im Monat; er bleibt als Rückfall für einen ausgefallenen Push-Lauf (§6.6). **Hinweis zum privaten
Repository (U-63):** Für öffentliche Repositories rechnet GitHub keine Minuten ab und stellt 4 vCPU bereit; nach der
Umstellung auf privat zählen die Minuten (2.000/Monat) und die Runner haben 2 vCPU – die gemessenen Laufzeiten können
dann deutlich länger werden. Den tatsächlichen Stand zeigt `pnpm ci:minutes`.

**Minuten-Wächter** (`pnpm ci:minutes` = `tsx scripts/ci/minutes.ts`, §6.10, Aufgabe P1.33a): summiert die abrechenbaren
Minuten des laufenden Kalendermonats (UTC) über alle Läufe des Repositorys – Liste per
`gh api "repos/{owner}/{repo}/actions/runs?created=>=<JJJJ-MM>-01&per_page=100" --paginate`, je Lauf
`gh api repos/{owner}/{repo}/actions/runs/<id>/timing` (Summe über `billable.UBUNTU.job_runs[].duration_ms`, je Job auf
volle Minuten aufgerundet; fehlt `billable`, ersatzweise `…/runs/<id>/jobs` mit `completed_at − started_at` je Job,
ebenfalls aufgerundet). Ausgabe: `MINUTEN_MONAT=<n>` und `MINUTEN_STATUS=ok|knapp|erschoepft|unbekannt` (`knapp` ab 1.500,
`erschoepft` ab 2.000 Minuten); Exit-Code immer 0. Scheitert die Abfrage (kein `gh`, fehlende Rechte, kein Netz), gilt
`MINUTEN_STATUS=unbekannt` (wird wie `knapp` behandelt) mit deutscher Meldung und
Vermerk im PR-Text. Das Skript ruft nur lesende Endpunkte auf; die API-Aufrufe sind für den Test injizierbar. Die Session
ruft es zu Beginn und vor jedem Push ohne `[skip ci]` auf und trägt den Stand in den PR-Text ein.

- **`knapp`/`unbekannt` (ab 1.500 Minuten oder bei API-Fehler):** bis Monatsende nur noch Phasenende-Läufe – keine Zwischenläufe
  `[ci:full]`, keine Referenzbild-Läufe, keine eigenen `[ci:art]`-Läufe (§6.7 Nr. 2), Dependabot-PRs warten; Hinweis oben
  im PR-Text „CI-Minuten fast aufgebraucht – bis Monatsende nur Phasenende-Läufe“.
- **`erschoepft`** (`MINUTEN_MONAT` ≥ 2000; CI startet nicht mehr): nicht mergen (E-97), lokal weiter prüfen
  (§6.7 Nr. 2), Eintrag in `docs/OFFENE-PUNKTE.md`; die Arbeit geht auf dem Branch weiter, der Phasenende-Lauf folgt im
  nächsten Monat.

### 6.9 Deployment ab P11

Vercel-Git-Integration: Push auf `main` → Produktion, `staging` → Staging, PR → Preview (§4.7). Build: `pnpm payload
migrate && pnpm build`. Rückweg: Vercel „Instant Rollback“ auf das letzte grüne Deployment (nur bei rückwärtsverträglicher
Migration, §6.7 Nr. 5), sonst Hotfix-PR. Details im RUNBOOK (P10).

### 6.10 Skript-Namen (verbindlich)

| Gruppe | Skripte (Datei, ab Phase) |
|---|---|
| Entwicklung | `dev`, `build`, `start`, `lint`, `typecheck`, `format`, `format:check`, `generate:types`, `generate:importmap`, `payload` |
| CI-Hilfen | `ci:minutes` (`scripts/ci/minutes.ts`, Minuten-Wächter §6.8, P1.33a; gleichwertig `pnpm exec tsx scripts/ci/minutes.ts`), `ci:artifacts` (`scripts/ci/artifact-budget.ts`, Budget-Schritt §6.2, P1) |
| Prüfungen | `check` (= `lint` + `typecheck` + `check:static` + `test:unit`), `check:static` (`scripts/check-static.ts`; Teilprüfungen u. a. Versionen, `.env.example`, i18n-Parität, Routen-Registry, Stripe-Importe, Fremd-URLs, Aktualität von `src/lib/legal/services.generated.ts`), `check:versions` (`scripts/check-versions.ts`, §1.3; auch Teil von `check:static`), `check:migrations` (`scripts/check-migration-drift.ts`), `check:bundle`, `check:external`, `check:no-debug`, `check:golive` (Startklar-Prüfung R-210/KONZEPT §7.16/DATENMODELL §13.7, Exit-Code ≠ 0 bei jedem roten Punkt; P10), `handbook:shots` (`scripts/handbook/shots.ts`: Handy-Bildschirmfotos der Verwaltung und dreier öffentlicher Seiten für das Handbuch → `docs/owner/img/handbuch/*.webp`, nur lokal gegen die Test-Datenbank mit Beispielbestand, P10.17), `env:example` (`scripts/gen-env-example.ts`), `legal:services` (`scripts/legal/gen-services.ts`: DIENSTE-YAML → `src/lib/legal/services.generated.ts`, P6.21) |
| Tests | `test` (= `test:unit` + `test:int`), `test:unit`, `test:int`, `test:e2e`, `test:visual`, `test:perf`, `test:preview-export`, `test:coverage` |
| Daten | `seed` (= `seed:base` + `seed:example`), `seed:base`, `seed:example [--only=<collection,…>] [--refresh-media]`, `seed:remove [--yes] [--drop-texts]` (ohne `--yes` nur Mengenvorschau), `seed:reset` (= `seed:remove --yes --drop-texts` + `seed:base` + `seed:example`; nur Entwicklung, Test, Vorschau-Export), `seed:import-instagram` (`scripts/seed/import-instagram.ts`, P8), `db:ensure`, `db:reset --test [--seed=none\|base\|all]` (Standard `base`) (nur dev/test), `db:mark-production`, `media:regenerate` |
| Betrieb | `jobs:run [task] [--now=<ISO>]` (`scripts/jobs-run.ts`), `admin:create`, `admin:unlock` (`scripts/admin-*.ts`), `backup:run`, `backup:restore`, `backup:verify`, `retention:replay`, `payments:reconcile [--since=<ISO>]`, `stripe:fixture <name>` |
| Vorschau/Kunst | `preview:export`, `fonts:copy` (`scripts/fonts/copy.ts`: WOFF2 kopieren, bei Bedarf per `subset-font` beschneiden, ab P3 TTF für OG-Bilder per WOFF2→TTF-Wandler, §1.2, DESIGN §4.1), `art:brand` (`scripts/art/build-brand.ts`: Wortmarke, `icon.svg`, `favicon.ico`, `apple-icon.png`, `public/og/default.png` aus `src/art/`, P2.5), `art:icons` (`scripts/art/build-icons.ts`: `src/art/icons/*.svg` → `src/components/icons/icons.generated.ts`, P2.5), `art:build` (`scripts/art/art-build.ts`: QA-Build nach `.next-art` mit `NEXT_PUBLIC_LEASH_DEBUG=1 ART_QA=1`, P9.2), `art:record` (`scripts/art/record.ts`, `playwright.art.config.ts`, Server `localhost:3200`, P9.2), `art:compare` (`scripts/art/compare-runs.ts`: `reduced`-Standbilder zweier Läufe pixelgleich, P9.2), `art:metrics` (`scripts/art/metrics.ts`: SC-18 → `metrics/perf.json`, P9.4), `art:sheets`, `art:check`, `art:bundle`, `art:vectorize` (`scripts/art/vectorize.ts`: `content/art/sources.json` → `src/art/stations/*.svg` + `stations.generated.ts`, P8.14), `art:sprite` (`scripts/art/build-sprite.ts`: Coco-Sprite → `public/art/coco-sprite.v{N}.svg` + `src/art/coco/coco-sprite.json`, P2.18; KUNST-QA §3.3), `art:coco` (`scripts/art/draw-coco.ts`: Coco-Zeichnungen aller 22 Symbole nach dem Charakterblatt, P9.9/P9.10; ersetzt den Platzhalter-Generator aus P2.18), `art:character-sheet` (`scripts/art/character-sheet.ts`: `content/art/coco/character-sheet.svg` + `.webp`, nie ausgeliefert, P9.8), `art:calibration` (`scripts/art/calibration-sheet.ts`: Kalibrierbogen, P2.18), `art:coco-refs` (`scripts/art/coco-refs.ts`, P8), `art:placeholders` (`scripts/art/placeholders.ts`, P8), `art:space` (`scripts/art/build-space.ts`: Weltraum-Motive `src/art/space/*.svg` → Laufzeit-Daten, P9.12), `art:admin-icons` (`scripts/art/admin-icons.ts`: Verwaltungs-Icons, P2/P9) |
| Doku | `handbook:shots` (`scripts/handbook/shots.ts`, P10) |

- Alle `seed*`-Befehle laufen über `payload run scripts/seed/cli.ts -- <base|example|remove|reset|all>` (SEED-SPEC §1.4);
  zerstörerische Befehle beachten die Produktionssperre (§4.8).
- Hilfsskripte ohne eigenen Namen (z. B. `scripts/art/build-brand.ts`, `scripts/art/admin-icons.ts`,
  `scripts/art/calibration-sheet.ts`, `scripts/legal/briefing-screenshots.ts`,
  `scripts/fixtures/*.ts`) laufen mit `pnpm exec tsx <datei>`. Braucht CI oder ein Fachdokument einen festen Aufruf, bekommt
  das Skript einen Namen – im selben PR in diese Tabelle eintragen. Namen, die hier fehlen, gibt es nicht.

**AK-A-6-01** Verhalten laut Kennungstabelle §6.2 (bei offenem PR): Ein Push mit `[ci:full p2]` startet `quick`, die
Jobs von `ci-full.yml` und `export`; ein Push mit `[ci:full]` startet `quick` und `ci-full.yml`, `preview-export.yml`
arbeitet nicht; ein Push mit `[ci:update-snapshots]` startet in `ci-full.yml` nur den Job `snapshots` und keinen
`quick`; ein Push mit `[ci:art]` startet nur `art-qa.yml` (ab P9); ein Push mit `[skip ci]` startet keinen Workflow; ein
Push ohne Kennung startet nur `quick`. Ein Push auf `main` startet nur `release.yml` (ab P10; nicht, wenn er nur
`content/seed/instagram-export/**` oder `content/seed/coco/**` ändert). Nachweis: `tests/unit/ci/workflows.unit.spec.ts`
prüft Auslöser und Bedingungen der YAML-Dateien; die Phasenende-Läufe belegen es in CI.
**AK-A-6-02** Nach einem erfolgreichen Export existieren höchstens 3 Artefakte mit Präfix `planet-claire-vorschau-`;
Fehlerberichte haben `retention-days: 2`, und bei einer Artefakt-Summe ≥ 350 MB entfällt ihr Upload (Unit-Test von
`scripts/ci/artifact-budget.ts` mit aufgezeichneten API-Antworten).
**AK-A-6-03** `pnpm ci:minutes` gibt für aufgezeichnete API-Antworten (Fixture, ohne Netz) die erwartete Monatssumme mit
Aufrundung je Job aus (nur Läufe des laufenden UTC-Monats; ohne `billable` dieselbe Summe über die Job-Zeiten), meldet
ab 1.500 Minuten `MINUTEN_STATUS=knapp`, ab 2.000 `erschoepft` und bei einem API-Fehler `unbekannt` mit deutscher Meldung
(`tests/unit/ci/minutes.unit.spec.ts`, P1.33a).

---

## 7. Teststrategie und Gates

### 7.1 Testebenen

| Ebene | Werkzeug | Dateien | Umgebung | Läuft in |
|---|---|---|---|---|
| Unit | Vitest (`vitest.unit.config.mts`, `environment: node`; Komponenten-Tests mit `jsdom` per Datei-Kommentar) | `tests/unit/**/*.unit.spec.ts` | ohne DB, ohne Netz, feste Uhr | lokal vor jedem Commit, `quick` |
| Integration | Vitest (`vitest.config.mts`, `environment: node` seit P0), Payload Local API gegen Postgres | `tests/int/**/*.int.spec.ts` | `DATABASE_URL_TEST`, frisch migriert, standardmäßig `fileParallelism: false`; mit `PC_INT_WORKERS=n` (CI: 3) laufen n Dateien parallel, je Worker eine Datenbankkopie `<name>_w<n>_test` und ein eigener Mail-Ausgang (`tests/int/setup/workers.ts`) | lokal, `quick` |
| Kontrakt | Vitest | `tests/int/adapters/*.contract.int.spec.ts` | Mock immer; echte Treiber nur mit Zugang bzw. MinIO/Mailpit/stripe-mock | lokal, `quick` (Mocks) |
| E2E | Playwright (`playwright.config.ts`) | `tests/e2e/**/*.e2e.spec.ts`, Tags `@smoke @a11y @privacy @perf @slow` | App mit Seed, `E2E_SERVER=dev` lokal / `start` in CI | lokal, `quick` (`@smoke`), `ci-full` |
| Visuell | Playwright `toHaveScreenshot` | `tests/visual/*.visual.spec.ts` | Chromium, Linux-Referenzen | `ci-full` |
| Tempo | Lighthouse-CI + Playwright `@perf` | `tests/perf/` | Produktions-Build ohne Debug | `ci-full` |
| Vorschau-Datei | Playwright gegen `file://` | `tests/e2e/preview-export.e2e.spec.ts`, ab P10 `tests/e2e/preview-portable.e2e.spec.ts` (beide `pnpm test:preview-export`, §14.10) | offline | `preview-export.yml`, `release.yml` |
| Kunst-QA | Playwright + Skripte | `tests/art/*.art.spec.ts` (`playwright.art.config.ts`) | KUNST-QA §4 | P9, `art-qa.yml` |

### 7.2 Determinismus und Testdaten

- **Datenbank:** `pnpm test:int` und `pnpm test:e2e` rufen vorher `db:ensure` und `db:reset --test` (Schema `public` leeren,
  `payload migrate`, eigenes SQL, `seed:base`; E2E zusätzlich `seed:example`) gegen `DATABASE_URL_TEST`. Der Reset verweigert
  jede DB, deren Name nicht auf `_test` endet oder die als Produktion markiert ist (§4.8); Namensregel und `APP_ENV`
  prüft er vor dem Verbindungsaufbau.
- **Int-Tests unabhängig von der Reihenfolge:** Das globale Vitest-Setup sichert den Stand nach dem Reset in das Schema
  `pc_test_baseline`; vor jeder Int-Testdatei stellt `tests/int/setup/restore.ts` ihn wieder her (Tabellen leeren,
  Daten und Sequenzstände zurückspielen). Jede Datei beginnt so im Zustand „nach `db:reset --test`“ – auch in CI, wo die
  Reihenfolge der Dateien mangels Vitest-Cache eine andere ist als lokal.
- **E2E gegen den Produktions-Build (`E2E_SERVER=start`):** `next build` backt den Datenbank-Stand zur Build-Zeit in die
  vorgerenderten Seiten; der anschließende Reset (Seed revalidiert nie) oder ein Build gegen eine andere DB ließe den ersten
  Aufruf den alten Stand zeigen. `tests/e2e/global-setup.ts` erzeugt deshalb nach dem Serverstart jede ISR-Route aus
  `prerender-manifest.json` per On-Demand-Revalidierung (`x-prerender-revalidate`) neu und bricht ab, wenn eine nicht
  `REVALIDATED` meldet.
- **E2E-Fixtures:** Tests, die Stücke kaufen/reservieren, legen eigene Stücke im Seed-Nummernbereich `980–999` an
  (`tests/e2e/fixtures.ts`, Local API, `seed=true`) und setzen sie vor jedem Test zurück; der P8-Beispielbestand bleibt
  unverändert (für Screenshots und Export).
- **Zeit:** `TZ=UTC`; Unit/Int mit `vi.setSystemTime` **und** injizierter `now`-Variable (A-08); E2E mit
  `page.clock.install({ time })` wo zeitabhängig (Countdown, Angebote). Zusätzlich läuft `test:unit` einmal mit
  `TZ=Europe/Berlin` im `ci-full` (Zeitzonen-Unabhängigkeit).
- **Netz:** `tests/setup/network-guard.ts` (in beiden Vitest-Konfigurationen über `vitest.setup.ts` eingebunden) installiert
  einen Wächter (undici-Dispatcher + `net.Socket.connect`-Hook), der Verbindungen zu anderen Hosts als
  `127.0.0.1`/`localhost`/`::1` mit Fehler abbricht (einzige Ausnahme: `api.stripe.com`, nur mit ausdrücklich gesetztem
  `PC_TEST_ALLOW_STRIPE_API=1` für den Stripe-Testmodus im Zahlungs-Kontrakttest, P4.5). Playwright blockiert per `context.route` alle
  Fremd-Hosts außer in ausdrücklich markierten Stripe-Test-Specs.
- **Flakiness:** CI wiederholt E2E höchstens einmal (`retries: 1`, seit P14.13; vorher 2 – eine zweite Wiederholung
  änderte nichts am Ergebnis, weil `pnpm ci:flaky` jeden erst im Wiederholungslauf grünen Test ohnehin rot meldet, und
  kostete nur Minuten); ein Test, der nur mit Wiederholung grün wird, wird im
  selben PR repariert oder mit `test.fixme` + Eintrag in `docs/OFFENE-PUNKTE.md` markiert (nicht bei Kasse/Reservierung/
  Recht erlaubt).
- **Fixtures im Repo:** `tests/fixtures/images/` (u. a. `gps-orientation-6.jpg` mit GPS-EXIF, `graycard.jpg`,
  `matte-only.jpg`), `tests/fixtures/stripe/*.json` (aufgezeichnete, bereinigte Events der gepinnten API-Version; keine
  echten Kundendaten), `tests/fixtures/mails/` (Snapshots).

### 7.3 Playwright-Projekte

| Projekt | Gerät | Browser | Viewport | Zweck |
|---|---|---|---|---|
| `desktop` | `devices['Desktop Chrome']` | Chromium | 1440×900 | Standard, Admin am Laptop |
| `iphone-15` | `devices['iPhone 15']` (Touch, DPR 3, UA) | **WebKit** | **390×844** (KONZEPT EK-02/AK-7-04) | Instagram-In-App-Browser iOS (WebKit) |
| `pixel-7` | `devices['Pixel 7']` | Chromium | **412×915** | Android, CPU-Drosselung für `@perf` |

`webServer`: `E2E_SERVER=dev` → `pnpm dev`; `start` → `pnpm start` (Build vorher). `baseURL = E2E_BASE_URL`.
`reducedMotion` je Test setzbar; Standard `no-preference`. Ohne WebKit (`PW_SKIP_WEBKIT=1`) wird `iphone-15` als
Chromium-Emulation ausgeführt und im Report markiert. KUNST-QA nutzt eigene Projekte (`art-*`, Viewport aus dem Deskriptor).

### 7.4 Pflicht-Testfälle (Querschnitt)

| ID | Test | Ebene | Bezug | Ab |
|---|---|---|---|---|
| T-01 | **Reservierungs-Wettlauf:** 20 parallele „Zur Kasse“ für dasselbe Stück über **20 getrennte DB-Verbindungen** (Pool ≥ 25), 100 Wiederholungen → genau 1 Erfolg, keine Teilreservierung | int | KONZEPT AK-4-07/-08, EK-03 | P4 |
| T-02 | **Webhooks mit Fixtures:** jedes Event aus DATENMODELL §8.8 Nr. 4 signiert (`stripe.webhooks.generateTestHeaderString`) an die Route; doppelt zugestellt; falsche Signatur → 400; unbekannter Typ → 200 `ignored`; Verarbeitungsfehler → 500 und erfolgreicher Wiederholungsversuch | int | AK-4-10/-11 | P4 |
| T-03 | **Keine Fremd-Requests:** alle Registry-Routen DE+EN (Status ≠ `planned`), 3 Projekte, Request-Log: nur eigener Origin, `data:`, `blob:`; auf der Kasse zusätzlich nur Hosts aus DIENSTE-YAML (`checkout`) und nur mit `PAYMENTS_DRIVER=stripe` | e2e `@privacy` | E-43, R-131, EK-05 | P2 |
| T-04 | **Kein Endgeräte-Speicher:** frischer Kontext je Route: `context.cookies()` leer, `localStorage`/`sessionStorage` leer, `indexedDB.databases()` leer, keine Service-Worker-Registrierung, kein `Set-Cookie`; nach „In den Korb“ genau `pc_cart` mit Attributen §8.7 | e2e `@privacy` | R-130, EK-04 | P2/P4 |
| T-05 | **EXIF/GPS:** Upload der GPS-Fixture über Admin und Anfrage-Formular → Original und alle Größen ohne EXIF/GPS/XMP/IPTC (`exifr`), richtig gedreht | int + e2e | R-135, DM-MEDIA-01, DM-PRIV-02 | P1/P7 |
| T-06 | i18n-Parität: gleiche Schlüssel in `de.json`/`en.json`, keine leeren Werte, kein `lorem` | unit | EK-09 | P2 |
| T-07 | Routen-Parität DE/EN aus der Registry; `/admin` → 404; Admin-Pfad nicht in `robots.txt`, Sitemap, öffentlichem HTML | unit + e2e | AK-2-01, AK-2-04 | P2 |
| T-08 | Mail-Snapshots DE/EN (HTML + Text) je Vorlage; Pflichtinhalte; keine externen Bild-URLs, kein OS-Link | unit | AK-6-01…04 | P4 |
| T-09 | JS-Budget je Seitentyp (§7.7) | build-check | EK-01 | P2 |
| T-10 | Lighthouse-CI mobil (§7.7) | perf | EK-01 | P2 |
| T-11 | axe: 0 Verstöße `serious`/`critical` je Seitentyp und je Admin-Handy-Ansicht | e2e `@a11y` | EK-07, AK-7-04 | P2 |
| T-12 | Visuelle Regression (§7.6) | visual | DESIGN | P2 |
| T-13 | Vorschau-Datei (KONZEPT §12.7) | e2e | EK-11 | P2 |
| T-14 | Migrations-Drift und Postgres-Objekte (`pg_indexes`, `pg_constraint`, `pg_trigger`, `pg_sequences`) | int | DM-P1-01/-02 | P1 |
| T-15 | Zugriffsmatrix: anonym `GET/POST/PATCH/DELETE` je Collection über REST = erlaubtes Ergebnis | int | DM-P1-03 | P1 |
| T-16 | Sicherheits-Header je Kontext (§8.1) inkl. CSP-Hosts ⊆ DIENSTE-YAML | unit + e2e | R-131, R-136 | P2 |
| T-17 | Env-Prüfung (§4.3): jede Produktionsregel einzeln verletzt → Abbruch mit Meldung | unit | AK-A-3-02 | P1 |
| T-18 | Jobs: jeder Task mit vorgestellter Uhr, doppelter Lauf ohne Doppelwirkung; Job-Wecker (§9.6) | int | AK-8-01, DM-JOB-01 | P4/P5 |
| T-19 | Lückenlose Belegnummern: 50 parallele Zahlungsabschlüsse → 50 Rechnungen ohne Lücke/Dublette | int | AK-4-13 | P4 |
| T-20 | Logger-Schwärzung: E-Mail, IBAN, Token, Telefon, Name aus Formularen erscheinen nicht in Logs; URLs nach Formularen ohne Eingabedaten | unit + e2e | R-137 | P4 |
| T-21 | Revalidierung: Verkauf per Mock-Webhook → Produktseite zeigt „sold“ spätestens nach 5 s (Produktions-Build) | e2e | KONZEPT §1.6 | P4 |
| T-22 | Backup → Restore auf leere DB → Zeilenanzahl je Tabelle und Belegprüfsummen identisch; `retention:replay` läuft | int (`restore-drill.yml`) | §10, L-23 | P10 |

### 7.5 Barrierefreiheit

Ziel WCAG 2.2 AA (KONZEPT §1.6). `@axe-core/playwright` mit Tags `wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa`;
**Gate:** 0 Verstöße der Stufen `serious`/`critical`; `moderate`/`minor` als Annotation im Report. Zusätzlich
Tastatur-Durchlauf-Tests (Menü, Galerie/Zoom, Warenkorb, Kasse, Formulare, Admin-Handy-Ansichten), Fokus-Sichtbarkeit,
`prefers-reduced-motion` (DESIGN AK-DS-14). Seitentypen: jede Route der Registry je Sprache mindestens einmal, dazu
Zustände (leer, Fehler, reserviert, verkauft).

### 7.6 Visuelle Regression

Chromium, Projekte `desktop` (1440×900) und Mobil-Emulation 390×844; `reducedMotion: 'reduce'`, `?freeze=1` nur mit
`ART_QA`, Uhr fest, Schriften geladen (`document.fonts.ready`). `maxDiffPixelRatio: 0.01`. Referenzen nur für Linux
(`tests/visual/__screenshots__/*-linux.png`) und **nur in CI erzeugt** (Schriftwiedergabe und Chromium-Stand der Runner
sind maßgeblich; Bilder aus der Cloud-Sandbox oder von lokalen Rechnern werden nie committet): Commit mit
`[ci:update-snapshots]` oder `gh workflow run ci-full.yml --ref <branch> -f update_snapshots=true` → Job `snapshots`
(§6.4) → Artefakt `visual-snapshots-<sha7>` → `gh run download <run-id> -n visual-snapshots-<sha7> -D <Referenzordner>` →
Commit der Referenzen mit Begründung und `[skip ci]`; geprüft werden sie im nächsten Phasenende-Lauf. Ist noch keine Linux-Referenz eingecheckt, überspringt `quality` den
Schritt `test:visual` mit Hinweis im Job-Summary (nicht rot; P2.28, OFFENE-PUNKTE); sobald Referenzen da sind, ist jede
Abweichung rot. Auf Windows/macOS
werden die visuellen Tests übersprungen. Umfang: je Seitentyp ein Bild pro Projekt,
Kopf/Menü/Fuß, Preisschild, sold-Stempel, Kasse, 404.

### 7.7 Tempo-Budgets

| Messgröße | Gate (blockiert) | Ziel (Bericht) | Messung | Seiten |
|---|---|---|---|---|
| LCP mobil | ≤ 2,5 s | ≤ 2,0 s | Lighthouse-CI, Preset mobil, Median aus 3 Läufen | R01, R02, R04, R11 |
| CLS | ≤ 0,1 | ≤ 0,05 | Lighthouse-CI + Playwright (`layout-shift`) | alle obigen + R06, R07 |
| TBT (Labor-Ersatz für INP) | ≤ 200 ms | ≤ 150 ms | Lighthouse-CI | wie LCP |
| INP-Ersatz | ≤ 200 ms je Interaktion | ≤ 150 ms | Playwright `@perf`, `pixel-7`, CPU 4× (CDP), Event Timing: Menü öffnen, In den Korb, Zoom öffnen, Filter | R01, R02, R04 |
| JS beim ersten Laden (gzip, Summe aller vor `load` geladenen Skripte) | R01 ≤ 170 KB; R02–R05, R11–R18, R19–R27 ≤ 150 KB; R06/R07 ≤ 220 KB (ohne Stripe.js) | R01 ≤ 140 KB | `pnpm check:bundle` (Playwright lädt die Seite gegen `next start`, liest die Skript-URLs, gzipt die Dateien aus `.next/static` mit Stufe 9) | alle Seitentypen |
| Lazy-Chunks | DESIGN §9.10: Engine ≤ 12 KB gz, Coco ≤ 3 KB, Mikro-Interaktionen ≤ 4 KB, statischer Renderer ≤ 4 KB; GSAP-Chunk (falls ADR) ≤ 30 KB | – | `check:bundle` | – |
| Schriften | genau 3 woff2, zusammen ≤ 100 KB | – | DESIGN AK-DS-04 | – |
| Bilder | LCP-Bild der Produktseite ≤ 120 KB (`pixel-7`); Median `thumb` ≤ 40 KB, `card` ≤ 90 KB | – | DESIGN §12.2; nur Bericht in `check:bundle` (Median aus den `srcset`-Größen von R02, LCP-Bild von R04 im Profil Pixel 7; `images` in budgets.json) | R02, R04 |
| Seitengewicht erster Aufruf | R01 ≤ 1,5 MB | ≤ 1,0 MB | Lighthouse `total-byte-weight` | R01 |
| Vorschau-Datei | ≤ 40 MB (Abbruch) | ≤ 20 MB (per Mail versendbar; darüber Warnung und Hinweis im Release-Text, §14.8) | Export-Bericht | – |

Die Budgets stehen maschinenlesbar in `tests/perf/budgets.json`; `tests/perf/lighthouserc.cjs` nutzt
`ci.upload.target: 'filesystem'` (**kein** `temporary-public-storage` – das wäre ein öffentlicher Fremddienst) und
Chrome aus der Playwright-Installation (`chromePath`). Lighthouse misst über HTTP/2 wie die Produktion (Vercel): Der
Vorschaltserver `scripts/perf/serve-h2.mjs` (Node `http2`, `allowHTTP1`, selbstsigniertes Zertifikat zur Laufzeit per
`openssl`, nur localhost) startet `next start` auf Port 3100 und reicht Anfragen auf `https://localhost:3000` 1:1 durch
(Header unverändert, inkl. CSP/Cache-Control); nur die Lighthouse-Konfiguration setzt `--ignore-certificate-errors`
(Grund: OFFENE-PUNKTE „P5 CI“). Die Research-Ziele (JS ≤ 90 KB gz) sind mit der Next.js-Grundlast
(React 19 + App-Router) nicht erreichbar und daher nur Bericht, kein Gate.

### 7.8 Abdeckung

`pnpm test:coverage` (v8, Unit + Int zusammengeführt) im `ci-full`: `src/lib/commerce/**`, `src/lib/payments/**`,
`src/lib/security/**`, `src/lib/legal/**` ≥ 90 % Zeilen / ≥ 85 % Zweige; `src/lib/**` gesamt ≥ 70 % Zeilen.
Konfiguration `vitest.coverage.config.mts` (Projekte Unit + Int, Job `quality` vor dem Seed). Stufenweise: seit P4.25
sind `commerce` und `payments` Gate; `security`, `legal` und `src/lib/**` gesamt werden bis P10.1 berichtet und dort
zum Gate (PLAN P10.1).

### 7.9 Gates

| Gate | Wann | Inhalt |
|---|---|---|
| G1 | vor jedem Commit (lokal/Sandbox) | `pnpm check` und `pnpm test:int`; betroffene E2E-Tests (mindestens `pnpm test:e2e --grep @smoke`); bei UI zusätzlich `pnpm build` (§6.7 Nr. 2) |
| G2 | Aufgaben-Abschluss (lokal, Commit mit `[skip ci]`) | G1 vollständig für die Aufgabe, dazu die Tests ihrer Akzeptanzkriterien; keine GitHub-CI |
| G3 | Phasen-Ende (`[ci:full pN]`) | `ci.yml` (§6.3) + `ci-full.yml` + `preview-export.yml` (ab P2) grün; Voraussetzung für den Merge (Merge-Regel §6.7 Nr. 3) |
| G4 | P9 Kunst & Bewegung | KUNST-QA (alle Linsen PASS) + G3 unverändert grün |
| G5 | Abschluss P10 | G3 + `release.yml` erfolgreich (vor dem Merge der PR-Probelauf, nach dem Merge `publish` und `verify-asset`, §6.6) + Startklar-Prüfung im Trockenlauf mit `APP_ENV=production`-Simulation (nur die Code-Prüfungen) |

---

## 8. Sicherheit

### 8.1 Header je Kontext

Gesetzt in `next.config.ts` (`headers()`, statisch vorberechenbar) bzw. im Proxy (Nonce-Kontexte). Die Host-Listen exportiert
`src/lib/security/csp.ts` je Kontext (`public`, `dynamic`, `checkout`, `admin`, `api`); ein Unit-Test prüft
„CSP-Hosts ⊆ Hosts der DIENSTE-YAML für denselben Kontext“ (R-131).

**Alle Antworten:** `X-Content-Type-Options: nosniff` · `Referrer-Policy: strict-origin-when-cross-origin` ·
`X-Frame-Options: DENY` · `Cross-Origin-Opener-Policy: same-origin` · `Permissions-Policy: camera=(), microphone=(),
geolocation=(), payment=(), usb=(), browsing-topics=()` · in `production`/`staging` zusätzlich
`Strict-Transport-Security: max-age=31536000; includeSubDomains` (ohne `preload`) · außerhalb `production`
`X-Robots-Tag: noindex, nofollow`.

| Kontext | Pfade | `Content-Security-Policy` (Kern) | Zusätzlich |
|---|---|---|---|
| `public` | statische öffentliche Seiten (R01–R05, R11–R25, R27–R29) | `default-src 'self'; script-src 'self' <S>; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self'; frame-src 'none'; worker-src 'none'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests` | `<S>` = Soll: SRI (`experimental.sri`) ohne `'unsafe-inline'`, dazu `'sha256-…'` des festen Inline-Skripts `pc-motion` (unten); Rückfall laut Spike B-03: `'unsafe-inline'` – Hosts bleiben auf `'self'` beschränkt, damit ist R-131 („keine fremden Hosts“) erfüllt (Kanzleifrage K-41) |
| `dynamic` | R06 Warenkorb, R08 Danke, R09 Status, R10 Auftragsarbeiten, R26 Widerruf | wie `public`, aber `script-src 'self' 'nonce-<zufällig>' 'strict-dynamic'` (Nonce je Anfrage im Proxy, Seiten sind ohnehin dynamisch) | Token-Seiten R08/R09 und Dokument-Downloads: `Referrer-Policy: no-referrer`, `Cache-Control: private, no-store`, `X-Robots-Tag: noindex, nofollow` |
| `checkout` | R07 Kasse | wie `dynamic`; bei `PAYMENTS_DRIVER=stripe` zusätzlich `script-src https://js.stripe.com https://*.js.stripe.com`; `frame-src https://js.stripe.com https://*.js.stripe.com https://hooks.stripe.com`; `connect-src 'self' https://api.stripe.com` (exakt DIENSTE-YAML) | `Permissions-Policy: payment=(self "https://js.stripe.com")`; `Cross-Origin-Opener-Policy: same-origin-allow-popups`; `Cache-Control: private, no-store` |
| `admin` | `ADMIN_ROUTE/*` | `default-src 'self'; script-src 'self' 'nonce-<zufällig>' 'strict-dynamic' 'sha256-<pc-motion>'` (Hash wegen der Entwurfs-Vorschau, die das öffentliche Dokument mit `pc-motion` unter `ADMIN_ROUTE` rendert; Soll: Nonce je Anfrage im Proxy; Rückfall laut Spike B-01: `'self' 'unsafe-inline'`, nur `'self'`-Hosts, ADR – zulässig nach R-131, Kanzleifrage K-41); `style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; form-action 'self'; object-src 'none'; base-uri 'self'` | `Permissions-Policy: camera=(self)` (Sendungsnummer-Scan); `X-Robots-Tag: noindex, nofollow`; `Cache-Control: no-store` |
| `api` | `/api/*` (JSON) | `default-src 'none'; frame-ancestors 'none'` | `Cache-Control` je Endpunkt (§2.5) |

**Inline-Skript `pc-motion`** (DESIGN §11.7): Das feste Skript im `<head>` liest `localStorage['pc-motion']` vor dem ersten
Rendern und öffnet danach das Schriften-Tor `html[data-fonts]` (DESIGN §4.1, P2.20; liest/schreibt keinen Speicher). Sein Text steht als Konstante in `src/lib/security/inlineScripts.ts`; `csp.ts` berechnet daraus den
`sha256`-Hash für `script-src` im Kontext `public` (ein Unit-Test prüft Hash und Skripttext gegeneinander). In den
Kontexten `dynamic` und `checkout` steht der Hash neben der Nonce (das Skript liegt im gemeinsamen, statischen
Wurzel-Layout und kennt die Nonce nicht). Ergebnis Spike B-03: Im Kontext `public` gilt die Rückfallebene
`'unsafe-inline'` ohne Hash (ADR 0002). `'unsafe-inline'` in `style-src` ist
nur für CSS-Variablen in `style`-Attributen nötig (§15.5) und erlaubt keine fremden Hosts.

In `development` ergänzt die CSP `'unsafe-eval'` (React-Fehlerdarstellung) und lässt `upgrade-insecure-requests` weg.
CSP-Verstöße werden in E2E-Tests über `securitypolicyviolation`-Ereignisse und Konsolenfehler erkannt (Test schlägt fehl).

### 8.2 Zugriffsschutz

- **Deny by default** laut DATENMODELL §1.4 (`isAdmin`, `none`, `publicRead`, `adminField`); Frontend liest nur über
  `getPublicPayload()` (`overrideAccess: false`, kein `user`). `overrideAccess: true` nur in Services unter `src/lib/**`
  und in Seeds, nie in Route-Handlern direkt.
- Öffentliche Schreibwege (Warenkorb, Kasse, Widerruf, Auftragsanfrage, Upload) nur über Server-Actions/Route-Handler mit
  zod-Schema, Rate-Limit (§8.5), Honeypot/Zeitfalle (R-134) und Local API.
- Payload: `graphQL.disable: true`; `cors` und `csrf` = `[NEXT_PUBLIC_SITE_URL]`, bei `APP_ENV=production` zusätzlich
  `https://${VERCEL_PROJECT_PRODUCTION_URL}` (Vercel-Produktions-Domain `<projekt>.vercel.app`), damit die Verwaltung
  vor der DNS-Umstellung bedienbar ist (P11); kanonische URLs, Sitemap und Mail-Links bleiben auf `NEXT_PUBLIC_SITE_URL`.
  `serverURL: NEXT_PUBLIC_SITE_URL`, sofern die Verwaltung damit unter der Vercel-Domain funktioniert (Prüfung in P10 mit
  Spike B-01); sonst bleibt `serverURL` leer (relative Admin-Aufrufe) und Mail-Links bauen auf `NEXT_PUBLIC_SITE_URL`.
  `upload.limits.fileSize` 20 MB (Admin) bzw. 10 MB (privat).
- Server-Actions: Next prüft `Origin` gegen `Host`; keine `serverActions.allowedOrigins`-Ausnahmen.
- Test T-15 (Zugriffsmatrix) ist Pflicht für jede neue Collection.

### 8.3 Private Dateien und Token-Seiten

- Private Uploads nur über Payload-Dateiroute mit Admin-Sitzung (`local`) bzw. signierte URL ≤ 300 s (`s3`) (R-136).
  Einzige Ausnahme ohne Admin-Sitzung: der DSGVO-Export der anfragenden Person über `GET /api/privacy-export/[token]`
  (§2.5, §8.6).
- Rechnungen und Gutschriften erhalten Kund:innen **nur** als Mail-Anhang; es gibt keinen Download über Token-Links
  (R-067, strengere Regel gegenüber KONZEPT §4.12; Anhang C C-24). `GET /api/orders/[token]/documents/[file]` liefert nur
  die Rechtstext-PDFs in der Fassung der Bestellung (Status-Token, Prüfung in konstanter Zeit, Datei gehört zur
  Bestellung, `Cache-Control: private, no-store`).
- Einwilligungsabhängige Bilder (`media.showsPerson = customer`; ohne Einwilligung `media.restricted = true`, DATENMODELL
  §6.2) liefert die Bildroute nur aus, wenn `isPubliclyVisible()` (KONZEPT §9.7) wahr ist, sonst 404 für alle außer
  angemeldeter Verwaltung – auch für erratene URLs. Dasselbe gilt für Bilder mit `showsPerson = jutta` ohne
  `ownerApproved` (R-181).

### 8.4 Verwaltung (Admin)

- **Pfad** (E-93): `ADMIN_ROUTE` (Standard `/werkstatt`; Produktion eigener Wert, in P11 festgelegt, nirgends öffentlich
  verlinkt). **Soll-Mechanik [Spike B-01]:** Der Ordner `src/app/(payload)/admin/` bleibt interner Mount-Punkt;
  `routes.admin = ADMIN_ROUTE`; `src/proxy.ts` schreibt `ADMIN_ROUTE/*` intern auf `/admin/*` um und beantwortet jede
  direkte Anfrage an `/admin` oder `/admin/*` mit **404** (keine Weiterleitung, KONZEPT §2.4). **Rückfall**, falls Payload mit
  der Umschreibung nicht vollständig funktioniert (Login, Listen, Bearbeiten, eigene Ansichten, Passwort-Reset-Link, PWA):
  Ordner heißt wie der Pfad (`src/app/(payload)/werkstatt/`), `ADMIN_ROUTE` muss dazu passen (Startprüfung), der
  Produktionspfad wird in P11 per Ordner-Umbenennung gesetzt (privates Repo; der Pfad erscheint trotzdem in keiner
  ausgelieferten Datei).
- **Anmeldung:** DATENMODELL §6.1 (5 Fehlversuche → 15 min Sperre, Sitzung 7 Tage, Cookie `SameSite=Strict`, `Secure` in
  Produktion, Passwort ≥ 12 Zeichen) plus Rate-Limit je IP-Hash (§8.5). Passwort-Reset-Link 1 h gültig.
- **Konto-Anlage:** `pnpm admin:create` (fragt E-Mail und Passwort interaktiv ab; nie als Argument; verweigert zweites Konto,
  E-03); `pnpm admin:unlock`. Grund-Seed legt nur außerhalb von Produktion ein Konto aus `SEED_ADMIN_*` an.
- **Keine Fremd-Requests im Admin:** Payloads Code-/JSON-Editor lädt Monaco standardmäßig von einem CDN → Felder vom Typ
  `json`/`code` bekommen in der Admin-Oberfläche eine eigene Nur-Lese-Anzeige (`<pre>`) oder `admin.hidden: true`. E2E prüft
  Admin-Ansichten mit dem Request-Log wie T-03.
- **PWA** (KONZEPT §7.1): Manifest `ADMIN_ROUTE/manifest.webmanifest`, Service Worker `ADMIN_ROUTE/sw.js` mit Scope
  `ADMIN_ROUTE/`, ohne Daten-Cache, ohne Push. Auf öffentlichen Seiten wird nie ein Service Worker registriert (R-130).

### 8.5 Rate-Limits

Umsetzung §3.9 (Postgres, Schlüssel = IP-Hash, Einträge ≤ 24 h). Antwort bei Überschreitung: HTTP 429 mit
`Retry-After` und einem i18n-Text; Formulare zeigen den Text am Formular.

| Bucket | Stelle | Schlüssel | Grenze |
|---|---|---|---|
| `cart_add` | Server-Action „In den Korb“ | IP-Hash | 60 / 10 min |
| `checkout_start` | „Zur Kasse“ | IP-Hash | 10 / 10 min und 30 / Tag (zweiter Bucket `checkout_start_day`) |
| `checkout_submit` | „Zahlungspflichtig bestellen“ | Kassen-Token | 10 / 30 min |
| `commission_submit` | Auftragsanfrage absenden | IP-Hash | 5 / h und 20 / Tag (KONZEPT §10.3) |
| `commission_upload` | `POST /api/uploads/commission` | IP-Hash | 15 / h |
| `withdrawal_submit` | Widerruf bestätigen | IP-Hash | 30 / h (großzügig, RECHT) |
| `admin_login` | Payload-Login | IP-Hash | 10 / 15 min (zusätzlich Konto-Sperre) |
| `forgot_password` | Passwort vergessen | IP-Hash | 3 / h (Antwort immer gleich, keine Konto-Aufzählung) |
| `token_pages` | R08, R09, `GET /api/checkout/[token]/state`, Dokument-Downloads, `GET /api/privacy-export/[token]` | IP-Hash | 60 / min |
| `product_status` | `GET /api/public/product-status` | IP-Hash | 120 / min |
| `client_errors` | `POST /api/client-errors` | IP-Hash | 10 / min (darüber stilles Verwerfen, 204) |

IP-Ermittlung: Vercel `x-forwarded-for` (erster Eintrag) bzw. `x-real-ip`; Docker hinter Caddy: `x-forwarded-for` nur vom
eigenen Proxy vertrauen (Konfiguration `TRUSTED_PROXY` entfällt, Caddy überschreibt den Header).

### 8.6 Schlüsselableitung, Tokens, IP-Hash

- Abgeleitete Schlüssel per HKDF-SHA256 aus `PAYLOAD_SECRET` mit festen Bezeichnern: `pc:ip-hash:v1`, `pc:form-token:v1`,
  `pc:mock-webhook:v1`, `pc:status-token-seal:v1`, `pc:privacy-export:v1`. `src/lib/security/keys.ts` ist die einzige Stelle.
- **IP-Hash** (R-134): `HMAC-SHA256(key = HMAC(ipKey, <Berliner Datum YYYY-MM-DD>), ip)` → täglich wechselndes Geheimnis,
  keine Klar-IP wird gespeichert.
- **Formular-Token** (Zeitfalle, Upload-Berechtigung): signiertes `{iat, purpose, nonce}`, Gültigkeit 2 h.
- **Kassen-, Danke- und Status-Token:** 32 Zufallsbytes base64url (43 Zeichen, KONZEPT §2.3), Vergleich in konstanter Zeit;
  gespeichert als SHA-256-Hash, wo DATENMODELL es vorsieht. **Nie aus `PAYLOAD_SECRET` ableiten** – sonst würde ein
  Schlüsseltausch alle Status-Links der Kund:innen ungültig machen (DATENMODELL §14 ist angeglichen, Anhang C C-09). Die
  Danke-Seite R08 prüft den Token gegen `checkouts.tokenHash` und – für angelegte Bestellungen – gegen
  `orders.statusTokenHash`. Nur Seed-Kassen und Seed-Bestellungen (`seed = true`) haben deterministische Token:
  `seedToken(seedKey, 'checkout' | 'status')` aus `src/lib/seed/tokens.ts` (SEED-SPEC §2.5, z. B.
  `seedToken('checkouts:O14', 'checkout')`, `seedToken('orders:O10', 'status')`), nie aus `orderNumber` oder
  `PAYLOAD_SECRET`.
- **Versiegelter Status-Token** (R-067, damit jede spätere Kund:innen-Mail denselben Status-Link enthält): Die
  Bestellanlage legt den Status-Token zusätzlich in `orders.statusTokenSealed` ab (AES-256-GCM mit dem HKDF-Schlüssel
  `pc:status-token-seal:v1`; `sealToken`/`unsealToken` in `src/lib/security/tokens.ts`). Der Token selbst bleibt
  zufällig; gesucht wird nur über `statusTokenHash`; Stufe B der Löschung (L-05) und die Anonymisierung leeren Siegel und
  Hash gemeinsam. Scheitert das Entsiegeln (z. B. nach Tausch von `PAYLOAD_SECRET`), erzeugt der Dienst einen neuen Token
  (neuer Hash, neues Siegel, Audit) und mailt den neuen Link. Seed-Bestellungen tragen das Siegel von
  `seedToken('orders:<Key>', 'status')` und werden nie automatisch rotiert.
- **DSGVO-Export-Link** (`GET /api/privacy-export/[token]`, §2.5): signierter Token `{ requestId, exp, nonce }` mit HMAC
  aus `pc:privacy-export:v1`, Gültigkeit 7 Tage, Prüfung in konstanter Zeit; keine Personendaten im Link (R-137).
- Tausch von `PAYLOAD_SECRET`: Admin muss sich neu anmelden; offene Formular-Token und DSGVO-Export-Links verfallen
  (Link bei Bedarf neu senden); versiegelte Status-Token werden bei der nächsten Mail der Bestellung neu erzeugt (bis dahin
  bleibt der bisherige Status-Link gültig); sonst keine Wirkung.

### 8.7 Cookies und Endgeräte-Speicher (vollständige Liste)

| Name | Entsteht | Inhalt | Attribute |
|---|---|---|---|
| `pc_cart` | erstes „In den Korb“ (Nutzeraktion) | base64url-JSON `{"v":1,"items":[{"id":<productId>,"p":<priceCents>}…],"delivery":"shipping"\|"pickup"}`; `p` = Preis beim Hinzufügen (nur für den Hinweis „Preis wurde aktualisiert“, KONZEPT §4.2); ≤ 20 Stücke (das 21. wird abgelehnt; „Zur Kasse“ lehnt mehr als `settings.shop.maxItemsPerCheckout` ab); keine Personendaten, keine Kennung | `Path=/; SameSite=Lax; Secure` (außer `localhost`); `Max-Age=604800` (7 Tage); **nicht** `HttpOnly` (Korb-Anzahl auf statischen Seiten) |
| `pc_checkout` | „Zur Kasse“ (POST) | zufälliger Kassen-Token | `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600` |
| `payload-token` | Admin-Anmeldung | Payload-Sitzung | `HttpOnly; SameSite=Strict; Secure` (Produktion) |
| `__stripe_mid`, `__stripe_sid` | nur auf der Kasse durch Stripe.js (R-062) | Stripe | Stripe |
| `localStorage['pc-motion']` | erst nach Klick auf den Schalter „Animationen“ (DESIGN DA-2, R-130 a) | `reduced`/`full` | – |

Sonst nichts: kein Sprach-Cookie (`localeCookie: false`), kein Analytics-Cookie, kein Service Worker, keine IndexedDB.
KONZEPT §4.2 und RECHT R-130/L-01 sind seit dem 26.09.2026 an diese Liste angeglichen (beide Cookies technisch notwendig
nach § 25 Abs. 2 Nr. 2 TDDDG, erst nach Nutzeraktion, minimaler Inhalt, kurze Laufzeit, kein Tracking). Offen ist nur
Kanzleifrage K-38, ob stattdessen ein Server-Warenkorb mit Zufalls-ID nötig ist (Anhang C, C-05).

### 8.8 Uploads

- Erlaubt: JPEG, PNG, WebP (Prüfung über den Dateiinhalt mit `sharp(buf).metadata().format`, nicht über Endung/MIME);
  PDF nur in `documents`/`private-uploads` durch die Verwaltung (Prüfung Magic Bytes `%PDF-`).
- Jedes Bild wird serverseitig neu kodiert (Orientierung angewendet, alle Metadaten entfernt) – Original und alle Größen
  (R-135, DATENMODELL §6.2/6.4).
- Größen: Auswahl im Browser ≤ 15 MB je Datei (vor der Verkleinerung); der Browser verkleinert vor dem Upload (Admin
  ≤ 2560 px JPEG q 0,85; Formular ≤ 2560 px und ≤ 4 MB); ein Bild je Anfrage (Vercel-Grenze 4,5 MB je Request-Body);
  Server lehnt > 4,5 MB mit 413 und verständlichem Text ab. Diese Grenzen gelten für alle Dokumente (KONZEPT §10,
  DATENMODELL, R-160).
- Formular-Uploads landen als `private-uploads` mit Status `pending` (Löschung nach 24 h, falls nicht abgeschickt).

### 8.9 Geheimnisse

| Geheimnis | Ablage (ab P11) | Tausch | Wirkung beim Tausch |
|---|---|---|---|
| `PAYLOAD_SECRET` | Vercel (je Umgebung eigener Wert) | bei Verdacht | Admin neu anmelden; Status-Links werden bei der nächsten Mail erneuert, DSGVO-Export-Links neu senden (§8.6) |
| `CRON_SECRET` | Vercel | jährlich / bei Verdacht | keine (Vercel sendet neuen Wert) |
| Neon-Passwort (`DATABASE_URL*`) | Vercel | bei Verdacht (Neon „Reset password“) | Env aktualisieren, neu deployen |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Vercel | Stripe „Roll key“ / Endpoint-Secret rollen | Env aktualisieren, neu deployen |
| R2-Tokens (`S3_*`, `BACKUP_S3_*`) | Vercel; getrennte Tokens je Umgebung und für Backups | jährlich | Env aktualisieren |
| `SMTP_PASS`, `DEEPL_API_KEY`, `SENTRY_DSN` | Vercel | bei Verdacht | Env aktualisieren |
| privater age-Schlüssel | **nur offline** bei Jutta (Passwort-Manager + Ausdruck) | nie routinemäßig | neuer Schlüssel → nur neue Backups lesbar |

Regeln: 2-Faktor-Anmeldung auf allen Konten (E-94); Geheimnisse nie in Logs, PR-Texten, Dokumenten, Screenshots, Cloud-
Umgebungsvariablen oder GitHub; `gitleaks` in CI; Testwerte sind erkennbar unecht (`ci-only-…`, `sk_test_fake…`,
`whsec_test_local`). Das Verfahren je Zeile steht im RUNBOOK (P10).

### 8.10 Abhängigkeiten und Lieferkette

`pnpm-lock.yaml` Pflicht, `--frozen-lockfile` in CI; nur Pakete aus `pnpm.onlyBuiltDependencies` dürfen Install-Skripte
ausführen (neue Einträge nur mit Begründung im PR); `pnpm audit` (§6.3); Dependabot (§1.3); keine `curl | sh`-Installationen
in Workflows (Werkzeuge über gepinnte Actions oder Container-Images mit Versions-Tag); keine Pakete von Git-URLs.

**Ausnahme bei `pnpm audit`:** Meldet `pnpm audit --prod` eine Lücke (`critical` oder `high`), für die es innerhalb von
Payload 3.x bzw. Next 16.3.x keinen Fix gibt (kein gepatchter Patch- oder Minor-Stand; ein Major-Sprung ist laut §1.1/§1.3
ausgeschlossen), trägt die Session die CVE-ID mit Begründung in `package.json` unter `pnpm.auditConfig.ignoreCves` ein und
im selben PR in `docs/OFFENE-PUNKTE.md` (CVE, betroffenes Paket, warum kein Fix, ob der Shop betroffen ist, „Eintrag
entfernen, sobald ein Fix erscheint“). Jede Session prüft zu Beginn, ob für eingetragene CVEs inzwischen ein Fix existiert,
und entfernt den Eintrag dann. Andere Ausnahmen (z. B. `--audit-level` senken) gibt es nicht.

### 8.11 Protokollierung ohne Personendaten (R-137)

`src/lib/monitoring/logger.ts` schreibt JSON-Zeilen `{ level, time, event, ...felder }` nach stdout. Schwärzung vor der
Ausgabe: Schlüssel `email, name, firstName, lastName, address*, street, postalCode, city, phone, iban, bic, token,
password, authorization, cookie` werden zu `"[redacted]"`; Freitext wird per Regex auf E-Mail-Adressen, IBANs
(`[A-Z]{2}\d{2}[A-Z0-9]{11,30}`) und 43-Zeichen-base64url-Tokens geprüft. Geloggt werden IDs und Nummern (`orderId`,
`orderNumber`), nie Request-Bodies, Webhook-Payloads oder vollständige URLs von Token-Seiten (Pfad wird zu
`/de/bestellung/[token]` normalisiert). Keine Log-Drains zu Dritten (DIENSTE §3.1).

**AK-A-8-01** Jede Antwort einer öffentlichen Route trägt die Header aus §8.1 ihres Kontexts (Test über alle Registry-Routen).
**AK-A-8-02** `GET /admin` und `GET /admin/collections/users` → 404; `GET <ADMIN_ROUTE>` → Login-Seite; der Wert von
`ADMIN_ROUTE` kommt in keiner Datei unter `.next/static` und in keinem öffentlichen HTML vor.
**AK-A-8-03** Der 11. Login-Versuch innerhalb von 15 min von derselben IP → 429; der 6. Fehlversuch für ein Konto → gesperrt.

---

## 9. Performance-Architektur

### 9.1 Rendering je Route

| Routen | Rendering | Erneuerung |
|---|---|---|
| R01 Start, R02 Shop, R03 Kategorie, R05 Archiv | statisch + ISR | Cache-Tags §9.3; Rückfall `revalidate = 3600` |
| R04 Produkt | statisch je Stück (`generateStaticParams`: alle öffentlichen Stücke; `dynamicParams = true`) | `product:<id>`, `products` |
| R11–R18 Tattoo, R19–R25, R27 | statisch | Tags je Inhalt |
| R28 404, R29 500 | statisch | – |
| R06 Warenkorb, R07 Kasse, R08 Danke, R09 Status, R10 Auftragsarbeiten, R26 Widerruf | dynamisch (Cookies/Token/Formular), `Cache-Control: private, no-store` | – |
| OG-Bilder (`opengraph-image.tsx`) | statisch je Stück | `product:<id>` |
| `sitemap.xml`, `robots.txt` | ISR | `sitemap` |
| Verwaltung, `/api/*` | dynamisch | – |

**Listen-Varianten bleiben statisch [Spike B-05]:** Query-Parameter (`?available=1`, `?page=2`, `?category=…`, `?kind=…`,
KONZEPT §2.3) würden eine Seite dynamisch machen. Deshalb übersetzt der Proxy bekannte Parameter in einen internen Pfad
(`…/shop/variant/available-1.page-2`, Schlüssel alphabetisch, Werte validiert) und schreibt intern dorthin um; die sichtbare
und kanonische URL bleibt die Query-Form. Unbekannte Parameter werden verworfen. Die Varianten-Seiten nutzen
`generateStaticParams` für die bekannten Kombinationen und `dynamicParams = true` für den Rest. Rückfall: dynamisches
Rendern mit gecachten Daten (§9.2) – nur zulässig, wenn T-10 (LCP) grün bleibt.

### 9.2 Daten-Cache

Alle öffentlichen Lesezugriffe gehen über `src/lib/data/*`, jede Funktion ist mit `cached(fn, { key, tags, revalidate })`
aus `src/lib/cache/cached.ts` umhüllt. **Soll-Variante (verbindlich bis ADR): `unstable_cache` + Segment-Konfiguration
`revalidate`** – in Next 16 weiterhin funktionsfähig und mit Payload erprobt. **Alternative [Spike B-04]:** Cache Components
(`cacheComponents: true`, `'use cache'`, `cacheTag`, `cacheLife`); nur per ADR, wenn Build, Payload-Admin und alle Tests
damit grün sind. Der Wechsel betrifft nur `cached.ts` und Segment-Konfigurationen.

### 9.3 Cache-Tags und Erneuerung

| Ereignis | Tags | Aufruf | Sichtbar nach |
|---|---|---|---|
| Stück reserviert / freigegeben / verkauft (Webhook, Job, Kasse, „Offline verkauft“) | `product:<id>`, `products`, `category:<key>`, `home`, `sitemap` | `revalidateTag(tag, { expire: 0 })` (Route-Handler/Job); in Server-Actions `updateTag(tag)` | ≤ 5 s (T-21) |
| Stück in der Verwaltung bearbeitet | wie oben | `revalidateTag(tag, 'max')` | ≤ 60 s |
| Seite, FAQ, Texte, Einstellungen | `page:<key>`, `faqs`, `site-texts`, `settings` | `revalidateTag(tag, 'max')` | ≤ 60 s |
| Flash, Galerie | `flash`, `tattoo-gallery`, `home` | `'max'` | ≤ 60 s |
| Termine „on Tour“ (P12.8) | `tour-dates`, `home` | `'max'` (Rückfall `revalidate = 3600`; „vorbei“ aus dem Datum beim Rendern) | ≤ 60 s |
| Rechtstext aktiviert | `legal:<type>` | `{ expire: 0 }` | ≤ 5 s |
| Bild geändert | `media:<id>` | `'max'` | ≤ 60 s |
| Beispieldaten entfernt | alle | `revalidatePath('/', 'layout')` | ≤ 60 s |

Alle Aufrufe laufen über `src/lib/cache/revalidate.ts` (`revalidateProduct(id, { immediate })`, `revalidateContent(key)`,
`revalidateAll()`); bei `context.seed` wird nichts ausgelöst. `updateTag` gibt es nur in Server-Actions – außerhalb davon fällt der
Helfer auf `revalidateTag(tag, { expire: 0 })` zurück. Next führt die Erneuerung am Ende des Requests aus, also nach dem Commit
der Payload-Transaktion (Nachweis P3.15: `tests/int/shop/revalidate.int.spec.ts`, `tests/e2e/shop/revalidation.e2e.spec.ts`).
**Live-Zustand:** Produktseite und Warenkorb holen nach dem Laden den aktuellen Zustand über `GET /api/public/product-status` (Verhaltensmodul, ≤ 1 KB) – so stimmt der Kauf-Knopf auch,
falls eine Seite noch nicht erneuert ist; der Server prüft beim Hinzufügen ohnehin neu (KONZEPT AK-3-08).

### 9.4 Bilder

Payload erzeugt alle Größen; **verbindlich ist `media.imageSizes` aus DATENMODELL §6.2**: `thumb` 400×500 und `card`
800×1000 (4:5, Zuschnitt am Fokuspunkt), `detail` Breite 1600, `zoom` Breite 2560 (Originalformat, nie hochskaliert), `og`
1200×630 (Rückfall für das OG-Bild, DESIGN §12.6). **Kein `card-s`** – eine weitere Größe gibt es nur, wenn DATENMODELL sie
ergänzt (dann gilt sie überall gleich). **Keine** Next-Bildoptimierung (`images.unoptimized: true`, seit P0 in
`next.config.ts`); `srcset` laut DESIGN §12.2 (z. B. Galerie aus `card` 800w und `detail` 1600w). Komponente `<ResponsiveImage>` rendert `<img srcset sizes width height alt decoding="async">`
mit fester `aspect-ratio`, `placeholderDataUrl` bzw. `dominantColor` als Hintergrund; das LCP-Bild (erstes Produktfoto,
Stationsbild oben) mit `fetchpriority="high"`, `decoding="sync"` und ohne `loading="lazy"`, alle anderen `loading="lazy"`. Format WebP (AVIF
nicht im Umfang). Auslieferung mit langem Cache (§3.3).

### 9.5 Schriften, CSS, JavaScript, Proxy

- Schriften: `next/font/local` aus `src/styles/fonts/` (3 Dateien, ≤ 100 KB), `display: swap`, `adjustFontFallback`,
  kein Preload; Webschriften erst nach dem ersten Bild über das Schriften-Tor `html[data-fonts]` (DESIGN §4.1, P2.20).
- Client-Hints: `withPayload` setzt `Accept-CH`/`Critical-CH`/`Vary: Sec-CH-Prefers-Color-Scheme` für alle Pfade;
  `withoutPublicClientHints` (`src/lib/security/headers.ts`) entfernt sie aus `next.config.ts`, der Proxy setzt sie nur
  im Kontext `admin` (sonst verwirft Chrome jede erste Anfrage einer öffentlichen Seite und stellt sie neu, P2.20).
- CSS: `src/styles/tokens.css` + `global.css` + CSS Modules; keine CSS-Laufzeitbibliothek.
- JavaScript: Server Components als Standard; Client-Komponenten nur als kleine Inseln. Interaktion über
  `src/behaviors/*` (A-11): Eine Client-Komponente `BehaviorHost` sucht nach dem ersten Rendern `[data-behavior]`-Elemente
  und lädt nur die benötigten Module per `import()`. Tuschelinie-Engine nach LCP + Idle (DESIGN §9.2). Stripe.js nur auf R07.
  Zielbrowser: Next-Standard (Safari ≥ 16.4, Chrome/Edge/Firefox ≥ 111) – deckt den Instagram-In-App-Browser ab.
- Proxy (`src/proxy.ts`, Node-Laufzeit): nur schnelle Arbeit ohne Datenbank und ohne Payload-Import – Admin-Pfad (§8.4),
  Sprache/Pfad-Übersetzung (next-intl), Pfade der anderen Sprache und Aliasse (308, §2.3; die Kurz-URLs erledigt schon
  `redirects()` in `next.config.ts`), Listen-Varianten (§9.1), `www` → Apex als Rückfallebene, `X-Robots-Tag` außerhalb
  Produktion, Nonce für `dynamic`/`checkout`/`admin`. `matcher` schließt `/_next/static`, `/_next/image`, `/api`, Dateien mit Endung
  und `/favicon*` aus.

### 9.6 Jobs ohne Dauerbetrieb der Datenbank („Job-Wecker“)

Problem: Neon Free schläft nach 5 min Leerlauf und hat 100 CU-Stunden/Monat. Ein Cron, der jede Minute (oder alle 5 min)
die Datenbank abfragt, hält sie dauerhaft wach (≈ 180 CU-h/Monat) → Kosten über E-05 bzw. Aussetzen der Datenbank.
Lösung (verbindlich für Vercel):

1. **Vercel Cron** ruft jede Minute `GET /api/cron/tick` auf (`vercel.json`: `{ "path": "/api/cron/tick", "schedule": "* * * * *" }`).
2. Der Tick liest **ohne Datenbank** die Systemdatei `system/job-alarm.json` (`{ nextDueAt, lastFullRunAt }`, §3.3; lokal
   `.data/job-alarm.json`). Ist `now < nextDueAt` **und** `now − lastFullRunAt < 60 min` → sofort `204`.
3. Sonst: `payload.jobs.handleSchedules({ allQueues: true })` und `payload.jobs.run({ allQueues: true, limit: 50 })` (in
   Payload 3.90.2 vorhanden, Bestätigung per Spike B-09; der Standard-Endpunkt `/api/payload-jobs/run` ruft `handleSchedules` ebenfalls selbst auf),
   danach neuen Weckzeitpunkt berechnen und schreiben: Minimum aus aktiven Reservierungen (`expiresAt`), wartenden Jobs
   (`waitUntil`), Vorkasse-Fristen (Erinnerung/Storno), Mail-Wiederholungen, Angebotsgrenzen (`startsAt`/`endsAt`), nächstem
   vollen Lauf (`lastFullRunAt + 60 min`).
4. **Wer eine zeitgebundene Sache anlegt**, ruft nach dem Commit `jobAlarm.bump(at)` auf (Reservierung, Vorkasse-Bestellung,
   fehlgeschlagene Mail, neues oder geändertes Angebot (`startsAt`, `endsAt`), Kasse im Zustand `confirming` → `bump(now + 10 min)` für „Kassen abgleichen“,
   KONZEPT §4.10).
5. **Sicherheitsnetz:** mindestens stündlich ein voller Lauf; tägliche/monatliche Aufgaben laufen beim ersten vollen Lauf nach
   ihrer Uhrzeit (KONZEPT §8.1 Nr. 3). Geht ein Weckzeitpunkt verloren, verzögert sich eine Aufgabe höchstens um 60 min.
   Zeitkritisches hat zusätzlich eigene Wege: Stripe `checkout.session.expired`, Freigabe abgelaufener Reservierungen beim
   nächsten Reservierungsversuch für dasselbe Stück („lazy release“), direkte Mail nach dem Commit.
6. Payload-Tasks mit `schedule` dürfen stündlich oder seltener sein; häufigere Zeitpläne werden durch Weckzeitpunkte ersetzt.
   Task-Namen und fachliche Takte: DATENMODELL §11 / KONZEPT §8 / LOESCHKONZEPT §4 (Namensregel Anhang A).
7. Lokal/Docker: `JOBS_AUTORUN=true` (Payload `autoRun` jede Minute, alle Queues); Tests: `pnpm jobs:run <task> --now=<ISO>`
   bzw. direkte Aufrufe mit `now`. Im Vorschau-Export laufen keine Jobs.
8. Parallelschutz: Postgres-Advisory-Lock je Task (`pg_try_advisory_xact_lock(hashtext('<task>'))`); der Tick selbst läuft
   höchstens einmal gleichzeitig (Lock `tick`).

Erwartete Last: ≤ 24 volle Läufe/Tag → Neon aktiv ≈ 2 h/Tag ≈ 15 CU-h/Monat plus Nutzung.

### 9.7 Datenbankzugriff

- Vercel: gepoolte Neon-URL (`…-pooler…`, PgBouncer im Transaktionsmodus) als `DATABASE_URL`, `DB_POOL_MAX=5`,
  `idleTimeoutMillis: 10000`, `connectionTimeoutMillis: 10000` (Neon-Kaltstart ≈ 0,5–1 s); Migrationen und Backups über
  `DATABASE_URL_UNPOOLED`. Keine sitzungsgebundenen Features (Session-Advisory-Locks, `LISTEN/NOTIFY`, `SET` ohne `LOCAL`) –
  nur transaktionsgebundene (`pg_try_advisory_xact_lock`, `SET LOCAL`).
- Kurze Transaktionen: nie einen externen Aufruf (Stripe, SMTP, DeepL) innerhalb einer offenen Transaktion (DATENMODELL §8:
  Stripe-Session nach dem Commit).
- Region: Funktionen `fra1`, Datenbank `aws-eu-central-1` (beide Frankfurt).
- Payload-Initialisierung (`getPayload`) ist teuer → nur in Server Components/Route-Handlern/Jobs, nie im Proxy; öffentliche
  Seiten sind statisch, damit Kaltstarts Besucher:innen selten treffen.

**AK-A-9-01** Ein Tick ohne fälligen Weckzeitpunkt öffnet keine DB-Verbindung (Test mit Pool-Zähler) und antwortet 204.
**AK-A-9-02** Reservierung anlegen → `job-alarm.json` enthält `nextDueAt ≤ expiresAt`; nach Vorstellen der Uhr und einem Tick
ist das Stück wieder `available`.
**AK-A-9-03** `/de/shop?available=1&page=2` liefert dieselbe HTML wie die interne Variante und wird ohne Funktionsaufruf aus dem
Cache bedient (Produktions-Build: Antwort-Header `x-nextjs-cache: HIT` bzw. Prerender-Manifest enthält die Variante).

---

## 10. Backups und Wiederherstellung

Gilt ab P10 (Code, Tests, Drill mit synthetischen Daten) bzw. P11 (Aktivierung in Produktion). Bis P11 ist die
Backup-Route inaktiv (`BACKUP_ENABLED=false` → 404 ohne DB-Zugriff); auf GitHub läuft nur `restore-drill.yml` mit
synthetischen Seed-Daten. Rechtlicher Rahmen: LOESCHKONZEPT L-23 und §3.6, DIENSTE §3.4 und §3.11, R-136.

### 10.1 Ziele und Grundsätze

| Ziel | Wert |
|---|---|
| Datenverlust höchstens (RPO), Datenbank | ≤ 24 h aus dem eigenen Backup; Fehler innerhalb des Neon-Wiederherstellungsfensters: Minuten (Neon-Restore, §10.5) |
| Datenverlust höchstens, private Dateien und Belege | ≤ 24 h (Spiegel); Rechnungs-PDFs zusätzlich durch Sperre gegen Löschen geschützt |
| Wieder online (RTO) | ≤ 4 h nach der Entscheidung zur Wiederherstellung |
| Ort | nur EU: R2-Bucket `pct-backups` mit EU-Jurisdiktion |
| Aufbewahrung | täglich 30 Tage, monatlich 12 Monate (L-23) |

| ID | Grundsatz |
|---|---|
| BK-1 | Produktionsdaten verlassen nie Vercel, Neon und R2 (EU). **Kein** Backup über GitHub Actions, Claude-Cloud oder weitere Anbieter (A-12, DIENSTE §3.11). |
| BK-2 | Verschlüsselung **vor** dem Upload mit age (X25519) an `BACKUP_AGE_RECIPIENT`. Der private Schlüssel liegt nur offline bei Jutta (§8.9); die App kann ihre eigenen Backups nicht lesen. |
| BK-3 | Getrennte Zugangsdaten: `BACKUP_S3_*` gilt nur für `pct-backups`; die App-Tokens (`S3_*`) haben dort keinen Zugriff. |
| BK-4 | Löschungen wirken auch in Backups – durch Ablauf (≤ 12 Monate) und durch `retention:replay` nach jeder Wiederherstellung (LOESCHKONZEPT §3.6). |
| BK-5 | Ein Codepfad für Vercel und Docker: `src/lib/backup/*`, aufgerufen von `GET /api/cron/backup` und `pnpm backup:run`. |
| BK-6 | Ein Backup, das nie wiederhergestellt wurde, gilt als nicht vorhanden → Drill (§10.6). |

### 10.2 Was wird gesichert?

| Gegenstand | Verfahren | Takt | Ablage in `pct-backups` | Aufbewahrung |
|---|---|---|---|---|
| Datenbank (alle Tabellen im Schema `public` außer `rate_limit_hits`) | logischer Dump „pcdump v1“ (§10.3), gzip, age | täglich 01:30 UTC | `db/daily/<YYYY>/<MM>/pc-db-<YYYYMMDD>T<HHMM>Z.pcdump.gz.age` | 30 Tage (Lebenszyklusregel `db/daily/`) |
| Datenbank, Monatsstand | serverseitige Kopie des ersten erfolgreichen Dumps eines Berliner Kalendermonats | monatlich | `db/monthly/pc-db-<YYYY-MM>.pcdump.gz.age` | 365 Tage (Lebenszyklusregel `db/monthly/`) |
| Private Dateien (`private/` im privaten Bucket, ohne `status = pending`), inkl. Rechnungs- und Gutschrift-PDFs | inkrementeller Spiegel (§10.4), je Objekt age-verschlüsselt | täglich nach dem Dump | `files/private/<sha256(Quell-Schlüssel)>.age` | solange die Quelle existiert, danach 7 Tage |
| Medien und öffentliche PDFs (`media/`, `documents/`) | derselbe Spiegel | wöchentlich (Lauf am Sonntag) | `files/media/<sha256(Quell-Schlüssel)>.age` | solange die Quelle existiert, danach 7 Tage |
| Code, Migrationen, Seed-Quellen, Dokumente | GitHub + lokale Klone | laufend | – | – |
| Konfiguration | Liste aller Variablen und Dienst-Einstellungen **ohne Werte** im RUNBOOK; Werte im Passwort-Manager von Jutta | bei Änderung | – | – |
| Zahlungen | Stripe ist führendes System; nach einer Wiederherstellung Abgleich (§10.5 Schritt 6) | – | – | – |

Nicht gesichert: `rate_limit_hits` (≤ 24 h, R-134), Systemdateien unter `system/` (werden neu erzeugt), Vercel-Logs,
Logs der Mail-Anbieter, Sentry-Ereignisse.

### 10.3 Datenbank-Dump „pcdump v1“ **[Spike B-06]**

Vercel-Funktionen haben kein `pg_dump`. `src/lib/backup/dump.ts` erzeugt den Dump deshalb selbst:

1. Verbindung über `DATABASE_URL_UNPOOLED`; `BEGIN ISOLATION LEVEL REPEATABLE READ, READ ONLY` – alle Tabellen stammen aus
   demselben Schnappschuss.
2. Tabellenliste aus `pg_catalog` (Schema `public`, `relkind = 'r'`), alphabetisch sortiert, ohne `rate_limit_hits`.
3. Ausgabe als Text im COPY-Format (mit `psql` lesbar, falls das eigene Werkzeug einmal fehlt):

   ```
   -- pcdump 1
   -- {"createdAt":"…","appVersion":"<git-sha>","lastMigration":"<name>","pgVersion":"17.x"}
   COPY public."orders" ("id", …) FROM stdin;
   <Zeilen im COPY-Textformat>
   \.
   …
   SELECT pg_catalog.setval('public."orders_id_seq"', 123, true);
   -- pcdump-end {"tables":[{"name":"orders","columns":["id",…],"rows":123,"md5":"…"}]}
   ```

   Zeilen je Tabelle über `COPY (SELECT <Spalten> FROM <Tabelle> ORDER BY <Primärschlüssel>) TO STDOUT` (`pg-copy-streams`).
   Die Sortierung macht den Dump deterministisch (gleicher Datenstand → byte-gleicher Klartext; `createdAt` steht nur im
   Kopf und wird beim Vergleich ausgenommen). Zeilenzahlen und `md5` (MD5 über alle Zeilen einer Tabelle) stehen im
   Abschluss-Kommentar `-- pcdump-end`, weil sie erst nach dem Streamen feststehen; die Wiederherstellung vergleicht dagegen.
   Fehlt der Abschluss-Kommentar, gilt der Dump als unvollständig.
4. Stream-Kette: COPY → gzip (Stufe 6) → age → Multipart-Upload (`@aws-sdk/lib-storage`, Teile à 8 MB). Kann die gepinnte
   `age-encryption`-Version nicht streamen, wird im Speicher verschlüsselt; über 512 MB (komprimiert) bricht der Lauf mit
   A12 ab (Rückfall: Anhang C, C-01).
5. Nach dem Upload prüft `HeadObject` die Größe. Objekt-Metadaten: `x-amz-meta-sha256` (des Chiffrats),
   `x-amz-meta-last-migration`, `x-amz-meta-app-version`. Danach schreibt der Lauf die Systemdatei `backup-status.json`
   (§3.3; lokal `.data/backup-status.json`): `{ lastSuccessAt, key, sizeBytes, sha256, tables, rows, durationMs,
   lastMonthlyKey }`; bei Fehler `{ lastFailureAt, errorCode }` – nie Personendaten.
6. Monatsstand: Liegt `lastMonthlyKey` nicht im aktuellen Berliner Monat, wird der neue Dump per `CopyObject` nach
   `db/monthly/…` kopiert.

**Route `GET /api/cron/backup`:** nur bei `APP_ENV=production` **und** `BACKUP_ENABLED=true` (sonst 404, ohne DB-Zugriff);
Bearer `CRON_SECRET` (sonst 401); Laufzeit `nodejs`, `maxDuration = 300`; Advisory-Lock `backup` (kein Parallellauf);
Vercel Cron `{ "path": "/api/cron/backup", "schedule": "30 1 * * *" }`. Nach dem Dump läuft der Datei-Spiegel (§10.4) mit
dem verbleibenden Zeitbudget. Fehler → A12 (höchstens einmal je Tag) und Sentry. Erwartete Dauer bei < 50 MB Daten: < 30 s;
die Datenbank ist dafür einmal täglich ca. 5 min wach (zusätzlich zu §9.6, vernachlässigbar).

**Skripte:** `pnpm backup:run [--to=file:<pfad>|s3] [--recipient=age1…]` führt denselben Code lokal, in Tests und im
Docker-Pfad aus. `pnpm backup:verify --key=<key>` prüft ohne Entschlüsselung, ob das Objekt existiert, mit
`age-encryption.org/v1` beginnt und zum gespeicherten `sha256` passt.

### 10.4 Datei-Spiegel

`src/lib/backup/mirror.ts`:

- listet die Quell-Präfixe (`ListObjectsV2`) und vergleicht mit dem Spiegelstand `files/state.json.age` (Zuordnung
  Quell-Schlüssel → Spiegel-Schlüssel, `etag`, `missingSince`; verschlüsselt, weil Quell-Schlüssel Dateinamen enthalten);
- kopiert neue und geänderte Objekte: Lesen mit dem App-Token, age-verschlüsseln, Schreiben mit dem Backup-Token.
  Spiegel-Schlüssel sind SHA-256-Hashes der Quell-Schlüssel (keine Dateinamen im Klartext);
- vermerkt fehlende Quellen mit `missingSince` und löscht ihr Spiegel-Objekt nach 7 Tagen (Löschungen wirken, versehentliches
  Löschen bleibt eine Woche rückholbar);
- überspringt Dateien, die laut Datenbank `status = pending` haben (Abfrage im selben Lauf, die DB ist ohnehin wach);
- bearbeitet nur so viele Objekte, wie in das Zeitbudget passen; der Rest folgt im nächsten Lauf;
- Voraussetzung: Rechnungs- und Gutschrift-PDFs werden mit `x-amz-meta-invoice-number` gespeichert (lokal: Nebendatei
  `<datei>.meta.json`) – nötig für §10.5 Schritt 6.

Rechnungs-PDFs sind zusätzlich durch eine **R2-Bucket-Sperre** auf `private/invoices/` geschützt (§3.3, Anhang C C-06).

### 10.5 Wiederherstellung

**Wer und wo:** lokal auf dem Rechner von Jutta oder einer beauftragten Vertrauensperson (Node 24, Repo-Klon auf dem
Commit `appVersion` des Backups) – **nie** in einer Claude-Cloud-Session oder in GitHub Actions (A-12). Der private
age-Schlüssel wird als Datei übergeben (`--identity <pfad>`), nie als Umgebungsvariable. Schritte, die Zugangsdaten zu
Stripe oder R2 brauchen, laufen in der App auf Vercel (Admin-Aktion), damit diese Schlüssel den Rechner nie erreichen.

| Lage | Weg |
|---|---|
| Fehler im Code nach einem Deploy, Daten intakt | Vercel „Instant Rollback“ (§6.9) – keine Datenwiederherstellung |
| Datenfehler, jünger als das Neon-Wiederherstellungsfenster | Neon: Zweig aus einem Zeitpunkt vor dem Fehler anlegen, prüfen, übernehmen; Schritte 1 und 5–8 (Schritt 6 ab dem gewählten Zeitpunkt) |
| Datenfehler älter, Neon-Projekt verloren oder Anbieterwechsel | eigenes Backup: Schritte 1–8 |
| einzelne private Datei oder ein Bild fehlt | `pnpm backup:restore --file=<Quell-Schlüssel> --identity=<pfad>` legt die Datei entschlüsselt lokal ab; Upload über die Verwaltung |

1. **Wartungsmodus:** in Vercel (Produktion) `MAINTENANCE_MODE=true` setzen und neu deployen. Stripe-Webhooks erhalten 503
   und werden von Stripe bis zu 3 Tage wiederholt. Die Widerrufsfunktion R26 bleibt nutzbar, solange die bisherige
   Datenbank erreichbar ist (§5.2); solche Widerrufe landen dort und werden in Schritt 6 d übernommen.
2. **Ziel anlegen:** leere Datenbank `planetclaire_restore` im Neon-Projekt (`CREATE DATABASE`).
3. **Einspielen:** `pnpm backup:restore --key=<db/…> --identity=<pfad> --target=<URL der leeren DB>`
   - a) prüft: Ziel leer und nicht als Produktion markiert, Format `pcdump 1`, `sha256`;
   - b) führt `payload migrate` bis `lastMigration` aus (neuere Migrationen folgen mit dem Deploy in Schritt 5);
   - c) sichert und entfernt die Fremdschlüssel (`pg_get_constraintdef`), deaktiviert Nutzer-Trigger
     (`ALTER TABLE … DISABLE TRIGGER USER`), lädt jede Tabelle per `COPY … FROM STDIN`, setzt die Sequenzen, aktiviert die
     Trigger und legt die Fremdschlüssel wieder an (mit Validierung), dann `ANALYZE`;
   - d) vergleicht Zeilenzahl und `md5` je Tabelle mit dem Abschluss-Kommentar; jede Abweichung → Abbruch mit Exit-Code 1.
4. **Markieren:** `pnpm db:mark-production` gegen das Ziel (§4.8).
5. **Umschalten:** `DATABASE_URL` und `DATABASE_URL_UNPOOLED` in Vercel auf die neue Datenbank setzen, neu deployen
   (weiterhin Wartungsmodus). Die alte Datenbank in `planetclaire_broken_<YYYYMMDD>` umbenennen und nach 30 Tagen löschen.
6. **Nacharbeiten in der App** (Verwaltung → System → „Nach Wiederherstellung abgleichen“, nur im Wartungsmodus sichtbar;
   Payload-Endpoint `src/endpoints/postRestore.ts`), in dieser Reihenfolge:
   - a) `retention:replay` (LOESCHKONZEPT §3.6: alle IDs aus dem Löschprotokoll löschen, danach jeden Löschjob einmal);
   - b) Zahlungsabgleich ab `createdAt` des Backups − 1 h: `listEventsSince` → `processPaymentEvent()` (idempotent) – Käufe
     und Erstattungen nach dem Backup entstehen neu, verkaufte Unikate werden wieder `sold` (kein Doppelverkauf);
   - c) Belegnummern: Rechnungs-PDFs im Bucket, deren `x-amz-meta-invoice-number` im Datenstand fehlt, werden aufgelistet;
     `invoice-counters` werden auf die höchste gefundene Nummer gesetzt (keine doppelte Vergabe);
   - d) Bericht: Zeitraum der Lücke, nachgeholte Ereignisse, fehlende Belege, Hinweis auf Vorkasse-Bestellungen, Anfragen
     und Widerrufe aus dieser Zeit (Benachrichtigungen A01–A05 im Postfach von Jutta) sowie die Widerrufe, die seit
     Schritt 1 in der alten Datenbank (`planetclaire_broken_<YYYYMMDD>`) eingegangen sind – sie werden übernommen, bevor
     wieder geöffnet wird.
   Dieselbe Logik gibt es als `pnpm retention:replay` und `pnpm payments:reconcile` für Docker und Tests.
7. **Wieder öffnen:** `MAINTENANCE_MODE=false`, neu deployen.
8. **Prüfen:** `/api/health?deep=1` = ok, Anmeldung in der Verwaltung, letzte Bestellungen sichtbar, ein Stück öffentlich
   sichtbar, Stripe-Dashboard ohne offene Webhook-Fehler; Eintrag im Vorfallprotokoll (RUNBOOK).

### 10.6 Wiederherstellungs-Übung (Drill)

- **Automatisch** (nur synthetische Daten): Int-Test `tests/int/backup/roundtrip.int.spec.ts` in jedem `quick`-Lauf und
  zusätzlich `restore-drill.yml` (monatlich und per `workflow_dispatch` auf `main`, außerdem bei jedem PR, der
  `src/lib/backup/**` oder die Workflow-Datei ändert, §6.2) mit vollständigem Beispielbestand – nie mit Produktionsdaten
  oder Produktions-Zugängen (A-12):
  `db:reset --test` → `seed` → Wegwerf-Schlüssel im Job erzeugen (`generateIdentity()` aus `age-encryption`) →
  `backup:run --to=file:…` → `backup:restore` in eine zweite Test-Datenbank → Vergleich je Tabelle.
- **Manuell** (ab P11, halbjährlich, RUNBOOK): das jüngste Produktions-Backup lokal in eine Wegwerf-Datenbank
  `planetclaire_drill` einspielen (Schritte 2–3), Stichprobe (letzte Bestellung vorhanden), Datenbank löschen, Datum im
  Protokoll vermerken.

**AK-A-10-01** Beispielbestand → `backup:run` → `backup:restore` in eine leere DB: Zeilenzahl und `md5` jeder Tabelle gleich,
Sequenzen ≥ größter ID, Fremdschlüssel und Trigger wieder aktiv – auch für Tabellen mit gegenseitigen Fremdschlüsseln.
**AK-A-10-02** Die Backup-Datei beginnt mit `age-encryption.org/v1`; weder Dump noch Spiegel enthalten eine Seed-E-Mail-Adresse
im Klartext; kein Spiegel-Schlüssel enthält einen Quell-Dateinamen.
**AK-A-10-03** `GET /api/cron/backup` bei `APP_ENV=production` und `BACKUP_ENABLED=true` ohne Bearer → 401; mit `APP_ENV ≠ production` oder `BACKUP_ENABLED ≠ true` → 404 ohne
DB-Verbindung (Pool-Zähler).
**AK-A-10-04** Nach Wiederherstellung und `retention:replay` existiert keine ID aus dem Löschprotokoll mehr (Int-Test: Bestellung
nach dem Backup gelöscht, Backup eingespielt, Replay).
**AK-A-10-05** Zwei Dumps desselben Datenstands sind vor der Verschlüsselung bis auf die Kopfzeile mit `createdAt`
byte-gleich; ein Dump ohne `-- pcdump-end` wird von `backup:restore` abgelehnt.

---

## 11. Monitoring und Alarme

### 11.1 Grundsätze

- Nur Dienste aus DIENSTE.md: Sentry (EU), Vercel, Stripe, Neon, Cloudflare, Lettermint, GitHub mit ihren eigenen
  Benachrichtigungen. Kein weiterer Monitoring-Anbieter.
- Alarme enthalten keine Personendaten, nur IDs und Nummern (R-137).
- Jeder Alarm hat einen Empfänger und eine Handlungsanweisung im RUNBOOK. Gleiche Alarme werden gedrosselt (A12: höchstens
  eine Mail je Fehlerart und Stunde, KONZEPT §6.4).
- Empfänger: In-App-Alarme an `settings.adminNotificationEmail` (Rückfall `ADMIN_NOTIFY_EMAIL`); Dienst-Alarme an die
  Konto-Adresse `jutta@planetclairetattoos.com` (E-94). Beide landen im IONOS-Postfach – unabhängig von Lettermint.

### 11.2 Signale

| ID | Signal | Erkennung | Alarm | Reaktion |
|---|---|---|---|---|
| M-01 | Unbehandelte Serverfehler (Seiten, Route-Handler, Server-Actions, Jobs) | `onRequestError` + Logger (`level = error` → `Sentry.captureException`) | Sentry-Regel „neues Problem“ und „Rückfall“ → Mail | Fehler lesen, Session mit Fix starten |
| M-02 | Browserfehler öffentlicher Seiten (**standardmäßig aus**: nur mit `NEXT_PUBLIC_CLIENT_ERRORS_ENABLED=true` nach Kanzleifrage K-30 c, §2.5) | `POST /api/client-errors` (nur Produktion, Stichprobe 10 %, höchstens 1 je Seitenaufruf, geschwärzt) → Sentry serverseitig | Sentry „> 20 Ereignisse je Stunde“ | wie M-01 |
| M-03 | Geldrelevante Fehler (Webhook-Verarbeitung, Erstattung, Doppelzahlung, Anfechtung, Prüfsumme) | Services | A06/A07/A08/A12 + Sentry + Hinweis unter „Heute“ | laut Mailtext |
| M-04 | Webhooks kommen nicht an | Stripe-Benachrichtigung bei fehlschlagenden Webhooks; Abgleich-Job (KONZEPT §4.10) findet Zahlungen ohne Webhook → A12 | Mail | Endpunkt und Secret prüfen |
| M-05 | Jobs laufen nicht | `job-alarm.json.lastFullRunAt` älter als 3 h → `/api/health/freshness` = 503 | über M-07 | Vercel-Cron-Protokoll prüfen |
| M-06 | Backup fehlgeschlagen oder älter als 30 h | Backup-Route: A12 + Sentry; `backup-status.json.lastSuccessAt` > 30 h → freshness 503 | A12, M-07 | §10 |
| M-07 | Website nicht erreichbar | Sentry Uptime Monitoring: `GET /api/health` und `GET /api/health/freshness` alle 5 min, Alarm nach 2 Fehlschlägen in Folge **(Annahme C-04)** | Sentry-Mail | Vercel-/Neon-Status, RUNBOOK |
| M-08 | Mails bleiben liegen | `email-log.status = failed` → A12 (KONZEPT §8.2 `mail-outbox`); Kontobenachrichtigungen von Lettermint | A12 | Lettermint prüfen |
| M-09 | Kosten und Kontingente | Vercel Spend Management, Nutzungsmails von Neon und Cloudflare (§12.3); monatlicher Blick laut RUNBOOK | Mail | §12.3 |
| M-10 | Domain, DNS, Zertifikat | Vercel-Mails bei ungültiger Konfiguration oder Zertifikatsfehler | Mail | §12.4 |
| M-11 | Sicherheitslücken in Abhängigkeiten | Dependabot-Alerts, `pnpm audit` in CI | GitHub-Mail, CI rot | §1.3 |
| M-12 | Fristen (Rechtstexte, Compliance, Umsatz-Wächter) | Jobs | A09, A10, `complianceDocsReview` | laut Mailtext |

### 11.3 Frische-Prüfung ohne Datenbank

`GET /api/health/freshness` liest `job-alarm.json` und `backup-status.json` über `systemFiles` (§3.3; 60 s im Prozess
gecacht) und antwortet `{ "jobs": "ok"|"late", "backup": "ok"|"late"|"off" }`:
`jobs = late`, wenn `lastFullRunAt < now − 3 h`; `backup = off` außerhalb von Produktion oder ohne `BACKUP_ENABLED`, sonst
`late`, wenn `lastSuccessAt < now − 30 h`. Status 503, sobald ein Wert `late` ist, sonst 200. Keine DB-Verbindung, keine
weiteren Angaben (öffentlich erreichbar). Im Wartungsmodus antwortet der Endpunkt 200 mit `{ "maintenance": true }`, damit
eine geplante Wartung keinen Alarm auslöst.

### 11.4 Sentry (nur Server, R-133)

- `@sentry/nextjs` 11 nur in `instrumentation.ts`: `register()` initialisiert, wenn `NEXT_RUNTIME === 'nodejs'` und
  `SENTRY_DSN` gesetzt ist; `export const onRequestError = Sentry.captureRequestError`.
- Optionen: `environment = SENTRY_ENVIRONMENT ?? APP_ENV`, `release = VERCEL_GIT_COMMIT_SHA`, `sendDefaultPii: false`,
  `tracesSampleRate: 0`, `maxBreadcrumbs: 20`, `ignoreErrors` für `NEXT_NOT_FOUND`/`NEXT_REDIRECT`; `beforeSend` und
  `beforeBreadcrumb` rufen `redactSentryEvent()` aus `src/lib/monitoring/sentry.ts` (Regeln §8.11; entfernt
  `request.cookies`, `request.data`, alle Header außer `user-agent`, normalisiert Pfade von Token-Seiten).
- **Nicht** verwenden: `sentry.client.config.ts`, `withSentryConfig`, Tunnel-Route, Session Replay, Performance-Tracing.
  Quellkarten werden nicht hochgeladen (Server-Stacktraces sind lesbar). `pnpm check:external` stellt sicher, dass kein
  Sentry-Host und kein Sentry-Code in `.next/static` landet.
- Projekt-Einstellungen (P11, RUNBOOK): Datenregion EU (Frankfurt), „Prevent Storing of IP Addresses“ an, Data Scrubber an
  (zusätzliche Felder: `email`, `token`, `iban`), kürzeste Aufbewahrung (L-14), Alarmregeln M-01, M-02, M-07, 2FA.
- Tests: `tests/int/monitoring/sentry.int.spec.ts` mit einem Test-Transport (kein Netz).

### 11.5 Verwaltung „System“

Die Ansicht Einstellungen → System (KONZEPT §8.1 Nr. 4) zeigt: App-Version (`VERCEL_GIT_COMMIT_SHA`), `APP_ENV`, letzter
voller Job-Lauf und nächster Weckzeitpunkt, Job-Protokoll (90 Tage), letztes Backup (Zeit, Größe, Monatsstand),
fehlgeschlagene Mails, nicht verarbeitete Webhook-Ereignisse, Knopf „Jetzt ausführen“ je Task (`POST /api/cron/run/[task]`
mit Admin-Sitzung) und – nur im Wartungsmodus – „Nach Wiederherstellung abgleichen“ (§10.5).

### 11.6 Protokolle

Vercel-Laufzeitprotokolle mit der Aufbewahrung des Tarifs, keine Log-Drains (§8.11). Docker: Log-Treiber `json-file` mit
`max-size: 10m`, `max-file: 3`; Caddy ohne Zugriffsprotokoll (L-13 c/e: ≤ 14 Tage, keine IP-Listen).

**AK-A-11-01** Ein geworfener Fehler, dessen Nachricht `erika@example.com` und einen 43-Zeichen-Token enthält, erzeugt ein
Sentry-Ereignis (Test-Transport) ohne diese Zeichenketten.
**AK-A-11-02** `.next/static` und alle öffentlichen HTML-Antworten enthalten keinen Sentry-Host und kein `@sentry`-Modul;
T-03 zeichnet keine Anfrage an einen Sentry-Host auf.
**AK-A-11-03** `/api/health/freshness` mit fester Uhr: `lastFullRunAt` vor 2 h → 200; vor 4 h → 503 mit `"jobs":"late"`; keine
DB-Verbindung (Pool-Zähler).
**AK-A-11-04** Fünf fehlschlagende Wiederholungen derselben Webhook-Verarbeitung innerhalb einer Stunde erzeugen genau eine
A12-Mail.

---

## 12. Hosting, Kosten, DNS-Umstellung

Alles in diesem Abschnitt wird erst in **P11 gemeinsam mit Jutta** eingerichtet (E-99). P1–P10 bereiten nur Code,
`vercel.json`, Prüfungen und das RUNBOOK vor.

### 12.1 Topologie (Produktion)

```
 Besucher:innen / Jutta (Handy, PWA)                    IONOS: DNS-Zone und Postfach jutta@ (MX unverändert)
            │ HTTPS                                             ▲
            ▼                                                   │ Benachrichtigungen, Kundenmails
 Vercel Edge (TLS, CDN, Cron) ──► Vercel Functions fra1: Next.js 16 + Payload 3 (Node 24)
                                    │            │             │             │            │
                              Neon Postgres 17   Cloudflare R2  Lettermint    Stripe API   DeepL API, Sentry EU
                              aws-eu-central-1   EU, pct-*      SMTP (EU)     (Server)     (nur Server)
 Stripe ──Webhooks──► /api/stripe/webhook          Vercel Cron ──► /api/cron/tick (jede Minute)
 Stripe.js ◄── nur Kasse R07 (Browser)                         └─► /api/cron/backup (01:30 UTC)
```

### 12.2 Konten und Ressourcen (P11)

Alle Konten auf `jutta@planetclairetattoos.com` mit 2FA, Wiederherstellungscodes offline (E-94).

| Dienst | Ressource | Name / Einstellung |
|---|---|---|
| Vercel | Team + Projekt | Projekt `planetclairetattoos`, Pro, Region `fra1`, Node 24.x, Fluid Compute an, Git-Integration mit dem GitHub-Repo, Deployment Protection für Preview/Staging (§4.7) |
| Neon | Projekt | `planetclairetattoos`, Region `aws-eu-central-1`, Postgres 17, Datenbank `planetclaire`; Zweige `main`, `seed-root`, `staging`, `preview` (§4.7); Scale-to-zero nach 5 min an |
| Cloudflare R2 | Buckets (alle **EU-Jurisdiktion**, nicht öffentlich, keine `r2.dev`-URL) | `pct-media-prod`, `pct-private-prod`, `pct-media-staging`, `pct-private-staging`, `pct-media-preview`, `pct-private-preview`, `pct-backups` |
| Cloudflare R2 | API-Tokens (Object Read & Write, je auf die genannten Buckets beschränkt) | `pct-app-prod` (media+private prod), `pct-app-staging`, `pct-app-preview`, `pct-backup` (nur `pct-backups`) |
| Cloudflare R2 | Lebenszyklus `pct-backups` | `db/daily/` löschen nach 30 Tagen; `db/monthly/` nach 365 Tagen; unvollständige Multipart-Uploads nach 1 Tag abbrechen |
| Cloudflare R2 | Bucket-Sperren (soweit verfügbar, Anhang C C-06) | `pct-private-prod`, Präfix `private/invoices/`: `settings.retention.invoiceYears` (Standard 10 Jahre, §3.3); `pct-backups`, Präfix `db/daily/`: 30 Tage, `db/monthly/`: 365 Tage |
| Lettermint | Projekt + Versanddomain | `planetclairetattoos.com`, Absender `shop@planetclairetattoos.com`; SMTP-Zugang je Umgebung (Staging mit `MAIL_REDIRECT_ALL_TO`) |
| Stripe | Konto (Live + Test) | Webhook-Endpunkte Produktion und Staging mit der gepinnten API-Version (§3.5); Payment-Method-Domains (§4.7); eingeschränkter Schlüssel `rk_live_…` |
| Sentry | Organisation in der EU-Region | Projekt `planetclairetattoos` (Einstellungen §11.4) |
| DeepL | API Free | Schlüssel `…:fx` |
| GitHub | privates Repo | Dependabot-Sicherheitsupdates an; optional GitHub Pro für Branch-Schutz (Anhang C C-03) |

### 12.3 Kosten und Kostenbremse

| Dienst | Tarif | Kosten/Monat | Kontingent und Beobachtung |
|---|---|---|---|
| Vercel | Pro, 1 Sitz | 20 USD ≈ 18,50 € (inkl. 20 USD Nutzungsguthaben) | Cron-Ticks ≈ 43.200 Aufrufe/Monat, meist < 50 ms ohne DB – deutlich im Guthaben |
| Neon | Free | 0 € | 100 CU-h/Monat, 0,5 GB; Ziel ≤ 40 CU-h dank Job-Wecker (§9.6) |
| Cloudflare R2 | Free-Kontingent | 0 € | 10 GB-Monat, 1 Mio. Class-A-, 10 Mio. Class-B-Operationen, kein Egress-Entgelt; erwartet < 6 GB inkl. Backups |
| Lettermint | Free | 0 € | Kontingent in P11 prüfen (Annahme C-04) |
| DeepL | API Free | 0 € | 500.000 Zeichen/Monat; Verbrauch in der Verwaltung sichtbar (`usage()`) |
| Sentry | Developer | 0 € | ca. 5.000 Fehler/Monat; Spike-Schutz an |
| GitHub | Free | 0 € | §6.1, §6.8 |
| IONOS | bestehender Vertrag | unverändert | nicht Teil des Budgets |
| Stripe | nutzungsabhängig | Gebühren je Zahlung | nicht Teil des Budgets (E-05) |
| **Summe** | | **≈ 18,50 €** | Budget ≤ 25 € (E-05), Warnung ab 30 € |

**Kostenbremse:**
- Vercel Spend Management: On-Demand-Budget 10 USD über dem Guthaben, Benachrichtigung bei 50 %, 75 %, 100 %. „Pause
  production deployment“ bei Erreichen: **aus** (der Shop bleibt online; Entscheidung Jutta in P11, Anhang C C-02).
- Neon Free stoppt die Datenbank beim Erreichen des Kontingents – das wäre ein Ausfall. Deshalb: monatlicher Blick in die
  Nutzung (RUNBOOK); liegt der Verbrauch zur Monatsmitte über 50 CU-h, Wechsel auf den nutzungsbasierten Tarif
  (Anhang C C-01). Tick-Handler und Frische-Prüfung öffnen nie eine DB-Verbindung ohne Anlass (AK-A-9-01).
- Cloudflare: Benachrichtigung „Billing usage“ für R2 aktivieren.
- Keine kostenpflichtigen Zusatzprodukte (Vercel Observability Plus, Speed Insights, KV, Blob, Neon-Add-ons) ohne
  Entscheidung (A-10).
- Vercel „Attack Challenge Mode“ setzt Cookies (R-130) → nur bei einem akuten Angriff, kurz, mit Eintrag im
  Vorfallprotokoll.

### 12.4 DNS-Umstellung bei IONOS (nur P11)

Regel (E-95): DNS bleibt bei IONOS; es ändern sich **nur** die Web-Einträge. MX, SPF, DKIM (IONOS) und DMARC bleiben
unverändert; für Lettermint kommen nur **neue** Einträge hinzu.

**Ist-Stand** (laut Recherche; vor der Umstellung erneut mit `dig` prüfen und im RUNBOOK-Protokoll festhalten):

| Typ | Name | Wert |
|---|---|---|
| NS | `@` | IONOS (`ui-dns.*`) |
| A | `@` | `217.160.0.7` (IONOS-Parkseite, nur HTTP, kein Zertifikat) |
| AAAA | `@` | `2001:8d8:100f:f000::200` |
| A / AAAA | `www` | wie `@` |
| MX | `@` | `mx00.ionos.de`, `mx01.ionos.de` (Priorität 10) |
| TXT | `@` | `v=spf1 include:_spf-eu.ionos.com ~all` |
| CNAME | `s1-ionos._domainkey` | `s1.dkim.ionos.com` |
| CNAME | `s2-ionos._domainkey` | `s2.dkim.ionos.com` |
| CNAME | `s42582890._domainkey` | `s42582890.dkim.ionos.com` |
| CNAME | `_dmarc` | `dmarc.ionos.de` (`p=none`) |
| CAA | – | keine |

**Soll-Stand:**

| Typ | Name | Wert | Aktion |
|---|---|---|---|
| A | `@` | Wert laut Vercel → Project → Settings → Domains (derzeit `76.76.21.21` oder ein projektbezogener Wert) | ändern |
| AAAA | `@` | – | **löschen** (E-95) |
| A / AAAA | `www` | – | löschen (ein CNAME darf nicht neben A/AAAA stehen) |
| CNAME | `www` | Wert laut Vercel (z. B. `cname.vercel-dns.com` oder projektbezogen) | neu |
| CNAME | `staging` | wie `www` | neu |
| TXT | `_vercel` | nur falls Vercel eine Inhaber-Bestätigung verlangt | neu |
| TXT / CNAME | Lettermint-DKIM-Selektor(en), Return-Path-Subdomain | Werte laut Lettermint | neu |
| MX, TXT (SPF), CNAME `*._domainkey` (IONOS), CNAME `_dmarc` | – | wie Ist | **unverändert** |
| CAA | – | keine anlegen (falls später doch: `0 issue "letsencrypt.org"`) | – |

DMARC besteht für Lettermint-Mails über die ausgerichtete DKIM-Signatur (`d=planetclairetattoos.com`); der SPF-Eintrag der
Hauptdomain muss dafür nicht geändert werden, weil Lettermint eine eigene Return-Path-Subdomain nutzt.

**Ablauf:**

1. **T−7:** Produktion läuft vollständig unter `planetclairetattoos.vercel.app` (Startklar-Prüfung aus PLAN P11 grün bis
   auf die Domain). Lettermint-Domain angelegt, ihre DNS-Einträge bei IONOS ergänzt, Testmail besteht DKIM und DMARC.
   Vor dem Setzen von HSTS mit `includeSubDomains` (§8.1) prüfen, dass keine Subdomain nur per HTTP genutzt wird.
2. **T−1:** TTL der Einträge `@` (A, AAAA) und `www` auf den kleinsten Wert setzen, den IONOS anbietet. Ist-Stand als
   Bildschirmfoto im RUNBOOK-Protokoll ablegen.
3. **T0 (werktags vormittags):**
   - a) Vercel: Domains `planetclairetattoos.com` (primär), `www.planetclairetattoos.com` (Weiterleitung 308 auf die
     Hauptdomain) und `staging.planetclairetattoos.com` (Branch `staging`) hinzufügen.
   - b) IONOS: Ist die Domain mit der Parkseite bzw. einem IONOS-Webprodukt verbunden, zuerst die Verwendung auf „eigene
     DNS-Einträge“ umstellen, **ohne** E-Mail-Einträge anzutasten. Dann die Einträge laut Soll-Tabelle ändern.
   - c) Warten, bis `dig +short A planetclairetattoos.com @1.1.1.1` den Vercel-Wert liefert und Vercel „Valid Configuration“
     sowie ein Zertifikat zeigt.
   - d) Stripe: Live-Webhook `https://planetclairetattoos.com/api/stripe/webhook` anlegen bzw. prüfen, Test-Ereignis senden;
     Payment-Method-Domains registrieren.
   - e) Prüfungen AK-A-12-01 und AK-A-12-02, danach Testkauf laut PLAN P11.
4. **T+7:** TTL wieder auf den IONOS-Standard setzen.

**Rückweg:** Bei Problemen die Web-Einträge auf den Ist-Stand zurücksetzen (Mail ist ohnehin nie betroffen). Bei längerem
Ausfall von Vercel: Docker-Pfad (§13) und A-Eintrag auf den Server zeigen lassen.

**AK-A-12-01** Nach der Umstellung liefern die Abfragen für MX, SPF-TXT, die drei IONOS-DKIM-CNAMEs und `_dmarc` exakt den
Ist-Stand; eine Testmail an `jutta@planetclairetattoos.com` kommt im IONOS-Postfach an.
**AK-A-12-02** `http://planetclairetattoos.com` → 308 auf `https://planetclairetattoos.com/`; `https://www.planetclairetattoos.com/x`
→ 308 auf `https://planetclairetattoos.com/x`; Zertifikat gültig; HSTS-Header vorhanden; keine AAAA-Antwort mit IONOS-Adresse.
**AK-A-12-03** Die Rechnungen des ersten vollen Monats (Vercel, Neon, Cloudflare, Lettermint, Sentry, DeepL) ergeben zusammen
≤ 25 € (Nachweis im RUNBOOK-Protokoll).

---

## 13. Docker-Exit-Pfad

Zweck (E-91): Dieselbe App läuft ohne Vercel und Neon, z. B. auf einem Hetzner-Server in Deutschland. Der Pfad wird ab P10 in
CI geprüft (Job `docker`, §6.4), aber nicht betrieben. Ein Umzug braucht einen neuen Eintrag in DIENSTE.md (Hetzner als
Auftragsverarbeiter, AVV) und eine Entscheidung von Jutta.

### 13.1 Bausteine

| Datei | Inhalt | Stand |
|---|---|---|
| `Dockerfile` | mehrstufig auf `node:24-alpine`: `deps` → `builder` (`NEXT_OUTPUT_STANDALONE=1`, `BUILD_WITHOUT_DB=1`) → `runner` (Benutzer `nextjs` UID 1001, `node server.js`) | existiert seit P0; P10 ergänzt: Ziel `migrator` (auf Basis `builder`, `CMD ["pnpm","payload","migrate"]`), `HEALTHCHECK` gegen `/api/health`, Kopie von `src/styles/fonts` und `src/og/fonts` falls vom Standalone-Tracing nicht erfasst |
| `docker-compose.prod.yml` | Dienste unten | P10 |
| `deploy/Caddyfile` | TLS (Let's Encrypt), `www` → Hauptdomain (308), Reverse-Proxy auf `app:3000`, `encode zstd gzip`, kein Zugriffsprotokoll | P10 |
| `.env.production.example` | alle Variablen aus §5 mit Docker-Werten, ohne Geheimnisse | P10 |

| Dienst | Image | Aufgabe |
|---|---|---|
| `caddy` | `caddy:2-alpine` | Ports 80/443, Volume `caddy_data` (Zertifikate) |
| `app` | eigenes Image (`runner`) | `APP_ENV=production`, `JOBS_AUTORUN=true`, `DB_POOL_MAX=10`, `NEXT_PUBLIC_ANALYTICS_ENABLED=false`; startet erst nach erfolgreichem `migrate`; Volume `/app/.next/cache` (ISR-Cache) und – nur bei `STORAGE_DRIVER=local` – `/app/.data` |
| `migrate` | eigenes Image (`migrator`) | einmalig `payload migrate`, wartet auf `postgres` (healthy) |
| `postgres` | `postgres:17-alpine` | Volume `pgdata`, Port **nicht** veröffentlicht, `POSTGRES_PASSWORD` aus der Env-Datei |
| `scheduler` | `alpine:3` (BusyBox `crond`) | `30 1 * * *` → `wget --header "Authorization: Bearer $CRON_SECRET" http://app:3000/api/cron/backup` |

### 13.2 Unterschiede zu Vercel

| Thema | Vercel | Docker |
|---|---|---|
| Jobs | Vercel Cron → Tick (§9.6) | Payload `autoRun` jede Minute (`JOBS_AUTORUN=true`); die DB ist lokal, Wachhalten kostet nichts |
| Backup | Vercel Cron → `/api/cron/backup` | `scheduler` → dieselbe Route (§10) |
| Datenbank | Neon (gepoolte URL) | Postgres im Compose-Netz |
| Dateien | R2 | R2 bleibt (empfohlen, kein Datei-Umzug) oder `local` mit Volume |
| Build | mit DB: statische Seiten und ISR | `BUILD_WITHOUT_DB=1`: Daten-Funktionen rufen während des Builds `await connection()`, Seiten werden zur Laufzeit gerendert, Daten kommen aus dem Daten-Cache (§9.2) **[Spike B-08]** |
| Cache | Vercel-Datencache, CDN | Dateisystem-Cache im Volume; **genau eine** App-Instanz (kein geteilter Cache) |
| TLS, Weiterleitungen | Vercel | Caddy |
| Client-IP (Rate-Limit) | `x-forwarded-for` von Vercel | Caddy überschreibt `X-Forwarded-For`; nur diesem Header wird vertraut |
| Statistik | Vercel Web Analytics (falls freigegeben, R-132) | aus (funktioniert nur auf Vercel) |
| Protokolle | Vercel | `json-file`, `max-size: 10m`, `max-file: 3` |
| Kosten | ≈ 18,50 € | Server mit ≥ 4 GB RAM (Hetzner, Standort DE) + R2 wie bisher; Preise beim Umzug prüfen |

Regeln für den Code, damit der Pfad funktioniert: keine Vercel-only-APIs außer `@vercel/analytics` (hinter
`AnalyticsSlot`); `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` wird serverseitig gelesen und als Prop an die Kasse übergeben
(kein Einbacken zur Build-Zeit, ein Image für jede Umgebung); `assertProductionEnv` läuft nur beim Serverstart, nicht
während `next build` (`NEXT_PHASE === 'phase-production-build'` → überspringen).

### 13.3 Umzug (Gliederung des RUNBOOK-Kapitels)

1. Server anlegen (Ubuntu 24.04, SSH nur mit Schlüssel, Firewall 22/80/443, automatische Sicherheitsupdates), Docker
   Engine + Compose-Plugin installieren.
2. Repo-Stand auschecken, `.env.production` aus `.env.production.example` und dem Passwort-Manager füllen.
3. `docker compose -f docker-compose.prod.yml up -d postgres`, dann jüngstes Backup einspielen (§10.5 Schritte 1–4 mit
   `--target` auf die Compose-Datenbank, Zugriff per `docker compose exec` oder SSH-Tunnel).
4. `docker compose -f docker-compose.prod.yml up -d` (Migration, App, Caddy, Scheduler).
5. Prüfen gegen die Server-IP (`curl --resolve`), dann A-Eintrag bei IONOS auf die Server-IP umstellen (Ablauf wie §12.4;
   AAAA nur, wenn der Server IPv6 hat).
6. Stripe-Webhook-URL bleibt gleich (gleiche Domain); Nacharbeiten §10.5 Schritt 6 über `pnpm retention:replay` und
   `pnpm payments:reconcile` im `migrator`-Container.
7. Vercel-Projekt pausieren, Neon nach 30 Tagen löschen, DIENSTE.md und Datenschutzerklärung aktualisieren.

**AK-A-13-01** `docker build .` gelingt ohne Datenbank und ohne Zugangsdaten; das Image ist ≤ 500 MB und läuft als UID 1001.
**AK-A-13-02** CI-Job `docker`: `docker compose -f docker-compose.prod.yml up -d` mit Testwerten (`APP_ENV=staging`, Mock-Treiber,
`STORAGE_DRIVER=local`) → `/api/health` = 200 innerhalb von 120 s, `GET /de` = 200, Migrationen angewendet, `down -v` räumt auf.

---

## 14. Single-File-Vorschau – Werkzeug

Fachliche Vorgaben: KONZEPT §12 (E-98) und DESIGN §9.12. Dieser Abschnitt legt die technische Umsetzung fest; bei
Widerspruch in fachlichen Punkten (Inhalt, Texte, Umfang) gilt KONZEPT §12, bei Namen und Technik dieses Dokument.

### 14.1 Überblick

| Punkt | Festlegung |
|---|---|
| Befehl | `pnpm preview:export` (= `tsx scripts/preview-export/index.ts`) |
| Optionen | `--skip-build` (vorhandenes `.next-preview` nutzen; nur lokal) · `--keep-server` (Server nach dem Lauf nicht beenden; Fehlersuche) |
| Ausgabe | `dist/planet-claire-vorschau.html`, `dist/planet-claire-vorschau.report.json` (beide gitignored, nie committet) |
| Exit-Codes | 0 = erfolgreich (auch mit Warnungen) · 1 = Fehler oder Budget überschritten · 2 = Voraussetzung fehlt (Postgres nicht erreichbar, Chromium fehlt) mit deutscher Anleitung |
| Code | `scripts/preview-export/` (Ablauf, Crawl, Umwandlung) · `src/preview-runtime/` (Laufzeit in der Datei) · `src/behaviors/`, `src/leash/` (gemeinsam mit der App, A-11) |
| Test | `pnpm test:preview-export` = `playwright test --config=playwright.preview.config.ts` (§14.10) |
| Voraussetzungen | Postgres-Server aus `DATABASE_URL` erreichbar, Playwright Chromium installiert; keine Zugangsdaten, kein Netz zu Fremddiensten (KONZEPT AK-12-01) |
| Laufzeit | ≤ 10 min in CI (Crawl mit 4 parallelen Seiten, Bildkodierung mit 4 parallelen `sharp`-Aufträgen) |

| Datei in `scripts/preview-export/` | Aufgabe |
|---|---|
| `index.ts` | Ablauf §14.2, Exit-Codes, Aufräumen im `finally` (Server immer beenden) |
| `env.ts` | Export-Umgebung §14.3 |
| `db.ts` | Datenbank anlegen/leeren, migrieren, seeden |
| `server.ts` | `next build` und `next start -p 3999` mit Export-Umgebung, Warten auf `/api/health` |
| `crawl.ts` | Start-Menge, Breitensuche, Erfassung von HTML und Dateien (§14.4) |
| `adminShots.ts`, `adminViews.ts` | Bildschirmfotos der Handy-Verwaltung (§14.7) |
| `transform/html.ts`, `css.ts`, `images.ts`, `fonts.ts`, `svg.ts`, `links.ts` | Umwandlung (§14.5) |
| `runtime.ts` | bündelt `src/preview-runtime/main.ts` mit esbuild (§14.6) |
| `write.ts`, `report.ts`, `phase.ts` | Datei schreiben, Bericht und Budget (§14.8), Phasen-Kennung (§14.9) |

### 14.2 Ablauf

1. Voraussetzungen prüfen → sonst Exit 2.
2. Datenbank `planetclaire_preview_export` auf dem Server aus `DATABASE_URL`: `db:ensure`, Schema `public` leeren,
   `payload migrate`, `seed:base`, `seed:example`. Dateiablage `.data/preview-export/` wird vorher geleert.
3. Build mit der Export-Umgebung (§14.3) nach `.next-preview` – ohne `NEXT_PUBLIC_LEASH_DEBUG`.
4. Start auf `http://127.0.0.1:3999`, Warten auf `/api/health` (höchstens 120 s).
5. Crawl (§14.4), danach Bildschirmfotos der Verwaltung (§14.7).
6. Umwandlung (§14.5), Laufzeit bündeln (§14.6), Datei schreiben.
7. Größenprüfung mit automatischer Stufung (§14.8), Bericht schreiben.
8. Server beenden. Die Export-Datenbank bleibt bis zum nächsten Lauf für die Fehlersuche bestehen.

### 14.3 Export-Umgebung

Das Skript setzt (Namen laut §5; Zuordnung zu KONZEPT §12.3 in Anhang A):

`APP_ENV=preview` · `PREVIEW_EXPORT=true` · `SEED_PREVIEW_MODE=true` · `PAYMENTS_DRIVER=mock` · `EMAIL_DRIVER=memory` ·
`STORAGE_DRIVER=local` · `STORAGE_LOCAL_DIR=.data/preview-export` · `TRANSLATION_DRIVER=mock` ·
`SEED_NOW=<Exportdatum>T12:00:00` mit Berliner Offset · `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3999` ·
`DATABASE_URL=<Server aus DATABASE_URL>/planetclaire_preview_export` · `JOBS_AUTORUN=false` ·
`NEXT_PUBLIC_ANALYTICS_ENABLED=false` · `NEXT_PUBLIC_CLIENT_ERRORS_ENABLED=false` · `SENTRY_DSN=` (leer) ·
`ADMIN_ROUTE=/werkstatt` · `NEXT_DIST_DIR=.next-preview` ·
`NEXT_TELEMETRY_DISABLED=1` · `TZ=UTC` · `PREVIEW_PHASE` (§14.9).

`PREVIEW_EXPORT=true` bewirkt in der App: Die Kasse rendert statt des Zahlungsfelds den Platzhalter „Hier erscheint die
Zahlungsauswahl von Stripe (Karte, Apple Pay, Google Pay, PayPal)“; Kauf-, Kassen- und Formular-Knöpfe tragen
`data-pv-block`; keine Statistik. Sonst rendert die App unverändert.

### 14.4 Crawl

- **Start-Menge** (KONZEPT §12.3 Nr. 4): alle Routen der Registry (§2.3) mit `status ≠ 'planned'` in DE und EN; alle
  öffentlichen Seed-Stücke und Kategorien (Local API); Danke-Seiten zweier Seed-Bestellungen (bezahlt, Vorkasse) und
  Statusseiten dreier Seed-Bestellungen (versendet, Vorkasse offen, erstattet); R26 Schritt 1; je Sprache eine nicht
  existierende Route (wird als `/de/__404` bzw. `/en/__404` gespeichert). Token der Seed-Kassen und Seed-Bestellungen sind
  deterministisch: `seedToken(seedKey, 'checkout' | 'status')` aus `src/lib/seed/tokens.ts` (SEED-SPEC §2.5) – Danke-Seiten
  mit `seedToken('checkouts:<Key>', 'checkout')`, Statusseiten mit `seedToken('orders:<Key>', 'status')`; **nur** für
  `seed: true`; echte Token bleiben zufällig (§8.6).
- **Warenkorb und Kasse:** In einem eigenen Browser-Kontext legt der Crawler zwei Seed-Stücke in den Korb, klickt „Zur
  Kasse“ und erfasst R06 und R07 je Sprache.
- **Breitensuche** über interne Links (`a[href^="/"]`), höchstens 500 Seiten; Query-Parameter `available`, `category`,
  `kind`, `page` bleiben, alle anderen werden entfernt; ausgelassen: `/api/*`, `ADMIN_ROUTE`, `/_next/*`, Pfade mit
  Dateiendung (PDFs → „nicht enthalten“).
- **Erfasst** wird der Körper der Navigationsantwort (serverseitiges HTML, `response.text()`), nicht der DOM nach Skripten.
  Antwort 404 für eine Registry-Route → Bericht `not-built`, Route fehlt in der Datei; 5xx → Exit 1.
- **Dateien** (Stylesheets, Schriften, Bilder, SVG-Sprites) lädt der Crawler vom laufenden Server und speichert sie nach URL.

### 14.5 Umwandlung und Aufbau der Datei

Umsetzung von KONZEPT §12.4 und §12.5 mit `cheerio`:

- **Seiten:** Aus jedem `<body>` werden alle `<script>` (auch `self.__next_f`-Daten und JSON), `<link rel="preload">`,
  `modulepreload`, `prefetch`, `<noscript>` und der Next-Routen-Ansager entfernt; `data-behavior`, ARIA-Attribute und `id`s
  bleiben. Ergebnis je Route: `<template data-route="/de/shop?available=1" data-title="…" data-lang="de"
  data-description="…">`.
- **CSS:** alle Stylesheets in der Reihenfolge des ersten Auftretens, nach Inhalts-Hash dedupliziert, in **einem**
  `<style>`; `url()` auf Schriften → `data:font/woff2;base64,…`, auf Bilder → wie Bilder unten; `@import` führt zu Exit 1.
- **Bilder:** `sharp`: Orientierung anwenden, längste Kante ≤ 1200 px (nie vergrößern), WebP Qualität 70; Deduplizierung
  nach SHA-256 der **Ausgabe**. Im Template: `<img data-pv-src="<hash>" width height alt loading="lazy" decoding="async">`
  ohne `src`, `srcset`, `sizes`. Alle Bilder einmal in `<script type="application/json" id="pv-assets">` als Data-URI.
- **SVG:** Einzel-SVGs bleiben inline – dazu gehören die Icons, die als Inline-SVG-React-Komponenten
  (`src/components/icons/`, DESIGN §6.5) schon im Server-HTML stehen, und inline gerenderte Zeichnungen. Externe Sprites
  unter `public/art/` (Coco-Sprite `coco-sprite.v{N}.svg`, weitere Sprites, falls Stationen oder Motive so ausgeliefert
  werden) werden einmal als `<svg id="pv-sprites" hidden aria-hidden="true">` mit `<symbol>`-Elementen eingebettet;
  `<use href="/art/…svg#id">` wird zu `<use href="#id">` (DESIGN §9.12). Symbol-IDs sind projektweit eindeutig (Präfix je
  Sprite, z. B. `coco-`, `station-`); Icons haben kein Symbol und kein Präfix, weil sie als Inline-SVG gerendert werden.
- **Links, Formulare, Knöpfe:** Regeln KONZEPT §12.5 Nr. 5 und 7; Formulare verlieren `action` und bekommen `data-pv-form`;
  externe `https:`-Links erhalten `target="_blank" rel="noopener"`.
- **Zusatzseiten:** `#/vorschau/nicht-enthalten` und `#/vorschau/verwaltung` (DE/EN) erzeugt das Skript; Texte aus
  `src/i18n/messages/{de,en}.json` unter `previewExport.*` (auch Banner und Dialog, KONZEPT §12.5 Nr. 7–8).
- **Kopf der Datei:** `<meta charset="utf-8">`, Viewport, `<meta name="robots" content="noindex, nofollow">` und eine
  CSP als Meta-Tag, die jedes Nachladen technisch verhindert:
  `default-src 'none'; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline'; font-src data:;
  script-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'; form-action 'none'`.

### 14.6 Vorschau-Laufzeit (`src/preview-runtime/`)

- **Dateien:** `main.ts` (Start), `router.ts` (Hash-Router), `assets.ts` (Data-URI → Blob-URL, einmal je Hash), `dialogs.ts`
  („Vorschau – hier wird nichts gekauft“ / „Preview – nothing can be bought here“), `cartDemo.ts` (Korb-Anzahl im
  Speicher), `banner.ts` (Banner und „Alle Seiten“, Gruppen Start, Shop, Tattoo, Service, Recht, Verwaltung).
- **Bündeln:** esbuild `format: 'iife'`, `target: ['safari16.4','chrome111','firefox111']`, `minify: true`,
  `legalComments: 'none'`; statischer Import von `src/behaviors/*` und `src/leash/*` (keine dynamischen Importe in einer
  Einzeldatei). Größe ≤ 300 KB minifiziert.
- **Router** (KONZEPT §12.5 Nr. 6): Suche nach `data-route` inkl. Query; unbekannt → `/<sprache>/__404`. Beim Wechsel:
  `unmount()` aller Verhaltensmodule und `destroy()` der Tuschelinie der alten Seite, Template in `#pv-root` klonen,
  `document.title` und `lang` setzen, nach oben bzw. zum Anker scrollen, Fokus auf die H1 (`tabindex="-1"`), dann
  `mount()` für jedes `[data-behavior]` (Register `src/behaviors/index.ts`) und `mountLeash()` (DESIGN §9.12).
  `window.__PV_ROUTES` = `{ route, lang, title, group, built }[]`.
- **Verhaltensmodule** haben die Signatur `mount(root: Element, ctx?: { mode: 'app' | 'preview' }) → unmount()`. Im Modus
  `preview` machen sie keine Server-Aufrufe (z. B. kein `product-status`), der Countdown startet als Demo bei 30:00.
- **Kein Speicher, kein Netz:** kein Cookie, kein Web-Storage (auch der Bewegungs-Schalter merkt sich die Wahl nur im
  Speicher), kein `fetch`/`XMLHttpRequest`; `prefers-reduced-motion` wird beachtet.

### 14.7 Verwaltung als Bildschirmfotos

- Anmeldung unter `ADMIN_ROUTE` mit dem Admin-Konto des Grund-Seeds der Export-Datenbank (`SEED_ADMIN_*`, Werte aus
  `.env.example`). Das ist das „Test-Admin-Konto nur für die Screenshots“ aus KONZEPT §12.3; ein zweites Konto wird nicht
  angelegt (E-03). Die Export-Datenbank enthält nur Seed-Daten.
- `adminViews.ts` listet je Ansicht aus KONZEPT §7.3–7.15: Schlüssel, Pfad relativ zu `ADMIN_ROUTE`, Bildunterschrift DE/EN,
  Phase ab der sie existiert. Noch nicht gebaute Ansichten erscheinen als Hinweis „kommt in P<n>“.
- Aufnahme mit Chromium 390×844, `deviceScaleFactor: 2` → WebP 780 px breit, Qualität 70 (KONZEPT: ≤ 800 px).

### 14.8 Größenbudget und Bericht

- Grenzen (KONZEPT §12.6, 1 MB = 1.000.000 Byte): **Ziel ≤ 20 MB** (per Mail versendbar), **harte Grenze 40 MB**. Liegt
  die Datei über 20 MB, kodiert das Skript automatisch neu – erst Qualität 60, dann zusätzlich längste Kante 1000 px – und
  hört auf, sobald sie ≤ 20 MB ist. Bleibt sie über 20 MB, aber ≤ 40 MB: Warnung im Bericht (`budget.result = 'warn'`),
  Exit 0, und `release.yml` ergänzt den Größenhinweis in den Release-Notizen (§6.6). Über 40 MB → Exit 1. Richtwerte je
  Art (Bilder ≤ 10 MB, Schriften ≤ 0,5 MB, CSS + Laufzeit ≤ 1,5 MB, Templates ≤ 6 MB, Verwaltungs-Screenshots ≤ 2 MB; zusammen
  20 MB) erzeugen bei Überschreitung nur Warnungen.
- `report.json` (Typ `PreviewReport` in `report.ts`, mit zod geprüft):

  ```ts
  type PreviewReport = {
    version: 1; file: 'planet-claire-vorschau.html'; sizeBytes: number
    sizeByKind: { images: number; fonts: number; css: number; runtime: number; templates: number; adminShots: number }
    imageSettings: { maxEdge: 1200 | 1000; quality: 70 | 60 }
    routes: { route: string; lang: 'de' | 'en'; title: string; status: 'ok' | 'not-built'; bytes: number }[]
    adminViews: { key: string; status: 'ok' | 'not-built' }[]
    warnings: string[]; phase: string; gitSha: string; seedNow: string; generatedAt: string
    budget: { limitBytes: 40_000_000; targetBytes: 20_000_000; result: 'ok' | 'warn' } // warn = über dem Ziel
  }
  ```

### 14.9 Phasen-Kennung

`PREVIEW_PHASE`, falls gesetzt (CI: `preview-export.yml` setzt es aus `[ci:full pN]` in der Nachricht des PR-Kopf-Commits,
§6.2). Sonst ermittelt `phase.ts` aus `PLAN.md` die erste Phase mit offener Checkbox und nimmt die Phase davor, also die
höchste vollständig abgehakte (`p0`, solange P1 offen ist; `p10`, wenn P1–P10 abgehakt sind – so im Lauf von
`release.yml`). Am Phasenende ist in `PLAN.md` noch das Häkchen „CI grün“ offen (es folgt erst nach dem Lauf, §6.7 Nr. 3);
deshalb gilt in CI immer die Kennung aus der Commit-Nachricht. Nie aus dem Branch-Namen (Cloud-Branches heißen
`claude/…`). Nicht ermittelbar → `px`. Die Kennung erscheint im Banner („Phase P3“), im Bericht und im Artefakt-Namen
`planet-claire-vorschau-<phase>-<sha7>` (§6.5).

### 14.10 Abnahmetest

`playwright.preview.config.ts`: kein `webServer`; Projekte `pv-mobile` (Chromium 390×844) und `pv-desktop` (Chromium
1440×900); Kontext mit `offline: true` und einer Route, die alles außer `file:`, `data:`, `blob:` abbricht und protokolliert.
`tests/e2e/preview-export.e2e.spec.ts` prüft KONZEPT §12.7 Nr. 1–9 und zusätzlich: CSP-Meta-Tag vorhanden; nach allen
Interaktionen `document.cookie === ''` und leerer Web-Storage; `report.json` ist gültig und nennt jede Registry-Route. Die
Haupt-Konfiguration `playwright.config.ts` schließt diese Datei aus (`testIgnore`).

**Portabilitätstest** (ab P10, PLAN P10.20): `tests/e2e/preview-portable.e2e.spec.ts` in derselben Konfiguration mit den
Projekten `pv-portable-chromium` und `pv-portable-webkit`. Der Test kopiert **nur** `dist/planet-claire-vorschau.html` in
ein frisches Temp-Verzeichnis außerhalb des Repos und öffnet sie dort per `file://` in einem neuen Kontext: `offline: true`,
andere Zeitzone und Sprache als der Build (`timezoneId: 'America/New_York'`, `locale: 'en-US'`). Geprüft werden
Startseite, Shop, eine Produktseite, Kasse, Widerruf, Tattoo und eine Verwaltungsansicht: 0 Anfragen außer der Datei
selbst und `data:`/`blob:` (auch keine weiteren `file:`-Zugriffe), 0 Konsolenfehler, alle Bilder und alle drei
Schriftfamilien geladen; die Datei enthält weder `localhost`, `127.0.0.1`, `file://` noch den absoluten Build-Pfad. WebKit
prüft Startseite, Shop und Produktseite (H1, 0 Anfragen, 0 Konsolenfehler); fehlt WebKit in der Sitzung
(`PW_SKIP_WEBKIT=1`), zählt der CI-Lauf. `release.yml` führt den Test in `publish` und – gegen die heruntergeladene Datei –
in `verify-asset` aus (§6.6).

**AK-A-14-01** Zwei Läufe desselben Commits am selben Tag (`pnpm preview:export`, danach `pnpm preview:export --skip-build`)
erzeugen byte-gleiche HTML-Dateien.
**AK-A-14-02** Die HTML-Datei enthält keine der Zeichenketten `/_next/`, `127.0.0.1:3999`, `__next_f`, `__leash`, `/werkstatt`.
**AK-A-14-03** Ist Postgres nicht erreichbar, endet `pnpm preview:export` mit Exit-Code 2 und einer deutschen Anleitung.

---

## 15. Coding-Konventionen

### 15.1 Sprache und Benennung

| Gegenstand | Regel | Beispiel |
|---|---|---|
| Bezeichner, Dateinamen, Commits | Englisch | `reserveProduct`, `feat(P3.8): add price tag [skip ci]` (§15.6) |
| Kommentare | Deutsch (wie das P0-Gerüst), kurz; fachliche Regeln mit Dokument-ID | `// R-062: Stripe nur auf der Kasse` |
| UI-Texte | nie im Code; nur `src/i18n/messages/{de,en}.json` bzw. Payload-Felder | `t('cart.empty')` |
| React-Komponenten | PascalCase, eine Komponente je Datei, co-lokales `*.module.css` | `PriceTag.tsx`, `PriceTag.module.css` |
| Module, Hooks, Services | camelCase | `fulfillCheckout.ts`, `useCartCount.ts` |
| Collections | Datei PascalCase, `slug` kebab-case (DATENMODELL) | `PrivateUploads.ts` → `private-uploads` |
| Verhaltensmodule | Datei kebab-case = Wert von `data-behavior` | `src/behaviors/add-to-cart.ts` ↔ `data-behavior="add-to-cart"` |
| Payload-Tasks | camelCase (Anhang A.3) | `releaseExpiredReservations` |
| Eigene SQL-Tabellen und -Spalten | snake_case | `rate_limit_hits.window_start` |
| Cache-Tags | kebab-case, Doppelpunkt vor IDs | `product:42`, `site-texts` |
| Umgebungsvariablen | SCREAMING_SNAKE_CASE, Treiber-Wahl immer `<BEREICH>_DRIVER` | `EMAIL_DRIVER` |
| i18n-Schlüssel | `bereich.schluessel` in camelCase | `checkout.orderButton` |
| Tests | `*.unit.spec.ts`, `*.int.spec.ts`, `*.e2e.spec.ts`, `*.visual.spec.ts`, `*.art.spec.ts`; Titel beginnen mit der AK- oder R-ID | `test('AK-A-9-01 Tick ohne Weckzeit öffnet keine DB', …)` |

### 15.2 TypeScript

- `strict: true`, zusätzlich `noUncheckedIndexedAccess: true` und `noImplicitOverride: true` (P1 ergänzt `tsconfig.json`).
- Kein `any` (ESLint `@typescript-eslint/no-explicit-any: error`; Ausnahme: generierte Dateien), kein `!`-Non-Null außer in
  Tests, `import type` für reine Typen, Pfad-Aliase `@/` → `src/` und `@payload-config`.
- Erwartbare Fehler als Ergebnis-Typ `{ ok: true, value } | { ok: false, code }` mit festen `code`-Strings (z. B.
  `'product_unavailable'`); `throw` nur für Unerwartetes. Fehlercodes werden über i18n in Texte übersetzt.
- Typen aus `src/payload-types.ts` verwenden, nicht nachbauen; nach Schema-Änderungen `pnpm generate:types`.

### 15.3 React, Next.js, Payload

- Server Components sind Standard; `'use client'` nur für kleine Inseln; Interaktion öffentlicher Seiten über
  `src/behaviors/*` (A-11).
- Server Actions liegen als `actions.ts` neben der Route, validieren mit zod, prüfen Rate-Limit und geben
  `{ ok, fieldErrors?, message? }` zurück; Formulare funktionieren ohne JavaScript (progressive Verbesserung).
- Öffentliche Lesezugriffe nur über `src/lib/data/*`; Schreiben nur über Services in `src/lib/<bereich>/`.
  `overrideAccess: true` nur in Services und mit Kommentar, warum (§8.2).
- Payload-Transaktionen: `req` durchreichen; eigenes SQL nur über Drizzle-`sql`-Vorlagen mit Parametern, nie per
  String-Verkettung; nie ein externer Aufruf innerhalb einer offenen Transaktion (§9.7).
- Hooks von Collections bleiben klein und rufen Services; `context.seed` und `context.skipRevalidate` werden beachtet.

### 15.4 Geld, Zeit, Validierung

- Geld nur als Integer-Cent, Formatierung nur mit `formatMoney(cents, locale)` aus `src/lib/money.ts`; `toFixed` und
  Fließkomma-Rechnung mit Beträgen sind verboten (ESLint-Regel im Ordner `src/lib/commerce`).
- Zeit: `now` wird übergeben (A-08); `new Date()` ohne Argument und `Date.now()` sind in `src/lib/commerce`, `src/lib/jobs`,
  `src/jobs`, `src/lib/legal` verboten (ESLint `no-restricted-syntax`), stattdessen `clock.now()`. Anzeige nur über
  `formatBerlin`.
- zod an jeder Grenze: Umgebungsvariablen, Route-Handler, Server Actions, Webhook-Normalisierung, CSV-Importe, Berichte.

### 15.5 CSS und Barrierefreiheit

- Design-Tokens nur aus `src/styles/tokens.css` (CSS-Variablen); CSS Modules je Komponente; keine Inline-Styles außer
  dynamischen CSS-Variablen (`style={{ '--progress': x }}`); kein `!important` außer in `global.css` für
  Hilfsklassen.
- Bewegung immer mit `prefers-reduced-motion` **und** `html[data-motion="reduced"]` (DESIGN §9.11).
- Semantisches HTML, sichtbarer Fokus, Beschriftungen für alle Eingaben, `aria-live="polite"` für die Korb-Anzahl; axe-Gate
  §7.5.

### 15.6 Protokolle, Abhängigkeiten, Git

- Kein `console.*` unter `src/` (ESLint `no-console: error`; Ausnahme `src/lib/monitoring/logger.ts`); Skripte dürfen
  `console` nutzen.
- Neue Laufzeit-Abhängigkeit nur mit Begründung im PR (Zweck, Größe, Lizenz MIT/Apache-2.0/BSD/ISC, Pflege) und exakt
  gepinnt (§1.3); Auswirkung auf `check:bundle` im PR nennen.
- Commits: Conventional Commits auf Englisch mit der Aufgaben-ID als Bereich, z. B.
  `feat(P1.4): add enums, money and time helpers [skip ci]`, am Phasenende `chore(P3): finish phase [ci:full p3]`;
  Commits ohne Aufgabenbezug (z. B. Sicherheitsupdate) mit Sachbereich (`deps`, `infra`, `docs`). Kennungen `[skip ci]`,
  `[ci:full]`, `[ci:full pN]`, `[ci:update-snapshots]`, `[ci:art]` laut §6.2 und §6.7 Nr. 2. Squash-Nachrichten,
  PR-Titel und PR-Beschreibungen enthalten nie `[skip ci]` (§6.7 Nr. 1, Nr. 3).
- Migrationen: `pnpm payload migrate:create p<n>_<thema>` (z. B. `p4_checkout`), nie eine angewendete Migration ändern,
  rückwärtsverträglich (§6.7 Nr. 5).
- `TODO` nur mit Phase und Verweis: `// TODO(P7): … (OFFENE-PUNKTE: <Datum/Stichwort>)`; kein auskommentierter Code.
- Formatierung: Prettier (`.prettierrc.json`: `singleQuote`, `semi: false`, `trailingComma: all`, `printWidth: 100`),
  ESLint Flat-Config; `pnpm format:check` ist Teil von `pnpm lint` ab P1.

**AK-A-15-01** Die ESLint-Konfiguration meldet einen Fehler für `console.log` in `src/`, für `new Date()` in `src/lib/commerce/`
und für `any` in handgeschriebenem Code (Unit-Test `tests/unit/lint/rules.unit.spec.ts` ruft die ESLint-API mit Beispiel-Quelltext
und virtuellen Dateipfaden unter `src/` auf; keine absichtlich fehlerhaften Dateien im Repo).
**AK-A-15-02** Jede Datei unter `src/behaviors/` exportiert `mount(root, ctx?)` mit Rückgabe `unmount` und ist in
`src/behaviors/index.ts` registriert (Unit-Test).

---

## Anhang A – Namensabgleich mit anderen Dokumenten

Andere Dokumente nannten für dieselbe Sache teils andere Namen. **Seit dem 26.09.2026 verwenden die Fachdokumente die
verbindlichen Namen dieses Dokuments**; die Tabellen bleiben nur als Nachschlagewerk (z. B. für die Recherche unter
`docs/research/`), die Spalten „dort genannt“ bzw. die Quell-Spalten in A.3 zeigen den Stand vor der Angleichung. Im Code gilt
die Spalte **„verbindlich“**; die fachlichen Regeln (Fristen, Abläufe, Texte) bleiben bei den Fachdokumenten. Nennt ein
Plan- oder Fachdokument noch einen Namen aus der Spalte „dort genannt“, gilt trotzdem die Spalte „verbindlich“.

### A.1 Umgebungsvariablen und Schalter

| Quelle | dort genannt | verbindlich |
|---|---|---|
| KONZEPT §12.3 | `PAYMENT_PROVIDER=mock` | `PAYMENTS_DRIVER=mock` |
| KONZEPT §12.3 | `MAIL_TRANSPORT=memory` | `EMAIL_DRIVER=memory` |
| KONZEPT §12.3 | `STORAGE_ADAPTER=local` | `STORAGE_DRIVER=local` |
| KONZEPT §12.3 | `TRANSLATION_PROVIDER=mock` | `TRANSLATION_DRIVER=mock` |
| KONZEPT §12.3 | `SEED_REFERENCE_DATE` | `SEED_NOW` |
| KONZEPT §12.3 | „Site-URL“ | `NEXT_PUBLIC_SITE_URL` |
| DATENMODELL §13.7 | `NODE_ENV=production` als fachliche Bedingung | `APP_ENV=production` (§4.2) |
| `.env.example` (erster P0-Entwurf) | `ADMIN_ROUTE=/admin` | `/werkstatt` für Entwicklung (seit 26.09.2026 so in `.env.example`); P1 erzeugt `.env.example` aus `src/lib/env.ts` neu (§5.1) |
| Payload-Vorlagen, Recherche | `NEXT_PUBLIC_SERVER_URL`, `PAYLOAD_PUBLIC_SERVER_URL` | `NEXT_PUBLIC_SITE_URL` |

### A.2 Endpunkte, Auslöser, Cookies

| Quelle | dort genannt | verbindlich |
|---|---|---|
| KONZEPT §8.1 Nr. 6 | Vercel Cron auf `/api/cron/<job>` | `GET /api/cron/tick` (Job-Wecker) und `POST /api/cron/run/[task]` (ein Task) |
| DATENMODELL §11, LOESCHKONZEPT §4 | Vercel Cron jede Minute auf `/api/payload-jobs/run` | `GET /api/cron/tick`; `/api/payload-jobs/run` bleibt nur als Rückfall (§2.5) |
| Recherche | `/api/cron/release-reservations` alle 5 min | entfällt (Weckzeitpunkt und „lazy release“, §9.6) |
| KONZEPT §8.2 | Backups „außerhalb der App (GitHub Actions)“ | `GET /api/cron/backup` per Vercel Cron (§10) |
| KONZEPT §12.8 | Phase aus dem Branch-Namen `phase/p3-…` | `PREVIEW_PHASE` bzw. `[ci:full pN]` bzw. `PLAN.md` (§14.9) |
| KONZEPT §4.2 | `pc_cart` mit Kassen-Token, 30 Tage | `pc_cart` (7 Tage, ohne Token) und `pc_checkout` (HttpOnly, 1 h), §8.7, Anhang C C-05 |
| KONZEPT §2.4, RECHT §2 | Kurz-URLs `/widerruf` u. a. mit 307 bzw. 308 | 308 auf die kanonische DE-Route (§2.3) |
| DESIGN §12.2 | Bildgröße `card-s` | entfällt; Größen nur aus DATENMODELL §6.2 (§9.4) |
| LOESCHKONZEPT | Collections `emailLog`, `deletionLog`, `privacyRequests` | Slugs `email-log`, `deletion-log`, `privacy-requests` (DATENMODELL ergänzt die beiden letzten, C-10) |
| DATENMODELL §6.25.1/§6.25.2 | Kassen-Token bei Stripe als `client_reference_id`/`metadata.checkoutToken`; Idempotenz `checkout:<token>:<n>` | `client_reference_id` und `metadata.checkoutRef` = `checkouts.reservationRef`, dazu `metadata.appEnv`; Idempotenz `checkout:<checkoutRef>:<n>`; Token nur in der `return_url` (§3.1 Nr. 6, §3.5) |
| KONZEPT §2.7/§4.12, DATENMODELL §6.8.2 | Rechnung und Gutschriften als Download auf der Statusseite | nur Mail-Anhang und Verwaltung; `GET /api/orders/[token]/documents/[file]` liefert nur Rechtstext-PDFs der Bestellung (R-067, §8.3, C-24) |
| RECHT R-131 (Kontexte) | CSP-Kontexte `public`, `checkout`, `admin` | zusätzlich `dynamic` und `api` (§8.1); Nonce in `dynamic`, `checkout`, `admin` |

### A.3 Task-Slugs der Jobs-Queue

Regel: Slug laut Spalte „verbindlich“, Queue laut DATENMODELL §11 (`commerce`, `email`, `documents`, `maintenance`). Unter
dem Job-Wecker (§9.6) sind die Uhrzeiten Richtwerte: Tägliche und monatliche Tasks laufen beim ersten vollen Lauf nach der
Berliner Uhrzeit aus KONZEPT §8.2 (sonst LOESCHKONZEPT §4) und höchstens einmal je Berliner Tag bzw. Monat (KONZEPT §8.1
Nr. 3). Zeitpläne kürzer als stündlich aus DATENMODELL §11 (`*/5`, `*/15`) werden durch Weckzeitpunkte ersetzt. Bei
widersprüchlichen Fristen gilt für Löschungen LOESCHKONZEPT, für Abläufe KONZEPT.

| verbindlich | Queue | Auslösung | KONZEPT §8.2 | DATENMODELL §11 | LOESCHKONZEPT §4 |
|---|---|---|---|---|---|
| `releaseExpiredReservations` | commerce | Weckzeit `expiresAt`; Kasse `confirming` + 10 min; stündliches Netz | `release-reservations` | `releaseExpiredReservations` | `releaseExpiredReservations` |
| `prepaymentReminders` | commerce | Weckzeit Erinnerungsfälligkeit | `prepayment-deadlines` (Erinnerung) | `prepaymentReminders` | `vorkasseReminder` |
| `cancelOverduePrepayments` | commerce | Weckzeit Zahlungsfrist | `prepayment-deadlines` (Storno) | `cancelOverduePrepayments` | `vorkasseAutoCancel` |
| `sendEmail` | email | direkt nach dem Commit; Wiederholung per `waitUntil` + Weckzeit (andere Mails laut KONZEPT §6.1) | `mail-outbox` | `sendEmail` | `withdrawalMailRetry` (Regel R-093 im Task: Widerrufs-Bestätigung M08 bis 24 h wiederholen; A12 ab dem 2. Fehlversuch, gedrosselt nach §11.1, und nach Aufgabe) |
| `renderInvoicePdf` | documents | bei Bedarf | – | `renderInvoicePdf` | – |
| `renderLegalTextPdf` | documents | bei Bedarf | – | `renderLegalTextPdf` | – |
| `activateScheduledLegalTexts` | maintenance | Weckzeit `validFrom` | – | `activateScheduledLegalTexts` | – |
| `markDelivered` | commerce | täglich (automatisch 10 Berliner Kalendertage nach dem Versandtag, `deliveredSource = auto`) | `mark-delivered` | – (fehlt) | – |
| `withdrawalDeadlines` | commerce | täglich ab 08:00 Berlin (A13 je Widerruf einmal ab Tag 10, ohne Beispieldaten) | `withdrawal-deadlines` | – (fehlt) | – |
| `legalReviewReminder` | maintenance | täglich | `legal-review-reminder` | `legalReviewReminder` | `legalTextsAnnualReview` |
| `revenueGuardCheck` | maintenance | täglich und bei Bedarf | `revenue-watchdog` | `revenueGuardCheck` | `revenueWatchdog` |
| `monthlyClose` | documents | monatlich am 1. | `monthly-close` (ohne Prüfsummen) | – (fehlt) | – |
| `invoiceIntegrityCheck` | maintenance | monatlich am 1. | Prüfsummen-Teil von `monthly-close` | – | `invoiceIntegrityCheck` |
| `retentionAbandonedCheckouts` | maintenance | täglich | `retention` | `purgeOrders` (Teil `expired`) | `retentionAbandonedCheckouts` |
| `retentionOrderMinimize` | maintenance | täglich | `retention` | `purgeOrders` (Teil) | `retentionOrderMinimize` |
| `retentionOrders` | maintenance | täglich | `retention` | `purgeOrders` | `retentionOrders` |
| `retentionInvoices` | maintenance | täglich | `retention` | `purgePrivateUploads` (Beleg-PDFs) | `retentionInvoices` |
| `retentionWithdrawals` | maintenance | täglich | `retention` | – | `retentionWithdrawals` |
| `retentionCommissionInquiries` | maintenance | täglich | `retention` | `purgeInquiries` | `retentionCommissionInquiries` |
| `retentionEmailLog` | maintenance | täglich | `retention` | `purgeLogs` (Teil `email-log`) | `retentionEmailLog` |
| `retentionPrivacyRequests` | maintenance | täglich | – | – (DSGVO-Exporte aus §12) | `retentionPrivacyRequests` |
| `retentionConsentEvidence` | maintenance | täglich | `retention` | `purgeLogs` (`consent-log`), `purgePrivateUploads` (Nachweise) | `retentionConsentEvidence` |
| `retentionDeletionLog` | maintenance | täglich | – | – | `retentionDeletionLog` |
| `retentionTechnical` | maintenance | stündlich | `temp-uploads-cleanup` | `purgePrivateUploads` (`pending`), `purgeLogs` (`webhook-events`, `audit-log`) | `retentionTechnical` (inkl. `rate_limit_hits` > 24 h) |
| – | – | – | – | – | `retentionCarts`: **entfällt**, solange es keinen Server-Warenkorb gibt (§8.7); L-01 erfüllt `Max-Age` des Cookies, Kassen-Datensätze löscht `retentionAbandonedCheckouts` |
| `legalHoldReview` | maintenance | täglich | – | – | `legalHoldReview` |
| `privacyRequestsDeadlineReminder` | maintenance | täglich | – | – | `privacyRequestsDeadlineReminder` |
| `complianceDocsReview` | maintenance | monatlich | – | – | `complianceDocsReview` |

`pnpm jobs:run <slug>` und `POST /api/cron/run/[task]` akzeptieren nur Slugs aus dieser Tabelle (Liste in
`src/jobs/index.ts`, Unit-Test gleicht sie mit dieser Tabelle ab).

### A.4 Pfade, Module und Skripte

Verbindlich sind der Baum §2.1 und die Skriptliste §6.10. Entwürfe der Plan-Dateien und einzelne Fachdokumente nannten
für dieselbe Sache andere Pfade:

| Quelle | dort genannt | verbindlich |
|---|---|---|
| Plan-Entwurf P1 | `src/lib/logger.ts` | `src/lib/monitoring/logger.ts` (einziger Logger, §8.11) |
| Plan-Entwurf P5 | Versanddienst-Adapter `src/lib/shipping/{types,index,manual}.ts` | `src/lib/carrier/` (Name wie `CARRIER_DRIVER`; `src/lib/commerce/shipping.ts` berechnet nur Versandkosten) |
| Plan-Entwurf P5 | `src/lib/products/transitions.ts` | `src/lib/commerce/productTransitions.ts` (neben `orderTransitions.ts`, `checkoutTransitions.ts`) |
| LOESCHKONZEPT §1, DATENMODELL, Plan-Entwurf P6 | `src/lib/retention/rules.ts`, `src/lib/legal/retention/rules.ts` | `src/lib/retention/policy.ts` (alle Fristen und Fristfunktionen), `src/lib/retention/log.ts` (`writeDeletionLog`) |
| DATENMODELL, Plan-Entwurf P3/P4 | `src/lib/tax.ts` | `src/lib/tax/` (`getTaxModeAt`, `computeTax`) |
| DATENMODELL §8.5, Plan-Entwurf P4 | `src/lib/commerce/prepayment.ts` bzw. `prepaymentDueAt`/`prepaymentReminderAt` | `src/lib/commerce/deadlines.ts` mit `prepaymentDeadlines(placedAt, settings)` (DATENMODELL §8.5) und den Reservierungszeiten |
| Plan-Entwurf P1 | `src/lib/audit/writeAudit.ts` | `src/lib/audit.ts` |
| Plan-Entwürfe P1/P3 | `src/lib/format/itemNumber.ts`; `formatItemNumber` in `src/lib/shop/format.ts` | `src/lib/products/itemNumber.ts` (Nummer, Slug, `formatItemNumber`); `src/lib/shop/format.ts` nutzt es |
| Plan-Entwürfe P1/P3 | `formatEuro`, `formatPrice` | `formatMoney(cents, locale)` aus `src/lib/money.ts` (§15.4) |
| Plan-Entwurf P1 | `stripe` nur in `src/lib/payments/stripe.ts` | Ordner `src/lib/payments/stripe/` (§2.2) |
| Plan-Entwurf P1 | `src/app/api/health/route.ts`, Antwort `{ ok: true }` | `src/app/(api)/api/health/route.ts`, Antwort `{ status: 'ok', version, appEnv }` (§2.5) |
| Plan-Entwurf P1 | `src/components/admin/…` | `src/admin/components/…` |
| Plan-Entwürfe P2–P4 | Verhaltensmodule `cartCount.ts`, `productStatus.ts`, `buyBar.ts`, `motionToggle.ts` … | kebab-case = `data-behavior`: `cart-count.ts`, `product-status.ts`, `buy-bar.ts`, `motion-toggle.ts` … (§15.1) |
| Plan-Entwürfe P2/P4, DESIGN AK-DS-16 | Routengruppe `src/app/(frontend)/[locale]/(calm)/` | keine Routengruppe; Ordner laut §2.1, Ruhe-Seiten über Preset/Layout-Props |
| ARCHITEKTUR-Entwurf §2.3 | Routen-Registry und `shortLinks` in `src/i18n/routing.ts`, Kurz-URLs im Proxy | Registry `src/lib/routes/registry.ts`; `src/i18n/routing.ts` erzeugt daraus `pathnames`; Kurz-URLs per `redirects()` in `next.config.ts` (§2.3) |
| SEED-SPEC (Entwurf) | `src/seed/*`, `payload run src/seed/cli.ts` | `src/lib/seed/*`, `payload run scripts/seed/cli.ts` |
| Plan-Entwurf P4, frühere Entwürfe | `seedStatusToken()`, `seedToken(orderNumber, purpose)` | `seedToken(seedKey, 'checkout' \| 'status')`, z. B. `seedToken('orders:O10', 'status')` (§8.6, §14.4) |
| Plan-Entwürfe P1 | Netzwerk-Wächter in `vitest.setup.ts` oder `tests/setup/network-guard.ts` | Wächter in `tests/setup/network-guard.ts`, eingebunden über `vitest.setup.ts` (§7.2) |
| ARCHITEKTUR-Entwurf | `content/seed/placeholders/`, `content/seed/texts/` | entfallen: Platzhalter in `src/art/placeholders/`, Seed-Texte in `content/seed/data/` |
| Plan-Entwürfe P8/P9 | fester Unterpfad `content/seed/instagram-export/media/stories/` | kein fester Unterpfad: Monatsordner direkt in `content/seed/instagram-export/`, Zuordnung über Dateiname und `uri` im JSON |
| Plan-Entwürfe P8–P10 | Skripte ohne Eintrag in §6.10 | `seed:reset`, `seed:import-instagram`, `art:coco-refs`, `art:placeholders`, `handbook:shots`, `check:golive`, `check:versions` stehen in §6.10 |

---

## Anhang B – Spikes mit Rückfallebene

Jeder Spike wird in der genannten Phase **zuerst** erledigt (kleiner Prototyp mit Test), dann gilt Soll oder Rückfall.
Das Ergebnis wird hier eingetragen („Ergebnis: …, Datum, PR“); weicht es vom Soll ab, zusätzlich ADR in `docs/adr/`.
Kein Spike darf die Phase blockieren: Scheitert das Soll, wird ohne Rückfrage die Rückfallebene umgesetzt.

| ID | Phase | Frage | Soll | Erfolgskriterium | Rückfallebene | Ergebnis |
|---|---|---|---|---|---|---|
| B-01 | P1 | Läuft die Payload-Verwaltung unter `ADMIN_ROUTE` per Proxy-Umschreibung auf den internen Ordner `admin/` – und mit Nonce-CSP (§8.1 Kontext `admin`)? | §8.4, §8.1 | AK-A-8-02; Login, Listen, Bearbeiten, eigene Ansichten, Passwort-Reset-Link, Manifest und Service Worker funktionieren unter `/werkstatt` ohne CSP-Verstoß | Pfad: Ordner heißt wie der Pfad (`src/app/(payload)/werkstatt/`), Startprüfung „Ordner = `ADMIN_ROUTE`“, Produktionspfad per Umbenennung in P11. CSP: `script-src 'self' 'unsafe-inline'` nur im Kontext `admin` (Hosts bleiben `'self'`; R-131, Kanzleifrage K-41), ADR | Ergebnis Pfad: Soll erfüllt – `src/proxy.ts` (Next 16, Node-Laufzeit) schreibt `ADMIN_ROUTE/*` intern auf den Ordner `admin/` um, `/admin` und `/admin/*` antworten mit 404 ohne Weiterleitung (`/admin/` normalisiert Next per 308 auf `/admin` → 404); `routes.admin = ADMIN_ROUTE`, `admin.importMap.importMapFile` zeigt fest auf `app/(payload)/admin/importMap.js`. Login, Übersicht, Liste, Bearbeiten, Weiterleitung auf `/werkstatt/login` und Passwort-Reset-Link `/werkstatt/reset/<token>` funktionieren mit `pnpm dev` und `pnpm start` (Desktop, iPhone 15/WebKit, Pixel 7); der Pfad steht in keiner Datei unter `.next/static` (`pnpm check:external --built`). GraphQL-Routen entfernt (`/api/graphql` → 404). Manifest/Service Worker (PWA) prüft P5.29, den CSP-Teil (Nonce, §8.1 Kontext `admin`) P2.12 (`tests/e2e/admin-route.e2e.spec.ts`, `tests/e2e/admin.e2e.spec.ts`), 27.09.2026, PR #1. Ergebnis CSP-Teil: Soll erfüllt – der Proxy setzt unter `ADMIN_ROUTE` `script-src 'self' 'nonce-…' 'strict-dynamic'`; Login, Liste und Bearbeiten ohne CSP-Verstoß (`tests/e2e/security-headers.e2e.spec.ts`), ADR 0002, 27.09.2026, P2.12 |
| B-02 | P1 | Funktioniert `@payloadcms/storage-s3` doppelt (öffentlich/privat) inkl. Präfix `private/invoices/` je Dokument und `signedDownloads` 300 s? | §3.3 | DM-PRIV-01 gegen MinIO grün; private Datei nur per signierter URL, nach Ablauf 403 | eine Instanz für alle Collections + eigener Download-Handler mit `@aws-sdk/s3-request-presigner`; Rechnungen notfalls eigener Bucket (C-06) | Ergebnis: Soll erfüllt – zwei Instanzen `@payloadcms/storage-s3` 3.90.2 (`clientCacheKey` je Bucket, `alwaysInsertFields` für gleiches Schema bei `local`), Dokument-Präfix `private/invoices/<Jahr>` wird übernommen, Dateiroute leitet nur die Verwaltung per 302 auf eine signierte URL (300 s) um, anonym 403, abgelaufene Signatur 403; geprüft gegen einen MinIO-kompatiblen Dienst (RustFS, weil das Image `minio/minio` hier nicht erhältlich war), R2 selbst in P11 (`tests/int/adapters/storage.contract.int.spec.ts`), 27.09.2026, PR #1 |
| B-03 | P2 | Lässt sich `script-src` auf statischen Seiten ohne `'unsafe-inline'` betreiben (`experimental.sri`, Inline-Daten von Next)? | §8.1 Kontext `public` | alle öffentlichen Routen ohne CSP-Verstoß in E2E, Seiten bleiben statisch | `'unsafe-inline'` im Kontext `public` (Hosts bleiben auf `'self'` beschränkt, R-131 erfüllt), ADR | Ergebnis: Rückfall umgesetzt – mit `experimental.sri` und Hash von `pc-motion` blockiert Chromium auf jeder statischen Seite die Inline-RSC-Daten von Next (`self.__next_f.push(…)`, je Seite/Build anders, nicht per Hash in `next.config.ts` erlaubbar; Nonce erzwänge dynamisches Rendern). Kontext `public` daher `script-src 'self' 'unsafe-inline'` ohne Hash und ohne fremde Hosts, `experimental.sri` aus; `pc-motion` in `dynamic`/`checkout` per Hash neben der Nonce. ADR `docs/adr/0002-csp-script-src.md`, 27.09.2026, P2.12. P10.5 (05.10.2026): erneut bewertet, Entscheidung unverändert (Rückfall `unsafe-inline` nur im Kontext `public`, nur `'self'`-Hosts; Audit `tests/unit/security/audit.unit.spec.ts`, `tests/e2e/security-headers.e2e.spec.ts`) |
| B-04 | ab P2, optional | Bringen Cache Components (`cacheComponents: true`) Vorteile ohne Nebenwirkungen? | nein, `unstable_cache` bleibt (§9.2) | Build, Verwaltung und alle Tests grün, messbar besseres LCP/TTFB | Soll beibehalten | offen |
| B-05 | P3 | Bleiben Listen-Varianten (`?available=1&page=2`) per Proxy-Umschreibung statisch? | §9.1 | AK-A-9-03 | dynamisches Rendern mit Daten-Cache, nur wenn T-10 (LCP) grün bleibt | Ergebnis: Soll erfüllt – `src/proxy.ts` übersetzt über `decideListVariant` (`src/lib/shop/listParams.ts`, ohne Payload/DB) bekannte Parameter in `/{locale}/<Ordner>/variant/<schlüssel>` (Schlüssel alphabetisch, z. B. `available-1.page-2`; `available` nur R02/R03, `category` nur R05 laut KONZEPT §2.3) und schreibt intern dorthin um; unbekannte/ungültige Parameter → keine Umschreibung (gleiche Antwort wie ohne). Im Produktions-Build liefert `/de/shop?available=1` die vorgerenderte Variante (`x-nextjs-cache: HIT`, Eintrag im Prerender-Manifest, byte-gleich mit `?available=1&foo=bar`); nicht vorgerenderte Varianten (`?available=1&page=2`) entstehen beim ersten Aufruf (`dynamicParams`, MISS) und kommen danach aus dem Cache (HIT). Interne Pfade `…/variant/…` antworten direkt mit 404 (keine doppelten Inhalte); Anfragen mit `x-prerender-revalidate` umgehen den Proxy und erreichen sie weiterhin (E2E-Vorwärmen). canonical = Query-Form ohne `available`/`category`, `page` ab 2. Layout-Segmente `…/variant/<k>` gehören zur Liste (`matchSegments`, Preset `shopString`); `check:static` erlaubt Varianten-Seiten nur für R02/R03/R05. Prototyp: R02-Variante (`[locale]/shop/variant/[variant]/page.tsx`); R03/R05-Varianten mit P3.5/P3.6 umgesetzt, in P3.16 von `@privacy`, `@a11y`, Verbotsmuster-Scan, `check:bundle` und Vorschau-Export mitgeprüft (`tests/unit/shop/list-params.unit.spec.ts`, `tests/e2e/shop/list-variants.e2e.spec.ts`), 28.09.2026, PR #3 |
| B-06 | P10 | Reicht der eigene COPY-Dump auf Vercel (Speicher, 300 s, Streaming von age)? | §10.3 | AK-A-10-01 bis -05; zehnfacher Beispielbestand in < 60 s und < 512 MB Speicher | gebündeltes statisches `pg_dump` 17 (`outputFileTracingIncludes`) + `pg_restore`; zweite Ebene: Neon-Wiederherstellung + Backup über den Docker-Pfad | **bestanden (P10.8, lokal):** eigener COPY-Dump, Streaming gzip → age (`age-encryption` 0.3.1 streamt) → Datei/S3-Multipart; 400 000 Zeilen (151 MB Tabelle, ≈ 10× Beispielbestand) in 3,4 s, 33 MB Chiffrat, läuft mit `--max-old-space-size=96` (konstanter Speicher); Rückfallebene nicht nötig. Messung auf Vercel selbst folgt mit dem ersten Produktionslauf (P11.3) |
| B-07 | P4 | Erlaubt die gepinnte Stripe-API-Version `checkout.sessions.update` mit neuen `shipping_options` bei `ui_mode: 'elements'`? | `updateShipping` → `updated` | Test im Stripe-Testmodus (falls Test-Schlüssel als API-Credential vorhanden) oder Parameter-Test gegen stripe-mock + Doku der gepinnten Version | `recreate_required`: alte Session beenden, neue mit derselben Reservierung (§3.5) | Ergebnis: Soll umgesetzt, im Stripe-Testmodus noch unbestätigt – SDK `stripe` 22.6.2 bringt `ApiVersion` `2026-08-26.dahlia`; deren OpenAPI (SDK-Typen `Checkout.SessionUpdateParams`, stripe-mock v0.205.0 mit identischer Version) führt `shipping_options` bei `POST /v1/checkout/sessions/{id}` ohne Einschränkung auf einen `ui_mode` (nur `collected_information` ist auf embedded/custom beschränkt); stripe-mock nimmt die Anfrage mit `shipping_options[0][shipping_rate_data]` (`fixed_amount`) an, ungültige Formen lehnt es ab. Stripe.js 9.17.0 hat für `ui_mode: 'elements'` `runServerUpdate`. `updateShipping` sendet daher das Update → `updated`; lehnt Stripe ab (`invalid_request_error`) oder ist die Session nicht mehr offen → `recreate_required` (Rückfall automatisch; fest einschaltbar über `UPDATE_SHIPPING_STRATEGY = 'recreate'`). Ohne Testschlüssel nicht belegbar: echte Annahme durch Stripe und Betragsaktualisierung im Zahlungsfeld → vor Go-live im Stripe-Testmodus prüfen (P11, OFFENE-PUNKTE; Kontrakttest-Lebenszyklus mit `PC_TEST_ALLOW_STRIPE_API=1`). Tests: `tests/unit/payments/stripe-params.unit.spec.ts`, `tests/int/adapters/payments.contract.int.spec.ts` (stripe-mock), 28.09.2026, P4.5 (PR folgt mit Phase P4) |
| B-08 | P10 | Baut das Docker-Image ohne DB, und rendern die Seiten dann zur Laufzeit korrekt? | §13.2 (`BUILD_WITHOUT_DB=1`, `connection()`) | AK-A-13-01, AK-A-13-02 | Build im Compose-Netz mit laufender, migrierter DB (`DATABASE_URL` als Build-Argument einer Wegwerf-DB) | Ergebnis: Soll erfüllt – `BUILD_WITHOUT_DB=1 pnpm build` mit unerreichbarer `DATABASE_URL` (127.0.0.1:1) gelingt (`dbGate()` in `src/lib/db/buildGate.ts`: `connection()` vor dem ersten DB-Zugriff in `cached()`, `getPublicPayload`, `getPublicSettings`, `getActive` und `src/lib/data/*`; `loadPublicProductSlugs()` liefert dann `[]`). Der Build danach gegen die migrierte, befüllte Datenbank gestartet (`next start`) antwortet 200 auf `/api/health`, `/de`, `/en`, `/de/shop`, `/de/shop/906-fliese-auftritt`, `/de/archiv`, `/de/impressum`, `/api/health/freshness`. Der Rückfall (Build mit Wegwerf-DB) war nicht nötig. Docker-Lauf selbst (Image ≤ 500 MB, Compose) belegt der CI-Job `docker` im Phasenende-PR, 05.10.2026, P10.12 |
| B-09 | P1 | Stellen `payload.jobs.handleSchedules()` und `payload.jobs.run()` in 3.90.2 die in §9.6 angenommenen Funktionen bereit (auch mit injizierter Zeit)? | §9.6 | Int-Test: geplanter Task wird durch einen Tick mit vorgestellter Uhr eingereiht und ausgeführt | eigene Tabelle `job_schedules (task, next_run_at)` und Einreihen im Tick | Ergebnis: Soll erfüllt – `handleSchedules({ allQueues, req })`, `run({ allQueues, limit, where, req })`, `runByID`, `queue`, `cancel` vorhanden; ein stündlich geplanter Test-Task wird bei vorgestellter Uhr (`Date` gefälscht) mit `waitUntil` = nächste volle Stunde eingereiht, erst danach ausgeführt, nicht doppelt eingereiht; `req.context` (injizierte Zeit `now`) erreicht den Task. Hinweis: erledigte Jobs löscht Payload standardmäßig (`deleteJobOnComplete`) – das Lauf-Protokoll (P5.3) braucht eine eigene Ablage (`tests/int/spikes/b09-jobs.int.spec.ts`), 27.09.2026, PR #1 |
| B-10 | P2 | View Transitions (DESIGN §9.8): Bieten Next 16.3.6/React 19.2.6 `ViewTransition`, braucht es `experimental.viewTransition`? | Soll: weiche Navigation mit Namen `coco`/`leash-head`, harte per `@view-transition`, nie von/zu `calm`, nicht bei reduzierter Bewegung | Rückfall: ohne Übergang | Ergebnis: umgesetzt mit Einschränkung – `react@19.2.6` exportiert `ViewTransition` nicht, der App Router nutzt aber die mitgelieferte Canary (Export vorhanden); `experimental.viewTransition` existiert in 16.3.6 nicht mehr. Harte Navigation per `@view-transition` (nur Presets mit Übergang), weiche per `<ViewTransition>` um Inhalt und Coco (P2.18); ADR `docs/adr/0003-view-transitions.md`, 2026-09-28, PR #2 |

---

## Anhang C – Annahmen und offene Punkte

Umgesetzt wird jeweils die Spalte „Standard“. Punkte mit Entscheider „Jutta“, „Kanzlei“ oder „Steuerberatung“ überträgt
die erste P1-Session in `docs/OFFENE-PUNKTE.md` (dieses Dokument ist die Quelle); Punkte „P1“ sind Arbeitsaufträge. Punkte mit
„**angeglichen am 26.09.2026**“ sind durch die Angleichung der P0-Dokumente erledigt und stehen nur noch zur
Nachvollziehbarkeit hier; „nur Hinweis“ braucht keine Entscheidung.

| ID | Thema | Standard (umgesetzt) | Änderung später / wer |
|---|---|---|---|
| C-01 | Neon Free reicht | Job-Wecker hält den Verbrauch ≤ 40 CU-h; Backup-Dump ≤ 512 MB | bei > 50 CU-h zur Monatsmitte oder > 0,4 GB Daten: nutzungsbasierter Neon-Tarif (Kosten in P11 prüfen, E-05) – Jutta |
| C-02 | Vercel-Ausgabenlimit | Benachrichtigung bei 50/75/100 % von 10 USD On-Demand, **keine** automatische Pause | harte Pause ja/nein – Jutta in P11 |
| C-03 | Branch-Schutz | GitHub Free: Merge-Regel §6.7 als Arbeitsregel | GitHub Pro (≈ 4 USD/Monat) für echten Branch-Schutz (ohne Pflicht-Checks, §6.7 Nr. 4), Budget bleibt ≤ 25 € – Jutta |
| C-04 | Kontingente ungeprüft | Sentry Developer enthält Uptime-Monitoring (M-07); Lettermint Free reicht für das Mailvolumen | falls nicht: kein weiterer Anbieter; RUNBOOK-Routine (wöchentlich `/api/health/freshness` aufrufen) plus A12-Mails; ein Zusatzdienst nur mit DIENSTE-Eintrag – in P11 prüfen, Jutta |
| C-05 | Warenkorb-Cookie | `pc_cart` 7 Tage, nicht HttpOnly, Inhalt nur Stück-IDs, Preis beim Hinzufügen (`p`) und Lieferart; Kassen-Token getrennt in `pc_checkout` (HttpOnly, 1 h); erstes Cookie erst bei „In den Korb“ (§8.7). KONZEPT §4.2 und RECHT R-130/L-01 sind darauf angeglichen (26.09.2026); beide Cookies gelten als technisch notwendig (§ 25 Abs. 2 Nr. 2 TDDDG). Offen: Kanzleifrage K-38, ob stattdessen ein Server-Warenkorb mit Zufalls-ID nötig ist – das hieße eine DB-Abfrage je Seitenaufruf für die Korb-Anzahl (DB wach, A-10) | falls die Kanzlei es verlangt: `pc_cart` HttpOnly mit Zufalls-ID, Tabelle `carts`, Endpunkt für die Anzahl – Kanzlei (K-38) in P11 |
| C-06 | Rechnungs-Ablage | privater Bucket, Präfix `private/invoices/` mit R2-Bucket-Sperre (soweit verfügbar; Dauer = `settings.retention.invoiceYears`, erst nach der Entscheidung 8 oder 10 Jahre setzen, §3.3), täglicher Spiegel, monatliche Prüfsummen; **keine** Versionierung (R2 bietet sie nicht, Löschungen müssen wirken). DIENSTE §3.4 ist darauf **angeglichen am 26.09.2026** | eigener Bucket `pct-invoices-prod` (Rückfall B-02), falls Sperren je Präfix fehlen oder die Steuerberatung es verlangt – Jutta mit Steuerberatung/Kanzlei in P11 |
| C-07 | Backups | Vercel Cron in der App (§10), nie über GitHub Actions (DIENSTE §3.11/L-23) | **angeglichen am 26.09.2026** (KONZEPT §8.2) |
| C-08 | Jobs | Job-Wecker (§9.6) statt Minuten-Cron mit DB-Zugriff (Kosten E-05, Neon); Task-Slugs aus Anhang A.3 | **angeglichen am 26.09.2026** (DATENMODELL §11, LOESCHKONZEPT §4); Änderung nur per ADR (z. B. bei Docker-Betrieb oder einem Neon-Tarif ohne Kontingentgrenze) |
| C-09 | Kunden-Token | Kassen-, Danke- und Status-Token zufällig, nicht aus `PAYLOAD_SECRET` abgeleitet (§8.6) | **angeglichen am 26.09.2026** (DATENMODELL §14) |
| C-10 | Fehlende Datenmodelle | Kasse als eigenes Objekt (Kassen-Token, Zustand `confirming`, KONZEPT §4), `deletion-log` (L-18, nötig für `retention:replay`), `privacy-requests` (L-17) | **angeglichen am 26.09.2026**: DATENMODELL ergänzt `checkouts`, `deletion-log`, `privacy-requests` |
| C-11 | Rate-Limits | Speicherdauer 24 h (R-134, L-13a); Widerruf 30/h (RECHT) (§8.5) | **angeglichen am 26.09.2026** (KONZEPT) |
| C-12 | JS-Budget | Recherche-Ziel 90 KB gz ist mit React 19 + App Router nicht erreichbar; Gates §7.7 | – (nur Hinweis) |
| C-13 | Versionen | TypeScript 5.7.3, Vitest 4.0.18, Playwright 1.58.2 wie im Gerüst (nicht wie in der Recherche) | Updates per Dependabot (§1.3) – nur Hinweis |
| C-14 | Offene Punkte aus dem P0-Gerüst | Stand 26.09.2026 (alles Übrige ist in P0 behoben): (1) `tests/helpers/login.ts`, `tests/helpers/seedUser.ts` und `tests/e2e/admin.e2e.spec.ts` nutzen fest `/admin` → auf `ADMIN_ROUTE` umstellen (AK-A-8-02). (2) `.env.example` aus `src/lib/env.ts` generieren (§5.1); dann kommen u. a. `SEED_NOW`, `SEED_ADMIN_*`, `DATABASE_URL_TEST`, `PAYLOAD_DB_PUSH`, `S3_PRIVATE_BUCKET`, `NEXT_PUBLIC_ANALYTICS_ENABLED` dazu. (3) `ci.yml` an §6.3 angleichen: Job `checks` in `quick` umbenennen (Pflicht-Check „CI / quick“, §6.7; Workflow-Name `CI` bleibt für `dependabot-automerge.yml`), Auslöser laut §6.2 (`pull_request` mit PR-Typ `ready_for_review`, `workflow_dispatch`; den `push`-Auslöser auf `main` entfernen) und Schritt „Kennung“ ergänzen; Service-`POSTGRES_DB` sowie `DATABASE_URL`/`DATABASE_URL_TEST` auf `planetclaire_test`; Umgebung um `TZ=UTC`, `DB_POOL_MAX=25`, `SEED_NOW`, `SEED_ADMIN_*`, `NEXT_PUBLIC_LEASH_DEBUG`, `E2E_SERVER` ergänzen; Schritte `check:static`, `payload migrate` + `check:migrations`, `seed` vor `build`, `check:bundle`/`check:external`, E2E-Rauchtest, `gitleaks`, `pnpm audit` und Artefakt-Upload bei Fehler ergänzen, sobald das jeweilige Skript existiert; Caches laut §6.2. (4) `.npmrc` mit `save-exact=true` (§1.3). (5) `next` und `eslint-config-next` auf den neuesten 16.3.x-Patch ≥ 16.3.7 (§1.1) | P1, erste Aufgabe |
| C-15 | Seed-Konventionen | Seed-Stücke 901–930, E2E-Fixtures 980–999 (nur Test-DB), Bestellnummern `PC-2026-900NN`, Belegserien `BSP-RE-…`/`BSP-GS-…`, Mail-Adressen `@example.com`/`@example.org`; Mail-Unterdrückung für `example.com`, `example.org`, `example.net`, `*.invalid`, `*.test` (§3.4) | **angeglichen am 26.09.2026** (KONZEPT §11, DATENMODELL §13, SEED-SPEC) |
| C-16 | Neon-Wiederherstellungsfenster | im Free-Tarif kurz (Stunden, ungeprüft); maßgeblich ist das eigene Backup (§10) | in P11 prüfen – Jutta (mit Neon-Tarif, C-01) |
| C-17 | DNS-Werte von Vercel | werden aus der Vercel-Oberfläche übernommen, nicht aus diesem Dokument (§12.4) | P11 gemeinsam mit Jutta |
| C-18 | Zeit in SQL | nie `now()` direkt, sondern Parameter `$now` (A-08) | **angeglichen am 26.09.2026** (DATENMODELL) |
| C-19 | Bildgrößen | nur `media.imageSizes` aus DATENMODELL §6.2, **kein** `card-s` (§9.4) | **angeglichen am 26.09.2026** (DESIGN §12.2) |
| C-20 | GSAP | nur laut DESIGN §9.10 (ADR, Lazy-Chunk auf R01, ≤ 30 KB gz); Standard eigener Code + WAAPI | **angeglichen am 26.09.2026** |
| C-21 | Übersetzungs-Mock | `"[EN] " + Text` (§3.6) ist verbindlich | **angeglichen am 26.09.2026** |
| C-22 | Fehlende Dokumente | `PLAN.md` und `docs/CLOUD-SETUP.md` existieren; `docs/RUNBOOK.md` entsteht in P10 aus §10–§13, `docs/GO-LIVE.md` (DNS-Umstellung, Start-Checkliste; Tabellen wörtlich aus §12.4) ebenfalls in P10 (Verweise darauf sind Vorgaben für deren Inhalt) | **angeglichen am 26.09.2026** |
| C-23 | Browser-Fehlermeldungen (`/api/client-errors`, M-02) | **aus**: `NEXT_PUBLIC_CLIENT_ERRORS_ENABLED=false`, Route antwortet 404, kein Client-Skript (§2.5); Code wird in P10 gebaut und getestet | einschalten erst, wenn Kanzleifrage K-30 (c) es erlaubt; dann nur first-party, ohne Cookies, IP-Speicherung und Personendaten (R-133, R-137) – Jutta nach Antwort der Kanzlei, P11 |
| C-24 | Rechnung auf der Statusseite | keine Rechnung und keine Gutschrift per Token-Link; Belege nur als Mail-Anhang und in der Verwaltung; die Token-Route liefert nur Rechtstext-PDFs der Bestellung (R-067 ist strenger als KONZEPT §4.12 und nennt den Schutzgrund Art. 5 Abs. 1 lit. f, Art. 25, 32 DSGVO; §8.3) | erlaubt die Kanzlei den Download, wird der Dateityp `invoice`/`credit_note` in `GET /api/orders/[token]/documents/[file]` freigeschaltet (eine Konstante) – Kanzlei in P11 |
| C-25 | Wartungsmodus und Widerruf | R26 bleibt im Wartungsmodus erreichbar und funktioniert, solange die Datenbank erreichbar ist; nur ohne Datenbank zeigt R26 den Widerruf per E-Mail (§5.2); Widerrufe aus der Zeit einer Wiederherstellung übernimmt §10.5 Schritt 6 d | anders nur auf Wunsch der Kanzlei – Kanzlei/Jutta in P11 |
| C-26 | Verwaltung vor der DNS-Umstellung | in Produktion lassen `cors`/`csrf` zusätzlich die Vercel-Produktions-Domain zu (§8.2), damit P11 die Daten vor der Umstellung einpflegen kann; kanonische URLs bleiben auf der Hauptdomain | nach der DNS-Umstellung darf die Zusatz-Domain entfallen (eine Zeile in `payload.config.ts`) – Claude-Session in P11 |
| C-27 | Größenhinweis der Vorschau-Datei und R-182 | Ziel ≤ 20 MB, harte Grenze 40 MB (§14.8); über 20 MB sagt der Release-Text „Die Datei ist zu groß für eine Mail – per Link oder USB-Stick auf einen anderen eigenen Rechner bringen.“ – das passt zu R-182 („Interne Vorschau – nicht weitergeben“, Kundenfotos ohne Einwilligung); die automatische Neukodierung beginnt schon über 20 MB | Erlaubt die Kanzlei (K-34) die Weitergabe, wird der Satz angepasst (ein Satz in `release.yml`) – Kanzlei/Jutta in P11 |
| C-28 | Ergänzungen zur CI-Disziplin (§6.2, §6.6, §6.7) | `ci.yml`, `ci-full.yml`, `preview-export.yml` laufen nur bei `pull_request` und `workflow_dispatch`, nie bei `push` auf `main` (der gemergte Stand ist der geprüfte PR-Stand); auf `main` läuft bis P10 nur `release.yml` (Push, täglicher `schedule` 06:00 UTC als Rückfall, Dispatch; endet nach Sekunden, solange `OFFEN_P1_P10 ≠ 0` oder das Release aktuell ist) und monatlich `restore-drill.yml`. Squash-Nachrichten, PR-Titel und PR-Beschreibungen enthalten nie `[skip ci]` (in keiner Phase); Merge-Commits von `main` in den Arbeitsbranch dürfen `[skip ci]` tragen. Jutta stellt einmalig unter „Allow squash merging“ „Default to pull request title and description“ ein (CLOUD-SETUP §1). `[ci:update-snapshots]` und `[ci:art]` starten keinen `quick`; Referenzbilder auch per `workflow_dispatch`; keine Pflicht-Checks bei GitHub Pro – alles, damit das Budget ≤ 1.500 min hält | ändern, wenn nach jedem Merge ein Lauf auf `main` gewünscht ist (dann ≈ +150 min für P1–P10) – Session per PR |
| C-29 | Kennung bei `pull_request` lesen | GitHub stellt die Commit-Nachricht bei `pull_request` nicht als Ausdruck bereit; der erste Schritt bzw. der Job `mode` liest sie per `gh api …/commits/<head.sha>` (§6.2). Übersprungene Workflows kosten dadurch je ~1 min (im Budget §6.8 enthalten) | scheitert der API-Aufruf, schlägt der Schritt fehl (sichtbar rot, kein stilles Überspringen); bei zu hohen Kosten `ci-full.yml`/`preview-export.yml` statt über `pull_request` über `push` mit `branches-ignore: [main]` und Job-Bedingung auf `github.event.head_commit.message` – Session per PR mit ADR |
