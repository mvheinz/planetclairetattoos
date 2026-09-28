import { describe, expect, it } from 'vitest'

import { priceNoteText } from '@/components/shop/PriceNote'
import { pickShopDisplaySettings, taxSettingsFor } from '@/lib/shop/displaySettings'
import { buildListMetadata } from '@/lib/seo/metadata'

// P3.5/P3.6 Listen-Seiten: Einstellungen (Shop pausiert, Abholung, Steuermodus) und Metadaten der Listen.

const SITE = 'https://planetclairetattoos.com'

describe('Shop-Einstellungen für Listen (KONZEPT §3.2)', () => {
  it('Standard ohne Datenbank: geöffnet, Abholung möglich, Kleinunternehmerin (E-02)', () => {
    expect(pickShopDisplaySettings({})).toEqual({
      isOpen: true,
      closedMessage: null,
      pickupEnabled: true,
      pickupCity: null,
      deliveryTimeText: null,
      taxMode: 'kleinunternehmer',
    })
  })

  it('Shop pausiert mit Hinweis, Abholung aus, Regelbesteuerung aus tax.currentMode', () => {
    expect(
      pickShopDisplaySettings({
        shop: { isOpen: false, closedMessage: '  Urlaub bis Montag  ' },
        shipping: { pickupEnabled: false, pickupCity: 'Berlin', deliveryTimeText: '3–4 Werktage' },
        tax: { currentMode: 'regelbesteuert' },
      }),
    ).toEqual({
      isOpen: false,
      closedMessage: 'Urlaub bis Montag',
      pickupEnabled: false,
      pickupCity: 'Berlin',
      deliveryTimeText: '3–4 Werktage',
      taxMode: 'regelbesteuert',
    })
    expect(pickShopDisplaySettings({ tax: { currentMode: 'erfunden' } }).taxMode).toBe(
      'kleinunternehmer',
    )
  })

  it('R-030 taxSettingsFor liefert der Fußnote den aktuellen Modus (nie „inkl. MwSt“ bei Kleinunternehmerin)', () => {
    const at = new Date('2026-09-28T10:00:00Z')
    expect(
      priceNoteText({ locale: 'de', settings: taxSettingsFor('kleinunternehmer'), at }),
    ).toMatch(/§ 19 UStG/)
    expect(priceNoteText({ locale: 'de', settings: taxSettingsFor('regelbesteuert'), at })).toBe(
      'inkl. 19 % USt.',
    )
  })
})

describe('Metadaten der Listen (KONZEPT §2.3)', () => {
  it('R02: canonical ohne available, mit page ab Seite 2; hreflang gleich aufgebaut', () => {
    const one = buildListMetadata('R02', 'de', {}, { siteUrl: SITE })
    expect(one.alternates?.canonical).toBe(`${SITE}/de/shop`)
    const two = buildListMetadata('R02', 'en', {}, { siteUrl: SITE, page: 2 })
    expect(two.alternates?.canonical).toBe(`${SITE}/en/shop?page=2`)
    expect(two.alternates?.languages).toEqual({
      de: `${SITE}/de/shop?page=2`,
      en: `${SITE}/en/shop?page=2`,
      'x-default': `${SITE}/de/shop?page=2`,
    })
    expect(two.title).toEqual({ absolute: 'Shop · Planet Claire' })
  })

  it('R03: Titel „{Kategorie} · Shop · Planet Claire“, Slug je Sprache in hreflang', () => {
    const m = buildListMetadata(
      'R03',
      'en',
      { slug: 'ceramics' },
      { siteUrl: SITE, title: 'Ceramics · Shop', alternateParams: { de: { slug: 'keramik' } } },
    )
    expect(m.title).toEqual({ absolute: 'Ceramics · Shop · Planet Claire' })
    expect(m.alternates?.canonical).toBe(`${SITE}/en/shop/category/ceramics`)
    expect(m.alternates?.languages).toMatchObject({
      de: `${SITE}/de/shop/kategorie/keramik`,
      'x-default': `${SITE}/de/shop/kategorie/keramik`,
    })
    expect((m.openGraph as { url?: string }).url).toBe(`${SITE}/en/shop/category/ceramics`)
  })

  it('R05: canonical ohne category, Titel „Archiv · Planet Claire“', () => {
    const m = buildListMetadata('R05', 'de', {}, { siteUrl: SITE })
    expect(m.alternates?.canonical).toBe(`${SITE}/de/archiv`)
    expect(m.title).toEqual({ absolute: 'Archiv · Planet Claire' })
    expect(buildListMetadata('R05', 'en', {}, { siteUrl: SITE }).alternates?.canonical).toBe(
      `${SITE}/en/archive`,
    )
  })
})
