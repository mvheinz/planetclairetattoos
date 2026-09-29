import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { Field, Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

// P3.15 Aktualität (ARCHITEKTUR §9.3, KONZEPT §1.6): Admin-Endpunkte und Hooks rufen die Helfer aus
// `src/lib/cache/revalidate.ts` mit den richtigen Tags. Spy auf `next/cache` – außerhalb eines Next-Requests würde
// `revalidateTag` sonst nur eine Warnung loggen. Statuswechsel sofort (`{ expire: 0 }`), Bearbeitungen `'max'`,
// Seed-Kontext nichts; dazu R-033 (Preis-Historie, kein Vergleichspreis) und die Segment-Konfiguration.

const nextCache = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  revalidatePath: vi.fn(),
}))
vi.mock('next/cache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/cache')>()),
  ...nextCache,
}))

import { revalidateAll, revalidateContent, revalidateProduct } from '@/lib/cache/revalidate'

import { resetAdmin } from '../helpers/admin'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'
import { rest } from '../helpers/rest'

const NOW = { expire: 0 }
const MAX = 'max'

let payload: Payload
let fx: ProductFixtures
let token: string
let nr = 980

const auth = () => ({ authorization: `JWT ${token}` })
const post = (url: string, body: Record<string, unknown> = {}) => rest('POST', url, body, auth())
const patch = (url: string, body: Record<string, unknown>) => rest('PATCH', url, body, auth())

/** Alle `revalidateTag`-Aufrufe seit dem letzten `mockClear` als `[tag, profile]`. */
const calls = () => nextCache.revalidateTag.mock.calls.map(([tag, profile]) => [tag, profile])
const tagsWith = (profile: unknown) =>
  calls()
    .filter(([, p]) => JSON.stringify(p) === JSON.stringify(profile))
    .map(([tag]) => tag as string)

const productTagSet = (id: number, category = 'keramik') => [
  `product:${id}`,
  'products',
  `category:${category}`,
  'home',
  'sitemap',
]

async function draft(category: 'keramik' | 'textil' = 'keramik') {
  const doc = await createProduct(payload, completeProduct(category, nr++, fx))
  return doc.id as number
}

async function action(id: number, name: string, body: Record<string, unknown> = {}) {
  const res = await post(`/products/${id}/${name}`, body)
  expect(res.status, `${name}: ${await res.clone().text()}`).toBe(200)
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteProducts(payload)
  fx = await createProductFixtures(payload)
  token = (await resetAdmin(payload, '198.51.100.115')).token
})

afterAll(async () => {
  await deleteProducts(payload)
})

beforeEach(() => {
  nextCache.revalidateTag.mockClear()
  nextCache.updateTag.mockReset()
  nextCache.revalidatePath.mockClear()
})

