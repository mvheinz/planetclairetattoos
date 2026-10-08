import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { FAQ_CATEGORIES, PAGE_KEYS } from '@/lib/enums'
import { expectedCount } from '@/lib/seed/expected'
import { lexicalToPlain } from '@/lib/richtext/plain'

import { resetAdmin } from '../helpers/admin'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'
import { SEED_TIMEOUT, bySeedKey, findAll, runCanonicalSeed, type SeedDoc } from './canonical'

// P8.7: Seiten für alle PAGE_KEYS (SEED-SPEC §13) und FAQ (§14) – Mengen, AK-SEED-18 (Startseite), AK-SEED-17
// (Übernahme von FAQ05), Feldgrenzen, `home.seo.metaTitle`, „Über mich“ ohne Jutta-Foto/Band/Liedzeile (V-28), EN-Texte.

let payload: Payload
type Block = Record<string, unknown> & { blockType: string }
type PageDoc = SeedDoc & { title: string; layout: Block[]; seo?: { metaTitle?: string } }

async function page(key: string, locale: 'de' | 'en', depth = 0): Promise<PageDoc> {
  const res = await payload.find({
    collection: 'pages',
    where: { key: { equals: key } },
    locale,
    depth,
    overrideAccess: true,
  })
  return res.docs[0] as unknown as PageDoc
}

const plain = (v: unknown) => lexicalToPlain(v).text

beforeAll(async () => {
  payload = await getTestPayload()
  await runCanonicalSeed(payload)
}, SEED_TIMEOUT)

afterAll(async () => {
  await runCanonicalSeed(payload, 'remove', { yes: true, dropTexts: true })
}, SEED_TIMEOUT)

describe('Seiten (SEED-SPEC §13)', () => {
  it('Mengen: alle 13 PAGE_KEYS veröffentlicht, 12 FAQ in allen benutzten Kategorien', async () => {
    const pages = await findAll(payload, 'pages', { seed: { equals: true } })
    expect(pages).toHaveLength(expectedCount('pages'))
    expect(pages.map((p) => p.key).sort()).toEqual([...PAGE_KEYS].sort())
    expect(pages.every((p) => p._status === 'published')).toBe(true)
    const faqs = await findAll(payload, 'faqs', { seed: { equals: true } })
    expect(faqs).toHaveLength(expectedCount('faqs'))
    expect(faqs.every((f) => f.published === true)).toBe(true)
    expect(new Set(faqs.map((f) => f.category))).toEqual(
      new Set(FAQ_CATEGORIES.filter((c) => c !== 'general')),
    )
  })

  it('AK-SEED-18: Startseite hero + genau 7 Stationen in fester Reihenfolge; Feldgrenzen; seo.metaTitle wie §13.7', async () => {
    for (const locale of ['de', 'en'] as const) {
      const home = await page('home', locale)
      expect(home.layout.map((b) => b.blockType)).toEqual(['hero', ...Array(7).fill('station')])
      expect(home.layout.slice(1).map((b) => b.stationId)).toEqual([
        'hallo',
        'keramik',
        'textil',
        'zeichnungen',
        'schmuck',
        'tattoo',
        'jutta-und-coco',
      ])
      expect(String(home.layout[0]!.subheading).length).toBeLessThanOrEqual(300)
      for (const b of home.layout.slice(1)) {
        expect(String(b.text ?? '').length).toBeLessThanOrEqual(400)
        expect(b.image ?? null).toBeNull()
      }
      expect(String(home.seo?.metaTitle).length).toBeLessThanOrEqual(60)
    }
    expect((await page('home', 'de')).seo?.metaTitle).toBe(
      'Planet Claire – Tattoos & Unikate aus Berlin',
    )
    expect((await page('home', 'en')).seo?.metaTitle).toBe(
      'Planet Claire – Tattoos & one-offs from Berlin',
    )
    for (const key of PAGE_KEYS.filter((k) => k !== 'home')) {
      expect((await page(key, 'de')).seo?.metaTitle ?? null, key).toBeNull()
    }
  })

  it('Blöcke je Seite laut §13.2–§13.7; EN-Texte in der englischen Fassung', async () => {
    const types = async (key: string) => (await page(key, 'de')).layout.map((b) => b.blockType)
    // U-48 (P13.9): nur noch „Zu zweit“ (Foto von Jutta und Coco, P12.16, von Jutta freigegeben) und „Sag etwas“
    expect(await types('about')).toEqual(['imageText', 'contactLinks'])
    expect(await types('commissions')).toEqual([
      'processSteps',
      'imageGallery',
      'callout',
      'commissionForm',
      'faqList',
    ])
    expect(await types('tattoo')).toEqual([
      'richText',
      'flashGrid',
      'tattooGallery',
      'priceInfo',
      'processSteps',
      'callout',
      'faqList',
      'contactLinks',
    ])
    expect(await types('tattoo_aftercare')).toEqual([
      'richText',
      'aftercareSteps',
      'callout',
      'richText',
      'faqList',
    ])
    for (const key of ['archive', 'conformity', 'order_status', 'thanks', 'not_found']) {
      expect(await types(key), key).toEqual(['richText'])
    }
    expect(await types('withdrawal')).toEqual(['callout'])
    expect(await types('shop')).toEqual(['richText', 'categoryTeaser'])

    const aftercareDe = await page('tattoo_aftercare', 'de')
    const aftercareEn = await page('tattoo_aftercare', 'en')
    const phases = (p: PageDoc) => p.layout[1]!.phases as { title: string; content: unknown }[]
    expect(phases(aftercareDe).map((x) => x.title)).toEqual([
      'Direkt danach',
      'Tag 1–3',
      'Woche 1–2',
      'Woche 3–6',
      'Langfristig',
    ])
    expect(phases(aftercareEn).map((x) => x.title)).toEqual([
      'Right after',
      'Days 1–3',
      'Weeks 1–2',
      'Weeks 3–6',
      'Long term',
    ])
    // Gleiche Zeilen-IDs in beiden Sprachen (Blöcke nicht lokalisiert)
    expect(phases(aftercareEn).map((x) => (x as { id?: string }).id)).toEqual(
      phases(aftercareDe).map((x) => (x as { id?: string }).id),
    )
    expect(plain(phases(aftercareEn)[0]!.content)).toMatch(/^I wrap your tattoo in film/)
    const tattooEn = await page('tattoo', 'en')
    expect(tattooEn.title).toBe('Tattoo')
    const steps = tattooEn.layout[4]!.steps as { title: string; text: string }[]
    expect(steps.map((s) => s.title)).toEqual([
      'Request',
      'Appointment',
      'Deposit',
      'Tattooing',
      'Aftercare',
    ])
    expect(plain((await page('not_found', 'en')).layout[0]!.content)).toBe(
      'Coco followed the line and never came back – this page does not exist (anymore). [Back to the start](/en)',
    )
    for (const key of PAGE_KEYS) {
      const [de, en] = [await page(key, 'de'), await page(key, 'en')]
      expect(en.title, key).toBeTruthy()
      expect(en.layout.length, key).toBe(de.layout.length)
    }
  })

  it('V-28: „Über mich“ nur mit dem von Jutta freigegebenen Foto, ohne Band-Namen, ohne Liedzeile', async () => {
    const about = await page('about', 'de', 1)
    const images = about.layout.flatMap((b) =>
      b.blockType === 'imageText'
        ? [b.image]
        : b.blockType === 'imageGallery'
          ? (b.images as unknown[])
          : [],
    ) as { showsPerson: string; sourceRef: string; ownerApproved?: boolean }[]
    expect(images).toHaveLength(1) // U-48: Galerie und „Die zittrige Linie“ gelöscht
    // Fotos von Jutta nur mit gesetztem Häkchen „ownerApproved“ (R-181): genau das gelieferte Foto
    const jutta = images.filter((m) => m.showsPerson === 'jutta')
    expect(jutta.map((m) => m.sourceRef)).toEqual(['own:jutta-coco'])
    expect(jutta.every((m) => m.ownerApproved === true)).toBe(true)
    expect(images.map((m) => m.sourceRef)).not.toContain('DdHXUQsDjqm')
    const text = JSON.stringify(about.layout)
    expect(text).not.toMatch(/B-?52|Planet Claire, |„[^“]{20,}“/)
    const en = JSON.stringify((await page('about', 'en')).layout)
    expect(en).not.toMatch(/B-?52/)
  })

  it('U-48: „Über mich“ ohne „Ich bin Jutta“, „Die zittrige Linie“, Coco-Absatz und „Wo ich zeichne“ (DE/EN)', async () => {
    for (const locale of ['de', 'en'] as const) {
      const text = JSON.stringify((await page('about', locale)).layout)
      expect(text, locale).not.toMatch(
        /Ich bin Jutta|I am Jutta|zittrige Linie|trembling line|Und das ist Coco|And this is Coco|Wo ich zeichne|Where I draw/,
      )
      expect(text, locale).toContain(locale === 'de' ? 'Zu zweit' : 'The two of us')
      expect(text, locale).toContain(locale === 'de' ? 'Sag etwas' : 'Say something')
    }
  })
})

