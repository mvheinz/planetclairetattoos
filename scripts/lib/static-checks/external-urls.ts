import { listFiles, readText } from './files'
import type { CheckResult, StaticCheck } from './types'

// Keine Drittanbieter-Requests (E-43, CLAUDE.md §6): http(s)-URLs im Quelltext nur aus dieser Allowlist.
// Erweiterungen nur mit Begründung (Kommentar) – Links, keine eingebetteten Ressourcen.
export const URL_ALLOWLIST: RegExp[] = [
  /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(\/|$)/, // lokale Entwicklung
  /^https:\/\/([a-z0-9-]+\.)?planetclairetattoos\.com(\/|$)/, // eigene Domain
  /^http:\/\/www\.w3\.org\//, // XML-/SVG-Namensräume, kein Request
  /^https:\/\/(www\.)?instagram\.com\//, // Link zum Instagram-Profil (kein Embed, E-51)
  /^https:\/\/ig\.me\//, // Instagram-DM-Link (E-51)
  /^https:\/\/api(-free)?\.deepl\.com\//, // Übersetzen-Knopf nur in der Verwaltung (E-61)
  /^https:\/\/[a-z0-9-]+\.eu\.r2\.cloudflarestorage\.com/, // Speicher (ARCHITEKTUR §4.3)
  /^https:\/\/www\.dhl\.de\/[a-z]{2}\/privatkunden\/pakete-empfangen\/verfolgen\.html/, // Link zur Sendungsverfolgung in Versandmails, kein Request (DATENMODELL §7.1)
  /^https:\/\/planetclairetattoos\.com$/,
  /^https:\/\/schema\.org$/, // JSON-LD-`@context` (KONZEPT §3.0.5), Bezeichner, kein Request
  /^https:\/\/europa\.eu\/youreurope\/citizens\/consumers\/shopping\/guarantees-returns\/index_(de|en)\.htm$/, // Textlink der harmonisierten Mitteilung (R-049), kein Request
]

/**
 * Nur in einzelnen Dateien erlaubt: Stripe-Hosts ausschließlich in der CSP des Kontexts `checkout` (DIENSTE-YAML,
 * R-131, ARCHITEKTUR §8.1) – Deklaration, kein Request.
 */
export const FILE_URL_ALLOWLIST: Record<string, RegExp[]> = {
  'src/lib/security/csp.ts': [/^https:\/\/(\*\.)?(js|hooks|api)\.stripe\.com$/],
  'src/lib/security/headers.ts': [/^https:\/\/js\.stripe\.com$/],
  // Erzeugte Dienstliste (P6.21): CSP-Hosts aus der DIENSTE-YAML für den T-16-Abgleich – Deklaration, kein Request
  'src/lib/legal/services.generated.ts': [/^https:\/\/(\*\.)?(js|hooks|api)\.stripe\.com$/],
  // Website der Universalschlichtungsstelle in der Mail M13 (§ 37 VSBG, R-112) – Textangabe, kein Request
  'src/lib/legal/vsbg.ts': [/^https:\/\/www\.universalschlichtungsstelle\.de$/],
}

const URL_RE = /https?:\/\/[^\s'"`)<>\]}]+/g

export function checkExternalUrls(files: { path: string; source: string }[]): CheckResult {
  const errors: string[] = []
  for (const f of files) {
    for (const m of f.source.matchAll(URL_RE)) {
      const url = m[0]
      const allowed = [...URL_ALLOWLIST, ...(FILE_URL_ALLOWLIST[f.path] ?? [])]
      if (!allowed.some((re) => re.test(url))) {
        errors.push(
          `${f.path}: Fremd-URL ${url} (nicht in der Allowlist, scripts/lib/static-checks/external-urls.ts).`,
        )
      }
    }
  }
  return { errors, warnings: [] }
}

const GENERATED = ['src/payload-types.ts', 'src/app/(payload)/admin/importMap.js']

export const externalUrlsCheck: StaticCheck = {
  name: 'external-urls',
  run: (root) =>
    checkExternalUrls(
      listFiles(root, 'src', ['.ts', '.tsx', '.js', '.mjs', '.css', '.json'])
        .filter((p) => !GENERATED.includes(p))
        .map((p) => ({ path: p, source: readText(root, p) })),
    ),
}