describe('P3.15 Statuswechsel über die Admin-Endpunkte: sofort ({ expire: 0 })', () => {
  it('KONZEPT §1.6 publish, unpublish, sell-offline, return-to-stock, archive, restore erneuern product:<id>, products, category:<key>, home, sitemap sofort', async () => {
    const id = await draft()
    const steps: [string, Record<string, unknown>][] = [
      ['publish', {}],
      ['unpublish', {}],
      ['publish', {}],
      ['sell-offline', { note: 'Atelier', showInArchive: true }],
      ['return-to-stock', {}],
      ['archive', {}],
      ['restore', {}],
    ]
    for (const [name, body] of steps) {
      nextCache.revalidateTag.mockClear()
      await action(id, name, body)
      expect(tagsWith(NOW).sort(), name).toEqual(productTagSet(id).sort())
      // keine Einzelargument-Form (veraltet) und kein zusätzliches 'max' für dieselben Tags
      expect(
        calls().every(([, p]) => p !== undefined),
        name,
      ).toBe(true)
      expect(tagsWith(MAX), name).toEqual([])
    }
    expect(nextCache.updateTag).not.toHaveBeenCalled()
  })

  it('Kategorie geändert (nur im Entwurf möglich): alte und neue Kategorie werden erneuert', async () => {
    const id = await draft('keramik')
    // Kategorie in der Verwaltung ändern (Bearbeitung → 'max' für beide Kategorien)
    const res = await patch(`/products/${id}`, { category: 'sonstiges' })
    expect(res.status, await res.clone().text()).toBe(200)
    expect(tagsWith(MAX)).toEqual(
      expect.arrayContaining(['category:keramik', 'category:sonstiges']),
    )
    expect(tagsWith(NOW)).toEqual([])
  })

  it('adopt (Beispiel-Stück übernehmen) erneuert die Tags des Stücks mit max', async () => {
    const doc = await payload.create({
      collection: 'products',
      data: { ...completeProduct('keramik', nr++, fx), seed: true } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    const id = doc.id as number
    expect(nextCache.revalidateTag).not.toHaveBeenCalled()
    await action(id, 'adopt')
    expect(tagsWith(MAX)).toEqual(expect.arrayContaining(productTagSet(id)))
    expect(tagsWith(NOW)).toEqual([])
  })
})

describe('P3.15 Bearbeitungen in der Verwaltung: max (≤ 60 s)', () => {
  it('Textänderung (Beschreibung) erneuert product:<id>, products, category:<key>, home, sitemap mit max', async () => {
    const id = await draft()
    await action(id, 'publish')
    nextCache.revalidateTag.mockClear()
    const res = await patch(`/products/${id}?locale=de`, {
      description: 'Neue Beschreibung: handbemalt, mit Coco auf der Rückseite.',
    })
    expect(res.status, await res.clone().text()).toBe(200)
    expect(tagsWith(MAX).sort()).toEqual(productTagSet(id).sort())
    expect(tagsWith(NOW)).toEqual([])
  })

  it('R-033 Preisänderung: audit-log product_price_changed mit altem und neuem Preis, Erneuerung mit max; kein Vergleichspreis-Feld', async () => {
    const id = await draft()
    await action(id, 'publish')
    nextCache.revalidateTag.mockClear()
    const res = await patch(`/products/${id}`, { priceCents: 5200 })
    expect(res.status, await res.clone().text()).toBe(200)
    expect(tagsWith(MAX).sort()).toEqual(productTagSet(id).sort())
    expect(tagsWith(NOW)).toEqual([])

    const log = await payload.find({
      collection: 'audit-log',
      where: {
        and: [
          { action: { equals: 'product_price_changed' } },
          { entityCollection: { equals: 'products' } },
          { entityId: { equals: String(id) } },
        ],
      },
      overrideAccess: true,
      depth: 0,
    })
    expect(log.totalDocs).toBe(1)
    const entry = log.docs[0]!
    expect(entry.changes).toEqual({ priceCents: [4500, 5200] })
    expect(entry.summary).toMatch(/45,00\s*€.*52,00\s*€/)
    expect(Number.isNaN(Date.parse(entry.createdAt))).toBe(false)

    // Das Produktmodell hat genau ein Preisfeld – keinen Vergleichs-, Streich- oder Rabattpreis (R-033, V-20).
    const names: string[] = []
    const walk = (fields: Field[]) => {
      for (const f of fields) {
        if ('name' in f && typeof f.name === 'string') names.push(f.name)
        if ('fields' in f && Array.isArray(f.fields)) walk(f.fields as Field[])
        if ('tabs' in f && Array.isArray(f.tabs)) for (const t of f.tabs) walk(t.fields)
        if ('blocks' in f && Array.isArray(f.blocks)) for (const b of f.blocks) walk(b.fields)
      }
    }
    walk(payload.collections.products.config.fields)
    expect(names.filter((n) => /price|preis/i.test(n))).toEqual(['priceCents'])
    expect(
      names.filter((n) => /compare|strike|streich|uvp|rrp|msrp|discount|rabatt|statt/i.test(n)),
    ).toEqual([])
  })

  it('R-031 geänderter Klassenpreis in settings.shipping.rates erneuert settings mit max', async () => {
    const settings = (await payload.findGlobal({
      slug: 'settings',
      overrideAccess: true,
    })) as unknown as {
      shipping: { rates: { zone: string; shippingClass: string; priceCents: number }[] }
    }
    const rates = settings.shipping.rates.map(({ zone, shippingClass, priceCents }) => ({
      zone,
      shippingClass,
      priceCents: zone === 'DE' && shippingClass === 'paket_klein' ? priceCents + 20 : priceCents,
    }))
    const res = await post('/globals/settings', { shipping: { rates } })
    expect(res.status, await res.clone().text()).toBe(200)
    expect(tagsWith(MAX)).toContain('settings')
    expect(tagsWith(NOW)).toEqual([])
  })

  it('Kategorie geändert: categories und category:<key> mit max', async () => {
    const cat = (
      await payload.find({
        collection: 'categories',
        where: { key: { equals: 'textil' } },
        overrideAccess: true,
        limit: 1,
      })
    ).docs[0]!
    const res = await patch(`/categories/${cat.id}?locale=de`, {
      description: 'Shirts und Taschen, einzeln bemalt.',
    })
    expect(res.status, await res.clone().text()).toBe(200)
    expect(tagsWith(MAX).sort()).toEqual(['categories', 'category:textil'])
    expect(tagsWith(NOW)).toEqual([])
  })
})

describe('P3.15 Seed-Kontext: keine Erneuerung', () => {
  it('Anlegen, Statuswechsel, Preisänderung, Einstellungen und Kategorien mit context.seed rufen nichts auf', async () => {
    const doc = await payload.create({
      collection: 'products',
      data: {
        ...completeProduct('keramik', nr++, fx),
        seed: true,
        status: 'available',
        firstPublishedAt: '2026-09-01T10:00:00.000Z',
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    await payload.update({
      collection: 'products',
      id: doc.id,
      data: { priceCents: 6100 },
      overrideAccess: true,
      context: { seed: true },
    })
    await payload.update({
      collection: 'products',
      id: doc.id,
      data: { status: 'sold', soldChannel: 'offline', soldAt: '2026-09-02T10:00:00.000Z' },
      overrideAccess: true,
      context: { seed: true },
    })
    await payload.updateGlobal({
      slug: 'settings',
      data: { shop: { isOpen: true } } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    await payload.update({
      collection: 'categories',
      where: { key: { equals: 'schmuck' } },
      data: { sortOrder: 5 } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    await payload.delete({
      collection: 'products',
      id: doc.id,
      overrideAccess: true,
      context: { seed: true },
    })
    expect(nextCache.revalidateTag).not.toHaveBeenCalled()
    expect(nextCache.updateTag).not.toHaveBeenCalled()
    expect(nextCache.revalidatePath).not.toHaveBeenCalled()

    expect(revalidateProduct(1, { context: { seed: true }, immediate: true })).toEqual([])
    expect(revalidateContent('settings', { context: { seed: true } })).toEqual([])
    expect(revalidateAll({ context: { seed: true } })).toBe(false)
    expect(nextCache.revalidateTag).not.toHaveBeenCalled()
  })
})

describe('P3.15 Helfer revalidate.ts', () => {
  it('Server-Action: updateTag je Tag; außerhalb einer Server-Action Rückfall auf { expire: 0 }', () => {
    expect(
      revalidateProduct(7, { category: 'cap', immediate: true, inServerAction: true }),
    ).toEqual(['product:7', 'products', 'home', 'sitemap', 'category:cap'])
    expect(nextCache.updateTag.mock.calls.map(([t]) => t)).toEqual([
      'product:7',
      'products',
      'home',
      'sitemap',
      'category:cap',
    ])
    expect(nextCache.revalidateTag).not.toHaveBeenCalled()

    nextCache.updateTag.mockImplementation(() => {
      throw new Error('updateTag can only be called from within a Server Action.')
    })
    revalidateProduct(8, { immediate: true, inServerAction: true })
    expect(tagsWith(NOW)).toEqual(['product:8', 'products', 'home', 'sitemap'])
  })

  it('Rechtstexte sofort, sonstige Inhalte max; Fehler außerhalb eines Requests brechen nicht ab', () => {
    revalidateContent('legal:agb')
    revalidateContent('faqs')
    expect(calls()).toEqual([
      ['legal:agb', NOW],
      ['faqs', MAX],
    ])
    nextCache.revalidateTag.mockImplementationOnce(() => {
      throw new Error('Invariant: static generation store missing in revalidateTag products')
    })
    expect(revalidateProduct(9)).toEqual(['product:9', 'products', 'home', 'sitemap'])
    expect(nextCache.revalidateTag).toHaveBeenCalledTimes(6)
  })
})

describe('P3.15 Segment-Konfiguration (ARCHITEKTUR §9.1)', () => {
  const root = path.resolve(import.meta.dirname, '../../../src/app/(frontend)/[locale]')
  const read = (rel: string) => readFileSync(path.join(root, rel), 'utf8')

  it('R01–R05 und die Listen-Varianten: Rückfall revalidate = 3600; R04 mit dynamicParams und generateStaticParams', () => {
    for (const rel of [
      'page.tsx',
      'shop/page.tsx',
      'shop/variant/[variant]/page.tsx',
      'shop/category/[slug]/page.tsx',
      'shop/category/[slug]/variant/[variant]/page.tsx',
      'shop/[product]/page.tsx',
      'shop/[product]/opengraph-image.tsx',
      'archive/page.tsx',
      'archive/variant/[variant]/page.tsx',
    ]) {
      expect(read(rel), rel).toMatch(/^export const revalidate = 3600$/m)
    }
    const product = read('shop/[product]/page.tsx')
    expect(product).toMatch(/^export const dynamicParams = true$/m)
    expect(product).toMatch(/export async function generateStaticParams/)
    expect(readFileSync(path.resolve(root, '../../sitemap.ts'), 'utf8')).toMatch(
      /^export const revalidate = 3600$/m,
    )
  })
})
