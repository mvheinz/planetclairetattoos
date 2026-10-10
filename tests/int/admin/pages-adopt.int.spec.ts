import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { PAGE_KEYS } from '@/lib/enums'
import { lexicalToPlain } from '@/lib/richtext/plain'
import { loadPageTexts } from '@/lib/tattoo/admin'

import { adminReq, resetAdmin } from '../helpers/admin'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'
import { bySeedKey, findAll, runCanonicalSeed, SEED_TIMEOUT } from '../seed/canonical'

// P8.19a: Verwaltung „Texte“ → „Seiten und FAQ“ – `POST /api/pages/texts` (Titel, SEO, Blöcke DE/EN) und
// `POST /api/faqs/texts-save` / `…/:id/move` (alle Kategorien). AK-SEED-17: Speichern durch Jutta setzt `seed = false`;
// ein weiterer Seed-Lauf legt den Eintrag weder neu an noch ändert er ihn (DATENMODELL §13.4, SEED-SPEC §1.3).

vi.setConfig({ testTimeout: SEED_TIMEOUT, hookTimeout: SEED_TIMEOUT * 2 })

let payload: Payload
let token: string
let userId: number

const auth = () => ({ authorization: `JWT ${token}` })

beforeAll(async () => {
  payload = await getTestPayload()
  await runCanonicalSeed(payload, 'reset')
  const acc = await resetAdmin(payload, '198.51.100.86')
  token = acc.token
  userId = acc.userId
})

afterAll(async () => {
  await runCanonicalSeed(payload, 'remove', { yes: true, dropTexts: true })
  for (const collection of ['pages', 'faqs'] as const) {
    await payload.delete({
      collection,
      where: { seedKey: { exists: true } },
      overrideAccess: true,
      context: { seed: true, skipAudit: true },
    })
  }
})

