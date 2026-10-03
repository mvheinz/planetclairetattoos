import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { lexicalToPlain, toLexical } from '@/lib/richtext/plain'
import { loadTattooPageTexts, moveTattooFaq, saveTattooFaq } from '@/lib/tattoo/admin'
import { newEditorBlock, type EditorBlock } from '@/lib/tattoo/textBlocks'
import { tattooTextWarnings } from '@/lib/tattoo/textWarnings'
import type { Page } from '@/payload-types'

import { adminReq, resetAdmin } from '../helpers/admin'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P7.9 – Tattoo-Texte in der Verwaltung (KONZEPT §7.12, §9.6): Blöcke der Seiten `tattoo`/`tattoo_aftercare` und FAQ
// der Kategorien `tattoo`/`aftercare` mit Warnung bei V-24/V-15 (Speichern bleibt möglich) und „Übersetzen“
// (`POST /api/pages/:id/translate`, `POST /api/faqs/:id/translate`, Mock „[EN] …“, Struktur gleich).

let payload: Payload
let token: string
let userId: number
const faqIds: number[] = []
let pagesBefore: number[] = []

const loc = (de: string, en = '') => ({ de, en })

beforeAll(async () => {
  payload = await getTestPayload()
  ;({ token, userId } = await resetAdmin(payload))
  const existing = await payload.find({
    collection: 'pages',
    where: { key: { in: ['tattoo', 'tattoo_aftercare'] } },
    overrideAccess: true,
    depth: 0,
  })
  pagesBefore = existing.docs.map((d) => d.id as number)
})

afterAll(async () => {
  // nur die hier angelegten Seiten entfernen (Löschen ist über die API gesperrt)
  const { sql } = await import('@payloadcms/db-postgres')
  const { dbOf } = await import('../helpers/commerce')
  const created = await payload.find({
    collection: 'pages',
    where: { key: { in: ['tattoo', 'tattoo_aftercare'] } },
    overrideAccess: true,
    depth: 0,
  })
  for (const p of created.docs) {
    if (!pagesBefore.includes(p.id as number))
      await dbOf(payload).execute(sql`DELETE FROM pages WHERE id = ${p.id}`)
  }
  await payload.delete({
    collection: 'faqs',
    where: { id: { in: faqIds } },
    overrideAccess: true,
  })
})

