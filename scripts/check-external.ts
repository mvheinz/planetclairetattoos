// Prüfung der Build-Ausgabe (ARCHITEKTUR §6.3 Nr. 9, §8.4): pnpm check:external --built
// Grundgerüst P1.12: Der Wert von ADMIN_ROUTE darf in keiner Datei unter `.next/static` und in keinem erzeugten
// öffentlichen HTML vorkommen (AK-2-04, Teil). P2 ergänzt die Fremd-URL-Prüfung (T-03, EK-05).
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
  console.log(
    `check:external ok – ${files.length} Dateien geprüft, Verwaltungspfad nicht enthalten`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) main()
