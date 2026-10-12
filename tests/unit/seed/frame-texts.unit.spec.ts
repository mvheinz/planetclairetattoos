import { readFileSync } from 'node:fs'
import path from 'node:path'

import { beforeAll, describe, expect, it } from 'vitest'

import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import { loadBestand, type BestandProduct } from '@/lib/bestand/schema'
import { isSupersededCategoryIntro, SUPERSEDED_CATEGORY_INTROS } from '@/lib/seed/globals'

// P20.2 (V-21, U-93): Die Rahmentexte – Kategorie-Texte, Texte der Startseiten-Stationen, Einleitung des Shops und
// die Beschreibungen für Google – nennen nur, was es im echten Bestand (`content/bestand/products.json`, noch nicht
// verkaufte Stücke) wirklich gibt: keine Kleider, Tellerchen oder Planeten-Anhänger, kein „Öse aus Edelstahl“ (E-17)
// und kein „Kette nicht dabei“, solange Anhänger an Kette, Band oder Kordel kommen. Schlägt der Test nach einem
// Bestandsimport fehl, passen die Texte nicht mehr zum Bestand (RUNBOOK §15: Rahmentexte prüfen).

const root = path.resolve(import.meta.dirname, '../../..')
const readJson = <T>(file: string) => JSON.parse(readFileSync(path.join(root, file), 'utf8')) as T

type Localized = { de: string; en: string }
const base = readJson<{ categories: { key: string; intro: Localized }[] }>(
  'content/seed/data/base.json',
)
const pages = readJson<
  { key: string; layout: { blockType: string; stationId?: string; text?: Localized }[] }[]
>('content/seed/data/pages.json')

/** Kategorien mit eigenem Bestand (Zeichnungen und Sonstiges beschreiben nur die Kategorie selbst). */
const INVENTORY_CATEGORIES = ['keramik', 'textil', 'cap', 'schmuck'] as const
const SEO_KEYS = ['default', 'home', 'shop', 'archive', 'about'] as const

interface FrameText {
  where: string
  text: string
}

function frameTexts(): FrameText[] {
  const out: FrameText[] = []
  for (const c of base.categories.filter((c) =>
    (INVENTORY_CATEGORIES as readonly string[]).includes(c.key),
  )) {
    out.push({ where: `base.json ${c.key}.intro.de`, text: c.intro.de })
    out.push({ where: `base.json ${c.key}.intro.en`, text: c.intro.en })
  }
  const home = pages.find((p) => p.key === 'home')!
  for (const b of home.layout.filter((b) => b.blockType === 'station' && b.text)) {
    out.push({ where: `pages.json Station ${b.stationId} (de)`, text: b.text!.de })
    out.push({ where: `pages.json Station ${b.stationId} (en)`, text: b.text!.en })
  }
  out.push({ where: 'de.json shop.list.intro', text: de.shop.list.intro })
  out.push({ where: 'en.json shop.list.intro', text: en.shop.list.intro })
  for (const k of SEO_KEYS) {
    out.push({ where: `de.json seo.descriptions.${k}`, text: de.seo.descriptions[k] })
    out.push({ where: `en.json seo.descriptions.${k}`, text: en.seo.descriptions[k] })
  }
  return out
}

type Pieces = readonly BestandProduct[]
const titled = (re: RegExp) => (ps: Pieces) => ps.some((p) => re.test(p.title.de))
const inCategory = (cat: string) => (ps: Pieces) => ps.some((p) => p.category === cat)
const jewelleryMaterial = (re: RegExp) => (ps: Pieces) =>
  ps.some((p) => p.category === 'schmuck' && re.test(p.materials.de))

/**
 * Was ein Rahmentext behauptet → woran man es im Bestand erkennt. Deutsche Wörter mit Großbuchstaben und Wortgrenze
 * („Reh“ nicht in „dreht“), englische ohne Rücksicht auf Groß-/Kleinschreibung.
 */
