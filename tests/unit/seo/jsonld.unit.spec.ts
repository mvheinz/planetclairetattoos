import { describe, expect, it } from 'vitest'

import type { TaxMode } from '@/lib/enums'
import { breadcrumbItems } from '@/lib/seo/breadcrumbs'
import {
  RETURN_DAYS,
  breadcrumbJsonLd,
  priceString,
  productImageUrls,
  productJsonLd,
  returnPolicyJsonLd,
  serializeJsonLd,
  shippingDetailsJsonLd,
  splitDeliveryDays,
  type ProductJsonLdInput,
  type PublicProductStatus,
} from '@/lib/seo/jsonld'
import {
  categoryMetaDescription,
  metaExcerpt,
  productMetaDescription,
  productPageTitle,
} from '@/lib/seo/product'
import { deliveryDayRange } from '@/lib/shop/deliveryTime'

// P3.13 JSON-LD (KONZEPT §3.0.5, §3.4): `Product` mit `Offer` je Zustand und Steuermodus, `BreadcrumbList` auf
// R02–R05; R-126: im Kleinunternehmer-Modus keine Steuerangabe.

const SITE = 'https://planetclairetattoos.com'

const base: Omit<ProductJsonLdInput, 'status' | 'taxMode'> = {
  name: 'Schale „Langohr & Wuschel“',
  description: 'Kleine Schale  mit zwei Hunden.\nVon Hand bemalt.',
  itemNumber: 17,
  priceCents: 4500,
  isSecondHand: false,
  images: productImageUrls(
    [
      { url: '/api/media/file/a.webp', sizes: { detail: { url: '/api/media/file/a-1600.webp' } } },
      { url: '/api/media/file/b.webp', sizes: { detail: null } },
      7,
      null,
    ],
    SITE,
  ),
  url: `${SITE}/de/shop/017-schale-langohr-wuschel`,
}

const STATES: PublicProductStatus[] = ['available', 'reserved', 'sold']
const MODES: TaxMode[] = ['kleinunternehmer', 'regelbesteuert']

describe('priceString', () => {
  it('bildet den Preis aus Integer-Cent als Zeichenkette ohne Fließkomma', () => {
    expect(priceString(4500)).toBe('45.00')
    expect(priceString(123450)).toBe('1234.50')
    expect(priceString(5)).toBe('0.05')
    expect(priceString(0)).toBe('0.00')
    expect(priceString(99)).toBe('0.99')
    expect(() => priceString(45.5)).toThrow()
    expect(() => priceString(-100)).toThrow()
  })
})

