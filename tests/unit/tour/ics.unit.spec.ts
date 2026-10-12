import { describe, expect, it } from 'vitest'

import {
  ICS_CONTENT_TYPE,
  addDaysToKey,
  buildTourIcs,
  escapeIcsText,
  foldIcsLine,
  icsUtc,
  timedRange,
  tourDayKeys,
  tourIcsFileName,
  tourIcsPath,
  type TourIcsItem,
  type TourIcsOptions,
} from '@/lib/tour/ics'
import { tourRangeFromInput } from '@/lib/tour/dates'

// V-60 (U-93, P20.3): „In den Kalender“ – iCalendar (RFC 5545) eines Markttermins. Ortszeit Europe/Berlin mit
// VTIMEZONE, mehrtägig als tägliche Wiederholung, ganztägig ohne Uhrzeit; Zeitumstellung (März/Oktober) bleibt korrekt.

const SITE = 'https://planetclairetattoos.com'

/** Termin wie in der Verwaltung angelegt (ganze Berliner Tage, `tourRangeFromInput`). */
function item(over: Partial<TourIcsItem> & { from?: string; to?: string } = {}): TourIcsItem {
  const { from = '2026-10-17', to, ...rest } = over
  const range = tourRangeFromInput({ startDate: from, endDate: to })
  if ('issues' in range) throw new Error('ungültig')
  return {
    id: 12,
    name: 'Kunstmarkt am Kanal',
    place: 'Berlin-Neukölln',
    address: 'Maybachufer, am Brückenkopf',
    link: 'https://example.org/markt',
    standNumber: '14',
    timeFrom: '10:00',
    timeTo: '18:00',
    note: 'Coco ist dabei; bring Zeit mit',
    startsAt: range.startsAt.toISOString(),
    endsAt: range.endsAt.toISOString(),
    status: 'planned',
    ...rest,
  }
}

const options = (over: Partial<TourIcsOptions> = {}): TourIcsOptions => ({
  locale: 'de',
  siteUrl: SITE,
  pageUrl: `${SITE}/de#on-tour`,
  now: new Date('2026-10-12T08:30:00.000Z'),
  texts: { stand: 'Stand 14', more: `Alle Termine: ${SITE}/de#on-tour`, cancelled: 'abgesagt' },
  ...over,
})

/** Entfaltete Zeilen (RFC 5545 §3.1). */
const unfold = (ics: string) => ics.replace(/\r\n /g, '').split('\r\n')
/** Eigenschaft im VEVENT (nicht in der VTIMEZONE). */
const prop = (ics: string, name: string) => {
  const lines = unfold(ics)
  return lines
    .slice(lines.indexOf('BEGIN:VEVENT'), lines.indexOf('END:VEVENT'))
    .filter((l) => l.startsWith(`${name}:`) || l.startsWith(`${name};`))
}

