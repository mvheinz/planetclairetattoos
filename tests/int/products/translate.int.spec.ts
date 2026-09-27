import { readFile } from 'node:fs/promises'

import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SAFETY_TEMPLATE_TEXTS } from '@/globals/settingsDefaults'

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

// P1.19: „Übersetzen“ (E-61, DATENMODELL §1.2, §6.6.8 Nr. 6, §6.6.10) mit dem Mock-Adapter ("[EN] " + Text).

let payload: Payload
let fx: ProductFixtures
let token: string
let nr = 980

const translate = (id: number, body: Record<string, unknown> = {}) =>
  rest('POST', `/products/${id}/translate`, body, { authorization: `JWT ${token}` })
const en = (id: number) =>
  payload.findByID({
    collection: 'products',
    id,
    locale: 'en',
    fallbackLocale: false,
    depth: 0,
    overrideAccess: true,
  })

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteProducts(payload)
  fx = await createProductFixtures(payload)
  token = (await resetAdmin(payload, '198.51.100.42')).token
})

afterAll(async () => {
  await deleteProducts(payload)
})

describe('translate (E-61)', () => {
  it('Mock setzt EN-Felder auf „[EN] …“ und enStatus = machine; Vorlagen-Texte bleiben', async () => {
    const p = await createProduct(
      payload,
      completeProduct('keramik', nr++, fx, {
        juttaSays: 'Mein Lieblingsstück',
        dimensions: { diameterCm: 14, heightCm: 6, note: 'Rand leicht gewellt' },
      }),
    )
    expect((await en(p.id)).i18n?.enStatus).toBe('missing')
    const image = await readFile('tests/fixtures/images/landscape-small.jpg')
    const media = await payload.create({
      collection: 'media',
      data: { alt: 'Rote Schale mit Katze' } as never,
      file: { data: image, name: 'katze.jpg', mimetype: 'image/jpeg', size: image.length },
      overrideAccess: true,
    })
    await payload.update({
      collection: 'products',
      id: p.id,
      data: { images: [fx.mediaId, media.id] },
      overrideAccess: true,
    })
    expect((await translate(p.id)).status).toBe(200)
    const doc = await en(p.id)
    expect(doc.title).toBe(`[EN] Teststück ${p.itemNumber}`)
    expect(doc.description).toBe('[EN] Ein handbemaltes Einzelstück aus dem Atelier in Berlin.')
    expect(doc.materials).toBe('[EN] Steinzeug, Unterglasurfarbe')
    expect(doc.juttaSays).toBe('[EN] Mein Lieblingsstück')
    expect(doc.dimensions?.note).toBe('[EN] Rand leicht gewellt')
    expect(doc.dimensions?.diameterCm).toBe(14)
    expect(doc.safetyWarnings).toBe(SAFETY_TEMPLATE_TEXTS.keramik.en)
    expect(doc.i18n?.enStatus).toBe('machine')
    expect(doc.i18n?.translatedAt).toBeTruthy()
    // Alt-Texte: fehlendes EN wird ergänzt, vorhandenes bleibt
    const [m1, m2] = await Promise.all(
      [fx.mediaId, media.id].map((id) =>
        payload.findByID({
          collection: 'media',
          id,
          locale: 'en',
          fallbackLocale: false,
          overrideAccess: true,
        }),
      ),
    )
    expect(m1!.alt).toBe('Blue bowl with a dog')
    expect(m2!.alt).toBe('[EN] Rote Schale mit Katze')
    // DE unverändert
    const de = await payload.findByID({
      collection: 'products',
      id: p.id,
      locale: 'de',
      overrideAccess: true,
    })
    expect(de.title).toBe(`Teststück ${p.itemNumber}`)
  })

  it('eine spätere manuelle EN-Änderung setzt reviewed; reviewed-Texte überschreibt nur force', async () => {
    const p = await createProduct(payload, completeProduct('keramik', nr++, fx))
    await translate(p.id)
    const edited = await rest(
      'PATCH',
      `/products/${p.id}?locale=en`,
      { title: 'Blue bowl with a dog' },
      { authorization: `JWT ${token}` },
    )
    expect(edited.status).toBe(200)
    expect((await en(p.id)).i18n?.enStatus).toBe('reviewed')

    await translate(p.id)
    expect((await en(p.id)).title).toBe('Blue bowl with a dog')
    expect((await en(p.id)).i18n?.enStatus).toBe('machine')
    await translate(p.id, { force: true })
    expect((await en(p.id)).title).toBe(`[EN] Teststück ${p.itemNumber}`)
  })

  it('EN-Texte geleert → missing; ohne Anmeldung 403', async () => {
    const p = await createProduct(payload, completeProduct('keramik', nr++, fx))
    await payload.update({
      collection: 'products',
      id: p.id,
      locale: 'en',
      data: { title: 'Bowl' },
      overrideAccess: true,
    })
    expect((await en(p.id)).i18n?.enStatus).toBe('reviewed')
    await payload.update({
      collection: 'products',
      id: p.id,
      locale: 'en',
      data: { title: '' },
      overrideAccess: true,
    })
    expect((await en(p.id)).i18n?.enStatus).toBe('missing')
    expect((await rest('POST', `/products/${p.id}/translate`, {})).status).toBe(403)
  })
})
