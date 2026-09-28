import type { Payload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import type { ProductCategory } from '@/lib/enums'
import { resetEnvCache } from '@/lib/env'
import { getCategoryBySlug, listNavCategories } from '@/lib/data/categories'
import {
  PRODUCT_ADMIN_FIELDS,
  SHOP_PAGE_SIZE,
  getPublicProductByItemNumber,
  listArchiveProducts,
  listRelatedProducts,
  listShopProducts,
  listStationProducts,
  type PublicProduct,
} from '@/lib/data/products'

import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'

// P3.1 Öffentliche Shop-Datenschicht (KONZEPT §3.2–§3.5, ARCHITEKTUR §9.2): eigene Stücke per Local API; die
// Seed-Stücke des Mini-Bestands (P1.30) blendet SEED_PREVIEW_MODE=false aus, damit nur die Fixtures zählen.
// Nummern: Fixture-Bereich 980–999, für die Paginierung (25 Stücke) zusätzlich 975–979 (OFFENE-PUNKTE §5, P3.1).

let payload: Payload
let fx: ProductFixtures

const day = (d: number) => new Date(Date.UTC(2026, 8, d, 10)).toISOString()

function setEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v)
  resetEnvCache()
}

/** Stück in einem Endstatus (Seed-Kontext wie im Helfer, `seed: false`). */
async function piece(
  nr: number,
  extra: Record<string, unknown>,
  category: ProductCategory = 'keramik',
) {
  return createProduct(
    payload,
    completeProduct(category, nr, fx, {
      internalNote: 'Regal 3 hinten',
      storageLocation: 'Keller',
      ...extra,
    }),
  )
}

const available = (published: number) => ({
  status: 'available',
  firstPublishedAt: day(published),
})
const sold = (published: number, soldDay: number, archive = true) => ({
  status: 'sold',
  firstPublishedAt: day(published),
  soldAt: day(soldDay),
  soldChannel: 'offline',
  offlineSaleNote: 'Flohmarkt',
  showInArchiveAfterSale: archive,
})

const numbers = (docs: PublicProduct[]) => docs.map((d) => d.itemNumber)

function expectNoAdminFields(docs: PublicProduct[]) {
  for (const d of docs) {
    for (const field of PRODUCT_ADMIN_FIELDS)
      expect(d, `${d.itemNumber}.${field}`).not.toHaveProperty(field)
  }
}

beforeAll(async () => {
  payload = await getTestPayload()
  fx = await createProductFixtures(payload)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  resetEnvCache()
  await deleteProducts(
    payload,
    Array.from({ length: 25 }, (_, i) => 975 + i),
  )
})

afterAll(async () => {
  vi.unstubAllEnvs()
  resetEnvCache()
})

describe('Status-/Archiv-Kombinationen (AK-3-03, AK-3-04, AK-3-09, DM-PROD-07)', () => {
  async function createMix() {
    await piece(980, available(1))
    await piece(981, {
      status: 'reserved',
      firstPublishedAt: day(3),
      reservedUntil: day(28),
      reservationRef: 'res-test-981',
    })
    await piece(982, available(2), 'textil')
    await piece(983, sold(1, 10))
    await piece(984, sold(2, 12), 'textil')
    await piece(985, sold(3, 11, false))
    await piece(986, { status: 'draft' })
    await piece(987, { status: 'archived', firstPublishedAt: day(1), archivedAt: day(5) })
  }

  it('R02: zuerst available/reserved nach firstPublishedAt ↓, dann sold+Archiv nach soldAt ↓', async () => {
    setEnv({ SEED_PREVIEW_MODE: 'false' })
    await createMix()
    const res = await listShopProducts({ locale: 'de', page: 1 })
    expect(numbers(res.docs)).toEqual([981, 982, 980, 984, 983])
    expect(res).toMatchObject({ page: 1, totalDocs: 5, totalPages: 1, hasNextPage: false })
    expectNoAdminFields(res.docs)
  })

  it('AK-3-03 availableOnly liefert kein sold; Kategorie-Filter (R03)', async () => {
    setEnv({ SEED_PREVIEW_MODE: 'false' })
    await createMix()
    const onlyAvailable = await listShopProducts({ locale: 'de', availableOnly: true, page: 1 })
    expect(numbers(onlyAvailable.docs)).toEqual([981, 982, 980])
    expect(onlyAvailable.docs.every((d) => d.status !== 'sold')).toBe(true)
    const textil = await listShopProducts({ locale: 'de', categoryKeys: ['textil'], page: 1 })
    expect(numbers(textil.docs)).toEqual([982, 984])
  })

  it('AK-3-04 DM-PROD-07: sold ohne Archiv, draft und archived erscheinen in keiner Liste', async () => {
    setEnv({ SEED_PREVIEW_MODE: 'false' })
    await createMix()
    const hidden = [985, 986, 987]
    const lists = [
      (await listShopProducts({ locale: 'de', page: 1 })).docs,
      (await listShopProducts({ locale: 'en', availableOnly: true, page: 1 })).docs,
      (await listArchiveProducts({ locale: 'de', page: 1 })).docs,
      await listStationProducts(['keramik', 'textil'], 10, 'de'),
      await listRelatedProducts({ id: -1, category: 'keramik' }, 10, 'de'),
    ]
    for (const list of lists) for (const nr of hidden) expect(numbers(list)).not.toContain(nr)
    for (const nr of hidden) expect(await getPublicProductByItemNumber(nr, 'de')).toBeNull()
  })

  it('AK-3-09 Archiv: nur sold + Archiv nach soldAt ↓, optional je Kategorie', async () => {
    setEnv({ SEED_PREVIEW_MODE: 'false' })
    await createMix()
    const all = await listArchiveProducts({ locale: 'de', page: 1 })
    expect(numbers(all.docs)).toEqual([984, 983])
    expect(all.docs.every((d) => d.status === 'sold' && d.showInArchiveAfterSale)).toBe(true)
    const keramik = await listArchiveProducts({ locale: 'de', categoryKey: 'keramik', page: 1 })
    expect(numbers(keramik.docs)).toEqual([983])
    expectNoAdminFields(all.docs)
  })

  it('Einzelstück, verwandte Stücke und Stationen: sichtbar, nicht verkauft, ohne Admin-Felder', async () => {
    setEnv({ SEED_PREVIEW_MODE: 'false' })
    await createMix()
    const one = await getPublicProductByItemNumber(980, 'en')
    expect(one).toMatchObject({ itemNumber: 980, status: 'available', title: 'Teststück 980' })
    expectNoAdminFields([one!])
    const sold983 = await getPublicProductByItemNumber(983, 'de')
    expect(sold983?.status).toBe('sold')

    const related = await listRelatedProducts(one!, 4, 'de')
    expect(numbers(related)).toEqual([981])
    const stations = await listStationProducts(['keramik', 'textil'], 2, 'de')
    expect(numbers(stations)).toEqual([981, 982])
    expectNoAdminFields([...related, ...stations])
  })
})