describe('buildTourIcs (V-60)', () => {
  it('Grundgerüst: CRLF, VCALENDAR mit einem VEVENT, stabile UID, DTSTAMP in UTC, keine Personendaten', () => {
    const ics = buildTourIcs(item(), options())
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/\n/)
    const lines = unfold(ics)
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(lines).toContain('VERSION:2.0')
    expect(lines).toContain('PRODID:-//Planet Claire//on Tour//DE')
    expect(lines).toContain('METHOD:PUBLISH')
    expect(lines.filter((l) => l === 'BEGIN:VEVENT')).toHaveLength(1)
    expect(lines.at(-2)).toBe('END:VCALENDAR')
    expect(prop(ics, 'UID')).toEqual(['UID:tour-12@planetclairetattoos.com'])
    // gleiche UID bei erneutem Abruf (Kalender erkennt den Termin wieder)
    expect(prop(buildTourIcs(item(), options({ now: new Date() })), 'UID')).toEqual(
      prop(ics, 'UID'),
    )
    expect(prop(ics, 'DTSTAMP')).toEqual(['DTSTAMP:20261012T083000Z'])
    expect(ics).not.toMatch(/ORGANIZER|ATTENDEE|MAILTO/i)
    // keine Mail-Adresse außer der technischen UID
    expect(
      unfold(ics)
        .filter((l) => !l.startsWith('UID:'))
        .join('\n'),
    ).not.toMatch(/[\w.+-]+@[\w-]+\.\w+/)
    expect(prop(ics, 'STATUS')).toEqual(['STATUS:CONFIRMED'])
    expect(prop(ics, 'URL')).toEqual([`URL:${SITE}/de#on-tour`])
  })

  it('eintägig mit Uhrzeit: Ortszeit Europe/Berlin mit VTIMEZONE (MEZ/MESZ-Regeln)', () => {
    const ics = buildTourIcs(item(), options())
    expect(prop(ics, 'DTSTART')).toEqual(['DTSTART;TZID=Europe/Berlin:20261017T100000'])
    expect(prop(ics, 'DTEND')).toEqual(['DTEND;TZID=Europe/Berlin:20261017T180000'])
    expect(prop(ics, 'RRULE').filter((l) => l.includes('DAILY'))).toEqual([])
    const lines = unfold(ics)
    expect(lines).toContain('BEGIN:VTIMEZONE')
    expect(lines).toContain('TZID:Europe/Berlin')
    expect(lines).toContain('RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU')
    expect(lines).toContain('RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU')
    // VTIMEZONE steht vor dem VEVENT
    expect(lines.indexOf('BEGIN:VTIMEZONE')).toBeLessThan(lines.indexOf('BEGIN:VEVENT'))
  })

  it('DST Oktober: Markt Sa/So über die Zeitumstellung (25.10.2026) bleibt täglich 10–18 Uhr Ortszeit', () => {
    const it2 = item({ from: '2026-10-24', to: '2026-10-25' })
    // gespeichert: Beginn 24.10. 00:00 MESZ = 23.10. 22:00 UTC, Ende 25.10. 23:59:59 MEZ = 25.10. 22:59:59 UTC
    expect(it2.startsAt).toBe('2026-10-23T22:00:00.000Z')
    expect(it2.endsAt).toBe('2026-10-25T22:59:59.000Z')
    expect(tourDayKeys(it2)).toEqual({ first: '2026-10-24', last: '2026-10-25', days: 2 })
    const ics = buildTourIcs(it2, options())
    expect(prop(ics, 'DTSTART')).toEqual(['DTSTART;TZID=Europe/Berlin:20261024T100000'])
    expect(prop(ics, 'DTEND')).toEqual(['DTEND;TZID=Europe/Berlin:20261024T180000'])
    expect(unfold(ics)).toContain('RRULE:FREQ=DAILY;COUNT=2')
  })

  it('DST März: Markt über die Umstellung auf Sommerzeit (29.03.2026), ganztägig ohne Uhrzeit', () => {
    const it3 = item({ from: '2026-03-28', to: '2026-03-29', timeFrom: null, timeTo: null })
    expect(it3.startsAt).toBe('2026-03-27T23:00:00.000Z') // 28.03. 00:00 MEZ
    expect(it3.endsAt).toBe('2026-03-29T21:59:59.000Z') // 29.03. 23:59:59 MESZ
    const ics = buildTourIcs(it3, options())
    expect(prop(ics, 'DTSTART')).toEqual(['DTSTART;VALUE=DATE:20260328'])
    // Ende exklusiv: Tag nach dem letzten Markttag
    expect(prop(ics, 'DTEND')).toEqual(['DTEND;VALUE=DATE:20260330'])
    // ganztägig braucht keine Zeitzone
    expect(unfold(ics)).not.toContain('BEGIN:VTIMEZONE')
  })

  it('Jahreswechsel und Monatsende: ganztägig bis in den Januar', () => {
    const ics = buildTourIcs(
      item({ from: '2026-12-30', to: '2027-01-01', timeFrom: '11:00', timeTo: null }),
      options(),
    )
    expect(prop(ics, 'DTSTART')).toEqual(['DTSTART;VALUE=DATE:20261230'])
    expect(prop(ics, 'DTEND')).toEqual(['DTEND;VALUE=DATE:20270102'])
  })

  it('unvollständige oder verdrehte Uhrzeiten → ganztägig', () => {
    expect(timedRange('10:00', '18:00')).toEqual({ from: '10:00', to: '18:00' })
    expect(timedRange('10:00', null)).toBeNull()
    expect(timedRange(null, '18:00')).toBeNull()
    expect(timedRange('18:00', '10:00')).toBeNull()
    expect(timedRange('10:00', '10:00')).toBeNull()
    expect(timedRange('25:00', '26:00')).toBeNull()
  })

  it('Texte: SUMMARY mit Markt und Planet Claire, LOCATION aus Ort und Adresse, DESCRIPTION mit Uhrzeit, Stand, Notiz, Link; maskiert', () => {
    const ics = buildTourIcs(item(), options())
    expect(prop(ics, 'SUMMARY')).toEqual(['SUMMARY:Kunstmarkt am Kanal · Planet Claire'])
    expect(prop(ics, 'LOCATION')).toEqual([
      'LOCATION:Berlin-Neukölln\\, Maybachufer\\, am Brückenkopf',
    ])
    expect(prop(ics, 'DESCRIPTION')).toEqual([
      'DESCRIPTION:10–18 Uhr\\nStand 14\\nCoco ist dabei\\; bring Zeit mit\\nhttps://example.org/markt\\nAlle Termine: https://planetclairetattoos.com/de#on-tour',
    ])
    const en = buildTourIcs(
      item(),
      options({
        locale: 'en',
        pageUrl: `${SITE}/en#on-tour`,
        texts: { stand: 'Stand 14', more: `All dates: ${SITE}/en#on-tour`, cancelled: 'cancelled' },
      }),
    )
    expect(unfold(en)).toContain('PRODID:-//Planet Claire//on Tour//EN')
    expect(prop(en, 'DESCRIPTION')[0]).toMatch(/^DESCRIPTION:10:00–18:00\\n/)
  })

  it('abgesagt: STATUS:CANCELLED und Hinweis im Titel', () => {
    const ics = buildTourIcs(item({ status: 'cancelled' }), options())
    expect(prop(ics, 'STATUS')).toEqual(['STATUS:CANCELLED'])
    expect(prop(ics, 'SUMMARY')).toEqual(['SUMMARY:Kunstmarkt am Kanal (abgesagt) · Planet Claire'])
  })

  it('ohne Adresse, Stand, Notiz und Link: nur das Vorhandene', () => {
    const ics = buildTourIcs(
      item({ address: null, standNumber: null, note: null, link: null, timeFrom: null }),
      options({ texts: { stand: null, more: 'Alle Termine: x', cancelled: 'abgesagt' } }),
    )
    expect(prop(ics, 'LOCATION')).toEqual(['LOCATION:Berlin-Neukölln'])
    expect(prop(ics, 'DESCRIPTION')).toEqual(['DESCRIPTION:bis 18 Uhr\\nAlle Termine: x'])
  })
})

