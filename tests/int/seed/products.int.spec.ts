import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PRODUCT_CATEGORIES, PRODUCT_STATUSES } from '@/lib/enums'
import {
  SEED_EXPECTED_PRODUCTS_BY_CATEGORY,
  SEED_EXPECTED_PRODUCTS_BY_STATUS,
  SEED_EXPECTED_SOLD,
  SEED_ITEM_NUMBER_RANGE,
  expectedCount,
} from '@/lib/seed/expected'

import { getTestPayload } from '../helpers/payload'
import { SEED_TIMEOUT, bySeedKey, findAll, runCanonicalSeed, type SeedDoc } from './canonical'

// P8.3: Stücke des Beispielbestands (SEED-SPEC §5) – Mengen und Verteilungen aus `src/lib/seed/expected.ts`,
// Verkaufsfelder, Sonderfälle, AK-SEED-06.

let payload: Payload
let products: SeedDoc[]

const count = <T extends string>(list: SeedDoc[], field: string, values: readonly T[]) =>
  Object.fromEntries(values.map((v) => [v, list.filter((p) => p[field] === v).length]))

beforeAll(async () => {
  payload = await getTestPayload()
  await runCanonicalSeed(payload)
  products = await findAll(payload, 'products', { seed: { equals: true } })
}, SEED_TIMEOUT)

afterAll(async () => {
  await runCanonicalSeed(payload, 'remove', { yes: true, dropTexts: true })
}, SEED_TIMEOUT)