const CLAIMS: readonly { claim: string; re: RegExp; exists: (ps: Pieces) => boolean }[] = [
  { claim: 'Kleider', re: /\bKleid(er)?\b|\bdress(es)?\b/i, exists: titled(/Kleid/) },
  { claim: 'Teller', re: /\bTeller(chen)?\b|\bplates?\b/i, exists: titled(/Teller/) },
  { claim: 'Fliesen', re: /\bFliesen?\b|\btiles?\b/i, exists: titled(/Fliese/) },
  { claim: 'Planeten', re: /\bPlaneten\b|\bplanets\b/i, exists: titled(/Planet/) },
  { claim: 'Rehe', re: /\bReh(e|köpfchen)?\b|\bdeer\b/i, exists: titled(/Reh/) },
  { claim: 'Füchse', re: /\bFüchse\b|\bfoxes\b/i, exists: titled(/Fuchs/) },
  { claim: 'Figuren', re: /\bFiguren\b|\bfigures\b/i, exists: titled(/Figur/) },
  { claim: 'Becher', re: /\bBecher\b|\bcups\b/i, exists: titled(/Becher|Tasse/) },
  { claim: 'Schalen', re: /\bSchalen\b|\bbowls\b/i, exists: titled(/Schale|Schälchen/) },
  { claim: 'Stoffbeutel', re: /Stoffbeutel|\btote bags?\b/i, exists: titled(/Stoffbeutel/) },
  { claim: 'Etuis', re: /\bEtuis?\b|\bpouch(es)?\b/i, exists: titled(/Etui/) },
  { claim: 'Tops', re: /\bTops\b|\btops\b/, exists: titled(/top/i) },
  { claim: 'Shirts', re: /\bShirts\b|\bshirts\b/, exists: titled(/Shirt/) },
  {
    claim: 'Hüte',
    re: /\bHüte\b|\bhats\b/i,
    exists: (ps) => ps.some((p) => p.category === 'cap' && /hut\b/i.test(p.title.de)),
  },
  { claim: 'Katzen', re: /\bKatzen\b|\bcats\b/i, exists: titled(/Katze/) },
  { claim: 'Fledermäuse', re: /\bFledermäuse\b|\bbats\b/i, exists: titled(/Fledermaus/) },
  { claim: 'Pferdeköpfe', re: /\bPferdeköpfe\b|\bhorse heads\b/i, exists: titled(/Pferd/) },
  {
    claim: 'Kette, Band oder Kordel',
    re: /Kette, Band oder Kordel|chain or cord/i,
    exists: (ps) => [/kette/i, /\bBand\b/, /Kordel/].every((re) => jewelleryMaterial(re)(ps)),
  },
  {
    claim: 'Zeichnungen',
    re: /\bZeichnung(en)?\b|\bAquarell|\bdrawings?\b|\bwatercolou?rs?\b/i,
    exists: inCategory('zeichnung'),
  },
  { claim: 'Keramik', re: /\bKeramik|\bceramics?\b/i, exists: inCategory('keramik') },
  { claim: 'Schmuck', re: /Schmuck|\bjewellery\b/i, exists: inCategory('schmuck') },
  { claim: 'Textil', re: /Textil|\btextiles?\b/i, exists: inCategory('textil') },
  { claim: 'Caps', re: /\bCaps\b|\bcaps\b/, exists: inCategory('cap') },
  { claim: 'Edelstahl', re: /Edelstahl|stainless/i, exists: jewelleryMaterial(/Edelstahl/) },
  {
    claim: 'Second-Hand',
    re: /second-hand/i,
    exists: (ps) =>
      ps.some((p) => p.category === 'textil' || p.category === 'cap') &&
      ps
        .filter((p) => p.category === 'textil' || p.category === 'cap')
        .every((p) => p.isSecondHand === true),
  },
  {
    claim: 'Deko, nicht für Lebensmittel',
    re: /Deko|decorative|nicht für (Essen|Lebensmittel)|not for food/i,
    exists: (ps) =>
      ps
        .filter((p) => p.category === 'keramik')
        .every((p) => (p as { foodContact?: string }).foodContact === 'deko'),
  },
]

