// Lokale Prüfschleuse (`pnpm ci:local`, U-65/U-66, ARCHITEKTUR §6): Planung ohne Seiteneffekte – Optionen lesen,
// Umgebung der Schritte bauen, Schritte je Modus auswählen. Ausgeführt werden sie in `scripts/ci-local.ts`.
// Die Schritte bilden die bisherigen Workflows nach: `quick` = ci.yml (ohne Int/Build/Rauchtest, die in `full` laufen),
// `full` = quick + ci-full.yml (quality, e2e-full je Gerät, docker) + preview-export.yml + restore-drill.yml,
// `art` = art-qa.yml. Seit U-67: iPhone 15 am Phasenende nur mit den mobilen Kernfällen (`IPHONE_CORE`), Kunst-QA nur
// bei Kunst-Änderungen seit dem letzten nachweislich grünen Kunst-Stand (`artGate`).

import { ART_PROFILES } from '../art/lib/run'

export const MODES = ['quick', 'full', 'art'] as const
export type Mode = (typeof MODES)[number]

export const DEFAULT_DB = 'planetclaire_ci'
export const DEFAULT_PORT = 3300
export const GITLEAKS_VERSION = '8.30.1'
export const GITLEAKS_SHA256 = '551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb'

export interface Options {
  mode: Mode
  /** Datenbank-Grundname; `<db>` und `<db>_test` (beide per `db:ensure` angelegt). */
  db: string
  /** Erster Port; die Schritte nutzen `port` … `port + 5` (siehe `ports`). */
  port: number
  only: string[] | null
  from: string | null
  /** Commit-Status über die GitHub-API setzen (nur vollständiger Lauf, sauberer Baum, HEAD gepusht). */
  status: boolean
  /** Nach einem roten Schritt weitermachen (Standard: anhalten). */
  keepGoing: boolean
  /** Zusätzliche Playwright-Argumente für die E2E-Schritte (z. B. einzelne Specs), nach `--`. */
  e2eArgs: string[]
  /** Nur planen und ausgeben. */
  dryRun: boolean
  /** `full`: iPhone 15 mit allen E2E-Tests statt der Kernfälle (U-67 a). */
  iphoneAll: boolean
  /** `art`: auch ohne Kunst-Änderung seit dem letzten vollständigen Kunst-Lauf (U-67 b). */
  force: boolean
}

export class UsageError extends Error {}

export const USAGE = `Aufruf: pnpm ci:local <quick|full|art> [Optionen]
  --db <name>        Datenbank-Grundname (Standard ${DEFAULT_DB}; dazu <name>_test)
  --port <n>         erster Port (Standard ${DEFAULT_PORT}; belegt n … n+5)
  --only <a,b>       nur diese Schritte
  --from <schritt>   ab diesem Schritt (Wiederaufnahme)
  --keep-going       nach einem roten Schritt weitermachen
  --status           Commit-Status lokal/ci-<modus> setzen (nur vollständiger Lauf, sauberer Baum, HEAD gepusht)
  --dry-run          nur die geplanten Schritte zeigen
  --iphone-all       full: iPhone 15 mit allen E2E-Tests statt nur der Kernfälle (U-67)
  --force            art: auch ohne Kunst-Änderung seit dem letzten vollständigen Kunst-Lauf (U-67)
  -- <args>          weitere Playwright-Argumente für die E2E-Schritte (z. B. tests/e2e/home.e2e.spec.ts);
                     Spec-Dateien hier ersetzen beim iPhone die Kernfälle`

export function parseArgs(argv: readonly string[]): Options {
  const dashdash = argv.indexOf('--')
  const own = dashdash >= 0 ? argv.slice(0, dashdash) : [...argv]
  const e2eArgs = dashdash >= 0 ? argv.slice(dashdash + 1) : []
  const opts: Options = {
    mode: 'quick',
    db: DEFAULT_DB,
    port: DEFAULT_PORT,
    only: null,
    from: null,
    status: false,
    keepGoing: false,
    e2eArgs,
    dryRun: false,
    iphoneAll: false,
    force: false,
  }
  let mode: string | null = null
  const value = (i: number, flag: string): string => {
    const v = own[i + 1]
    if (v === undefined || v.startsWith('--')) throw new UsageError(`${flag} braucht einen Wert.`)
    return v
  }
  for (let i = 0; i < own.length; i++) {
    const a = own[i]!
    if (a === '--db') opts.db = value(i++, a)
    else if (a === '--port') opts.port = Number(value(i++, a))
    else if (a === '--only')
      opts.only = value(i++, a)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    else if (a === '--from') opts.from = value(i++, a)
    else if (a === '--status') opts.status = true
    else if (a === '--keep-going') opts.keepGoing = true
    else if (a === '--dry-run') opts.dryRun = true
    else if (a === '--iphone-all') opts.iphoneAll = true
    else if (a === '--force') opts.force = true
    else if (a.startsWith('--')) throw new UsageError(`Unbekannte Option ${a}.`)
    else if (mode === null) mode = a
    else throw new UsageError(`Unerwartetes Argument ${a}.`)
  }
  if (mode === null) throw new UsageError('Modus fehlt (quick, full oder art).')
  if (!(MODES as readonly string[]).includes(mode))
    throw new UsageError(`Unbekannter Modus ${mode} (quick, full oder art).`)
  opts.mode = mode as Mode
  // Nie die Entwicklungs- oder Produktionsdatenbank: eigener Name mit Präfix planetclaire_ und „ci“.
  if (!/^planetclaire_[a-z0-9_]*ci[a-z0-9_]*$/.test(opts.db) || opts.db.endsWith('_test'))
    throw new UsageError(
      `--db ${opts.db} ungültig: planetclaire_…ci… (a–z, 0–9, _), ohne _test (das hängt das Skript an).`,
    )
  if (!Number.isInteger(opts.port) || opts.port < 1024 || opts.port > 65530)
    throw new UsageError(`--port ${opts.port} ungültig: ganze Zahl 1024–65530.`)
  if (opts.only && opts.from) throw new UsageError('--only und --from nicht zusammen.')
  if (opts.iphoneAll && opts.mode !== 'full') throw new UsageError('--iphone-all nur mit full.')
  if (opts.force && opts.mode !== 'art') throw new UsageError('--force nur mit art.')
  return opts
}

/** Ports der Schritte (alle frei zu Beginn, sonst Abbruch). */
export function ports(base: number) {
  return {
    app: base, // E2E, visuell (Playwright-Server)
    bundle: base + 1, // check:bundle (eigener next start)
    perf: base + 2, // Lighthouse HTTPS-Vorschaltserver
    perfUpstream: base + 3, // Lighthouse next start
    preview: base + 4, // Vorschau-Export
    art: base + 5, // Kunst-QA-Server
  }
}