describe('productJsonLd', () => {
  it('Snapshot je Zustand und Steuermodus', () => {
    const all = Object.fromEntries(
      STATES.map((status) => [
        status,
        Object.fromEntries(
          MODES.map((taxMode) => [taxMode, productJsonLd({ ...base, status, taxMode })]),
        ),
      ]),
    )
    expect(all).toMatchInlineSnapshot(`
      {
        "available": {
          "kleinunternehmer": {
            "@context": "https://schema.org",
            "@type": "Product",
            "brand": {
              "@type": "Brand",
              "name": "Planet Claire",
            },
            "description": "Kleine Schale mit zwei Hunden. Von Hand bemalt.",
            "image": [
              "https://planetclairetattoos.com/api/media/file/a-1600.webp",
              "https://planetclairetattoos.com/api/media/file/b.webp",
            ],
            "itemCondition": "https://schema.org/NewCondition",
            "name": "Schale „Langohr & Wuschel“",
            "offers": {
              "@type": "Offer",
              "availability": "https://schema.org/InStock",
              "price": "45.00",
              "priceCurrency": "EUR",
              "url": "https://planetclairetattoos.com/de/shop/017-schale-langohr-wuschel",
            },
            "sku": "017",
          },
          "regelbesteuert": {
            "@context": "https://schema.org",
            "@type": "Product",
            "brand": {
              "@type": "Brand",
              "name": "Planet Claire",
            },
            "description": "Kleine Schale mit zwei Hunden. Von Hand bemalt.",
            "image": [
              "https://planetclairetattoos.com/api/media/file/a-1600.webp",
              "https://planetclairetattoos.com/api/media/file/b.webp",
            ],
            "itemCondition": "https://schema.org/NewCondition",
            "name": "Schale „Langohr & Wuschel“",
            "offers": {
              "@type": "Offer",
              "availability": "https://schema.org/InStock",
              "price": "45.00",
              "priceCurrency": "EUR",
              "priceSpecification": {
                "@type": "PriceSpecification",
                "price": "45.00",
                "priceCurrency": "EUR",
                "valueAddedTaxIncluded": true,
              },
              "url": "https://planetclairetattoos.com/de/shop/017-schale-langohr-wuschel",
            },
            "sku": "017",
          },
        },
        "reserved": {
          "kleinunternehmer": {
            "@context": "https://schema.org",
            "@type": "Product",
            "brand": {
              "@type": "Brand",
              "name": "Planet Claire",
            },
            "description": "Kleine Schale mit zwei Hunden. Von Hand bemalt.",
            "image": [
              "https://planetclairetattoos.com/api/media/file/a-1600.webp",
              "https://planetclairetattoos.com/api/media/file/b.webp",
            ],
            "itemCondition": "https://schema.org/NewCondition",
            "name": "Schale „Langohr & Wuschel“",
            "offers": {
              "@type": "Offer",
              "availability": "https://schema.org/InStock",
              "price": "45.00",
              "priceCurrency": "EUR",
              "url": "https://planetclairetattoos.com/de/shop/017-schale-langohr-wuschel",
            },
            "sku": "017",
          },
          "regelbesteuert": {
            "@context": "https://schema.org",
            "@type": "Product",
            "brand": {
              "@type": "Brand",
              "name": "Planet Claire",
            },
            "description": "Kleine Schale mit zwei Hunden. Von Hand bemalt.",
            "image": [
              "https://planetclairetattoos.com/api/media/file/a-1600.webp",
              "https://planetclairetattoos.com/api/media/file/b.webp",
            ],
            "itemCondition": "https://schema.org/NewCondition",
            "name": "Schale „Langohr & Wuschel“",
            "offers": {
              "@type": "Offer",
              "availability": "https://schema.org/InStock",
              "price": "45.00",
              "priceCurrency": "EUR",
              "priceSpecification": {
                "@type": "PriceSpecification",
                "price": "45.00",
                "priceCurrency": "EUR",
                "valueAddedTaxIncluded": true,
              },
              "url": "https://planetclairetattoos.com/de/shop/017-schale-langohr-wuschel",
            },
            "sku": "017",
          },
        },
        "sold": {
          "kleinunternehmer": {
            "@context": "https://schema.org",
            "@type": "Product",
            "brand": {
              "@type": "Brand",
              "name": "Planet Claire",
            },
            "description": "Kleine Schale mit zwei Hunden. Von Hand bemalt.",
            "image": [
              "https://planetclairetattoos.com/api/media/file/a-1600.webp",
              "https://planetclairetattoos.com/api/media/file/b.webp",
            ],
            "itemCondition": "https://schema.org/NewCondition",
            "name": "Schale „Langohr & Wuschel“",
            "offers": {
              "@type": "Offer",
              "availability": "https://schema.org/SoldOut",
              "price": "45.00",
              "priceCurrency": "EUR",
              "url": "https://planetclairetattoos.com/de/shop/017-schale-langohr-wuschel",
            },
            "sku": "017",
          },
          "regelbesteuert": {
            "@context": "https://schema.org",
            "@type": "Product",
            "brand": {
              "@type": "Brand",
              "name": "Planet Claire",
            },
            "description": "Kleine Schale mit zwei Hunden. Von Hand bemalt.",
            "image": [
              "https://planetclairetattoos.com/api/media/file/a-1600.webp",
              "https://planetclairetattoos.com/api/media/file/b.webp",
            ],
            "itemCondition": "https://schema.org/NewCondition",
            "name": "Schale „Langohr & Wuschel“",
            "offers": {
              "@type": "Offer",
              "availability": "https://schema.org/SoldOut",
              "price": "45.00",
              "priceCurrency": "EUR",
              "priceSpecification": {
                "@type": "PriceSpecification",
                "price": "45.00",
                "priceCurrency": "EUR",
                "valueAddedTaxIncluded": true,
              },
              "url": "https://planetclairetattoos.com/de/shop/017-schale-langohr-wuschel",
            },
            "sku": "017",
          },
        },
      }
    `)
  })

  it('ist gültiges JSON mit allen Pflichtfeldern (sku 3-stellig, Marke, Zustand, Angebot)', () => {
    for (const status of STATES) {
      const data = JSON.parse(
        serializeJsonLd(productJsonLd({ ...base, status, taxMode: 'kleinunternehmer' })),
      ) as Record<string, unknown>
      expect(data).toMatchObject({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: base.name,
        sku: '017',
        brand: { '@type': 'Brand', name: 'Planet Claire' },
        itemCondition: 'https://schema.org/NewCondition',
        offers: {
          '@type': 'Offer',
          price: '45.00',
          priceCurrency: 'EUR',
          availability: `https://schema.org/${status === 'sold' ? 'SoldOut' : 'InStock'}`,
          url: base.url,
        },
      })
      expect(data.image).toEqual([
        `${SITE}/api/media/file/a-1600.webp`,
        `${SITE}/api/media/file/b.webp`,
      ])
      expect(data.description).toBe('Kleine Schale mit zwei Hunden. Von Hand bemalt.')
    }
  })

  it('itemCondition UsedCondition bei isSecondHand', () => {
    const data = productJsonLd({
      ...base,
      isSecondHand: true,
      status: 'available',
      taxMode: 'kleinunternehmer',
    })
    expect(data.itemCondition).toBe('https://schema.org/UsedCondition')
  })

  it('R-126 im Kleinunternehmer-Modus kein Steuer-Flag; regelbesteuert valueAddedTaxIncluded', () => {
    for (const status of STATES) {
      const ku = serializeJsonLd(productJsonLd({ ...base, status, taxMode: 'kleinunternehmer' }))
      expect(ku).not.toMatch(/valueAddedTax|priceSpecification|tax/i)
      const rb = JSON.parse(
        serializeJsonLd(productJsonLd({ ...base, status, taxMode: 'regelbesteuert' })),
      ) as { offers: { priceSpecification?: Record<string, unknown> } }
      expect(rb.offers.priceSpecification).toMatchObject({ valueAddedTaxIncluded: true })
    }
  })

  it('ohne Bilder und ohne Beschreibung fehlen die Felder statt leer zu sein', () => {
    const data = productJsonLd({
      ...base,
      images: [],
      description: '  ',
      status: 'available',
      taxMode: 'kleinunternehmer',
    })
    expect(data).not.toHaveProperty('image')
    expect(data).not.toHaveProperty('description')
  })

  it('serializeJsonLd maskiert „<“ (kein Ausbruch aus dem Skript)', () => {
    const out = serializeJsonLd(
      productJsonLd({
        ...base,
        name: '</script><b>',
        status: 'available',
        taxMode: 'kleinunternehmer',
      }),
    )
    expect(out).not.toContain('<')
    expect((JSON.parse(out) as { name: string }).name).toBe('</script><b>')
  })
})

