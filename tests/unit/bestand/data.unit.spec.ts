import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import {
  BESTAND_DIR,
  BESTAND_PHOTO_DIR,
  loadBestand,
  photosOf,
  type BestandProduct,
} from '@/lib/bestand/schema'
import { lintProductText } from '@/lib/legal/forbidden'

import { FORBIDDEN_CONTENT_PATTERNS } from '../../helpers/forbiddenPatterns'

// P16.1 (U-76, U-77): Echter Bestand aus Juttas Fotos – Datei gültig, jedes Foto genau einmal, Nummern eindeutig,
// Fotos ohne Metadaten (EXIF/GPS), keine Schriftzug-Zitate und keine Bezüge zu fremden Werken.

const root = process.cwd()
const photoDir = path.join(root, BESTAND_DIR, BESTAND_PHOTO_DIR)

/** Texte, die öffentlich erscheinen (Shop, Alt-Texte), je Stück. */
function publicTexts(p: BestandProduct): string[] {
  const l = (v: { de: string; en: string } | undefined) => (v ? [v.de, v.en] : [])
  return [
    ...l(p.title),
    ...l(p.description),
    ...l(p.materials),
    ...l(p.dimensions.note),
    ...l(p.sizeLabel),
    ...l(p.careInstructions),
    ...l(p.deviationDescription),
    ...photosOf(p).flatMap((i) => l(i.alt)),
  ]
}

/**
 * U-77: Wörter, die auf zitierte Schriftzüge oder fremde Werke hindeuten (Lieder, Bands, Filme, Bücher, Zitate) –
 * in allen Texten einschließlich der Prüfpunkte. „Band“ fehlt bewusst: es heißt hier Kettenband.
 */
const THIRD_PARTY_WORK =
  /(?<!\p{L})(songs?|lieds?|lieder|liedtext\p{L}*|songtext\p{L}*|lyrics?|album|alben|refrain|strophe|chorus|film|films|movie|kinofilm|serie|roman|novel|zitat\p{L}*|zitiert|quote[sd]?|quoting|singer|sänger\p{L}*|musiker\p{L}*|musician|lautet|reads|says|spells?|buchstabiert)(?!\p{L})/iu

/** Bezeichnungen aus der Verwaltung, die in Prüfpunkten in Anführungszeichen stehen dürfen. */
const REVIEW_QUOTES = new Set([
  'Ablage',
  'Ablage für Schmuck/Kleinkram',
  'Abweichung geprüft',
  'Cap',
  'Deko – nicht für Lebensmittel',
  'Deko',
  'Dekoobjekt, kein Spielzeug',
  'Falter',
  'butterfly',
  'Foto zum Größenvergleich',
  'Geprüft: keine Abweichung',
  'Glasur bleifrei',
  'Glasur innen',
  'Kette nicht dabei',
  'gut',
  'keine Abweichung',
  'lebensmittelecht',
  'nicht für Lebensmittel',
  'nur Deko',
  'nur eigene Figuren',
  'sehr gut',
  'von Hand reinigen',
  'von Hand spülen',
])