describe('Stücke des Beispielbestands (SEED-SPEC §0, §5)', () => {
  it('Anzahl, Nummern 901–930 und Verteilung je Kategorie und Status wie SEED_EXPECTED_*', () => {
    expect(products).toHaveLength(expectedCount('products'))
    for (const p of products) {
      const n = Number(String(p.seedKey).slice('products:S'.length))
      expect(p.itemNumber).toBe(900 + n)
      expect(p.itemNumber).toBeGreaterThanOrEqual(SEED_ITEM_NUMBER_RANGE.min)
      expect(p.itemNumber).toBeLessThanOrEqual(SEED_ITEM_NUMBER_RANGE.max)
    }
    expect(count(products, 'category', PRODUCT_CATEGORIES)).toEqual(
      SEED_EXPECTED_PRODUCTS_BY_CATEGORY,
    )
    expect(count(products, 'status', PRODUCT_STATUSES)).toEqual(SEED_EXPECTED_PRODUCTS_BY_STATUS)
    const sold = products.filter((p) => p.status === 'sold')
    expect(count(sold, 'soldChannel', ['online', 'pickup', 'offline'] as const)).toEqual(
      SEED_EXPECTED_SOLD.byChannel,
    )
    expect(sold.filter((p) => p.showInArchiveAfterSale === true)).toHaveLength(
      SEED_EXPECTED_SOLD.visibleInArchive,
    )
  })

  it('Verkaufsfelder laut §5.3: S08 nicht im Archiv, S09 archiviert ohne Verkaufsfelder, S14/S27 reserviert', async () => {
    const s08 = await bySeedKey(payload, 'products', 'S08')
    expect([s08.status, s08.soldChannel, s08.showInArchiveAfterSale]).toEqual([
      'sold',
      'online',
      false,
    ])
    expect(s08.soldAt).toBe('2026-10-12T17:11:00.000Z')
    const s09 = await bySeedKey(payload, 'products', 'S09')
    expect(s09.status).toBe('archived')
    expect([s09.soldAt ?? null, s09.soldChannel ?? null, s09.currentOrder ?? null]).toEqual([
      null,
      null,
      null,
    ])
    expect(s09.internalNote).toMatch(/PC-2026-90008/)
    const s14 = await bySeedKey(payload, 'products', 'S14')
    expect([s14.status, s14.reservedUntil]).toEqual(['reserved', '2026-10-18T21:59:59.000Z'])
    expect(s14.reservationRef).toBe('00000000-0000-4000-8000-000000090013')
    const s27 = await bySeedKey(payload, 'products', 'S27')
    expect(s27.reservationRef).toBe('00000000-0000-4000-8000-000000090102')
    for (const p of products.filter((x) => x.status !== 'draft')) {
      expect(p.firstPublishedAt, String(p.seedKey)).toBeTruthy()
    }
  })

  it('AK-SEED-06: jedes available/reserved-Stück besteht validateForPublish; S18 scheitert genau an der Faserangabe, S25 genau an „Bildbeschreibung EN“', async () => {
    for (const p of products.filter((x) => x.status === 'available' || x.status === 'reserved')) {
      await payload.update({
        collection: 'products',
        id: p.id,
        data: { status: p.status } as never,
        overrideAccess: true,
        context: { transition: 'publish' },
      })
    }
    const publishErrors = async (key: string) => {
      const p = await bySeedKey(payload, 'products', key)
      const err = await payload
        .update({
          collection: 'products',
          id: p.id,
          data: { status: 'available' } as never,
          overrideAccess: true,
          context: { transition: 'publish' },
        })
        .then(
          () => null,
          (e: unknown) => e as { data?: { errors?: { path: string; message: string }[] } },
        )
      return err?.data?.errors ?? []
    }
    expect((await publishErrors('S18')).map((e) => e.path)).toEqual(['fiberComposition'])
    const s25 = await publishErrors('S25')
    expect(s25.map((e) => e.path)).toEqual(['images'])
    expect(s25[0]!.message).toMatch(/Englisch/)
  })

  it('Sonderfälle: Mischgewebe + Abweichung (S11), Etikett fehlt (S14), Papier-Abweichung (S22), Schmuck-Nachweise, nur Abholung (S30), EN-Status', async () => {
    const s11 = await bySeedKey(payload, 'products', 'S11')
    expect(s11.fiberComposition).toHaveLength(2)
    expect([s11.hasDeviation, s11.deviationDecision]).toEqual([true, 'described'])
    const s14 = await bySeedKey(payload, 'products', 'S14', { locale: 'all' })
    expect(s14.labelMissing).toBe(true)
    expect(s14.fiberFreeText).toEqual({
      de: 'Baumwolle (nach bestem Wissen)',
      en: 'cotton (to the best of my knowledge)',
    })
    expect(s14.hasDeviation).toBe(true)
    expect((await bySeedKey(payload, 'products', 'S22')).hasDeviation).toBe(true)
    const nickel = await bySeedKey(payload, 'private-uploads', 'nickel-demo')
    for (const key of ['S26', 'S27', 'S28', 'S29']) {
      const p = await bySeedKey(payload, 'products', key)
      expect([p.nickelEvidence, p.smallPartsWarning, p.nickelFreeConfirmed], key).toEqual([
        nickel.id,
        true,
        true,
      ])
    }
    const s30 = await bySeedKey(payload, 'products', 'S30')
    expect([s30.shippingClass, s30.category]).toEqual(['nur_abholung', 'sonstiges'])
    const en = (key: string) =>
      bySeedKey(payload, 'products', key).then((p) => (p.i18n as { enStatus: string }).enStatus)
    expect(await en('S29')).toBe('missing')
    expect(await en('S23')).toBe('machine')
    for (const p of products) {
      expect(p.ownDesignConfirmed, String(p.seedKey)).toBe(true)
      if (p.category === 'keramik') expect(p.foodContact, String(p.seedKey)).toBe('deko')
      if (p.category === 'zeichnung') expect(p.vatCategory, String(p.seedKey)).toBe('reduced_art')
      if (p.category === 'textil' || p.category === 'cap') {
        expect(p.blankBrandVisible, String(p.seedKey)).toBe(false)
      }
    }
    expect(await findAll(payload, 'conformity-declarations', { seed: { equals: true } })).toEqual(
      [],
    )
  })
})