describe('BreadcrumbList R02–R05', () => {
  const keramik = {
    de: { name: 'Keramik', slug: 'keramik' },
    en: { name: 'Ceramics', slug: 'ceramics' },
  }

  it('R02 Start → Shop, R05 Start → Archiv (DE/EN, absolute URLs)', () => {
    expect(breadcrumbItems({ routeId: 'R02' }, 'de', SITE)).toEqual([
      { name: 'Planet Claire', url: `${SITE}/de` },
      { name: 'Shop', url: `${SITE}/de/shop` },
    ])
    expect(breadcrumbItems({ routeId: 'R05' }, 'en', SITE)).toEqual([
      { name: 'Planet Claire', url: `${SITE}/en` },
      { name: 'Archive', url: `${SITE}/en/archive` },
    ])
  })

  it('R03 mit Kategorie-Slug der Seitensprache', () => {
    expect(breadcrumbItems({ routeId: 'R03', category: keramik.en }, 'en', SITE).at(-1)).toEqual({
      name: 'Ceramics',
      url: `${SITE}/en/shop/category/ceramics`,
    })
    expect(breadcrumbItems({ routeId: 'R03', category: keramik.de }, 'de', SITE).at(-1)).toEqual({
      name: 'Keramik',
      url: `${SITE}/de/shop/kategorie/keramik`,
    })
  })

  it('R04 Start → Shop → Kategorie → Stück; Positionen ab 1', () => {
    const list = breadcrumbJsonLd(
      breadcrumbItems(
        {
          routeId: 'R04',
          category: keramik.de,
          title: 'Schale',
          path: '/de/shop/017-schale',
        },
        'de',
        SITE,
      ),
    )
    expect(list).toEqual({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Planet Claire', item: `${SITE}/de` },
        { '@type': 'ListItem', position: 2, name: 'Shop', item: `${SITE}/de/shop` },
        {
          '@type': 'ListItem',
          position: 3,
          name: 'Keramik',
          item: `${SITE}/de/shop/kategorie/keramik`,
        },
        { '@type': 'ListItem', position: 4, name: 'Schale', item: `${SITE}/de/shop/017-schale` },
      ],
    })
  })
})

