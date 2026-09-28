import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// `pnpm check:no-debug` (DESIGN §9.13, KUNST-QA §3.1, ARCHITEKTUR §6.4): Produktions-Build **ohne**
// `NEXT_PUBLIC_LEASH_DEBUG`, danach dürfen die Test-Schnittstellen `__leash` und `__qa` weder in `.next/static` noch im
// vorgerendertem HTML vorkommen. `--no-build` prüft einen vorhandenen Build (z. B. im CI-Job `quality`, der schon ohne
// Schalter gebaut hat). Später (P2.2x) kommt die Vorschau-Datei `dist/planet-claire-vorschau.html` dazu, sobald es sie gibt.

export const DEBUG_MARKERS = ['__leash', '__qa'] as const

function listFiles(dir: string, match: (name: string) => boolean): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap((name) => {
    const abs = path.join(dir, name)
    if (statSync(abs).isDirectory()) return listFiles(abs, match)
    return match(name) ? [abs] : []
  })
}

/** Fundstellen `Datei: Marker` in JavaScript/CSS unter `staticDir` und HTML-Dateien unter `htmlDirs`. */
export function findDebugMarkers(
  staticDir: string,
  htmlDirs: string[] = [],
  files: string[] = [],
): string[] {
  const scanned = [
    ...listFiles(staticDir, (n) => /\.(js|css|html)$/.test(n)),
    ...htmlDirs.flatMap((d) => listFiles(d, (n) => n.endsWith('.html'))),
    ...files.filter((f) => existsSync(f)),
  ]
  const hits: string[] = []
  for (const file of scanned) {
    const text = readFileSync(file, 'utf8')
    for (const marker of DEBUG_MARKERS)
      if (text.includes(marker)) hits.push(`${path.relative(process.cwd(), file)}: ${marker}`)
  }
  return hits
}

function main(): void {
  const noBuild = process.argv.includes('--no-build')
  if (!noBuild) {
    const env = { ...process.env }
    delete env.NEXT_PUBLIC_LEASH_DEBUG
    console.log('check:no-debug: Produktions-Build ohne NEXT_PUBLIC_LEASH_DEBUG …')
    const res = spawnSync('pnpm', ['run', 'build'], { stdio: 'inherit', env })
    if (res.status !== 0) {
      console.error('check:no-debug: Build fehlgeschlagen.')
      process.exit(res.status ?? 1)
    }
  }
  const staticDir = path.resolve('.next/static')
  if (!existsSync(staticDir)) {
    console.error(
      'check:no-debug: .next/static fehlt – zuerst bauen (ohne --no-build baut das Skript selbst).',
    )
    process.exit(1)
  }
  const hits = findDebugMarkers(
    staticDir,
    [path.resolve('.next/server/app')],
    [path.resolve('dist/planet-claire-vorschau.html')],
  )
  if (hits.length > 0) {
    for (const h of hits) console.error(`check:no-debug: ${h}`)
    console.error(
      'check:no-debug: Debug-Schnittstelle im Build gefunden – wurde mit NEXT_PUBLIC_LEASH_DEBUG=1 gebaut?',
    )
    process.exit(1)
  }
  console.log('check:no-debug: keine Debug-Schnittstelle (__leash, __qa) im Build.')
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main()