/** Gleicher Postgres-Server wie `sourceUrl`, andere Datenbank. */
export function databaseUrl(sourceUrl: string, name: string): string {
  const u = new URL(sourceUrl)
  u.pathname = `/${name}`
  u.search = ''
  return u.toString()
}

/**
 * Testwerte wie in `ci.yml` (ARCHITEKTUR §6.3), aber mit eigener Datenbank. Gilt für die Prüf-Schritte von `quick`
 * (dieselben Werte wie der frühere Job, damit Unit-Tests nichts anderes sehen als dort).
 */
export function stepEnv(opts: Options, sourceDbUrl: string): Record<string, string> {
  return {
    CI: '1',
    APP_ENV: 'test',
    TZ: 'UTC',
    ADMIN_ROUTE: '/werkstatt',
    DATABASE_URL: databaseUrl(sourceDbUrl, opts.db),
    DATABASE_URL_TEST: databaseUrl(sourceDbUrl, `${opts.db}_test`),
    DB_POOL_MAX: '25',
    PC_INT_WORKERS: '3',
    PAYLOAD_SECRET: 'ci-only-secret-not-used-anywhere-else-0000',
    NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
    SEED_PREVIEW_MODE: 'true',
    SEED_NOW: '2026-10-15T10:00:00+02:00',
    SEED_ADMIN_EMAIL: 'admin@example.com',
    SEED_ADMIN_PASSWORD: 'ci-only-password-2026',
    STORAGE_DRIVER: 'local',
    EMAIL_DRIVER: 'file',
    PAYMENTS_DRIVER: 'mock',
    TRANSLATION_DRIVER: 'mock',
    CARRIER_DRIVER: 'manual',
    CRON_SECRET: 'ci-only-cron-secret-000000000000000000',
    NEXT_PUBLIC_LEASH_DEBUG: '1',
    NEXT_TELEMETRY_DISABLED: '1',
    E2E_SERVER: 'start',
  }
}

/** Zusätzlich für Schritte mit Server/Datenbank (alles außer den Prüf-Schritten von `quick`): eigene Ports. */
export function serverEnv(opts: Options): Record<string, string> {
  const p = ports(opts.port)
  // Kunst-QA: Server, Build und E2E-Helfer zeigen auf den QA-Server (art-qa.yml: Port 3200)
  const app = opts.mode === 'art' ? p.art : p.app
  return {
    NEXT_PUBLIC_SITE_URL: `http://localhost:${app}`,
    PORT: String(p.app),
    E2E_BASE_URL: `http://localhost:${app}`,
    PERF_PORT: String(p.perf),
    PERF_UPSTREAM_PORT: String(p.perfUpstream),
    PREVIEW_EXPORT_DB_NAME: `${opts.db}_preview`,
    PREVIEW_EXPORT_PORT: String(p.preview),
    ART_PORT: String(p.art),
  }
}

/** Aus der Umgebung des Aufrufs nie übernehmen (Ports/Ziele einer anderen Arbeitskopie, eigener Build-Ordner). */
export const STRIPPED_ENV = [
  'PORT',
  'E2E_BASE_URL',
  'PERF_PORT',
  'PERF_UPSTREAM_PORT',
  'PREVIEW_EXPORT_DB_NAME',
  'PREVIEW_EXPORT_PORT',
  'PREVIEW_PHASE',
  'ART_PORT',
  'ART_BASE_URL',
  'ART_DIST_DIR',
  'NEXT_DIST_DIR',
] as const