/** Zitate in doppelten Anführungszeichen oder deutschen einfachen (‚…‘); ’ ist im Englischen ein Apostroph. */
const QUOTED = /[„“"]([^„“”"]{1,80})[“”"]|‚([^‚‘]{1,80})‘/gu
const quotes = (t: string) => [...t.matchAll(QUOTED)].map((m) => m[1] ?? m[2]!)

describe('Echter Bestand (content/bestand, P16.1)', async () => {
  const products = await loadBestand(root)

  it('74 Stücke B001–B074 mit den Nummern 101–174 (zod-Schema, eindeutig)', () => {
    expect(products.map((p) => p.key)).toEqual(
      Array.from({ length: 74 }, (_, i) => `B${String(i + 1).padStart(3, '0')}`),
    )
    expect(products.map((p) => p.itemNumber)).toEqual(Array.from({ length: 74 }, (_, i) => 101 + i))
  })

  it('jedes Foto im Ordner gehört zu genau einem Stück, und jedes Stück hat seine Fotos', async () => {
    const files = (await readdir(photoDir)).filter((f) => !f.startsWith('.')).sort()
    const used = products.flatMap((p) => photosOf(p).map((i) => i.file)).sort()
    expect(new Set(used).size).toBe(used.length)
    expect(used).toEqual(files)
    expect(files).toHaveLength(186)
  })

  it('Fotos: JPEG, längste Kante ≤ 1600 px, ohne EXIF/GPS/XMP/IPTC', async () => {
    for (const p of products) {
      for (const { file } of photosOf(p)) {
        const meta = await sharp(await readFile(path.join(photoDir, file))).metadata()
        expect(meta.format, file).toBe('jpeg')
        expect(Math.max(meta.width ?? 0, meta.height ?? 0), file).toBeLessThanOrEqual(1600)
        expect(Math.max(meta.width ?? 0, meta.height ?? 0), file).toBeGreaterThanOrEqual(1000)
        expect(meta.exif, file).toBeUndefined()
        expect(meta.xmp, file).toBeUndefined()
        expect(meta.iptc, file).toBeUndefined()
        expect(meta.orientation ?? 1, file).toBe(1)
      }
    }
  })

  it('Titel: „<Gegenstand> „<Name>““ in beiden Sprachen', () => {
    for (const p of products) {
      expect(p.title.de, p.key).toMatch(/^[\p{L}-]+(?: [\p{L}-]+)? „[^„“]+“$/u)
      expect(p.title.en, p.key).toMatch(/^[\p{L}-]+(?: [\p{L}’-]+)* “[^“”]+”$/u)
    }
  })

  it('U-77: öffentliche Texte zitieren nichts – keine Anführungszeichen außer dem eigenen Namen', () => {
    for (const p of products) {
      const name = {
        de: /„([^„“]+)“/u.exec(p.title.de)![1],
        en: /“([^“”]+)”/u.exec(p.title.en)![1],
      }
      for (const t of publicTexts(p)) {
        const quoted = quotes(t)
        expect(
          quoted.filter((q) => q !== name.de && q !== name.en),
          `${p.key}: ${t}`,
        ).toEqual([])
      }
    }
  })

  it('U-77: Prüfpunkte zitieren nur Bezeichnungen aus der Verwaltung', () => {
    for (const p of products)
      for (const r of p.review)
        for (const q of quotes(r)) expect(REVIEW_QUOTES.has(q), `${p.key}: ${r}`).toBe(true)
  })

  it('U-77: keine Lieder, Bands, Filme, Zitate oder gelesenen Schriftzüge – in keinem Text', () => {
    for (const p of products)
      for (const t of [...publicTexts(p), ...p.review])
        expect(THIRD_PARTY_WORK.exec(t)?.[0], `${p.key}: ${t}`).toBeUndefined()
  })

  it('Rechts-Lint: keine unbelegten Aussagen (V-13), keine fremden Marken/Figuren (V-16), Verbotsliste', async () => {
    for (const p of products)
      for (const t of publicTexts(p)) expect(lintProductText(t), `${p.key}: ${t}`).toEqual([])
    const raw = await readFile(path.join(root, BESTAND_DIR, 'products.json'), 'utf8')
    for (const { id, re } of FORBIDDEN_CONTENT_PATTERNS)
      expect(re.exec(raw)?.[0], id).toBeUndefined()
  })

  it('Keramik ist „Deko“, Schmuck mit Kleinteile-Hinweis; jede Kategorie mit Prüfpunkt „nur eigene Figuren“', () => {
    for (const p of products) {
      if (p.category === 'keramik') expect(p.foodContact, p.key).toBe('deko')
      if (p.category === 'schmuck') expect(p.smallPartsWarning, p.key).toBe(true)
      expect(
        p.review.some((r) => r.includes('„nur eigene Figuren“')),
        p.key,
      ).toBe(true)
    }
  })
})
