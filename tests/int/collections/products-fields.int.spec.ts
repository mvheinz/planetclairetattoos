import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SAFETY_TEMPLATE_TEXTS } from '@/globals/settingsDefaults'
import { toPublicPayload } from '@/lib/payload/public'
import { MANDATORY_WARNING_TEXTS } from '@/lib/products/warnings'

import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  createTestImage,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// P1.16: Collection `products` – Felder, Zugriff, Voreinstellungen (DATENMODELL §6.6.1–§6.6.3, §6.6.8, §6.6.9).

let payload: Payload
let fx: ProductFixtures

async function rejects(promise: Promise<unknown>, re: RegExp): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e as { message?: string; data?: { errors?: { message: string }[] } },
  )
  expect(err, `erwartet Ablehnung mit ${re}`).not.toBeNull()
  const text = [err!.message ?? '', ...(err!.data?.errors ?? []).map((x) => x.message)].join(' | ')
  expect(text).toMatch(re)
}

const byId = (id: number | string, locale: 'de' | 'en' = 'de') =>
  payload.findByID({ collection: 'products', id, locale, overrideAccess: true, depth: 0 })

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteProducts(payload)
  fx = await createProductFixtures(payload)
})

afterAll(async () => {
  await deleteProducts(payload)
})

describe('products: öffentliche Abfrage (DM-PROD-07)', () => {
  const secret = {
    reservationRef: '0f8fad5b-d9cb-469f-a165-70867728950e',
    internalNote: 'Geheime Notiz',
    storageLocation: 'Regal B3',
  }

  beforeAll(async () => {
    const rows: [number, string, Record<string, unknown>][] = [
      [980, 'draft', {}],
      [981, 'available', {}],
      [982, 'reserved', { reservedUntil: '2026-09-27T12:00:00.000Z' }],
      [983, 'sold', { showInArchiveAfterSale: true, soldChannel: 'offline' }],
      [984, 'sold', { showInArchiveAfterSale: false, soldChannel: 'offline' }],
      [985, 'archived', {}],
    ]
    for (const [nr, status, extra] of rows) {
      await createProduct(
        payload,
        completeProduct(nr === 982 ? 'schmuck' : 'keramik', nr, fx, {
          status,
          ...secret,
          ...extra,
        }),
      )
    }
  })

  it('DM-PROD-07 REST ohne Anmeldung: nur frei, reserviert und verkauft mit Archiv; keine internen Felder', async () => {
    const res = await rest(
      'GET',
      '/products?limit=50&depth=0&where[itemNumber][greater_than_equal]=980&where[itemNumber][less_than_equal]=985',
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { docs: Record<string, unknown>[] }
    expect(body.docs.map((d) => d.itemNumber).sort()).toEqual([981, 982, 983])
    for (const doc of body.docs) {
      for (const field of ['reservationRef', 'internalNote', 'storageLocation', 'nickelEvidence']) {
        expect(doc, `${field} in Nr. ${String(doc.itemNumber)}`).not.toHaveProperty(field)
      }
      expect(doc.isPublic).toBe(true)
    }
    const draft = await payload.find({
      collection: 'products',
      where: { itemNumber: { equals: 980 } },
      overrideAccess: true,
    })
    expect([401, 403, 404]).toContain((await rest('GET', `/products/${draft.docs[0]!.id}`)).status)
  })

  it('DM-PROD-07 Local API ohne Nutzer (Frontend-Weg) filtert gleich', async () => {
    const pub = toPublicPayload(payload)
    const res = await pub.find({
      collection: 'products',
      where: { itemNumber: { greater_than_equal: 980, less_than_equal: 985 } },
      limit: 50,
      depth: 0,
    })
    expect(res.docs.map((d) => d.itemNumber).sort()).toEqual([981, 982, 983])
    const reserved = res.docs.find((d) => d.itemNumber === 982) as unknown as Record<
      string,
      unknown
    >
    expect(reserved).not.toHaveProperty('nickelEvidence')
    expect(reserved).not.toHaveProperty('reservationRef')
  })

  it('virtuelle Felder: displayNumber, adminTitle, isPublic, characteristics', async () => {
    const res = await payload.find({
      collection: 'products',
      where: { itemNumber: { equals: 984 } },
      overrideAccess: true,
    })
    const doc = res.docs[0]!
    expect(doc.displayNumber).toBe('984')
    expect(doc.adminTitle).toBe('Nr. 984 · Teststück 984')
    expect(doc.isPublic).toBe(false)
    expect(doc.characteristics).toBe(
      'Keramik · Ø 14 cm, Höhe 6 cm · Steinzeug, Unterglasurfarbe · Deko – nicht für Lebensmittel',
    )
  })
})

describe('products: Bilder (DM-MEDIA-05)', () => {
  it('DM-MEDIA-05 Bild eines veröffentlichten Stücks lässt sich nicht löschen, eines Entwurfs schon', async () => {
    const used = await createTestImage(payload, 'Rote Tasse mit Katze')
    const draftOnly = await createTestImage(payload, 'Grüne Tasse mit Vogel')
    await createProduct(
      payload,
      completeProduct('keramik', 986, fx, { status: 'available', images: [fx.mediaId, used] }),
    )
    await createProduct(payload, completeProduct('keramik', 987, fx, { images: [draftOnly] }))
    await rejects(
      payload.delete({ collection: 'media', id: used, overrideAccess: true }),
      /noch verwendet.*Stück Nr\. 986/,
    )
    await payload.delete({ collection: 'media', id: draftOnly, overrideAccess: true })
  })
})

describe('products: Kategorie und Voreinstellungen (§6.6.3)', () => {
  it('Voreinstellungen je Kategorie, auch in EN (Versandklasse, Deko, Vorlage)', async () => {
    const doc = await createProduct(payload, {
      priceCents: 4500,
      itemNumber: 988,
      category: 'keramik',
      title: 'Schale',
    })
    expect(doc.shippingClass).toBe('keramik')
    expect(doc.foodContact).toBe('deko')
    expect(doc.safetyWarnings).toBe(SAFETY_TEMPLATE_TEXTS.keramik.de)
    const en = await byId(doc.id, 'en')
    expect(en.safetyWarnings).toBe(SAFETY_TEMPLATE_TEXTS.keramik.en)

    const textil = await createProduct(payload, {
      priceCents: 4500,
      itemNumber: 989,
      category: 'textil',
      title: 'Shirt',
    })
    expect(textil.shippingClass).toBe('paket_klein')
    expect(textil.isSecondHand).toBe(true)
    expect(textil.careInstructions).toBeTruthy()
    expect((await byId(textil.id, 'en')).careInstructions).toMatch(/Wash/)
  })

  it('Die Voreinstellung überschreibt keine gesetzten Felder', async () => {
    const doc = await createProduct(payload, {
      priceCents: 4500,
      itemNumber: 990,
      category: 'keramik',
      title: 'Vase',
      shippingClass: 'nur_abholung',
      safetyWarnings: 'Eigener Hinweis zur Vase',
      foodContact: 'deko',
    })
    expect(doc.shippingClass).toBe('nur_abholung')
    expect(doc.safetyWarnings).toBe('Eigener Hinweis zur Vase')
  })

  it('category ist nur im Entwurf änderbar; beim Wechsel werden fremde Angaben geleert', async () => {
    const doc = await createProduct(payload, {
      priceCents: 4500,
      itemNumber: 991,
      category: 'keramik',
      title: 'Teller',
    })
    const moved = await payload.update({
      collection: 'products',
      id: doc.id,
      data: { category: 'textil' },
      overrideAccess: true,
    })
    expect(moved.category).toBe('textil')
    expect(moved.foodContact).toBeNull()
    expect(moved.shippingClass).toBe('paket_klein')
    expect(moved.safetyWarnings).toBe(SAFETY_TEMPLATE_TEXTS.textil.de)
    expect((await byId(doc.id, 'en')).safetyWarnings).toBe(SAFETY_TEMPLATE_TEXTS.textil.en)

    const live = await createProduct(
      payload,
      completeProduct('keramik', 992, fx, { status: 'available' }),
    )
    await rejects(
      payload.update({
        collection: 'products',
        id: live.id,
        data: { category: 'sonstiges' },
        overrideAccess: true,
      }),
      /nur im Entwurf/,
    )
  })

  it('DM-PROD-08 Preis bei reserviertem Stück gesperrt', async () => {
    const res = await payload.find({
      collection: 'products',
      where: { itemNumber: { equals: 982 } },
      overrideAccess: true,
    })
    await rejects(
      payload.update({
        collection: 'products',
        id: res.docs[0]!.id,
        data: { priceCents: 9900 },
        overrideAccess: true,
      }),
      /Preis ist gesperrt/,
    )
  })

  it('Pflicht-Hinweise: Kleinteile (Schmuck) und Glasrahmen werden angefügt (DE/EN) und sind nicht entfernbar', async () => {
    const jewel = await createProduct(payload, {
      priceCents: 4500,
      itemNumber: 993,
      category: 'schmuck',
      title: 'Ohrring',
    })
    expect(jewel.smallPartsWarning).toBe(true)
    expect(jewel.safetyWarnings).toContain(MANDATORY_WARNING_TEXTS['product.jewelrySmallParts'].de)
    expect((await byId(jewel.id, 'en')).safetyWarnings).toContain(
      MANDATORY_WARNING_TEXTS['product.jewelrySmallParts'].en,
    )
    await rejects(
      payload.update({
        collection: 'products',
        id: jewel.id,
        data: { safetyWarnings: 'Nur ein anderer Hinweis' },
        overrideAccess: true,
      }),
      /lässt sich nicht entfernen/,
    )

    const drawing = await createProduct(payload, {
      priceCents: 4500,
      itemNumber: 994,
      category: 'zeichnung',
      title: 'Hund',
      framed: true,
      frameHasGlass: true,
    })
    expect(drawing.safetyWarnings).toContain(MANDATORY_WARNING_TEXTS['product.glassFrame'].de)
    expect((await byId(drawing.id, 'en')).safetyWarnings).toContain(
      MANDATORY_WARNING_TEXTS['product.glassFrame'].en,
    )
    const unframed = await payload.update({
      collection: 'products',
      id: drawing.id,
      data: { framed: false },
      overrideAccess: true,
    })
    expect(unframed.frameHasGlass).toBe(false)
  })

  it('deviationDecision leitet hasDeviation ab; isCustomCommission bleibt false', async () => {
    const doc = await createProduct(payload, {
      priceCents: 4500,
      itemNumber: 995,
      category: 'textil',
      title: 'Hoodie',
      deviationDecision: 'described',
      deviationDescription: 'kleiner Fleck am linken Ärmel',
      isCustomCommission: true,
    })
    expect(doc.hasDeviation).toBe(true)
    expect(doc.isCustomCommission).toBe(false)
    const none = await payload.update({
      collection: 'products',
      id: doc.id,
      data: { deviationDecision: 'none' },
      overrideAccess: true,
    })
    expect(none.hasDeviation).toBe(false)
  })

  it('reduced_art nur bei Zeichnungen (R-046)', async () => {
    await rejects(
      createProduct(payload, {
        priceCents: 4500,
        itemNumber: 996,
        category: 'keramik',
        title: 'Krug',
        vatCategory: 'reduced_art',
      }),
      /nur für Originalzeichnungen/,
    )
  })

  it('Titel: DE Pflicht, 2–80 Zeichen, getrimmt', async () => {
    await rejects(
      createProduct(payload, { priceCents: 4500, itemNumber: 997, category: 'sonstiges' }),
      /Pflichtfeld/,
    )
    const doc = await createProduct(payload, {
      priceCents: 4500,
      itemNumber: 997,
      category: 'sonstiges',
      title: '  Kleiner Anhänger  ',
    })
    expect(doc.title).toBe('Kleiner Anhänger')
  })
})
