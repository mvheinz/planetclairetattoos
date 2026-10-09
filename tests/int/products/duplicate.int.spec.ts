import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { transitionProduct } from '@/lib/commerce/productTransitions'
import { copyTitle } from '@/lib/products/duplicate'

import { adminReq, resetAdmin } from '../helpers/admin'
import { deleteCommerce } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// U-60 (P14.11): „Als neues Stück kopieren“ – `POST /api/products/:id/duplicate` (nur Verwaltung). Übernimmt Titel mit
// „(Kopie)“, Kategorie, Texte DE/EN, Maße, Material, Preis, Versand und GPSR-Angaben; nicht Fotos, Nummer (nächste freie),
// Status (immer Entwurf), Abweichung und „nur eigene Figuren“.

let payload: Payload
let fx: ProductFixtures
let token: string
let userId: number

const post = (id: number, auth = true) =>
  rest('POST', `/products/${id}/duplicate`, {}, auth ? { authorization: `JWT ${token}` } : {})
const read = (id: number, locale: 'de' | 'en' = 'de') =>
  payload.findByID({
    collection: 'products',
    id,
    locale,
    fallbackLocale: false,
    depth: 0,
    overrideAccess: true,
  })

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  fx = await createProductFixtures(payload)
  const acc = await resetAdmin(payload, '198.51.100.61')
  token = acc.token
  userId = acc.userId
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload)
})

describe('Stück duplizieren (U-60)', () => {
  it('copyTitle hängt „(Kopie)“/„(copy)“ an, bleibt ≤ 80 Zeichen und doppelt nicht', () => {
    expect(copyTitle('Schale mit Hund', 'de')).toBe('Schale mit Hund (Kopie)')
    expect(copyTitle('Bowl with dog', 'en')).toBe('Bowl with dog (copy)')
    expect(copyTitle('Schale (Kopie)', 'de')).toBe('Schale (Kopie)')
    expect(copyTitle('x'.repeat(80), 'de')!.length).toBe(80)
    expect(copyTitle('', 'de')).toBeNull()
  })

  it('Kopie eines veröffentlichten Schmuckstücks: Entwurf, nächste freie Nummer, ohne Fotos, Texte DE/EN übernommen', async () => {
    const src = await createProduct(
      payload,
      completeProduct('schmuck', 985, fx, {
        title: 'Ohrringe Mond',
        juttaSays: 'Leicht wie eine Feder.',
        priceCents: 3900,
        hasDeviation: true,
        deviationDecision: 'described',
        deviationDescription: 'Kleiner Glasurfleck auf der Rückseite.',
        storageLocation: 'Regal 2',
        internalNote: 'nur intern',
      }),
    )
    await payload.update({
      collection: 'products',
      id: src.id,
      locale: 'en',
      data: {
        title: 'Moon earrings',
        description: 'A hand-painted one-off from the studio in Berlin.',
      } as never,
      overrideAccess: true,
    })
    const admin = await adminReq(payload, userId)
    await transitionProduct(admin, src.id as number, 'publish')

    const res = await post(src.id as number)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { doc: { id: number; itemNumber: number; status: string } }
    expect(body.doc.status).toBe('draft')
    expect(body.doc.id).not.toBe(src.id)
    expect(body.doc.itemNumber).toBe(986)

    const de = await read(body.doc.id)
    const srcDe = await read(src.id as number)
    expect(de).toMatchObject({
      status: 'draft',
      category: 'schmuck',
      title: 'Ohrringe Mond (Kopie)',
      description: srcDe.description,
      juttaSays: 'Leicht wie eine Feder.',
      priceCents: 3900,
      materials: srcDe.materials,
      shippingClass: srcDe.shippingClass,
      vatCategory: srcDe.vatCategory,
      weightGrams: 400,
      metalPartsMaterial: 'Edelstahl 316L',
      nickelFreeConfirmed: true,
      nickelEvidence: fx.nickelEvidenceId,
      leadFreeGlazeConfirmed: true,
      smallPartsWarning: srcDe.smallPartsWarning,
      safetyWarnings: srcDe.safetyWarnings,
    })
    expect(de.dimensions?.heightCm).toBe(3)
    // nicht übernommen
    expect(de.images ?? []).toEqual([])
    expect(de.firstPublishedAt ?? null).toBeNull()
    expect(de.hasDeviation).toBe(false)
    expect(de.deviationDescription ?? null).toBeNull()
    expect(de.ownDesignConfirmed).toBe(false)
    expect(de.storageLocation ?? null).toBeNull()
    expect(de.internalNote ?? null).toBeNull()
    expect(de.slug).toMatch(/^986-/)

    const en = await read(body.doc.id, 'en')
    expect(en).toMatchObject({
      title: 'Moon earrings (copy)',
      description: 'A hand-painted one-off from the studio in Berlin.',
      safetyWarnings: (await read(src.id as number, 'en')).safetyWarnings,
    })
    // Das Original bleibt unverändert online.
    expect((await read(src.id as number)).status).toBe('available')
  })

  it('Nummer belegt → nächste freie; Textil mit Fasern und Maß-Hinweis', async () => {
    const src = await createProduct(payload, completeProduct('textil', 990, fx))
    await createProduct(payload, completeProduct('keramik', 991, fx))
    const res = await post(src.id as number)
    expect(res.status).toBe(200)
    const { doc } = (await res.json()) as { doc: { id: number; itemNumber: number } }
    expect(doc.itemNumber).toBe(992)
    const de = await read(doc.id)
    expect(de.fiberComposition?.map((f) => [f.component, f.fiber, f.percent])).toEqual([
      ['main', 'cotton', 100],
    ])
    expect(de.dimensions?.note).toBe('Brustweite 52 cm')
    expect(de).toMatchObject({ sizeLabel: 'M', condition: 'good', status: 'draft' })
  })

  it('nur Verwaltung: ohne Anmeldung 403, unbekanntes Stück 404', async () => {
    const src = await createProduct(payload, completeProduct('keramik', 995, fx))
    expect((await post(src.id as number, false)).status).toBe(403)
    const before = await payload.count({ collection: 'products', overrideAccess: true })
    expect((await post(999_999_999)).status).toBe(404)
    expect((await payload.count({ collection: 'products', overrideAccess: true })).totalDocs).toBe(
      before.totalDocs,
    )
  })
})