/** Aufruf-Umgebung ohne `STRIPPED_ENV`. */
export function inheritedEnv(
  env: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined> {
  const out = { ...env }
  for (const k of STRIPPED_ENV) delete out[k]
  return out
}

/** Umgebung eines Schritts: Testwerte, für Server-Schritte die Ports, dann die Werte des Schritts. */
export function envFor(step: Step, opts: Options, sourceDbUrl: string): Record<string, string> {
  return {
    ...stepEnv(opts, sourceDbUrl),
    ...(step.modes.includes('quick') || step.noServerEnv ? {} : serverEnv(opts)),
    ...step.env,
  }
}

/** Kontext zur Laufzeit (für Schritte, deren Befehl erst dann feststeht). */
export interface RunContext {
  opts: Options
  /** Lauf-ID der Kunst-Aufnahme (nach `art-record`). */
  artRunId?: string
}

export type Requirement = 'docker'

export interface Step {
  id: string
  title: string
  modes: readonly Mode[]
  /** Shell-Befehl (bash -c); Funktion, wenn er vom Lauf abhängt. */
  cmd: string | ((ctx: RunContext) => string)
  env?: Record<string, string>
  /** Fehlt die Voraussetzung, wird der Schritt als „übersprungen“ gemeldet (nie still grün). */
  requires?: Requirement
  /** Läuft auch nach einem roten Schritt (wie `if: always()` im Workflow), sofern ausführbar. */
  always?: boolean
  /** Ohne Server-Ports (Testwerte wie `quick`): Int-/Unit-Läufe erwarten die CI-Werte (z. B. Website-Adresse :3000). */
  noServerEnv?: boolean
  timeoutMin: number
}

/** Gibt ein Schritt diese Zeile aus, gilt er als „übersprungen“ (mit dem Rest der Zeile als Grund). */
export const SKIP_MARKER = 'CI_LOCAL_SKIP:'

const FETCH_CACHE =
  "node -e \"require('node:fs').rmSync('.next/cache/fetch-cache',{recursive:true,force:true})\""
/** Frische Datenbank wie je GitHub-Job: der Beispielbestand ließe Reservierungen früherer Läufe stehen. */
const FRESH_DB =
  'tsx --import=./scripts/lib/register-server-only.mjs scripts/ci/fresh-db.ts && pnpm payload migrate'
const E2E_GREP = '--grep-invert "@visual|@perf"'
const quote = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`

/**
 * U-67 a (Jutta, 10.10.2026, „iPhone-Tests nur Kernfälle“): Am Phasenende laufen alle E2E-Tests auf `desktop` und
 * `pixel-7`, auf `iphone-15` (WebKit, das langsamste Gerät) nur diese mobilen Kernfälle. Jeder Eintrag ist ein
 * Playwright-Dateifilter (Pfad ab Projektwurzel; Ordner mit `/` am Ende) und sagt, was er auf dem iPhone abdeckt.
 * Gemessen am 10.10.2026 (Summe der Testdauern in den iPhone-Logs unter `ci-reports/`): ganzes iPhone-Paket ≈ 52 min,
 * diese Liste ≈ 20 min.
 *
 * Pflicht in der Liste sind Specs, die `pixel-7` absichtlich auslassen (Paar Chromium `desktop` + WebKit `iphone-15`):
 * ohne iPhone liefe ihr Mobil-Teil auf keinem Telefon (`shop/gallery`, `privacy.e2e` „Datenschutz P3“, `keyboard.e2e`
 * „Tastatur-Durchlauf Shop P3“; der Unit-Test prüft das). Ganze Dateien statt `datei:zeile`, weil Playwright unter dem
 * tsx-Lader die Zeilen der Tests nicht kennt (Logs zeigen `:1:<spalte>`).
 *
 * Bewusst nicht dabei (laufen weiter auf `pixel-7` und – außer dem Kaufpfad `purchase/**`, `metrics/purchase-path`,
 * den `playwright.config.ts` dort auslässt – auf `desktop`):
 * - Routen-Durchläufe, die ihre Fenstergrößen selbst setzen bzw. nur das DOM prüfen: `legal/footer.e2e` (Pflichtlinks
 *   je Route bei 390/1440 px), `a11y.e2e` (axe je Route; die P3-Varianten lassen das iPhone ohnehin aus) – zusammen
 *   ≈ 9 min auf dem iPhone;
 * - Verwaltung (`admin/**`), Vorkasse/Reservierung (`purchase/prepayment`, `purchase/reservation`), Kennzahlen,
 *   Tattoo-, Auftrags- und SEO-Seiten;
 * - Linie/Coco/Choreografie (`leash*`, `coco`, `home-choreo`, `reduced-motion`) prüfen die Engine ohnehin nur in
 *   Chromium; WebKit sieht die Kunst-QA (Profil `art-iphone15`).
 */
export const IPHONE_CORE: readonly { spec: string; covers: string }[] = [
  // Startseite
  {
    spec: 'tests/e2e/home.e2e.spec.ts',
    covers:
      'Startseite DE/EN: Kopf-Station und 5 Stationen, Schriften-Tor, ohne JavaScript, Beispielbestand',
  },
  {
    spec: 'tests/e2e/home/',
    covers: 'Stationen mit Stücken, Stationszeichnungen',
  },
  {
    spec: 'tests/e2e/home-tour.e2e.spec.ts',
    covers:
      'Tour-Schaukasten unter 1100 px hinter Station 01 eingeklappt (U-51), ohne JavaScript aufklappbar',
  },
  {
    spec: 'tests/e2e/home-koko.e2e.spec.ts',
    covers:
      'Koko: Augen nach Berliner Uhrzeit, Bild und Alt-Text, Pupillen, weniger Bewegung, Schalter „Animationen“',
  },
  // Kopfleiste, Menü, Sprache
  {
    spec: 'tests/e2e/shell.e2e.spec.ts',
    covers: 'Kopfleiste 320–390 px ohne Überlauf, Ziele ≥ 44 px, Skip-Link zuerst, Korb-Anzahl',
  },
  {
    spec: 'tests/e2e/menu.e2e.spec.ts',
    covers:
      'Menü: öffnen/schließen, Fokus bleibt im Dialog, reduzierte Bewegung, Pflichtlinks inkl. „Vertrag widerrufen“',
  },
  {
    spec: 'tests/e2e/language-switch.e2e.spec.ts',
    covers:
      'Sprach-Umschalter DE ↔ EN auf dieselbe Seite, Kopfleiste einzeilig bei 320/375/390 px (U-47)',
  },
  // Shop
  {
    spec: 'tests/e2e/shop/shop.e2e.spec.ts',
    covers: 'Shop-Liste und Kategorie: Aufbau, Chips, „nur verfügbare“, ohne JavaScript',
  },
  {
    spec: 'tests/e2e/shop/product-page.e2e.spec.ts',
    covers: 'Produktseite: Reihenfolge der Blöcke, Knopftexte, reserviert/verkauft, Pflichtangaben',
  },
  {
    spec: 'tests/e2e/shop/gallery.e2e.spec.ts',
    covers:
      'Produktgalerie mobil (Wischen, Doppeltipp-Zoom, Lightbox) und Kauf-Leiste KO-09a – lässt pixel-7 aus',
  },
  {
    spec: 'tests/e2e/shop/add-to-cart.e2e.spec.ts',
    covers: '„In den Korb“ mit und ohne JavaScript, veraltete Seite',
  },
  // Korb und Kasse
  {
    spec: 'tests/e2e/cart/cart.e2e.spec.ts',
    covers:
      'Korb: Summen, Entfernen, Lieferart, Zustände, Countdown, ohne JavaScript, kein Cookie beim Ansehen',
  },
  {
    spec: 'tests/e2e/checkout/checkout-form.e2e.spec.ts',
    covers:
      'Kasse: Pflichtfelder und Fehlerzusammenfassung, Lieferartwechsel, Countdown, Instagram-In-App-Browser',
  },
  {
    spec: 'tests/e2e/checkout/overview.e2e.spec.ts',
    covers:
      'genau ein Knopf „Zahlungspflichtig bestellen“ (EN „Order with obligation to pay“), Übersicht davor',
  },
  {
    spec: 'tests/e2e/checkout/legal-dialogs.e2e.spec.ts',
    covers: 'AGB, Widerrufsbelehrung und Datenschutz als Dialog in Safari (Schließen, Escape)',
  },
  {
    spec: 'tests/e2e/legal/checkout-compliance.e2e.spec.ts',
    covers:
      'Prüf-Suite Bestellprozess § 312j/312i/312f (R-036, R-063, R-064 ohne Icon, R-065, R-012, R-081) – Abnahme P6.12 verlangt iphone-15',
  },
  {
    spec: 'tests/e2e/purchase/card-paypal.e2e.spec.ts',
    covers: 'Kaufpfad Ende-zu-Ende: Karte, Apple-Pay-Kennung, PayPal, „Abgelehnt“ → Vorkasse',
  },
  // Widerruf und Rechtliches
  {
    spec: 'tests/e2e/legal/withdrawal-flow.e2e.spec.ts',
    covers:
      'Widerrufsfunktion in zwei Schritten (R-091/R-092/R-093), per Tastatur und ohne JavaScript',
  },
  {
    spec: 'tests/e2e/contact-withdraw.e2e.spec.ts',
    covers:
      'Seiten „Vertrag widerrufen“ und Kontakt DE/EN, Fußlinks auf allen Live-Seiten ohne 404',
  },
  {
    spec: 'tests/e2e/legal/pages.e2e.spec.ts',
    covers:
      'Rechtsseiten DE/EN: h1, Platzhalter-Band, Belehrung mit Link „Vertrag widerrufen“, Impressum',
  },
  // Bewegung, Tastatur, Datenschutz
  {
    spec: 'tests/e2e/motion-toggle.e2e.spec.ts',
    covers:
      'Schalter „Animationen“: Speicher erst nach dem Klick (R-130 a), Systemeinstellung „reduzieren“',
  },
  {
    spec: 'tests/e2e/a11y/keyboard.e2e.spec.ts',
    covers: 'Kauf und Widerruf nur mit der Tastatur DE/EN (R-191), Fokus in Safari',
  },
  {
    spec: 'tests/e2e/keyboard.e2e.spec.ts',
    covers:
      'Tab-Durchlauf je Seite und „Tastatur-Durchlauf Shop P3“ (R02, S01, R05) mit WebKit-Tastenlogik – Shop-Teil lässt pixel-7 aus',
  },
  {
    spec: 'tests/e2e/privacy/cart-cookie.e2e.spec.ts',
    covers: 'Cookie pc_cart erst nach „In den Korb“, Attribute wie ARCHITEKTUR §8.7 (R-130)',
  },
  {
    spec: 'tests/e2e/privacy/p4-pages.e2e.spec.ts',
    covers:
      'Kaufweg R04 → R08: Cookies genau laut §8.7, kein Web-Storage, kein Stripe-Host; Danke/Bestellstatus ohne Speicher (R-130/R-131)',
  },
  {
    spec: 'tests/e2e/privacy.e2e.spec.ts',
    covers:
      'keine Cookies, kein Speicher, keine Fremd-Anfragen je Route und „Datenschutz P3“ (Varianten R02–R05) – P3-Teil lässt pixel-7 aus',
  },
]

/** Playwright-Optionen mit Wert (`--grep x`): `x` ist dann kein Dateifilter. */
const PW_VALUE_FLAGS = new Set([
  '-c',
  '--config',
  '-g',
  '--grep',
  '--grep-invert',
  '-j',
  '--workers',
  '--browser',
  '--global-timeout',
  '--max-failures',
  '--output',
  '--project',
  '--repeat-each',
  '--reporter',
  '--retries',
  '--shard',
  '--test-list',
  '--test-list-invert',
  '--timeout',
  '--trace',
  '--tsconfig',
  '-u',
  '--update-snapshots',
  '--only-changed',
])

/** Enthalten die Argumente nach `--` Dateifilter (Specs/Ordner) und nicht nur Optionen wie `--grep`/`--shard`? */
export function hasFileFilter(args: readonly string[]): boolean {
  return args.some((a, i) => !a.startsWith('-') && !(i > 0 && PW_VALUE_FLAGS.has(args[i - 1]!)))
}

/** Dateifilter je Gerät: iPhone nur Kernfälle – außer `--iphone-all` oder eigene Specs nach `--` (die gelten dann). */
export function e2eFilters(
  project: 'desktop' | 'iphone-15' | 'pixel-7',
  opts: Pick<Options, 'iphoneAll' | 'e2eArgs'>,
): string[] {
  if (project !== 'iphone-15' || opts.iphoneAll || hasFileFilter(opts.e2eArgs))
    return [...opts.e2eArgs]
  return [...IPHONE_CORE.map((c) => c.spec), ...opts.e2eArgs]
}

/** Für `--dry-run`: was der iPhone-Schritt prüft. */
export function describeIphone(opts: Pick<Options, 'iphoneAll' | 'e2eArgs'>): string[] {
  if (opts.iphoneAll) return ['alle E2E-Tests (--iphone-all)']
  if (hasFileFilter(opts.e2eArgs)) return [`nur die Specs nach --: ${opts.e2eArgs.join(' ')}`]
  return [
    `Kernfälle (U-67, ${IPHONE_CORE.length} Filter; alle mit --iphone-all):`,
    ...IPHONE_CORE.map((c) => `  ${c.spec} – ${c.covers}`),
  ]
}

function e2eStep(project: 'desktop' | 'iphone-15' | 'pixel-7'): Step {
  return {
    id: `e2e-${project}`,
    title:
      project === 'iphone-15'
        ? 'E2E iphone-15 – Kernfälle (U-67; --iphone-all: alle), ohne @visual/@perf, Debug-Build + Flaky-Wächter'
        : `E2E ${project} (ohne @visual/@perf, Debug-Build) + Flaky-Wächter`,
    modes: ['full'],
    cmd: (ctx) =>
      `pnpm run test:e2e --project=${project} ${E2E_GREP} ${e2eFilters(project, ctx.opts).map(quote).join(' ')}`.trim() +
      ' && pnpm run ci:flaky',
    timeoutMin: 240,
  }
}

const ALL: Step[] = [
  // ---------- quick (ci.yml) ----------
  {
    id: 'eslint',
    title: 'ESLint',
    modes: ['quick', 'full'],
    cmd: 'pnpm exec eslint .',
    env: { NODE_OPTIONS: '--no-deprecation' },
    timeoutMin: 20,
  },
  {
    id: 'format',
    title: 'Prettier (format:check)',
    modes: ['quick', 'full'],
    cmd: 'pnpm run format:check',
    timeoutMin: 10,
  },
  {
    id: 'typecheck',
    title: 'Typen (tsc)',
    modes: ['quick', 'full'],
    cmd: 'pnpm run typecheck',
    timeoutMin: 20,
  },
  {
    id: 'static',
    title: 'Statische Prüfungen (check:static)',
    modes: ['quick', 'full'],
    cmd: 'pnpm run check:static',
    timeoutMin: 10,
  },
  {
    id: 'unit',
    title: 'Unit-Tests (UTC)',
    modes: ['quick', 'full'],
    cmd: 'pnpm run test:unit',
    timeoutMin: 30,
  },
  {
    id: 'unit-berlin',
    title: 'Unit-Tests (TZ=Europe/Berlin)',
    modes: ['quick', 'full'],
    cmd: 'pnpm run test:unit',
    env: { TZ: 'Europe/Berlin' },
    timeoutMin: 30,
  },
  {
    id: 'env-example',
    title: '.env.example aktuell (env:example-Abgleich)',
    modes: ['quick', 'full'],
    cmd: 'pnpm run env:example && git diff --exit-code -- .env.example .env.production.example',
    timeoutMin: 5,
  },
  {
    id: 'secrets',
    title: 'Geheimnis-Scan (gitleaks)',
    modes: ['quick', 'full'],
    cmd: 'internal:secrets',
    timeoutMin: 10,
  },
  {
    id: 'audit',
    title: 'Abhängigkeiten (pnpm audit, critical blockiert)',
    modes: ['quick', 'full'],
    cmd: 'pnpm audit --prod --audit-level=high || echo "CI_LOCAL_WARN: pnpm audit meldet Lücken der Stufe high (blockiert nur bei critical, siehe Log)"; pnpm audit --prod --audit-level=critical',
    timeoutMin: 5,
  },
  // ---------- full: Datenbank, Int + Abdeckung (quality) ----------
  {
    id: 'db',
    title: 'Datenbanken anlegen + migrieren + Drift',
    modes: ['full', 'art'],
    cmd: 'pnpm run db:ensure && pnpm payload migrate && pnpm run check:migrations',
    timeoutMin: 15,
  },
  {
    id: 'coverage',
    title: 'Int + Unit mit Abdeckung (test:coverage)',
    modes: ['full'],
    cmd: 'pnpm run test:coverage',
    noServerEnv: true,
    // Auf einem geteilten Rechner (mehrere Sitzungen) brauchte der Lauf > 90 min (CI ohne Last: 37 min).
    timeoutMin: 180,
  },
  // Wie restore-drill.yml: eine Datenbank für Bestand und Übung (die Testdatenbank).
  {
    id: 'restore-drill',
    title: 'Wiederherstellungs-Übung (synthetischer Bestand)',
    modes: ['full'],
    cmd: 'export DATABASE_URL="$DATABASE_URL_TEST" && pnpm run db:reset --test --seed=all && pnpm exec tsx --import=./scripts/lib/register-server-only.mjs scripts/ci/restore-drill.ts',
    timeoutMin: 20,
  },
  // ---------- full: Produktions-Build ohne Debug (quality) ----------
  {
    id: 'build',
    title: 'Seed + Build ohne Debug-Flag',
    modes: ['full'],
    cmd: `${FETCH_CACHE} && ${FRESH_DB} && pnpm run seed && pnpm run build`,
    env: { NEXT_PUBLIC_LEASH_DEBUG: '' },
    timeoutMin: 45,
  },
  {
    id: 'no-debug',
    title: 'Kein Debug im Build (check:no-debug)',
    modes: ['full'],
    cmd: 'pnpm run check:no-debug --no-build',
    timeoutMin: 10,
  },
  {
    id: 'bundle',
    title: 'Tempo-Budgets (check:bundle)',
    modes: ['full'],
    cmd: (ctx) => `pnpm run check:bundle --port ${ports(ctx.opts.port).bundle}`,
    timeoutMin: 30,
  },
  {
    id: 'external',
    title: 'Fremd-URLs im Build (check:external --built)',
    modes: ['full'],
    cmd: 'pnpm run check:external --built',
    timeoutMin: 10,
  },
  {
    id: 'visual',
    title: 'Visuelle Regression (test:visual)',
    modes: ['full'],
    cmd: `if [ "$(find tests/visual/__screenshots__ -name \'*-linux.png\' 2>/dev/null | wc -l)" -gt 0 ]; then pnpm run test:visual; else echo "${SKIP_MARKER} keine visuellen Referenzbilder (tests/visual/__screenshots__)"; fi`,
    timeoutMin: 60,
  },
  {
    id: 'lighthouse',
    title: 'Lighthouse-CI (test:perf, CPU-Drosselung an den Rechner angepasst)',
    modes: ['full'],
    cmd: 'tsx scripts/ci/lighthouse-calibrated.ts',
    timeoutMin: 30,
  },
  {
    id: 'inp',
    title: 'INP-Ersatzmessung (@perf, pixel-7)',
    modes: ['full'],
    // CPU-Drosselung wie Lighthouse an den Rechner angepasst (benchmarkIndex des Lighthouse-Schritts, sonst 4×)
    cmd: 'PERF_CPU_RATE="$(tsx scripts/ci/lighthouse-calibrated.ts --rate)" && echo "CPU-Drosselung ${PERF_CPU_RATE}×" && PERF_CPU_RATE="$PERF_CPU_RATE" pnpm run test:e2e --grep @perf --project=pixel-7',
    timeoutMin: 30,
  },
  // ---------- full: E2E je Gerät mit Debug-Build (e2e-full) ----------
  {
    id: 'build-debug',
    title: 'Seed + Build mit NEXT_PUBLIC_LEASH_DEBUG=1',
    modes: ['full'],
    cmd: `${FETCH_CACHE} && ${FRESH_DB} && pnpm run seed && pnpm run build`,
    env: { NEXT_PUBLIC_LEASH_DEBUG: '1' },
    timeoutMin: 45,
  },
  e2eStep('desktop'),
  e2eStep('iphone-15'),
  e2eStep('pixel-7'),
  // ---------- full: Docker (docker-Job) ----------
  {
    id: 'docker',
    title: 'Docker-Image (Build ohne DB, ≤ 500 MB, UID 1001)',
    modes: ['full'],
    requires: 'docker',
    cmd: 'docker build -t planetclaire-ci:local . && size=$(docker image inspect planetclaire-ci:local --format "{{.Size}}") && echo "Image: $((size / 1024 / 1024)) MB" && test "$size" -le 524288000 && test "$(docker run --rm --entrypoint id planetclaire-ci:local -u)" = "1001"',
    timeoutMin: 45,
  },
  // ---------- full: Vorschau-Export (preview-export.yml) ----------
  {
    id: 'preview',
    title: 'Vorschau-Export + Export-Test + Budget + Prüfliste',
    modes: ['full'],
    cmd: "pnpm run preview:export && pnpm run test:preview-export && node -e \"const r=require('./dist/planet-claire-vorschau.report.json');const b=r.budget&&r.budget.result;console.log('Budget:',b);if(b==='fail')process.exit(1)\" && pnpm run bestand:pruefliste",
    timeoutMin: 60,
  },
  // ---------- art (art-qa.yml) ----------
  {
    id: 'art-seed',
    title: 'Beispielbestand',
    modes: ['art'],
    cmd: 'pnpm run seed',
    timeoutMin: 15,
  },
  {
    id: 'art-build',
    title: 'QA-Build (art:build, .next-art)',
    modes: ['art'],
    cmd: 'pnpm run art:build',
    timeoutMin: 45,
  },
  {
    id: 'art-record',
    title: 'Aufnahme (art:record, 2 Worker)',
    modes: ['art'],
    cmd: 'pnpm run art:record',
    env: { ART_WORKERS: '2' },
    timeoutMin: 90,
  },
  {
    id: 'art-metrics',
    always: true,
    title: 'Auswertung (art:metrics)',
    modes: ['art'],
    cmd: (ctx) => `pnpm run art:metrics ${artRun(ctx)}`,
    timeoutMin: 20,
  },
  {
    id: 'art-sheets',
    always: true,
    title: 'Kontaktbögen (art:sheets)',
    modes: ['art'],
    cmd: (ctx) => `pnpm run art:sheets ${artRun(ctx)}`,
    timeoutMin: 20,
  },
  {
    id: 'art-check',
    always: true,
    title: 'Prüfung (art:check --evidence)',
    modes: ['art'],
    cmd: (ctx) => `pnpm run art:check ${artRun(ctx)} --evidence`,
    timeoutMin: 20,
  },
  {
    id: 'art-bundle',
    title: 'Bündel (art:bundle, lokal)',
    modes: ['art'],
    cmd: (ctx) => `pnpm run art:bundle ${artRun(ctx)}`,
    timeoutMin: 20,
  },
]

function artRun(ctx: RunContext): string {
  if (!ctx.artRunId)
    throw new Error(
      'Keine Kunst-Aufnahme gefunden (artifacts/art-qa/<lauf-id>) – zuerst art-record.',
    )
  return ctx.artRunId
}

/** Alle Schritte eines Modus in Ausführungsreihenfolge. */
export function stepsFor(mode: Mode): Step[] {
  return ALL.filter((s) => s.modes.includes(mode))
}

/** Auswahl nach `--only`/`--from`; unbekannte Schritte → UsageError mit der Liste der gültigen. */
export function planSteps(opts: Pick<Options, 'mode' | 'only' | 'from'>): Step[] {
  const steps = stepsFor(opts.mode)
  const ids = steps.map((s) => s.id)
  const unknown = [...(opts.only ?? []), ...(opts.from ? [opts.from] : [])].filter(
    (id) => !ids.includes(id),
  )
  if (unknown.length)
    throw new UsageError(
      `Unbekannte Schritte für ${opts.mode}: ${unknown.join(', ')}. Gültig: ${ids.join(', ')}.`,
    )
  if (opts.only) return steps.filter((s) => opts.only!.includes(s.id))
  if (opts.from) return steps.slice(ids.indexOf(opts.from))
  return steps
}

/** Kunst-Lauf-ID `YYYYMMDD-iterNN-<sha7>` (wie `scripts/art/lib/run.ts`); nach Namen sortiert = zeitlich. */
export const ART_RUN_ID_RE = /^[0-9]{8}-iter[0-9]{2}-[0-9a-f]{7}$/

/** Neueste Kunst-Lauf-ID aus einer Verzeichnisliste. */
export function latestArtRun(names: readonly string[]): string | undefined {
  return names
    .filter((n) => ART_RUN_ID_RE.test(n))
    .sort()
    .at(-1)
}

// ---------- U-67 b: Kunst-QA nur bei Kunst-Änderungen ----------
// Jutta (10.10.2026): `pnpm ci:local art` läuft nur, wenn sich seit dem letzten nachweislich grünen Kunst-Stand etwas an
// der Kunst geändert hat; sonst meldet der Lauf alle Schritte als „übersprungen“ mit Grund (nie still grün). Im Zweifel
// läuft die Kunst-QA. Vergleichsstand:
// 1. der neueste Lauf unter `artifacts/art-qa/`, den ein vollständiges `pnpm ci:local art` angelegt hat (Marke
//    `ci-local.json`: Seed, Build, Aufnahme und Prüfung in derselben Ausführung, ohne `--only`/`--from`). Handläufe mit
//    `art:record` (Teilmengen per `--scope`/`--project`, Aufnahme in mehreren Teilen, Server mit altem Build) zählen
//    nicht. Ist dieser Lauf rot oder unvollständig (Szenarien, echtes WebKit, alle drei Profile), läuft die Kunst-QA;
// 2. ohne solchen Lauf (frische Arbeitskopie – `artifacts/` ist nicht versioniert) der Abzweigpunkt von `origin/main`,
//    aber nur mit Nachweis: Commit-Status `lokal/ci-art` = success an diesem Commit. Sonst läuft die Kunst-QA.
// `--force` erzwingt den Lauf, `--only`/`--from` (gezielte Wiederholung) ebenso. Git- und API-Abfragen macht
// `scripts/ci-local.ts`; hier nur die reine Entscheidung.

/**
 * Kunst-relevante Pfade (`**` = beliebig tief, `*` = innerhalb eines Ordners). Bewusst weit: Die Kunst-Abnahme nimmt
 * fast jede öffentliche Seite auf (Start, Shop, Archiv, Produkt, Korb, Kasse, Danke, Tattoo, 404/500, QA-Seiten,
 * Vorschaubilder; KUNST-QA §3–§5), dazu die Texte und den Beispielbestand, aus denen diese Seiten entstehen.
 * Überspringen lohnt sich für Verwaltung, Sammlungen, Endpunkte, Jobs, Mails, Migrationen, übrige Logik unter
 * `src/lib`, Tests außerhalb `tests/art` und Doku. Der Unit-Test verlangt, dass jede Datei unter `src/`, die Linie, Coco,
 * Zeichnungen oder Mikro-Interaktionen einbindet, hier erfasst ist.
 */
export const ART_PATHS: readonly { glob: string; why: string }[] = [
  // Linie, Coco, Zeichnungen, Aussehen
  { glob: 'src/leash/**', why: 'Tuschelinie, Coco-Laufzeit, Presets' },
  {
    glob: 'src/art/**',
    why: 'Zeichnungen: Coco, Koko, Stationen, Weltraum, Platzhalter, Icons, Wortmarke',
  },
  { glob: 'content/art/**', why: 'Quellen der Zeichnungen (Skizzen, Stationen, Coco-Vorlagen)' },
  { glob: 'public/art/**', why: 'ausgelieferte Sprites, Koko-Bilder, Fotorahmen, Wortmarke' },
  { glob: 'public/shop-tiles/**', why: 'Kategorie-Bilder (Umrundung, SC-04)' },
  { glob: 'public/og/**', why: 'Vorschaubild (ART-BRAND)' },
  {
    glob: 'src/behaviors/**',
    why: 'Mikro-Interaktionen (MI-xx: Schwingen, Stempel, Hüpfer, Menü, Countdown, Danke)',
  },
  { glob: 'src/styles/**', why: 'Farben, Schriften, Bewegung, Coco-CSS' },
  // Seiten und Bausteine, die die Kunst-Abnahme aufnimmt
  {
    glob: 'src/components/**',
    why: 'Bausteine der öffentlichen Seiten: Coco, Stationen/Schlaufen der Linie (`data-leash-*`), Kopf, Menü, Fuß, Leerzustände, Fehlerbilder, CSS',
  },
  {
    glob: 'src/app/(frontend)/**',
    why: 'öffentliche Seiten samt CSS, Vorschaubild-Routen (SC-13) und QA-Seiten',
  },
  { glob: 'src/app/*icon*', why: 'Favicon und App-Symbole (ART-BRAND)' },
  { glob: 'src/app/global-*', why: 'globale 404/500-Seiten mit Zeichnung (SC-10)' },
  { glob: 'src/og/**', why: 'Vorschaubilder (SC-13)' },
  {
    glob: 'src/lib/routes/**',
    why: 'Linien-Preset je Route, Pfade der Kunst-Szenarien (`scripts/art/lib/routes.ts`)',
  },
  { glob: 'src/lib/shop/**', why: 'Preisschild und Stempel, Kategorie-Kacheln, Kaufbereich' },
  { glob: 'src/lib/tattoo/**', why: 'Tattoo-Seiten und Flash-Raster' },
  { glob: 'src/lib/tour/**', why: 'Tour-Schaukasten der Startseite' },
  { glob: 'src/lib/home/**', why: 'Koko schläft nachts (U-53)' },
  { glob: 'src/lib/qa/**', why: 'QA-Quellen, Mikro-Interaktionen, Schalter' },
  { glob: 'src/lib/media/**', why: 'Bild-Pipeline (Foto-Look, SC-16)' },
  { glob: 'src/proxy.ts', why: 'CSP-Kopf und Weiterleitungen der Seiten' },
  { glob: 'src/lib/security/csp.ts', why: 'CSP (Inline-Skript Animationen-Schalter)' },
  {
    glob: 'src/lib/security/inlineScripts.ts',
    why: 'Inline-Skript Animationen-Schalter (`pc-motion`) und Schriften-Tor',
  },
  // Texte und Beispielbestand: Textlänge verschiebt das Layout, `art-seed` legt die aufgenommenen Stücke an
  {
    glob: 'src/i18n/messages/**',
    why: 'Texte DE/EN – Länge der Stationstexte bestimmt das Handy-Layout',
  },
  { glob: 'src/globals/SiteTexts.ts', why: 'Standard-UI-Texte DE/EN' },
  {
    glob: 'content/seed/*/**',
    why: 'Beispielbestand: Stücke, Seiten, Tour, Fotos, Coco-Vorlagen (art-seed, SC-05, SC-15, SC-16)',
  },
  { glob: 'content/seed/*.json', why: 'Zuordnung Instagram-Export → Seed-Fotos' },
  { glob: 'src/lib/seed/**', why: 'Seed-Erzeugung (art-seed)' },
  // Werkzeuge, Kriterien, Build
  { glob: 'tests/art/**', why: 'Szenarien der Kunst-Abnahme' },
  { glob: 'scripts/art/**', why: 'Aufnahme, Auswertung, Prüfung, Bündel, Zeichen-Werkzeuge' },
  { glob: 'playwright.art.config.ts', why: 'Geräteprofile der Aufnahme' },
  { glob: 'docs/design/KUNST-QA.md', why: 'Kriterien und Schwellen (art:check liest sie)' },
  { glob: 'tests/perf/budgets.json', why: 'Tempo-Budgets (SC-18)' },
  { glob: 'next.config.ts', why: 'Build und Bilder' },
  {
    glob: 'pnpm-lock.yaml',
    why: 'Abhängigkeiten (Next, React, Playwright-Browser) ändern Darstellung und Tempo',
  },
]

/** Glob → RegExp (nur `**` und `*`, alles andere wörtlich; Pfade relativ zur Projektwurzel mit `/`). */
export function globToRegExp(glob: string): RegExp {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]!
    if (c === '*' && glob[i + 1] === '*') {
      const dir = glob[i + 2] === '/'
      re += dir ? '(?:.*/)?' : '.*'
      i += dir ? 2 : 1
    } else if (c === '*') re += '[^/]*'
    else re += c.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}

