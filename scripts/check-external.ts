// Prüfung der Build-Ausgabe (ARCHITEKTUR §6.3 Nr. 9, §8.4): pnpm check:external --built
// P1.12: Der Wert von ADMIN_ROUTE darf in keiner Datei unter `.next/static` und in keinem erzeugten öffentlichen HTML
// vorkommen (AK-2-04, Teil).
// P2.21: Keine Fremd-URLs in den öffentlich ausgelieferten Dateien (T-03, R-131, EK-05). Geprüft werden das erzeugte
// HTML/RSC öffentlicher Seiten und alle Dateien unter `.next/static`, die öffentliche Seiten laden (Einstiegs-Chunks
// aus `build-manifest.json`, Client-Manifeste der öffentlichen Routen, Verweise aus HTML/RSC, transitiv über
// nachgeladene Chunks). Die Chunks der Verwaltung (Payload, nur unter ADMIN_ROUTE) sind ausgenommen; deren
// Fremd-Requests prüft `tests/e2e/admin-privacy.e2e.spec.ts` zur Laufzeit.
// Erlaubt (EXTERNAL_ALLOWLIST): Instagram als Linkziel, eigene Adresse (NEXT_PUBLIC_SITE_URL), Namensraum-/Vokabular-
// Kennungen, die nie geladen werden (SVG/XLink/XHTML/MathML, Sitemap-Schema, JSON-LD `https://schema.org`), und in
// Framework-JS eingebaute Fehlertext-Verweise (react.dev/errors, nextjs.org/docs, core-js-Lizenz) – nur in `.js`.
import 'dotenv/config'

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

export interface BuiltFile {
  path: string
  content: string
}

function walk(dir: string, filter: (p: string) => boolean, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) walk(p, filter, out)
    else if (filter(p)) out.push(p)
  }
  return out
}

/** Dateien, die an Besucher:innen ausgeliefert werden: statische Chunks und vorgerendertes HTML/RSC öffentlicher Seiten. */
export function collectBuiltFiles(distDir: string): BuiltFile[] {
  const staticFiles = walk(path.join(distDir, 'static'), () => true)
  const appDir = path.join(distDir, 'server', 'app')
  const internalAdmin = path.join(appDir, 'admin')
  const pages = walk(
    appDir,
    (p) => /\.(html|rsc|body)$/.test(p) && !p.startsWith(internalAdmin + path.sep),
  )
  return [...staticFiles, ...pages].map((p) => ({
    path: path.relative(root, p),
    content: readFileSync(p, 'latin1'),
  }))
}

const REF = /static\/(?:chunks|media|css)\/[\w.@~-]+\.\w+/g

/**
 * Öffentlich ausgelieferte Dateien: vorgerendertes HTML/RSC öffentlicher Seiten plus die davon (transitiv) geladenen
 * Dateien unter `.next/static`. Chunks, die nur die Verwaltung lädt, bleiben außen vor.
 */
export function collectPublicFiles(distDir: string): BuiltFile[] {
  const appDir = path.join(distDir, 'server', 'app')
  const isAdmin = (p: string) =>
    p.startsWith(path.join(appDir, 'admin') + path.sep) ||
    p.startsWith(path.join(appDir, '(payload)') + path.sep)
  const pages = walk(appDir, (p) => /\.(html|rsc|body)$/.test(p) && !isAdmin(p))
  const manifests = walk(appDir, (p) => p.endsWith('_client-reference-manifest.js') && !isAdmin(p))
  const buildManifest = JSON.parse(
    readFileSync(path.join(distDir, 'build-manifest.json'), 'utf8'),
  ) as { rootMainFiles?: string[]; polyfillFiles?: string[] }
  const queue = [...(buildManifest.rootMainFiles ?? []), ...(buildManifest.polyfillFiles ?? [])]
  for (const f of [...pages, ...manifests])
    for (const m of readFileSync(f, 'latin1').matchAll(REF)) queue.push(m[0])
  const seen = new Set<string>()
  while (queue.length > 0) {
    const ref = queue.pop()!
    if (seen.has(ref)) continue
    seen.add(ref)
    const file = path.join(distDir, ref)
    if (!existsSync(file) || !/\.(js|css)$/.test(file)) continue
    for (const m of readFileSync(file, 'latin1').matchAll(REF)) queue.push(m[0])
  }
  const statics = [...seen].map((r) => path.join(distDir, r)).filter((p) => existsSync(p))
  return [...statics, ...pages].map((p) => ({
    path: path.relative(root, p),
    content: readFileSync(p, 'latin1'),
  }))
}

