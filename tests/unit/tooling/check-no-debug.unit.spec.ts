import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { findDebugMarkers } from '../../../scripts/check-no-debug'
import { MODULE_BUDGETS, measureModules } from '../../../scripts/check-bundle'

// P2.17 `pnpm check:no-debug` (DESIGN §9.13) und Modul-Budgets der Tuschelinie in `check:bundle` (§9.10).

let dir: string | null = null
afterEach(() => {
  if (dir) rmSync(dir, { recursive: true, force: true })
  dir = null
})

describe('check:no-debug', () => {
  it('findet __leash/__qa in .next/static und im HTML, sonst nichts', () => {
    dir = mkdtempSync(path.join(tmpdir(), 'no-debug-'))
    const stat = path.join(dir, 'static', 'chunks')
    const html = path.join(dir, 'server')
    mkdirSync(stat, { recursive: true })
    mkdirSync(html, { recursive: true })
    writeFileSync(path.join(stat, 'a.js'), 'console.log(1)')
    writeFileSync(path.join(html, 'de.html'), '<html></html>')
    // P9.1: CSS-Modul-Klassennamen (`Commission-module__e0cIba__leashEnd`) sind keine Debug-Schnittstelle.
    writeFileSync(path.join(stat, 'c.css'), '.Commission-module__e0cIba__leashEnd{width:0}')
    writeFileSync(path.join(html, 'x.html'), '<span class="Tattoo-module__ab12__qaNote"></span>')
    expect(findDebugMarkers(path.join(dir, 'static'), [html])).toEqual([])
    writeFileSync(path.join(stat, 'b.js'), 'window.__leash={}')
    writeFileSync(path.join(html, 'en.html'), '<script>window.__qa</script>')
    const hits = findDebugMarkers(path.join(dir, 'static'), [html])
    expect(hits).toHaveLength(2)
    expect(hits.join()).toContain('__leash')
    expect(hits.join()).toContain('__qa')
  })

  it('der Debug-Code steht nur in src/leash/debug.ts (Laufzeit und Renderer ohne Marker)', async () => {
    const { readFileSync } = await import('node:fs')
    for (const f of ['src/leash/runtime.ts', 'src/leash/static.ts'])
      expect(readFileSync(f, 'utf8')).not.toMatch(/__leash|__qa/)
  })
})

describe('check:bundle – Modul-Budgets (§9.10)', () => {
  it('jedes Verhaltensmodul gehört zu genau einer Mikro-Interaktionen-Gruppe (je Seite gemeinsam geladen)', async () => {
    const { readdirSync } = await import('node:fs')
    const behaviors = readdirSync('src/behaviors')
      .filter((f) => f.endsWith('.ts') && !['index.ts', 'types.ts'].includes(f))
      .map((f) => `src/behaviors/${f}`)
    const groups = MODULE_BUDGETS.filter((b) => b.name.startsWith('Mikro-Interaktionen'))
    expect(groups.length).toBeGreaterThanOrEqual(2)
    for (const file of behaviors)
      expect(
        groups.filter((g) => g.entries.includes(file)).map((g) => g.name),
        file,
      ).toHaveLength(1)
    for (const g of groups) expect(g.gzipMax).toBe(4000)
  })

  it('Engine ≤ 12 KB gz, statischer Renderer ≤ 4 KB gz, Coco ≤ 3 KB, Mikro-Interaktionen ≤ 4 KB je Gruppe', async () => {
    const reports = await measureModules()
    expect(reports.map((r) => r.name)).toEqual(MODULE_BUDGETS.map((b) => b.name))
    for (const r of reports)
      expect(r.gzipBytes, `${r.name}: ${r.gzipBytes} B`).toBeLessThanOrEqual(r.gzipMax)
  })
})
