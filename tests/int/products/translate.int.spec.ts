import { readFile } from 'node:fs/promises'

import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SAFETY_TEMPLATE_TEXTS } from '@/globals/settingsDefaults'

import { translateDocumentFields } from '@/lib/translation/translateDocument'

import { adminReq, resetAdmin } from '../helpers/admin'
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
let userId: number
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
  const acc = await resetAdmin(payload, '198.51.100.42')
  token = acc.token
  userId = acc.userId
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

// P5.4 – Akzeptanz: Mock-Übersetzung, `force`, Rich-Text-Struktur über den allgemeinen Dienst.
describe('Übersetzen → EN (P5.4)', () => {
  it('Mock übersetzt „Schale mit Hund“ zu „[EN] Schale mit Hund“', async () => {
    const p = await createProduct(
      payload,
      completeProduct('keramik', nr++, fx, { title: 'Schale mit Hund' }),
    )
    const res = await translate(p.id)
    expect(res.status).toBe(200)
    expect((await en(p.id)).title).toBe('[EN] Schale mit Hund')
  })

  it('vorhandener EN-Titel bleibt ohne force unverändert; mit force wird er ersetzt', async () => {
    const p = await createProduct(
      payload,
      completeProduct('keramik', nr++, fx, { title: 'Schale mit Hund' }),
    )
    await payload.update({
      collection: 'products',
      id: p.id,
      locale: 'en',
      data: { title: 'Bowl with a dog' },
      overrideAccess: true,
    })
    expect((await translate(p.id)).status).toBe(200)
    const kept = await en(p.id)
    expect(kept.title).toBe('Bowl with a dog')
    // leere Felder wurden trotzdem gefüllt
    expect(kept.description).toBe('[EN] Ein handbemaltes Einzelstück aus dem Atelier in Berlin.')
    expect((await translate(p.id, { force: true })).status).toBe(200)
    expect((await en(p.id)).title).toBe('[EN] Schale mit Hund')
  })

  it('translateDocumentFields: Rich Text (Absätze, Listen, fett) behält seine Struktur (FAQ)', async () => {
    const t = (text: string, format = 0) => ({
      type: 'text',
      text,
      format,
      detail: 0,
      mode: 'normal',
      style: '',
      version: 1,
    })
    const el = (type: string, children: unknown[], extra: Record<string, unknown> = {}) => ({
      type,
      children,
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
      ...extra,
    })
    const answer = {
      root: el('root', [
        el('paragraph', [t('Jede '), t('Schale', 1), t(' ist ein Unikat.')], {
          textFormat: 0,
          textStyle: '',
        }),
        el(
          'list',
          [
            el('listitem', [t('Handbemalt')], { value: 1 }),
            el('listitem', [t('Spülmaschinenfest')], { value: 2 }),
          ],
          { listType: 'bullet', tag: 'ul', start: 1 },
        ),
      ]),
    }
    const faq = await payload.create({
      collection: 'faqs',
      locale: 'de',
      data: { question: 'Ist jede Schale anders?', answer, sortOrder: 980 } as never,
      overrideAccess: true,
    })
    try {
      const req = await adminReq(payload, userId)
      const { paths } = await translateDocumentFields(req, 'faqs', faq.id, ['question', 'answer'])
      expect(paths).toEqual(['question', 'answer'])
      const doc = await payload.findByID({
        collection: 'faqs',
        id: faq.id,
        locale: 'en',
        fallbackLocale: false,
        overrideAccess: true,
      })
      expect(doc.question).toBe('[EN] Ist jede Schale anders?')
      const root = (doc.answer as unknown as typeof answer).root
      const [para, list] = root.children as {
        type: string
        children: { type: string; text?: string; format?: number; children?: { text: string }[] }[]
      }[]
      expect(root.children.map((c) => (c as { type: string }).type)).toEqual(['paragraph', 'list'])
      expect(para!.children.map((c) => [c.text, c.format])).toEqual([
        ['[EN] Jede ', 0],
        ['[EN] Schale', 1],
        [' [EN] ist ein Unikat.', 0],
      ])
      expect(list!.children.map((li) => [li.type, li.children![0]!.text])).toEqual([
        ['listitem', '[EN] Handbemalt'],
        ['listitem', '[EN] Spülmaschinenfest'],
      ])
      // Vorhandenes EN bleibt ohne force
      await payload.update({
        collection: 'faqs',
        id: faq.id,
        locale: 'en',
        data: { question: 'Is every bowl different?' },
        overrideAccess: true,
      })
      const again = await translateDocumentFields(req, 'faqs', faq.id, ['question', 'answer'])
      expect(again.paths).toEqual([])
      const forced = await translateDocumentFields(req, 'faqs', faq.id, ['question'], {
        force: true,
      })
      expect(forced.doc.question).toBe('[EN] Ist jede Schale anders?')
    } finally {
      await payload.delete({ collection: 'faqs', id: faq.id, overrideAccess: true })
    }
  })
})