/** Erlaubte absolute URLs (Präfixe). `jsOnly`: nur als Text in Framework-JS, nie in HTML. */
export const EXTERNAL_ALLOWLIST: readonly { prefix: string; why: string; jsOnly?: boolean }[] = [
  { prefix: 'https://www.instagram.com/', why: 'Linkziel Instagram (E-43)' },
  { prefix: 'https://ig.me/m/', why: 'Linkziel Instagram-Direktnachricht (Kontakt)' },
  { prefix: 'http://www.w3.org/2000/svg', why: 'SVG-Namensraum' },
  { prefix: 'http://www.w3.org/1999/xlink', why: 'XLink-Namensraum' },
  { prefix: 'http://www.w3.org/1999/xhtml', why: 'XHTML-Namensraum' },
  { prefix: 'http://www.w3.org/1998/Math/MathML', why: 'MathML-Namensraum' },
  { prefix: 'http://www.w3.org/XML/1998/namespace', why: 'XML-Namensraum' },
  { prefix: 'http://www.sitemaps.org/schemas/sitemap/0.9', why: 'Sitemap-Namensraum' },
  { prefix: 'https://schema.org', why: 'JSON-LD-Vokabular (`@context`)' },
  { prefix: 'https://react.dev/errors/', why: 'React-Fehlertext', jsOnly: true },
  { prefix: 'https://nextjs.org/docs/', why: 'Next.js-Fehlertext', jsOnly: true },
  { prefix: 'https://github.com/zloirock/core-js', why: 'core-js-Lizenzhinweis', jsOnly: true },
]

// Absolute (`https://…`) und protokoll-relative (`//host.tld/…`) URLs mit Punkt im Host.
const URL_PATTERN =
  /(?:https?:|wss?:)?\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?::\d+)?[^\s"'`)<>\\]*/gi

/** Fremd-URLs in ausgelieferten Dateien (Datei + URL), abzüglich Allowlist und eigener Adresse. */
export function findForeignUrls(
  files: BuiltFile[],
  ownOrigins: readonly string[] = [],
): { path: string; url: string }[] {
  const found: { path: string; url: string }[] = []
  for (const f of files) {
    const isJs = f.path.endsWith('.js')
    for (const m of f.content.matchAll(URL_PATTERN)) {
      const url = m[0]
      // `a//b.cd` in Minifikaten ist kein URL-Anfang: nur Treffer am Wortanfang zählen.
      const before = f.content[m.index - 1] ?? ''
      if (!url.includes(':') && /[\w.]/.test(before)) continue
      const absolute = url.startsWith('//') ? `https:${url}` : url
      if (ownOrigins.some((o) => absolute === o || absolute.startsWith(`${o}/`))) continue
      if (EXTERNAL_ALLOWLIST.some((a) => absolute.startsWith(a.prefix) && (!a.jsOnly || isJs)))
        continue
      found.push({ path: f.path, url })
    }
  }
  return found
}

/** Findet den Verwaltungspfad in ausgelieferten Dateien. */
export function findAdminRouteLeaks(files: BuiltFile[], adminRoute: string): string[] {
  if (!adminRoute || adminRoute === '/admin') return []
  return files.filter((f) => f.content.includes(adminRoute)).map((f) => f.path)
}

function main(): void {
  const args = process.argv.slice(2)
  if (!args.includes('--built')) {
    console.error(
      'Aufruf: pnpm check:external --built (prüft die Build-Ausgabe; vorher pnpm build)',
    )
    process.exit(2)
  }
  const distDir = path.resolve(root, process.env.NEXT_DIST_DIR || '.next')
  if (!existsSync(path.join(distDir, 'static'))) {
    console.error(`check:external: keine Build-Ausgabe unter ${distDir} – vorher pnpm build.`)
    process.exit(1)
  }
  const adminRoute = process.env.ADMIN_ROUTE || '/werkstatt'
  const files = collectBuiltFiles(distDir)
  const leaks = findAdminRouteLeaks(files, adminRoute)
  if (leaks.length > 0) {
    console.error('check:external: Der Verwaltungspfad steht in ausgelieferten Dateien:')
    for (const l of leaks) console.error(`- ${l}`)
    process.exit(1)
  }
  const publicFiles = collectPublicFiles(distDir)
  const ownOrigins = [process.env.NEXT_PUBLIC_SITE_URL]
    .filter((o): o is string => !!o)
    .map((o) => new URL(o).origin)
  const foreign = findForeignUrls(publicFiles, ownOrigins)
  if (foreign.length > 0) {
    console.error('check:external: Fremd-URLs in öffentlich ausgelieferten Dateien (T-03, R-131):')
    for (const f of foreign.slice(0, 50)) console.error(`- ${f.path}: ${f.url}`)
    process.exit(1)
  }
  console.log(
    `check:external ok – ${files.length} Dateien geprüft, Verwaltungspfad nicht enthalten; ` +
      `${publicFiles.length} öffentliche Dateien ohne Fremd-URL`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) main()
