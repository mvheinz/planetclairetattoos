import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import {
  WARRANTY_NOTICE_BLOCKS,
  WARRANTY_NOTICE_GRAPHIC,
  WARRANTY_NOTICE_TEXT_ORIGIN,
  warrantyNoticeIsPlaceholder,
  warrantyNoticePlaceholderParts,
} from '@/lib/legal/warranty'

import { FORBIDDEN_CONTENT_PATTERNS } from '../../helpers/forbiddenPatterns'

// P13.6 (U-45, R-049): Die harmonisierte Mitteilung zur gesetzlichen Gewährleistung ist nie leer – Text DE/EN nach
// Anhang I der DVO (EU) 2025/1960 (Mindestdauer zwei Jahre, Rechte gegenüber dem Verkäufer, längere nationale Fristen,
// gebrauchte Waren), Grafik je Sprache mit denselben Kernaussagen, bis zur Kanzlei-Prüfung als Platzhalter-Fassung
// gekennzeichnet (Gate R-210).

const KEYS = ['title', 'alt', 'placeholderNote', 'link'] as const
type WarrantyMessages = (typeof de)['shop']['warranty']
const blockText = (w: WarrantyMessages, key: string) =>
  (w.blocks as Record<string, string | undefined>)[key] ?? ''
const V19 = FORBIDDEN_CONTENT_PATTERNS.filter((p) => p.id === 'V-19')

describe('U-45 harmonisierte Mitteilung', () => {
  it.each([
    ['de', de.shop.warranty, /mindestens zwei Jahre/i, /Verkäufer/, /Platzhalter-Fassung/],
    ['en', en.shop.warranty, /at least two years/i, /seller/, /Placeholder version/],
  ] as const)('Text %s vollständig und nicht leer', (_locale, w, years, seller, note) => {
    for (const k of KEYS)
      expect((w as Record<string, unknown>)[k]?.toString().trim().length, k).toBeGreaterThan(10)
    for (const b of WARRANTY_NOTICE_BLOCKS)
      expect(blockText(w, b.key).trim().length, b.key).toBeGreaterThan(10)
    expect(blockText(w, 'lead')).toMatch(years)
    expect(blockText(w, 'rights')).toMatch(seller)
    expect(blockText(w, 'secondHand')).toMatch(/ein Jahr|one year/)
    expect(w.placeholderNote).toMatch(note)
    expect(w.placeholderNote).toContain('2025/1960')
    const all = [
      ...KEYS.map((k) => (w as Record<string, unknown>)[k]),
      ...WARRANTY_NOTICE_BLOCKS.map((b) => blockText(w, b.key)),
    ].join('\n')
    for (const p of V19) expect(all).not.toMatch(p.re)
  })

  it('U-59 Bausteine: eindeutig, genau ein hervorgehobener, DE und EN mit denselben Schlüsseln, keine verwaisten', () => {
    const keys = WARRANTY_NOTICE_BLOCKS.map((b) => b.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(WARRANTY_NOTICE_BLOCKS.filter((b) => b.lead)).toHaveLength(1)
    expect(WARRANTY_NOTICE_BLOCKS[0]?.lead).toBe(true)
    expect(Object.keys(de.shop.warranty.blocks).sort()).toEqual([...keys].sort())
    expect(Object.keys(en.shop.warranty.blocks).sort()).toEqual([...keys].sort())
  })

  it('Grafiken DE/EN tragen die Kernaussagen und sind als Platzhalter-Fassung markiert', () => {
    const svg = (locale: 'de' | 'en') =>
      readFileSync(path.join(process.cwd(), 'public', WARRANTY_NOTICE_GRAPHIC[locale].src), 'utf8')
    expect(svg('de')).toContain('GESETZLICHE GEWÄHRLEISTUNG')
    expect(svg('de')).toContain('2 JAHRE')
    expect(svg('de')).toContain('Platzhalter-Fassung')
    expect(svg('en')).toContain('LEGAL GUARANTEE')
    expect(svg('en')).toContain('2 YEARS')
    expect(svg('en')).toContain('Placeholder version')
    for (const locale of ['de', 'en'] as const)
      expect(svg(locale)).toContain(`height="${WARRANTY_NOTICE_GRAPHIC[locale].height}"`)
  })

  it('Platzhalter bis zur Kanzlei-Prüfung (R-002-Logik, Gate R-210)', () => {
    expect(WARRANTY_NOTICE_TEXT_ORIGIN).toBe('placeholder')
    expect(warrantyNoticeIsPlaceholder()).toBe(true)
    // U-59: Die Teile werden einzeln gemeldet (Startklar-Check); solange die amtliche Fassung fehlt, alle drei.
    expect(warrantyNoticePlaceholderParts()).toEqual(['graphic-de', 'graphic-en', 'text'])
  })

  it('U-59 Grafik-Platz: Datei vom eigenen Origin, Maße gesetzt, Platzhalter-Kennzeichen je Sprache', () => {
    for (const locale of ['de', 'en'] as const) {
      const g = WARRANTY_NOTICE_GRAPHIC[locale]
      expect(g.src).toMatch(/^\/legal\/[a-z0-9-]+\.(svg|png|webp)$/)
      expect(g.width).toBeGreaterThan(0)
      expect(g.height).toBeGreaterThan(0)
      expect(typeof g.placeholder).toBe('boolean')
    }
  })

  it('U-59 Komponente rendert die Bausteine aus der Liste und kennzeichnet die Grafik', () => {
    const src = readFileSync(
      path.join(process.cwd(), 'src/components/shop/WarrantyNotice.tsx'),
      'utf8',
    )
    expect(src).toContain('WARRANTY_NOTICE_BLOCKS.map')
    expect(src).toContain('data-warranty-graphic')
    expect(src).toContain("alt={t('alt')}")
  })
})