describe('Tattoo-Texte (P7.9)', () => {
  it('Klartext ↔ Lexical: Absätze, Listen, fett und Links bleiben beim Bearbeiten erhalten', () => {
    const text = 'Erster Absatz mit **fett**.\n\n- Punkt eins\n- Punkt [zwei](https://example.com)'
    expect(lexicalToPlain(toLexical(text))).toEqual({ text, lossy: false })
  })

  it('AK „Anzahlung verfällt bei Absage“ speichert mit sichtbarer Warnung; Mock-Übersetzung setzt „[EN] …“ in alle EN-Felder der Blöcke, Struktur gleich', async () => {
    const before = await loadTattooPageTexts(await adminReq(payload, userId), 'tattoo')
    const price = newEditorBlock('priceInfo')
    price.fields.heading = loc('Preise')
    price.fields.content = loc('Kleine Motive ab 80 €.\n\nAnzahlung verfällt bei Absage.')
    const steps = newEditorBlock('processSteps')
    steps.fields.heading = loc('So läuft es ab')
    steps.rows = [
      { fields: { title: loc('Anfrage'), text: loc('Du schreibst mir deine Idee.') } },
      { fields: { title: loc('Termin'), text: loc('Wir finden einen Termin.') } },
    ]
    const style = newEditorBlock('richText')
    style.fields.content = loc('Feine Linien, viel **Witz**.')
    const blocks: EditorBlock[] = [
      ...before.blocks.filter(
        (b) => !['priceInfo', 'processSteps', 'richText'].includes(b.blockType),
      ),
      style,
      price,
      steps,
    ]
    const res = await rest(
      'POST',
      '/pages/tattoo-texts',
      { key: 'tattoo', blocks },
      { authorization: `JWT ${token}` },
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      doc: Page
      warnings: { id: string; match: string }[]
    }
    expect(body.warnings.map((w) => w.id)).toEqual(['V-24'])
    expect(body.warnings[0]!.match).toContain('Anzahlung verfällt')
    const id = body.doc.id

    // gespeichert und veröffentlicht (DE)
    const de = (await payload.findByID({
      collection: 'pages',
      id,
      locale: 'de',
      fallbackLocale: false,
      overrideAccess: true,
    })) as Page
    expect(de._status).toBe('published')
    const priceDe = de.layout!.find((b) => b.blockType === 'priceInfo') as { content: unknown }
    expect(lexicalToPlain(priceDe.content).text).toContain('Anzahlung verfällt bei Absage.')

    // Übersetzen
    const tr = await rest('POST', `/pages/${id}/translate`, {}, { authorization: `JWT ${token}` })
    expect(tr.status).toBe(200)
    const en = (await payload.findByID({
      collection: 'pages',
      id,
      locale: 'en',
      fallbackLocale: false,
      overrideAccess: true,
    })) as Page
    const shape = (p: Page) =>
      (p.layout ?? []).map((b) => ({
        id: b.id,
        blockType: b.blockType,
        rows: ((b as { steps?: { id?: string }[] }).steps ?? []).map((r) => r.id),
      }))
    expect(shape(en)).toEqual(shape(de))
    const edited = (en.layout ?? []).filter((b) =>
      ['priceInfo', 'processSteps', 'richText'].includes(b.blockType),
    )
    expect(edited).toHaveLength(3)
    for (const b of edited) {
      const texts: string[] = []
      const visit = (v: unknown) => {
        if (typeof v === 'string') texts.push(v)
        else if (v && typeof v === 'object' && 'root' in (v as object))
          texts.push(lexicalToPlain(v).text)
      }
      const block = b as Record<string, unknown>
      for (const key of ['heading', 'content']) visit(block[key])
      for (const row of (block.steps as Record<string, unknown>[] | undefined) ?? []) {
        visit(row.title)
        visit(row.text)
      }
      expect(texts.length).toBeGreaterThan(0)
      for (const t of texts) {
        for (const para of t.split('\n\n'))
          expect(para.replace(/^\*\*|^- /, '')).toMatch(/^\[EN\] /)
      }
    }
    // erneutes Laden zeigt DE und EN im Formular
    const loaded = await loadTattooPageTexts(await adminReq(payload, userId), 'tattoo')
    const priceForm = loaded.blocks.find((b) => b.blockType === 'priceInfo')!
    expect(priceForm.fields.heading).toEqual({ de: 'Preise', en: '[EN] Preise' })
  })

  it('V-15 und FAQ: Warnung beim Speichern, Übersetzen, Reihenfolge per Hoch/Runter', async () => {
    expect(tattooTextWarnings(['Heilt schmerzfrei und schnell']).map((w) => w.id)).toEqual(['V-15'])
    expect(tattooTextWarnings(['Anzahlung wird nicht erstattet'])).toHaveLength(1)
    expect(tattooTextWarnings(['Die Anzahlung vereinbaren wir persönlich.'])).toHaveLength(0)

    const req = await adminReq(payload, userId)
    const a = await saveTattooFaq(req, {
      category: 'aftercare',
      question: loc('Tut das Abheilen weh?'),
      answer: loc('Meist ist es schmerzfrei, manchmal juckt es.'),
      published: true,
    })
    faqIds.push(a.doc.id)
    expect(a.warnings.map((w) => w.id)).toEqual(['V-15'])
    const b = await saveTattooFaq(req, {
      category: 'aftercare',
      question: loc('Wie lange dauert das Abheilen?'),
      answer: loc('Etwa zwei bis vier Wochen.'),
      published: true,
    })
    faqIds.push(b.doc.id)
    expect(b.warnings).toEqual([])

    const tr = await rest(
      'POST',
      `/faqs/${b.doc.id}/translate`,
      {},
      { authorization: `JWT ${token}` },
    )
    expect(tr.status).toBe(200)
    const en = (await tr.json()) as { doc: { question: string; answer: unknown } }
    expect(en.doc.question).toBe('[EN] Wie lange dauert das Abheilen?')
    expect(lexicalToPlain(en.doc.answer).text).toBe('[EN] Etwa zwei bis vier Wochen.')

    const order = async () =>
      (
        await payload.find({
          collection: 'faqs',
          where: { id: { in: [a.doc.id, b.doc.id] } },
          sort: ['sortOrder', 'id'],
          overrideAccess: true,
        })
      ).docs.map((d) => d.id)
    expect(await order()).toEqual([a.doc.id, b.doc.id])
    const moved = await rest(
      'POST',
      `/faqs/${b.doc.id}/move`,
      { direction: 'up' },
      {
        authorization: `JWT ${token}`,
      },
    )
    expect(moved.status).toBe(200)
    expect(await order()).toEqual([b.doc.id, a.doc.id])
    expect((await moveTattooFaq(req, b.doc.id, 'up')).unchanged).toBe(true)
  })
})
