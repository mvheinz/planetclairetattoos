import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import * as cheerio from 'cheerio'
import { describe, expect, it } from 'vitest'

import { EXPORT_ORIGIN } from '../../../scripts/preview-export/env'

// AK-A-14-01/AK-A-14-02 (ARCHITEKTUR §14.10): zwei Läufe desselben Commits am selben Tag (`pnpm preview:export`, danach
// `pnpm preview:export --skip-build`) erzeugen byte-gleiche HTML-Dateien; die Datei enthält keine Spuren des Servers,
// der Verwaltung oder der Debug-Schnittstelle und keine http(s)-Ressourcen außer externen Linkzielen.
// Braucht Postgres und Playwright-Chromium (Voraussetzungen des Exports) und baut einmal nach `.next-preview`.

const root = process.cwd()
const file = path.join(root, 'dist/planet-claire-vorschau.html')

function runExport(args: string[]) {
  const res = spawnSync('pnpm', ['-s', 'preview:export', ...args], {
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL_TEST!,
      DATABASE_URL_UNPOOLED: '',
    },
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 15 * 60_000,
  })
  if (res.status !== 0) {
    throw new Error(
      `preview:export ${args.join(' ')} → Exit ${res.status}\n${res.stdout.slice(-4000)}\n${res.stderr.slice(-4000)}`,
    )
  }
  return readFileSync(file)
}

/** Alle http(s)-Werte in Attributen und CSS, die keine Linkziele (`<a href>`) oder Namensräume sind. */
function externalResources(html: string): string[] {
  const $ = cheerio.load(html)
  const found: string[] = []
  $('*').each((_, el) => {
    const tag = (el as { tagName?: string }).tagName ?? ''
    for (const [name, value] of Object.entries($(el).attr() ?? {})) {
      if (!/https?:\/\//i.test(value)) continue
      if (tag === 'a' && name === 'href') continue
      // Teilen/Kopieren (P14.12, U-61): Linkadresse als Text zum Teilen bzw. in die Zwischenablage – wird nie geladen
      if (['data-share-url', 'data-copy', 'data-copy-failed-text'].includes(name)) continue
      if (name === 'xmlns' || name.startsWith('xmlns:')) continue
      found.push(`<${tag} ${name}="${value.slice(0, 80)}">`)
    }
  })
  $('style').each((_, el) => {
    for (const m of $(el)
      .text()
      .matchAll(/url\(\s*['"]?(https?:[^'")]+)/gi))
      found.push(`url(${m[1]})`)
    if (/@import/i.test($(el).text())) found.push('@import')
  })
  return found
}

describe('pnpm preview:export – Determinismus und Inhalt (AK-A-14-01, AK-A-14-02)', () => {
  it(
    'AK-A-14-01 Build-Lauf und --skip-build-Lauf am selben Tag sind byte-gleich; AK-A-14-02 keine Server-Spuren',
    () => {
      const first = runExport([])
      const second = runExport(['--skip-build'])
      // Zur Fehlersuche bleibt bei Abweichung der erste Lauf neben der Datei liegen (dist/ ist nicht im Repo).
      if (!second.equals(first)) writeFileSync(file.replace(/\.html$/, '.first.html'), first)
      expect(second.equals(first)).toBe(true)

      const html = first.toString('utf8')
      for (const needle of [
        '/_next/',
        EXPORT_ORIGIN.replace('http://', ''),
        '__next_f',
        '/werkstatt',
      ])
        expect(html, `AK-A-14-02: ${needle}`).not.toContain(needle)
      // Debug-Schnittstelle als eigener Bezeichner (wie `pnpm check:no-debug`) – nicht als Teil eines
      // CSS-Modul-Klassennamens wie `qa-module__O2_KOq__leashPage`.
      expect(html, 'AK-A-14-02: __leash').not.toMatch(/(?<![A-Za-z0-9_$])__leash(?![A-Za-z0-9_$])/)
      expect(externalResources(html)).toEqual([])
      expect(html).toContain('<meta name="robots" content="noindex, nofollow">')
      expect(html).toMatch(
        /<meta http-equiv="Content-Security-Policy" content="default-src 'none';/,
      )
      // Keine Zeitstempel im HTML (nur das Stand-Datum als Tag).
      expect(html).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
    },
    30 * 60_000,
  )
})