describe('Hilfen (RFC 5545)', () => {
  it('escapeIcsText maskiert Backslash, Semikolon, Komma und Zeilenumbrüche', () => {
    expect(escapeIcsText('a\\b;c,d\ne\r\nf')).toBe('a\\\\b\\;c\\,d\\ne\\nf')
  })

  it('foldIcsLine: höchstens 75 Oktette je Zeile, nie mitten in einem Umlaut', () => {
    const long = `DESCRIPTION:${'ä'.repeat(60)}${'x'.repeat(80)}`
    const folded = foldIcsLine(long)
    const parts = folded.split('\r\n')
    expect(parts.length).toBeGreaterThan(2)
    for (const [i, part] of parts.entries()) {
      expect(new TextEncoder().encode(part).length, `Zeile ${i}`).toBeLessThanOrEqual(75)
      if (i > 0) expect(part.startsWith(' ')).toBe(true)
    }
    expect(folded.replace(/\r\n /g, '')).toBe(long)
    expect(folded).not.toContain('�')
    expect(foldIcsLine('SUMMARY:kurz')).toBe('SUMMARY:kurz')
  })

  it('icsUtc, addDaysToKey', () => {
    expect(icsUtc(new Date('2026-10-12T08:30:05.123Z'))).toBe('20261012T083005Z')
    expect(addDaysToKey('2026-02-28', 1)).toBe('2026-03-01')
    expect(addDaysToKey('2028-02-28', 1)).toBe('2028-02-29')
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('Pfad, Dateiname und Inhaltstyp', () => {
    expect(tourIcsPath(12, 'en')).toBe('/api/public/tour-dates/12.ics?locale=en')
    expect(tourIcsFileName(item({ from: '2026-10-24', to: '2026-10-25' }))).toBe(
      'planet-claire-on-tour-2026-10-24.ics',
    )
    expect(ICS_CONTENT_TYPE).toBe('text/calendar; charset=utf-8')
  })
})
