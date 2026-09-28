import { describe, expect, it } from 'vitest'

import type { TaxMode } from '@/lib/enums'
import { breadcrumbItems } from '@/lib/seo/breadcrumbs'
import {
  breadcrumbJsonLd,
  priceString,
  productImageUrls,
  productJsonLd,
  serializeJsonLd,
  type ProductJsonLdInput,
  type PublicProductStatus,
} from '@/lib/seo/jsonld'
import { productMetaDescription, productPageTitle } from '@/lib/seo/product'

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