const ART_RES = ART_PATHS.map((p) => globToRegExp(p.glob))

/** Liegt die Datei in einem kunst-relevanten Pfad? */
export function isArtRelevant(file: string): boolean {
  const f = file.replace(/\\/g, '/').replace(/^\.\//, '')
  return ART_RES.some((re) => re.test(f))
}

/** Marke im Lauf-Ordner: Lauf stammt aus einem vollständigen `pnpm ci:local art` (schreibt `scripts/ci-local.ts`). */
export const ART_CI_MARKER = 'ci-local.json'

/** Szenarien ohne Browser (wie `SCRIPT_SCENARIOS` in `scripts/art/record.ts`). */
export const ART_SCRIPT_SCENARIOS: readonly string[] = ['SC-16']

/** Alle Szenarien eines vollständigen Laufs aus den Dateinamen unter `tests/art/` (wie `allScenarios` in record.ts). */
export function artScenarios(files: readonly string[]): string[] {
  const specs = files
    .map((f) => /^sc-(\d{2})\.art\.spec\.ts$/.exec(f)?.[1])
    .filter((n): n is string => !!n)
    .map((n) => `SC-${n}`)
  return [...new Set([...specs, ...ART_SCRIPT_SCENARIOS])].sort()
}

/** Inhalte eines Lauf-Ordners `artifacts/art-qa/<id>/` (null = Datei fehlt oder unlesbar). */
export interface ArtRunFiles {
  run: unknown
  check: unknown
  marker: unknown
  /** Profil-Ordner unter `frames/<SC>/` über alle Szenarien. */
  profiles: readonly string[]
}

/** Ein Kunst-Lauf aus `artifacts/art-qa/<id>/`. */
export interface ArtRunInfo {
  id: string
  /** Commit aus `run.json`, sonst null. */
  commit: string | null
  /** Aufnahme auf unsauberem Stand (`--allow-dirty`). */
  dirty: boolean
  /** Marke `ci-local.json` zum selben Commit: aus einem vollständigen `pnpm ci:local art`. */
  ciLocal: boolean
  /** Alle Schritte dieses `ci:local art` grün (Marke → `ok`). */
  ciOk: boolean
  /** `check.json` → `pass` (alle automatischen Kriterien bestanden). */
  pass: boolean
  /** Was dem Lauf als Nachweis fehlt (leer = vollständig). */
  gaps: string[]
}

/** Lauf-Ordner auswerten; `scenarios` = alle Szenarien eines vollständigen Laufs (`artScenarios`). */
export function artRunInfo(
  id: string,
  files: ArtRunFiles,
  scenarios: readonly string[],
  profiles: readonly string[] = ART_PROFILES,
): ArtRunInfo {
  const r = (files.run ?? {}) as {
    commit?: unknown
    dirty?: unknown
    scope?: unknown
    webkit?: unknown
  }
  const c = files.check as { pass?: unknown } | null
  const m = files.marker as { sha?: unknown; ok?: unknown } | null
  const commit = typeof r.commit === 'string' && /^[0-9a-f]{7,40}$/.test(r.commit) ? r.commit : null
  const scope: unknown[] = Array.isArray(r.scope) ? r.scope : []
  const missingSc = scenarios.filter((s) => !scope.includes(s))
  const missingPr = profiles.filter((p) => !files.profiles.includes(p))
  const gaps = [
    c !== null && typeof c === 'object' ? '' : 'check.json fehlt',
    missingSc.length ? `Szenarien fehlen: ${missingSc.join(', ')}` : '',
    r.webkit === 'webkit' ? '' : 'WebKit emuliert',
    missingPr.length ? `Profile fehlen: ${missingPr.join(', ')}` : '',
  ].filter(Boolean)
  return {
    id,
    commit,
    dirty: r.dirty === true,
    ciLocal: m !== null && typeof m === 'object' && commit !== null && m.sha === commit,
    ciOk: m?.ok === true,
    pass: c?.pass === true,
    gaps,
  }
}

/** Vergleichs-Lauf: der neueste Lauf aus `pnpm ci:local art` (Marke, Commit, sauberer Stand) – grün oder rot. */
export function artBaseline(runs: readonly ArtRunInfo[]): ArtRunInfo | undefined {
  return runs
    .filter((r) => ART_RUN_ID_RE.test(r.id) && r.ciLocal && r.commit && !r.dirty)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .at(-1)
}

/**
 * Lauf, der nach `ci:local art` die Marke bekommt: nur ein vollständiger Lauf (ohne `--only`/`--from`, nicht
 * übersprungen), dessen Schritt `art-record` selbst eine neue Aufnahme angelegt hat; sonst null.
 */
export function artMarkerRun(
  opts: Pick<Options, 'mode' | 'only' | 'from'>,
  skipped: boolean,
  before: readonly string[],
  runId: string | undefined,
): string | null {
  if (opts.mode !== 'art' || skipped || opts.only || opts.from) return null
  return runId && ART_RUN_ID_RE.test(runId) && !before.includes(runId) ? runId : null
}

/** Antwort von `GET repos/{repo}/commits/{sha}/status`: trägt der Commit den Status `context` = success? */
export function statusSuccess(json: unknown, context: string): boolean {
  const list = (json as { statuses?: unknown } | null)?.statuses
  return (
    Array.isArray(list) &&
    list.some(
      (s) =>
        (s as { context?: unknown }).context === context &&
        (s as { state?: unknown }).state === 'success',
    )
  )
}

/** Commit-Status, der eine grüne (oder begründet übersprungene) Kunst-QA belegt (`--status` im Modus `art`). */
export const ART_STATUS_CONTEXT = 'lokal/ci-art'

/** Vergleichsstand: Commit des Vergleichs-Laufs, sonst Abzweigpunkt von origin/main (null = keiner). */
export function artBase(
  baseline: ArtRunInfo | undefined,
  mainBase: string | null,
): { sha: string; label: string } | null {
  if (baseline?.commit)
    return {
      sha: baseline.commit,
      label: `Kunst-Lauf ${baseline.id} (${baseline.commit.slice(0, 7)})`,
    }
  return mainBase ? { sha: mainBase, label: `origin/main (${mainBase.slice(0, 7)})` } : null
}

export interface ArtGateInput {
  force: boolean
  /** Teillauf mit `--only`/`--from`. */
  partial: boolean
  baseline: ArtRunInfo | undefined
  base: { sha: string; label: string } | null
  /** Nur ohne Vergleichs-Lauf: trägt der Abzweigpunkt von origin/main `lokal/ci-art` = success? */
  mainVerified: boolean
  /** Seit `base` geänderte Dateien (Commits, Arbeitsbaum, neue Dateien); null = Vergleich nicht möglich. */
  changed: readonly string[] | null
}

export interface ArtGate {
  run: boolean
  reason: string
  /** Kunst-relevante Änderungen (Grund des Laufs). */
  artFiles: string[]
}

/** Läuft die Kunst-QA? Im Zweifel ja – übersprungen nur bei nachweislich grünem Vergleichsstand ohne Kunst-Änderung. */
export function artGate(i: ArtGateInput): ArtGate {
  const run = (reason: string, artFiles: string[] = []): ArtGate => ({
    run: true,
    reason,
    artFiles,
  })
  if (i.force) return run('--force')
  if (i.partial) return run('Teillauf (--only/--from), ohne Abgleich')
  const b = i.baseline
  if (b?.gaps.length) return run(`letzter Kunst-Lauf ${b.id} unvollständig (${b.gaps.join('; ')})`)
  if (b && !b.pass) return run(`letzter Kunst-Lauf ${b.id} ist rot (check.json)`)
  if (b && !b.ciOk) return run(`letzter Kunst-Lauf ${b.id} ist rot (ein Schritt von ci:local art)`)
  if (!i.base) return run('kein Vergleichsstand (kein Lauf aus ci:local art, origin/main fehlt)')
  if (!b && !i.mainVerified)
    return run(
      `kein Lauf aus ci:local art und ${i.base.label} ohne Commit-Status ${ART_STATUS_CONTEXT} = success`,
    )
  if (!i.changed) return run(`Vergleich mit ${i.base.label} nicht möglich (Commit fehlt?)`)
  const artFiles = i.changed.filter(isArtRelevant)
  if (artFiles.length)
    return run(
      `${artFiles.length} Kunst-Datei(en) geändert seit ${i.base.label}: ${artFiles.slice(0, 5).join(', ')}${artFiles.length > 5 ? ', …' : ''}`,
      artFiles,
    )
  return {
    run: false,
    reason: `keine Kunst-Änderung seit ${i.base.label}, ${b ? 'der grün war' : `${ART_STATUS_CONTEXT} grün`} (${i.changed.length} Datei(en) geändert, keine kunst-relevant) – erzwingen mit --force`,
    artFiles: [],
  }
}

/** `owner/repo` aus der Remote-URL (GitHub direkt oder über einen Git-Proxy …/owner/repo[.git]). */
export function repoFromRemote(url: string): string | null {
  const m = /[/:]([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(url.trim())
  return m ? `${m[1]}/${m[2]}` : null
}

export type StepResult = 'passed' | 'failed' | 'skipped' | 'warn' | 'not-run'

export interface StepReport {
  id: string
  title: string
  result: StepResult
  seconds: number
  log: string
  note?: string
}

/** Kurzbilanz für Commit-Status und Zusammenfassung, z. B. „24/24 grün in 142 min“. */
export function summarize(reports: readonly StepReport[]): {
  ok: boolean
  line: string
} {
  const count = (r: StepResult) => reports.filter((s) => s.result === r).length
  const failed = count('failed')
  const notRun = count('not-run')
  const passed = count('passed')
  const minutes = Math.round(reports.reduce((s, r) => s + r.seconds, 0) / 60)
  const extra = [
    failed ? `${failed} rot` : '',
    count('skipped') ? `${count('skipped')} übersprungen` : '',
    count('warn') ? `${count('warn')} mit Hinweis` : '',
    notRun ? `${notRun} nicht gelaufen` : '',
  ].filter(Boolean)
  const ok = failed === 0 && notRun === 0
  return {
    ok,
    line: `${passed}/${reports.length} grün${extra.length ? `, ${extra.join(', ')}` : ''} in ${minutes} min`,
  }
}
