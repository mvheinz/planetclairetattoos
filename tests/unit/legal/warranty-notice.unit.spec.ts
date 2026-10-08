import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import {
  WARRANTY_NOTICE_GRAPHIC,
  WARRANTY_NOTICE_TEXT_ORIGIN,
  warrantyNoticeIsPlaceholder,
} from '@/lib/legal/warranty'

import { FORBIDDEN_CONTENT_PATTERNS } from '../../helpers/forbiddenPatterns'

// P13.6 (U-45, R-049): Die harmonisierte Mitteilung zur gesetzlichen Gewährleistung ist nie leer – Text DE/EN nach
// Anhang I der DVO (EU) 2025/1960 (Mindestdauer zwei Jahre, Rechte gegenüber dem Verkäufer, längere nationale Fristen,
// gebrauchte Waren), Grafik je Sprache mit denselben Kernaussagen, bis zur Kanzlei-Prüfung als Platzhalter-Fassung
// gekennzeichnet (Gate R-210).

const KEYS = ['title', 'alt', 'lead', 'rights', 'duration', 'placeholderNote', 'link'] as const
const V19 = FORBIDDEN_CONTENT_PATTERNS.filter((p) => p.id === 'V-19')

describe('U-45 harmonisierte Mitteilung', () => {
  it.each([
    ['de', de.shop.warranty, /mindestens zwei Jahre/i, /Verkäufer/, /Platzhalter-Fassung/],
    ['en', en.shop.warranty, /at least two years/i, /seller/, /Placeholder version/],
  ] as const)('Text %s vollständig und nicht leer', (_locale, w, years, seller, note) => {
    for (const k of KEYS)
      expect((w as Record<string, string>)[k]?.trim().length, k).toBeGreaterThan(10)
    expect(w.lead).toMatch(years)
    expect(w.rights).toMatch(seller)
    expect(w.duration).toMatch(/ein Jahr|one year/)
    expect(w.placeholderNote).toMatch(note)
    expect(w.placeholderNote).toContain('2025/1960')
    const all = KEYS.map((k) => (w as Record<string, string>)[k]).join('\n')
    for (const p of V19) expect(all).not.toMatch(p.re)
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
  })
})
