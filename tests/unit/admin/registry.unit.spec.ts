import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { adminViewsConfig } from '@/admin/views/config'
import {
  ADMIN_BOTTOM_BAR,
  ADMIN_DETAIL_VIEWS,
  ADMIN_VIEWS,
  ALL_ADMIN_VIEWS,
  adminViewPath,
  allDataPath,
  isActiveView,
  matchAdminView,
} from '@/admin/views/registry'
import { ADMIN_VIEWS as PREVIEW_ADMIN_VIEWS } from '../../../scripts/preview-export/adminViews'

// P5.1 – Ansichten-Registry der Verwaltung (KONZEPT §7.2): Pfade eindeutig, alle Pfade aus §7.2 vorhanden,
// Detailpfade, Zuordnung Pfad → Ansicht, Payload-Registrierung und Vorschau-Liste aus derselben Quelle.

const KONZEPT_PATHS = [
  '/heute',
  '/neues-stueck',
  '/stuecke',
  '/packen',
  '/vorkasse',
  '/versendet',
  '/abholung',
  '/widerrufe',
  '/anfragen',
  '/tattoo',
  '/texte',
  '/einstellungen',
  '/export',
]

describe('Ansichten-Registry (P5.1)', () => {
  it('alle 13 Pfade aus KONZEPT §7.2 vorhanden, in dieser Reihenfolge', () => {
    expect(ADMIN_VIEWS.map((v) => v.path)).toEqual(KONZEPT_PATHS)
    // Die Liste in KONZEPT selbst (Schutz gegen Auseinanderlaufen).
    const konzept = readFileSync('docs/KONZEPT.md', 'utf8')
    const section = konzept.slice(konzept.indexOf('### 7.2 Navigation'), konzept.indexOf('### 7.3'))
    const listed = [...new Set([...section.matchAll(/`(\/[a-z-]+)`/g)].map((m) => m[1]))]
    expect(listed).toEqual(KONZEPT_PATHS)
  })

  it('Schlüssel und Pfade eindeutig, Detailpfade mit :id, jedes Feld gesetzt', () => {
    const keys = ALL_ADMIN_VIEWS.map((v) => v.key)
    const paths = ALL_ADMIN_VIEWS.map((v) => v.path)
    expect(new Set(keys).size).toBe(keys.length)
    expect(new Set(paths).size).toBe(paths.length)
    expect(ADMIN_DETAIL_VIEWS.map((v) => v.path)).toEqual([
      '/stuecke/:id',
      '/bestellungen/:id',
      '/widerrufe/:id',
      '/einstellungen/produktsicherheit',
      '/anfragen/:id',
    ])
    for (const v of ALL_ADMIN_VIEWS) {
      expect(v.path).toMatch(/^\/[a-z-]+(\/(:id|[a-z-]+))?$/)
      expect(v.title.length).toBeGreaterThan(2)
      expect(v.phase).toBeGreaterThanOrEqual(5)
      expect(v.task).toMatch(/^P\d+\.\d+[a-z]?$/)
      expect(v.allData).toMatch(/^\/(collections|globals)\//)
      if (v.path.includes(':id')) expect(v.allData).toContain(':id')
    }
    // Keine Kollision mit Payloads eigenen Pfaden.
    for (const p of paths)
      expect(p).not.toMatch(/^\/(collections|globals|login|logout|account|api)\b/)
    expect(ADMIN_VIEWS.find((v) => v.key === 'tattoo')!.phase).toBe(7)
  })

  it('Leiste unten: Heute · Neues Stück · Packen (· Mehr)', () => {
    expect(ADMIN_BOTTOM_BAR).toEqual(['heute', 'neues-stueck', 'packen'])
  })

  it('Pfad → Ansicht: Startseite = Heute, Detail mit ID, Unbekanntes = null', () => {
    expect(matchAdminView([])?.view.key).toBe('heute')
    expect(matchAdminView(undefined)?.view.key).toBe('heute')
    expect(matchAdminView(['heute'])?.view.key).toBe('heute')
    expect(matchAdminView(['bestellungen', '17'])).toMatchObject({
      view: { key: 'bestellung' },
      id: '17',
    })
    expect(matchAdminView(['bestellungen'])).toBeNull()
    expect(matchAdminView(['bestellungen', 'abc'])).toBeNull()
    expect(matchAdminView(['stuecke', '0'])).toBeNull()
    expect(matchAdminView(['collections', 'orders'])).toBeNull()
    expect(isActiveView('widerrufe', '/widerrufe/3')).toBe(true)
    expect(isActiveView('heute', '/')).toBe(true)
    expect(isActiveView('packen', '/heute')).toBe(false)
  })

  it('Pfade für Links und Rückfall in „Alle Daten“', () => {
    expect(adminViewPath('packen')).toBe('/packen')
    expect(adminViewPath('bestellung', 17)).toBe('/bestellungen/17')
    expect(() => adminViewPath('bestellung', '')).toThrow()
    const detail = ADMIN_DETAIL_VIEWS.find((v) => v.key === 'widerruf')!
    expect(allDataPath(detail, 3)).toBe('/collections/withdrawals/3')
  })

  it('Payload-Registrierung: Dashboard = Heute, je Registry-Pfad eine exakte Route', () => {
    const views = adminViewsConfig()
    expect(views.dashboard?.Component).toBe('/admin/views/AdminView#HeuteDashboard')
    for (const v of ALL_ADMIN_VIEWS) {
      expect(views[v.key]).toMatchObject({
        path: v.path,
        exact: true,
        Component: '/admin/views/AdminView#AdminView',
      })
    }
  })

  it('Vorschau-Export listet alle Ansichten mit Phase (ARCHITEKTUR §14.7)', () => {
    for (const v of ADMIN_VIEWS) {
      const shot = PREVIEW_ADMIN_VIEWS.find((p) => p.key === v.key)
      expect(shot, v.key).toBeDefined()
      expect(shot!.phase).toBe(v.phase)
      expect(shot!.caption.de).toBe(v.title)
      expect(shot!.caption.en.length).toBeGreaterThan(2)
      expect(shot!.path).toBe(v.key === 'heute' ? '' : v.path)
    }
  })
})