let pieces: BestandProduct[] = []
beforeAll(async () => {
  pieces = (await loadBestand(root)).filter((p) => !p.sold)
})

describe('V-21 Rahmentexte passen zum echten Bestand', () => {
  it('jede Behauptung eines Rahmentexts hat Stücke im Bestand', () => {
    expect(pieces.length).toBeGreaterThan(0)
    const wrong = frameTexts().flatMap(({ where, text }) =>
      CLAIMS.filter((c) => c.re.test(text) && !c.exists(pieces)).map(
        (c) => `${where}: „${c.claim}“ gibt es nicht im Bestand`,
      ),
    )
    expect(wrong).toEqual([])
  })

  it('kein „Kette nicht dabei“, solange Anhänger an Kette, Band oder Kordel kommen; kein unbelegtes Edelstahl (E-17)', () => {
    const corded = jewelleryMaterial(/kette|\bBand\b|kordel/i)(pieces)
    expect(corded).toBe(true)
    for (const { where, text } of frameTexts()) {
      expect(text, where).not.toMatch(/Kette (ist )?nicht dabei|chain (is )?not included/i)
      expect(text, where).not.toMatch(/Öse aus Edelstahl|stainless steel loop/i)
    }
  })

  it('die Beschreibungen für Google nennen jede Stückart, die es gibt (DE/EN)', () => {
    const names: Record<string, RegExp> = {
      keramik: /Keramik|ceramics/i,
      schmuck: /Schmuck|jewellery/i,
      textil: /Textil|textiles/i,
      cap: /\bCaps\b|\bcaps\b/,
      zeichnung: /Zeichnung|drawings/i,
    }
    const categories = [...new Set(pieces.map((p) => p.category))].filter((c) => names[c])
    expect(categories).toContain('cap')
    for (const k of ['default', 'home', 'shop'] as const) {
      for (const [lang, messages] of [
        ['de', de],
        ['en', en],
      ] as const) {
        for (const c of categories)
          expect(messages.seo.descriptions[k], `${lang} seo.descriptions.${k}: ${c}`).toMatch(
            names[c]!,
          )
      }
    }
  })

  it('Juttas Leitsatz „Tinte auf Haut, Ton und Papier“ bleibt (nur sie ändert ihn)', () => {
    expect(de.common.claim).toBe(
      'Tinte auf Haut, Ton und Papier – von einem kleinen Planeten in Berlin',
    )
    expect(en.common.claim).toBe('Ink on skin, clay and paper – from a small planet in Berlin')
  })
})

describe('V-21 bestehende Datenbanken bekommen die neuen Kategorie-Texte (Grund-Seed)', () => {
  it('frühere Texte gelten als ersetzbar, die aktuellen und eigene Texte nie', () => {
    for (const c of base.categories) {
      for (const lang of ['de', 'en'] as const) {
        expect(isSupersededCategoryIntro(c.key, lang, c.intro[lang]), `${c.key}.${lang}`).toBe(
          false,
        )
      }
    }
    for (const [key, byLang] of Object.entries(SUPERSEDED_CATEGORY_INTROS)) {
      expect(base.categories.map((c) => c.key)).toContain(key)
      for (const lang of ['de', 'en'] as const) {
        expect(byLang[lang].length).toBeGreaterThan(0)
        for (const old of byLang[lang]) expect(isSupersededCategoryIntro(key, lang, old)).toBe(true)
      }
    }
    expect(
      isSupersededCategoryIntro(
        'schmuck',
        'de',
        'Winzige Anhänger aus Keramik mit Öse aus Edelstahl. Die Kette ist nicht dabei – deine Lieblingskette wartet bestimmt schon.',
      ),
    ).toBe(true)
    expect(isSupersededCategoryIntro('schmuck', 'de', 'Mein eigener Text.')).toBe(false)
    expect(isSupersededCategoryIntro('schmuck', 'en', null)).toBe(false)
    expect(isSupersededCategoryIntro('unbekannt', 'de', 'x')).toBe(false)
  })
})