describe('SEO-Texte der Produktseite', () => {
  it('Titel „{Titel} – Nr. 017“ bzw. „– No. 017“; CMS-Titel hat Vorrang', () => {
    expect(productPageTitle({ title: 'Schale', itemNumber: 17 }, 'de')).toBe('Schale – Nr. 017')
    expect(productPageTitle({ title: 'Bowl', itemNumber: 17 }, 'en')).toBe('Bowl – No. 017')
    expect(
      productPageTitle({ title: 'Schale', itemNumber: 17, seo: { metaTitle: 'Eigene' } }, 'de'),
    ).toBe('Eigene')
  })

  it('Beschreibung: CMS-Text, sonst erste 155 Zeichen an einer Wortgrenze', () => {
    const long = `${'Wort '.repeat(40)}Ende`
    const cut = productMetaDescription({ description: long })!
    expect(cut.length).toBeLessThanOrEqual(155)
    expect(cut.endsWith('…')).toBe(true)
    expect(cut).not.toMatch(/ …$/)
    const sentences = productMetaDescription({ description: `${'Satz eins. '.repeat(20)}` })!
    expect(sentences).toMatch(/eins…$/)
    expect(productMetaDescription({ description: 'Kurz.' })).toBe('Kurz.')
    expect(
      productMetaDescription({ description: long, seo: { metaDescription: ' Aus dem CMS ' } }),
    ).toBe('Aus dem CMS')
    expect(productMetaDescription({ description: ' ' })).toBeUndefined()
  })
})