describe('Paginierung (KONZEPT §3.2: 24 je Seite)', () => {
  it('25 Stücke → 2 Seiten, Seite 2 mit dem ältesten; ungültige Seite → 1', async () => {
    setEnv({ SEED_PREVIEW_MODE: 'false' })
    for (let i = 0; i < 25; i++) await piece(975 + i, available(1 + i))
    const p1 = await listShopProducts({ locale: 'de', page: 1 })
    expect(p1.docs).toHaveLength(SHOP_PAGE_SIZE)
    expect(p1).toMatchObject({ totalDocs: 25, totalPages: 2, hasNextPage: true })
    expect(p1.docs[0]!.itemNumber).toBe(999)
    const p2 = await listShopProducts({ locale: 'de', page: 2 })
    expect(numbers(p2.docs)).toEqual([975])
    expect(p2).toMatchObject({ page: 2, hasNextPage: false })
    const p0 = await listShopProducts({ locale: 'de', page: 0 })
    expect(p0.page).toBe(1)
    const p3 = await listShopProducts({ locale: 'de', page: 3 })
    expect(p3.docs).toEqual([])
  })
})

describe('Seed-Filter (DATENMODELL §1.4 Regel 4)', () => {
  it('SEED_PREVIEW_MODE ≠ true: keine Seed-Stücke; = true: Seed-Stücke sichtbar', async () => {
    // Seed-Stück (wie der Beispielbestand, `seed: true`) und ein echtes Stück in der Fixture-Nummer.
    const seedNr = 990
    await piece(seedNr, { ...available(4), seed: true })
    await piece(991, sold(1, 5))
    await piece(992, { ...sold(1, 6), seed: true })

    setEnv({ SEED_PREVIEW_MODE: 'false' })
    const off = [
      ...(await listShopProducts({ locale: 'de', page: 1 })).docs,
      ...(await listArchiveProducts({ locale: 'de', page: 1 })).docs,
      ...(await listStationProducts(
        ['keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges'],
        50,
      )),
    ]
    expect(off.filter((d) => d.seed)).toEqual([])
    expect(numbers(off)).toContain(991)
    expect(await getPublicProductByItemNumber(seedNr, 'de')).toBeNull()

    setEnv({ SEED_PREVIEW_MODE: 'true', APP_ENV: 'development' })
    const on = await listShopProducts({ locale: 'de', page: 1 })
    expect(numbers(on.docs)).toContain(seedNr)
    expect(numbers((await listArchiveProducts({ locale: 'de', page: 1 })).docs)).toContain(992)
    expect((await getPublicProductByItemNumber(seedNr, 'de'))?.seed).toBe(true)

    // Produktion: Vorschau wirkt nie.
    setEnv({ SEED_PREVIEW_MODE: 'true', APP_ENV: 'production' })
    expect(await getPublicProductByItemNumber(seedNr, 'de')).toBeNull()
  })
})

describe('Kategorien (KONZEPT §3.3, §2.4)', () => {
  it('getCategoryBySlug: eigener Slug direkt, Slug der anderen Sprache mit redirect, unbekannt → null', async () => {
    const own = await getCategoryBySlug('en', 'ceramics')
    expect(own).toMatchObject({ canonicalSlug: 'ceramics', redirect: false })
    expect(own?.category).toMatchObject({ key: 'keramik', name: 'Ceramics' })
    const other = await getCategoryBySlug('en', 'keramik')
    expect(other).toMatchObject({ canonicalSlug: 'ceramics', redirect: true })
    const de = await getCategoryBySlug('de', 'drawings')
    expect(de).toMatchObject({ canonicalSlug: 'zeichnungen', redirect: true })
    expect(await getCategoryBySlug('de', 'gibt-es-nicht')).toBeNull()
    expect(await getCategoryBySlug('de', '../etc')).toBeNull()
  })

  it('listNavCategories: nur showInNavigation, nach sortOrder, Namen der Sprache', async () => {
    const all = await payload.find({
      collection: 'categories',
      where: { showInNavigation: { equals: true } },
      sort: 'sortOrder',
      overrideAccess: true,
      depth: 0,
      pagination: false,
    })
    const nav = await listNavCategories('en')
    expect(nav.map((c) => c.key)).toEqual(all.docs.map((c) => c.key))
    expect(nav.every((c) => c.showInNavigation)).toBe(true)
    expect(nav.find((c) => c.key === 'keramik')?.slug).toBe('ceramics')
  })
})