describe('FAQ (SEED-SPEC §14)', () => {
  it('Fragen und Antworten DE/EN, Antworten als Lexical', async () => {
    const de = await bySeedKey(payload, 'faqs', 'FAQ08', { locale: 'de' })
    const en = await bySeedKey(payload, 'faqs', 'FAQ08', { locale: 'en' })
    expect(de.question).toBe('Wie frage ich ein Tattoo an?')
    expect(en.question).toBe('How do I request a tattoo?')
    expect(plain(de.answer)).toContain('zum Beispiel F-902')
    expect(plain(en.answer)).toContain('for example F-902')
    expect(de.category).toBe('tattoo')
    expect(de.sortOrder).toBe(80)
  })

  it(
    'AK-SEED-17: Speichern von FAQ05 in der Verwaltung setzt seed = false; ein weiterer Seed legt FAQ05 weder neu an noch ändert es',
    async () => {
      const before = await bySeedKey(payload, 'faqs', 'FAQ05', { locale: 'de' })
      const { token } = await resetAdmin(payload, '198.51.100.85')
      const question = 'Ist Coco beim Tätowieren dabei? (von Jutta)'
      const res = await rest(
        'PATCH',
        `/faqs/${before.id}?locale=de`,
        { question },
        { authorization: `JWT ${token}` },
      )
      expect(res.status, await res.clone().text()).toBe(200)
      const adopted = await bySeedKey(payload, 'faqs', 'FAQ05', { locale: 'de' })
      expect(adopted).toMatchObject({ seed: false, seedKey: 'faqs:FAQ05', question })

      const { report } = await runCanonicalSeed(payload, 'example')
      expect(report.get('faqs', 'skipped')).toBe(1)
      expect(report.get('faqs', 'created')).toBe(0)
      const after = await findAll(
        payload,
        'faqs',
        { seedKey: { equals: 'faqs:FAQ05' } },
        {
          locale: 'de',
        },
      )
      expect(after).toHaveLength(1)
      expect(after[0]).toMatchObject({ id: before.id, seed: false, question })
      expect(await findAll(payload, 'faqs')).toHaveLength(expectedCount('faqs'))
      await payload.delete({ collection: 'faqs', id: before.id, overrideAccess: true })
    },
    SEED_TIMEOUT,
  )
})