describe('P8.19a Seiten und FAQ', () => {
  it('jede Seite aus PAGE_KEYS lässt sich laden (Titel DE/EN, Textblöcke bearbeitbar)', async () => {
    const req = await adminReq(payload, userId)
    for (const key of PAGE_KEYS) {
      const form = await loadPageTexts(req, key)
      expect(form.page, key).not.toBeNull()
      expect(form.page!.title.de.length, key).toBeGreaterThan(1)
      expect(form.page!.seed, key).toBe(true)
      expect(
        form.blocks.some((b) => b.editable),
        `${key}: mindestens ein bearbeitbarer Block`,
      ).toBe(true)
    }
    const home = await loadPageTexts(req, 'home')
    expect(home.blocks.map((b) => b.blockType)).toEqual([
      'hero',
      'imageText',
      ...Array(5).fill('station'),
    ])
    expect(home.blocks.every((b) => b.editable)).toBe(true)
  })

  it('Feldgrenzen: Station-Text > 400 und seo.metaTitle > 60 → 400, nichts gespeichert', async () => {
    const req = await adminReq(payload, userId)
    const form = await loadPageTexts(req, 'home')
    const blocks = structuredClone(form.blocks)
    blocks[2]!.fields.text = { de: 'x'.repeat(401), en: '' } // Station 01 Keramik (nach „Bild mit Text“, U-50)
    const res = await rest(
      'POST',
      '/pages/texts',
      {
        key: 'home',
        blocks,
        title: form.page!.title,
        seo: { metaTitle: { de: 'y'.repeat(61), en: '' } },
      },
      auth(),
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { errors: { path: string }[] }
    expect(body.errors.map((e) => e.path)).toEqual(
      expect.arrayContaining(['blocks.2.fields.text.de', 'seo.metaTitle.de']),
    )
    expect((await bySeedKey(payload, 'pages', 'home')).seed).toBe(true)
  })

  it('ohne Admin-Sitzung → 403', async () => {
    expect((await rest('POST', '/pages/texts', { key: 'about', blocks: [] })).status).toBe(403)
    expect((await rest('POST', '/faqs/texts-save', {})).status).toBe(403)
  })

  it('AK-SEED-17 (pages): Speichern einer Seed-Seite setzt seed = false (DE/EN, Hero, SEO); weiterer Seed überspringt sie', async () => {
    const req = await adminReq(payload, userId)
    const form = await loadPageTexts(req, 'home')
    const blocks = structuredClone(form.blocks)
    blocks[0]!.fields.subheading = { de: 'Neue Unterzeile von Jutta', en: 'New subline by Jutta' }
    blocks[2]!.fields.text = { de: 'Keramik, frisch aus dem Ofen.', en: '' } // Station 01 Keramik (U-40, U-50)
    const res = await rest(
      'POST',
      '/pages/texts',
      {
        key: 'home',
        blocks,
        title: { de: 'Startseite von Jutta', en: 'Home by Jutta' },
        seo: {
          metaTitle: { de: 'Planet Claire – Keramik', en: 'Planet Claire – ceramics' },
          metaDescription: { de: 'Unikate aus Berlin.', en: '' },
        },
      },
      auth(),
    )
    expect(res.status, await res.clone().text()).toBe(200)
    const de = await bySeedKey(payload, 'pages', 'home', { locale: 'de' })
    const en = await bySeedKey(payload, 'pages', 'home', { locale: 'en' })
    expect(de).toMatchObject({ seed: false, seedKey: 'pages:home', title: 'Startseite von Jutta' })
    expect(en.title).toBe('Home by Jutta')
    const layoutDe = de.layout as Array<Record<string, unknown>>
    const layoutEn = en.layout as Array<Record<string, unknown>>
    expect(layoutDe[0]!.subheading).toBe('Neue Unterzeile von Jutta')
    expect(layoutEn[0]!.subheading).toBe('New subline by Jutta')
    expect(layoutDe[2]!.text).toBe('Keramik, frisch aus dem Ofen.')
    // Stationen bleiben vollständig (stationId, Pose, Link unverändert)
    expect(layoutDe.filter((b) => b.blockType === 'station').map((b) => b.stationId)).toEqual([
      'keramik',
      'textil',
      'zeichnungen',
      'schmuck',
      'tattoo',
    ])
    expect((de.seo as Record<string, unknown>).metaTitle).toBe('Planet Claire – Keramik')

    const { report } = await runCanonicalSeed(payload, 'example')
    expect(report.get('pages', 'created')).toBe(0)
    const after = await findAll(
      payload,
      'pages',
      { seedKey: { equals: 'pages:home' } },
      { locale: 'de' },
    )
    expect(after).toHaveLength(1)
    expect(after[0]).toMatchObject({ id: de.id, seed: false, title: 'Startseite von Jutta' })
    expect((after[0]!.layout as Array<Record<string, unknown>>)[0]!.subheading).toBe(
      'Neue Unterzeile von Jutta',
    )
  })

  it('AK-SEED-17 (faqs): Speichern eines Seed-FAQ (Kategorie außerhalb Tattoo) setzt seed = false; weiterer Seed ändert ihn nicht; Reihenfolge per move', async () => {
    const shopFaqs = await findAll(
      payload,
      'faqs',
      { category: { not_in: ['tattoo', 'aftercare'] } },
      { locale: 'de' },
    )
    expect(shopFaqs.length).toBeGreaterThan(0)
    const target = shopFaqs[0]!
    const res = await rest(
      'POST',
      '/faqs/texts-save',
      {
        id: target.id,
        category: target.category,
        question: { de: 'Wie lange dauert der Versand? (Jutta)', en: '' },
        answer: { de: 'Meist zwei bis drei Tage.', en: 'Usually two to three days.' },
        published: true,
      },
      auth(),
    )
    expect(res.status, await res.clone().text()).toBe(200)
    const saved = await payload.findByID({
      collection: 'faqs',
      id: target.id,
      locale: 'de',
      overrideAccess: true,
    })
    expect(saved.seed).toBe(false)
    expect(saved.question).toBe('Wie lange dauert der Versand? (Jutta)')

    await runCanonicalSeed(payload, 'example')
    const again = await payload.findByID({
      collection: 'faqs',
      id: target.id,
      locale: 'en',
      overrideAccess: true,
    })
    expect(again.seed).toBe(false)
    expect(lexicalToPlain(again.answer).text).toBe('Usually two to three days.')

    // Reihenfolge: zwei Fragen derselben Kategorie tauschen
    const cat = await findAll(payload, 'faqs', { category: { equals: 'tattoo' } }, { locale: 'de' })
    const ordered = [...cat].sort(
      (a, b) => (a.sortOrder as number) - (b.sortOrder as number) || a.id - b.id,
    )
    const second = ordered[1]!
    expect(
      (await rest('POST', `/faqs/${second.id}/move`, { direction: 'up' }, auth())).status,
    ).toBe(200)
    const now = await payload.find({
      collection: 'faqs',
      where: { category: { equals: 'tattoo' } },
      sort: 'sortOrder',
      pagination: false,
      overrideAccess: true,
    })
    expect(now.docs[0]!.id).toBe(second.id)
    expect(now.docs[1]!.id).toBe(ordered[0]!.id)
  })
})
