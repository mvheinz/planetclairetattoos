import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { ADMIN_VIEWS } from '../../../scripts/preview-export/adminViews'
import { SHOT_IDS, SHOT_SPECS } from '../../../scripts/handbook/shotList'
import { parseShotArgs } from '../../../scripts/handbook/shots'

// P10.17 – Bildschirmfotos für das Handbuch: Größenbudget (≤ 150 KB je Bild, ≤ 3 MB zusammen), jedes Bild der Liste liegt
// im Ordner, jedes im Handbuch referenzierte Bild existiert (nach P10.18), nur Beispieldaten und kein Verwaltungspfad.

const root = path.resolve(__dirname, '../../..')
const dir = path.join(root, 'docs/owner/img/handbuch')
const handbook = existsSync(path.join(root, 'docs/owner/HANDBUCH.md'))
  ? readFileSync(path.join(root, 'docs/owner/HANDBUCH.md'), 'utf8')
  : ''

describe('Handbuch-Bilder (P10.17)', () => {
  it('Ansichtsliste: jede Verwaltungsansicht des Vorschau-Exports hat ein Bild; Namen eindeutig', () => {
    expect(new Set(SHOT_IDS).size).toBe(SHOT_IDS.length)
    for (const v of ADMIN_VIEWS.filter((x) => !['products-list', 'products-form'].includes(x.key)))
      expect(SHOT_IDS, v.key).toContain(v.key)
    for (const id of [
      'dialog-neues-stueck',
      'dialog-uebersetzen',
      'dialog-versendet',
      'dialog-zahlung-erhalten',
      'dialog-abholung',
      'dialog-offline-verkauft',
      'widerruf-erstatten',
      'anfrage',
      'tattoo-flash',
      'tattoo-galerie',
      'umsatz-waechter',
      'export',
      'datenschutz-anfrage',
      'dialog-beispieldaten-entfernen',
      'startklar',
    ])
      expect(SHOT_IDS, id).toContain(id)
    expect(SHOT_SPECS.filter((s) => s.kind === 'public')).toHaveLength(3)
    for (const s of SHOT_SPECS) expect(s.caption.length, s.id).toBeGreaterThan(3)
  })

  it('Argumente der Aufnahme werden geprüft', () => {
    expect(parseShotArgs(['--only=heute'])).toMatchObject({ only: ['heute'] })
    expect(() => parseShotArgs(['--only=gibt-es-nicht'])).toThrow()
    expect(() => parseShotArgs(['--x'])).toThrow()
  })

  it('jedes Bild ≤ 150 KB, zusammen ≤ 3 MB, nur .webp', () => {
    const files = readdirSync(dir)
    expect(files.length).toBeGreaterThan(0)
    let total = 0
    for (const f of files) {
      expect(f.endsWith('.webp'), f).toBe(true)
      const size = statSync(path.join(dir, f)).size
      expect(size, f).toBeLessThanOrEqual(150 * 1024)
      total += size
    }
    expect(total).toBeLessThanOrEqual(3 * 1024 * 1024)
  })

  it('jedes Bild der Liste existiert, keine überzähligen Dateien', () => {
    const files = new Set(readdirSync(dir))
    for (const id of SHOT_IDS) expect(files.has(`${id}.webp`), id).toBe(true)
    for (const f of files) expect(SHOT_IDS, f).toContain(f.replace(/\.webp$/, ''))
  })

  it('alle im Handbuch referenzierten Bilder existieren (relative Pfade)', () => {
    for (const m of handbook.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g)) {
      const ref = m[1]!
      expect(ref.startsWith('img/handbuch/'), ref).toBe(true)
      expect(existsSync(path.join(root, 'docs/owner', ref)), ref).toBe(true)
    }
  })
})
