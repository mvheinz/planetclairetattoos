import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import {
  LOCALES,
  PRESETS,
  PUBLIC_PAGE_TYPES,
  ROUTES,
  aliases,
  shortLinks,
  type RouteEntry,
} from '../../../src/lib/routes/registry'
import { listFiles } from './files'
import type { CheckResult, StaticCheck } from './types'

// AK-2-01 / T-07 (KONZEPT §2.2, ARCHITEKTUR §2.3): Die Registry stimmt mit der KONZEPT-Routentabelle überein.

/** Die sieben rechtlichen Kurz-URLs aus RECHT R-010. */
export const R010_SHORT_LINKS = [
  '/impressum',
  '/datenschutz',
  '/agb',
  '/widerrufsbelehrung',
  '/versand',
  '/vertrag-widerrufen',
  '/widerruf',
]

export interface KonzeptRouteRow {
  id: string
  de: string
  en: string
  phase: string
}

/** Liest die Tabelle „### 2.2 Routentabelle“ aus docs/KONZEPT.md. */
export function parseKonzeptRouteTable(markdown: string): KonzeptRouteRow[] {
  const start = markdown.indexOf('### 2.2 Routentabelle')
  if (start < 0) return []
  const end = markdown.indexOf('\n### ', start + 5)
  const section = markdown.slice(start, end < 0 ? undefined : end)
  const rows: KonzeptRouteRow[] = []
  for (const line of section.split('\n')) {
    const cells = line.split('|').map((c) => c.trim())
    if (!/^R\d{2}$/.test(cells[1] ?? '')) continue
    rows.push({ id: cells[1]!, de: cells[3] ?? '', en: cells[4] ?? '', phase: cells[6] ?? '' })
  }
  return rows
}