// V-61 b (U-93, normale Google-Suche ohne Google Shopping): Versand und Rückgabe im `Offer`, eigene Beschreibung je
// Kategorie. Form nach schema.org (`OfferShippingDetails`, `ShippingDeliveryTime`, `MerchantReturnPolicy`).
describe('V-61 b Versand und Rückgabe im Offer', () => {
  const shipping = { rateCents: 890, deliveryDays: { min: 2, max: 5 } }

  it('OfferShippingDetails: Deutschland, Preis der Versandklasse als Zeichenkette, Lieferzeit = Bearbeitung + Laufzeit', () => {
    expect(shippingDetailsJsonLd(shipping)).toEqual({
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: '8.90', currency: 'EUR' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'DE' },
      deliveryTime: {
        '@type': 'ShippingDeliveryTime',
        handlingTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 3, unitCode: 'DAY' },
        transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
      },
    })
    // ohne verwertbare Lieferzeit: nur Preis und Ziel (lieber nichts als etwas Falsches)
    expect(shippingDetailsJsonLd({ rateCents: 450, deliveryDays: null })).not.toHaveProperty(
      'deliveryTime',
    )
    expect(() => shippingDetailsJsonLd({ rateCents: 8.9, deliveryDays: null })).toThrow()
  })

  it('splitDeliveryDays: Summen ergeben genau die Lieferzeit, Laufzeit höchstens 2 Tage, nie negativ', () => {
    for (let min = 1; min <= 10; min++) {
      for (let max = min; max <= 14; max++) {
        const { handling, transit } = splitDeliveryDays({ min, max })
        expect(handling.min + transit.min, `${min}–${max}`).toBe(min)
        expect(handling.max + transit.max, `${min}–${max}`).toBe(max)
        expect(handling.min).toBeGreaterThanOrEqual(0)
        expect(handling.max).toBeGreaterThanOrEqual(handling.min)
        expect(transit.min).toBe(1)
        expect(transit.max).toBeLessThanOrEqual(2)
        expect(transit.max).toBeGreaterThanOrEqual(transit.min)
      }
    }
    expect(splitDeliveryDays({ min: 3, max: 3 })).toEqual({
      handling: { min: 2, max: 2 },
      transit: { min: 1, max: 1 },
    })
  })

  it('deliveryDayRange liest die Lieferzeit der Einstellungen (DE/EN), sonst null', () => {
    expect(deliveryDayRange('2–5 Werktage')).toEqual({ min: 2, max: 5 })
    expect(deliveryDayRange('2-5 working days')).toEqual({ min: 2, max: 5 })
    expect(deliveryDayRange('2 bis 4 Werktage')).toEqual({ min: 2, max: 4 })
    expect(deliveryDayRange('3 Werktage')).toEqual({ min: 3, max: 3 })
    expect(deliveryDayRange('1–2 business days')).toEqual({ min: 1, max: 2 })
    for (const bad of [
      null,
      '',
      '1–2 Wochen',
      'ca. 2–5 Werktage',
      '5–2 Werktage',
      'bald',
      '0 Tage',
    ])
      expect(deliveryDayRange(bad), String(bad)).toBeNull()
  })

  it('MerchantReturnPolicy: 14 Tage Widerruf, Rücksendekosten trägt die Kundin (E-27), per Post nur bei Versandstücken', () => {
    expect(RETURN_DAYS).toBe(14)
    expect(returnPolicyJsonLd({ byMail: true })).toEqual({
      '@type': 'MerchantReturnPolicy',
      applicableCountry: 'DE',
      returnPolicyCountry: 'DE',
      returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
      merchantReturnDays: 14,
      returnMethod: 'https://schema.org/ReturnByMail',
      returnFees: 'https://schema.org/ReturnFeesCustomerResponsibility',
    })
    expect(returnPolicyJsonLd({ byMail: false })).not.toHaveProperty('returnMethod')
  })

  it('Product: Versand und Rückgabe nur, solange man das Stück kaufen kann; ohne Angaben unverändert', () => {
    for (const status of ['available', 'reserved'] as const) {
      const ld = productJsonLd({
        ...base,
        status,
        taxMode: 'kleinunternehmer',
        shipping,
        returns: { byMail: true },
      })
      expect(ld.offers).toMatchObject({
        shippingDetails: { '@type': 'OfferShippingDetails' },
        hasMerchantReturnPolicy: { '@type': 'MerchantReturnPolicy', merchantReturnDays: 14 },
      })
    }
    const sold = productJsonLd({
      ...base,
      status: 'sold',
      taxMode: 'kleinunternehmer',
      shipping,
      returns: { byMail: true },
    })
    expect(sold.offers).not.toHaveProperty('shippingDetails')
    expect(sold.offers).not.toHaveProperty('hasMerchantReturnPolicy')
    // reines Abholstück: keine Versandangabe, Rückgabe ohne Post
    const pickup = productJsonLd({
      ...base,
      status: 'available',
      taxMode: 'kleinunternehmer',
      shipping: null,
      returns: { byMail: false },
    })
    expect(pickup.offers).not.toHaveProperty('shippingDetails')
    expect(pickup.offers).toHaveProperty('hasMerchantReturnPolicy.merchantReturnDays', 14)
  })

  it('R-126: auch mit Versand und Rückgabe im Kleinunternehmer-Modus keine Steuerangabe', () => {
    const ld = productJsonLd({
      ...base,
      status: 'available',
      taxMode: 'kleinunternehmer',
      shipping,
      returns: { byMail: true },
    })
    expect(JSON.stringify(ld)).not.toMatch(/valueAddedTax|TaxRate|taxRate|MwSt|VAT/i)
  })
})

describe('V-61 b Beschreibung je Kategorie', () => {
  it('CMS-Feld, sonst die Einleitung (gekürzt auf ≤ 155 Zeichen), sonst undefined (gemeinsame Vorlage)', () => {
    expect(
      categoryMetaDescription({ intro: 'Einleitung', seo: { metaDescription: ' Eigener Text ' } }),
    ).toBe('Eigener Text')
    expect(categoryMetaDescription({ intro: '  Teller, Schalen und Becher.  ' })).toBe(
      'Teller, Schalen und Becher.',
    )
    const long = `${'Bemalte Keramik aus Berlin '.repeat(10)}`
    const cut = categoryMetaDescription({ intro: long, seo: { metaDescription: null } })!
    expect(cut.length).toBeLessThanOrEqual(155)
    expect(cut.endsWith('…')).toBe(true)
    expect(categoryMetaDescription({ intro: null })).toBeUndefined()
    expect(categoryMetaDescription({ intro: ' ', seo: { metaDescription: '' } })).toBeUndefined()
    expect(metaExcerpt('a  b\n c')).toBe('a b c')
  })
})
