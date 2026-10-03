import type { Payload } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { HOME_STATION_IDS, loadHomeView, stationCategories, toHomeView } from '@/lib/data/home'
import { loadSeedData } from '@/lib/seed/loader'
import { runSeed } from '@/lib/seed/run'
import { CANONICAL_SEED_NOW } from '@/lib/seed/time'
import { fixedClock } from '@/lib/time'

import { getTestPayload } from '../helpers/payload'

// P2.20 Startseite R01: Daten aus `pages:home` (Seed, SEED-SPEC) über den öffentlichen Payload – Kopf-Station, 7
// Stationen in fester Reihenfolge (AK-3-01, AK-SEED-18), Links aufgelöst, Name aus `settings.business`; ohne `home`
// ein Leerzustand statt Fehler (DM-PAGE-01).

let payload: Payload
const now = new Date(CANONICAL_SEED_NOW)

beforeAll(async () => {
  payload = await getTestPayload()
  const data = await loadSeedData({ now, requireBase: false })
  await runSeed(payload, {
    command: 'example',
    data,
    now,
    clock: fixedClock('2026-10-15T08:00:30Z'),
    appEnv: 'test',
    // Seiten verweisen auf Medien des Beispielbestands (SEED-SPEC §13.1) → Medien zuerst.
    only: ['media', 'pages'],
  })
}, 240_000)

describe('Startseite (P2.20)', () => {
  it('AK-3-01 AK-SEED-18 Kopf-Station und genau 7 Stationen in der festen Reihenfolge (DE)', async () => {
    const view = await loadHomeView('de')
    expect(view).not.toBeNull()
    expect(view!.name).toBe('Planet Claire')
    expect(view!.hero?.heading).toBe('Tattoos & handgemachte Unikate aus Berlin')
    expect(view!.stations.map((s) => s.stationId)).toEqual([...HOME_STATION_IDS])
    expect(view!.stations.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6, 7])
    const byId = Object.fromEntries(view!.stations.map((s) => [s.stationId, s]))
    expect(byId.hallo!.heading).toBe('Hallo!')
    expect(byId.hallo!.link).toBeNull()
    expect(byId.keramik!.pose).toBe('sniff')
    expect(byId.keramik!.link).toEqual({
      href: '/de/shop/kategorie/keramik',
      label: 'Alle Keramik',
      external: false,
    })
    expect(byId.tattoo!.link?.href).toBe('/de/tattoo')
    expect(byId['jutta-und-coco']!.link?.href).toBe('/de/ueber-mich')
  })

  it('AK-3-01 EN vollständig: englische Texte und Pfade', async () => {
    const view = await loadHomeView('en')
    expect(view!.hero?.heading).toBe('Tattoos & handmade one-offs from Berlin')
    expect(view!.stations.map((s) => s.stationId)).toEqual([...HOME_STATION_IDS])
    const keramik = view!.stations.find((s) => s.stationId === 'keramik')!
    expect(keramik.heading).toBe('Ceramics')
    expect(keramik.link?.href).toBe('/en/shop/category/ceramics')
    expect(keramik.link?.label).toBe('All ceramics')
    for (const s of view!.stations) expect(s.text).toBeTruthy()
  })

  it('Kategorie ohne Navigationseintrag → Shop statt toter Link', () => {
    const view = toHomeView(
      {
        id: 1,
        key: 'home',
        title: 'x',
        layout: [
          {
            blockType: 'station',
            stationId: 'keramik',
            heading: 'Keramik',
            link: { target: 'category', category: 'keramik', label: 'Alle' },
          },
        ],
        updatedAt: '',
        createdAt: '',
      },
      {
        locale: 'de',
        categories: [],
        contact: { email: null, instagramHandle: 'planet.claire.tattoos' },
        tradeName: null,
      },
    )
    expect(view!.stations[0]!.link?.href).toBe('/de/shop')
    expect(view!.hero).toBeNull()
  })

  it('P3.12 KA-17 Kategorien der Stationen: Textil = textil + cap, nur Kategorie-Stationen, Link-Kategorie gilt', async () => {
    const view = await loadHomeView('de')
    const byId = Object.fromEntries(view!.stations.map((s) => [s.stationId, s]))
    expect(byId.keramik!.categories).toEqual(['keramik'])
    expect(byId.textil!.categories).toEqual(['textil', 'cap'])
    expect(byId.zeichnungen!.categories).toEqual(['zeichnung'])
    expect(byId.schmuck!.categories).toEqual(['schmuck'])
    for (const id of ['hallo', 'tattoo', 'jutta-und-coco']) expect(byId[id]!.categories).toBeNull()
    expect(byId.keramik!.categoryName).toBe('Keramik')
    // Link auf eine andere Kategorie (Test-Kategorie) bzw. kein Kategorie-Link → feste Zuordnung.
    expect(stationCategories('schmuck', { target: 'category', category: 'sonstiges' })).toEqual([
      'sonstiges',
    ])
    expect(stationCategories('textil', { target: 'shop', category: null })).toEqual([
      'textil',
      'cap',
    ])
    expect(stationCategories('tattoo', { target: 'category', category: 'keramik' })).toBeNull()
  })

  it('P3.12 Kategorie-Station ohne Link bekommt „Alle {Kategorie}“ → R03', () => {
    const view = toHomeView(
      {
        id: 1,
        key: 'home',
        title: 'x',
        layout: [{ blockType: 'station', stationId: 'keramik', heading: 'Keramik' }],
        updatedAt: '',
        createdAt: '',
      },
      {
        locale: 'de',
        categories: [{ key: 'keramik', name: 'Keramik', slug: 'keramik' }],
        contact: { email: null, instagramHandle: 'planet.claire.tattoos' },
        tradeName: null,
      },
    )
    expect(view!.stations[0]!.link).toEqual({
      href: '/de/shop/kategorie/keramik',
      label: null,
      external: false,
    })
    expect(view!.stations[0]!.categoryName).toBe('Keramik')
  })

  it('DM-PAGE-01 fehlt `pages:home`, liefert der Loader null statt eines Fehlers', async () => {
    await payload.delete({
      collection: 'pages',
      where: { key: { equals: 'home' } },
      overrideAccess: true,
      context: { seed: true },
    })
    await expect(loadHomeView('de')).resolves.toBeNull()
  })
})