/** `/de/impressum` → `/impressum`, `/de` → `/`; ohne Sprachpräfix bzw. ohne Code → null. */
export function patternFromCell(cell: string, locale: string): string | null {
  const m = /`([^`]+)`/.exec(cell)
  if (!m) return null
  const p = m[1]!
  if (p === `/${locale}`) return '/'
  if (p.startsWith(`/${locale}/`)) return p.slice(locale.length + 1)
  return null
}

const underPrefix = (p: string, prefix: string) => p === prefix || p.startsWith(`${prefix}/`)

/** Ordner unter `[locale]/` für einen Registry-Schlüssel. */
export const pageFileForKey = (key: string) =>
  `src/app/(frontend)/[locale]${key === '/' ? '' : key}/page.tsx`

/**
 * Seiten unter `[locale]/` ohne eigenes Registry-Muster (P2.19): der Fehler-Auslöser für Tests (`/__fehler-test`,
 * wirft nur bei `APP_ENV=test`, sonst 404; nicht in Registry, Sitemap oder Crawl).
 */
export const NON_REGISTRY_PAGE_FILES: readonly string[] = [
  'src/app/(frontend)/[locale]/%5F%5Ffehler-test/page.tsx',
]

export interface RegistryInput {
  routes: readonly RouteEntry[]
  shortLinks: readonly { path: string; routeId: string }[]
  aliases: readonly { path: string; locale: string; routeId: string }[]
  konzept: KonzeptRouteRow[]
  adminRoutes: string[]
  /** Pfade aller `page.tsx` unter `src/app/(frontend)/[locale]/` (relativ zum Repo); `null` = nicht prüfen. */
  pageFiles: string[] | null
}

export function checkRouteRegistry(input: RegistryInput): CheckResult {
  const errors: string[] = []
  const { routes, konzept } = input
  const byId = new Map(routes.map((r) => [r.id, r]))

  if (konzept.length === 0) errors.push('KONZEPT §2.2: Routentabelle nicht gefunden.')
  if (byId.size !== routes.length) errors.push('Registry: Routen-IDs sind nicht eindeutig.')
  const expectedIds = Array.from({ length: 31 }, (_, i) => `R${String(i + 1).padStart(2, '0')}`)
  for (const id of expectedIds) {
    if (!byId.has(id)) errors.push(`Registry: ${id} fehlt.`)
    if (konzept.length && !konzept.some((k) => k.id === id))
      errors.push(`KONZEPT §2.2: ${id} fehlt in der Tabelle.`)
  }
  for (const r of routes) {
    if (!expectedIds.includes(r.id)) errors.push(`Registry: unbekannte ID ${r.id}.`)
    if (r.pageType && !PUBLIC_PAGE_TYPES.includes(r.pageType))
      errors.push(`${r.id}: pageType ${r.pageType} unbekannt.`)
    if (r.preset && !PRESETS.includes(r.preset))
      errors.push(`${r.id}: Preset ${r.preset} unbekannt.`)
  }

  for (const row of konzept) {
    const r = byId.get(row.id)
    if (!r) continue
    const de = patternFromCell(row.de, 'de')
    const en = patternFromCell(row.en, 'en')
    if (de !== null && en !== null) {
      if (r.kind !== 'page' || !r.paths) {
        errors.push(`${r.id}: muss eine Seite mit DE- und EN-Muster sein.`)
        continue
      }
      if (r.paths.de !== de) errors.push(`${r.id}: DE-Muster ${r.paths.de} ≠ KONZEPT ${de}.`)
      if (r.paths.en !== en) errors.push(`${r.id}: EN-Muster ${r.paths.en} ≠ KONZEPT ${en}.`)
      if (!r.key) errors.push(`${r.id}: interner Schlüssel fehlt.`)
    } else {
      if (r.kind === 'page')
        errors.push(`${r.id}: KONZEPT nennt kein DE-/EN-Muster, Registry schon.`)
      const from = /`([^`]+)`/.exec(row.de)?.[1]
      if (r.kind === 'redirect' && r.from !== from)
        errors.push(`${r.id}: Weiterleitung von ${r.from} ≠ KONZEPT ${from}.`)
    }
    const phase = /^P(\d+)(?: \(Gerüst P(\d+)\))?/.exec(row.phase)
    if (phase) {
      if (Number(phase[1]) !== r.phase)
        errors.push(`${r.id}: Phase ${r.phase} ≠ KONZEPT ${row.phase}.`)
      const scaffold = phase[2] ? Number(phase[2]) : null
      if (scaffold !== r.scaffoldPhase)
        errors.push(`${r.id}: Gerüst-Phase ${r.scaffoldPhase} ≠ KONZEPT ${row.phase}.`)
    }
  }

  // Eindeutigkeit: Schlüssel und Muster je Sprache.
  const pages = routes.filter((r) => r.kind === 'page' && r.paths && r.key)
  const seen = new Map<string, string>()
  const claim = (what: string, id: string) => {
    const other = seen.get(what)
    if (other && other !== id) errors.push(`Pfad ${what} doppelt (${other}, ${id}).`)
    seen.set(what, id)
  }
  for (const r of pages) {
    claim(`key:${r.key}`, r.id)
    for (const l of LOCALES) claim(`/${l}${r.paths![l] === '/' ? '' : r.paths![l]}`, r.id)
  }

  // Kein Pfad unter /admin oder ADMIN_ROUTE (E-93).
  const allPaths = [
    ...pages.flatMap((r) => [r.key!, r.paths!.de, r.paths!.en]),
    ...routes.flatMap((r) => (r.from ? [r.from] : [])),
    ...input.shortLinks.map((s) => s.path),
    ...input.aliases.map((a) => a.path),
  ]
  for (const p of allPaths) {
    for (const admin of ['/admin', ...input.adminRoutes]) {
      if (p !== '/' && underPrefix(p, admin)) errors.push(`Pfad ${p} liegt unter ${admin}.`)
    }
  }

  // Kurz-URLs (R-010) und Aliasse.
  const shortPaths = input.shortLinks.map((s) => s.path).sort()
  if (JSON.stringify(shortPaths) !== JSON.stringify([...R010_SHORT_LINKS].sort()))
    errors.push(`shortLinks ≠ R-010 (${R010_SHORT_LINKS.join(', ')}).`)
  for (const s of input.shortLinks) {
    if (!byId.get(s.routeId)?.paths)
      errors.push(`Kurz-URL ${s.path}: Ziel ${s.routeId} ist keine Seite.`)
  }
  for (const a of input.aliases) {
    const target = byId.get(a.routeId)
    if (!target?.paths) errors.push(`Alias ${a.path}: Ziel ${a.routeId} ist keine Seite.`)
    if (!a.path.startsWith(`/${a.locale}/`))
      errors.push(`Alias ${a.path}: muss mit /${a.locale}/ beginnen.`)
    if (seen.has(a.path)) errors.push(`Alias ${a.path} ist bereits ein kanonischer Pfad.`)
  }

  // Seiten-Dateien ↔ Registry: jede `live`-Seite hat ihre page.tsx, jede page.tsx gehört zu einer `live`-Seite.
  if (input.pageFiles) {
    const files = new Set(input.pageFiles)
    for (const r of pages) {
      const file = pageFileForKey(r.key!)
      if (r.status === 'live' && !files.has(file))
        errors.push(`${r.id} ist live, aber ${file} fehlt.`)
      if (r.status === 'planned' && files.has(file))
        errors.push(`${r.id} ist 'planned', aber ${file} existiert (Status auf 'live' setzen).`)
    }
    const known = new Set([...pages.map((r) => pageFileForKey(r.key!)), ...NON_REGISTRY_PAGE_FILES])
    for (const f of files) {
      if (!known.has(f)) errors.push(`${f}: Seite ohne Eintrag in der Routen-Registry.`)
    }
  }

  return { errors, warnings: [] }
}

export function registryInput(root: string, adminRoutes: string[]): RegistryInput {
  return {
    routes: ROUTES,
    shortLinks,
    aliases,
    konzept: parseKonzeptRouteTable(readFileSync(path.join(root, 'docs/KONZEPT.md'), 'utf8')),
    adminRoutes,
    pageFiles: existsSync(path.join(root, 'src/app/(frontend)/[locale]'))
      ? listFiles(root, 'src/app/(frontend)/[locale]', ['page.tsx'])
      : [],
  }
}

export const routeRegistryCheck: StaticCheck = {
  name: 'route-registry',
  run: (root) => checkRouteRegistry(registryInput(root, adminRoutesFromEnv())),
}

/** Verwaltungspfad aus der Umgebung (falls gesetzt) plus der Standard `/werkstatt` aus `.env.example`. */
export function adminRoutesFromEnv(): string[] {
  const fromEnv = process.env.ADMIN_ROUTE
  return [...new Set(['/werkstatt', ...(fromEnv ? [fromEnv] : [])])]
}
