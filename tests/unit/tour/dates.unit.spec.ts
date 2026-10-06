import { describe, expect, it } from 'vitest'

import { containsStreet, parseTourLink } from '@/lib/tour/address'
import {
  isTourOver,
  normalizeTourRange,
  splitTourDates,
  tourDateIso,
  tourDateText,
  tourHoursText,
  tourInputFromRange,
  tourRangeFromInput,
  tourState,
} from '@/lib/tour/dates'

// P12.8 (U-20): reine Bausteine von „Planet Claire on Tour“ – Zeitraum auf ganze Berliner Tage, Zustand nach Datum,
// Aufteilung kommend/vergangen, Datums- und Uhrzeit-Texte DE/EN, Adress-Schutz (E-50), Link-Prüfung.

const range = (s: string, e: string) =>
  tourRangeFromInput({ startDate: s, endDate: e }) as {
    startsAt: Date
    endsAt: Date
  }

describe('Zeitraum (Europe/Berlin)', () => {
  it('P12.8 eintägig: Beginn 00:00 Berlin, Ende 23:59:59 am selben Tag (Sommerzeit UTC+2)', () => {
    const r = range('2026-10-10', '')
    expect(r.startsAt.toISOString()).toBe('2026-10-09T22:00:00.000Z')
    expect(r.endsAt.toISOString()).toBe('2026-10-10T21:59:59.000Z')
  })

  it('P12.8 mehrtägig über die Zeitumstellung hinweg; Umkehrung liefert dieselben Kalendertage', () => {
    const r = range('2026-10-24', '2026-10-26')
    expect(r.startsAt.toISOString()).toBe('2026-10-23T22:00:00.000Z')
    expect(r.endsAt.toISOString()).toBe('2026-10-26T22:59:59.000Z')
    expect(tourInputFromRange(r)).toEqual({ startDate: '2026-10-24', endDate: '2026-10-26' })
  })

  it('P12.8 Fehler: kein Startdatum, Enddatum vor Beginn', () => {
    expect('issues' in tourRangeFromInput({ startDate: '' })).toBe(true)
    const bad = tourRangeFromInput({ startDate: '2026-10-10', endDate: '2026-10-09' })
    expect('issues' in bad && bad.issues[0]!.path).toBe('endDate')
  })

  it('P12.8 normalizeTourRange legt beliebige Zeitpunkte auf ganze Berliner Tage', () => {
    const n = normalizeTourRange('2026-10-10T13:30:00.000Z', '2026-10-11T08:00:00.000Z')
    expect(n.startsAt.toISOString()).toBe('2026-10-09T22:00:00.000Z')
    expect(n.endsAt.toISOString()).toBe('2026-10-11T21:59:59.000Z')
    expect(normalizeTourRange('2026-10-10T13:30:00.000Z').endsAt.toISOString()).toBe(
      '2026-10-10T21:59:59.000Z',
    )
  })
})

describe('Zustand und Aufteilung', () => {
  const day = range('2026-10-20', '2026-10-21')
  const item = { ...day, status: 'planned' as const }

  it('P12.8 kommt · läuft · vorbei folgt dem Datum; abgesagt bleibt abgesagt; „vorbei“ von Hand', () => {
    expect(tourState(item, new Date('2026-10-19T12:00:00Z'))).toBe('upcoming')
    expect(tourState(item, new Date('2026-10-20T12:00:00Z'))).toBe('running')
    expect(tourState(item, new Date('2026-10-21T21:59:58Z'))).toBe('running')
    expect(tourState(item, new Date('2026-10-21T21:59:59Z'))).toBe('past')
    expect(tourState({ ...item, status: 'cancelled' }, new Date('2026-12-01T00:00:00Z'))).toBe(
      'cancelled',
    )
    expect(tourState({ ...item, status: 'past' }, new Date('2026-10-01T00:00:00Z'))).toBe('past')
    expect(isTourOver({ ...item, status: 'past' }, new Date('2026-10-01T00:00:00Z'))).toBe(true)
  })

  it('P12.8 kommende nach Beginn aufsteigend (abgesagte noch nicht vergangene mittendrin), vergangene absteigend und begrenzt', () => {
    const mk = (id: number, s: string, e: string, status: 'planned' | 'cancelled' | 'past') => ({
      id,
      ...range(s, e),
      status,
    })
    const items = [
      mk(1, '2026-11-20', '2026-11-20', 'planned'),
      mk(2, '2026-10-05', '2026-10-05', 'planned'),
      mk(3, '2026-10-25', '2026-10-25', 'cancelled'),
      mk(4, '2026-09-01', '2026-09-01', 'cancelled'),
      mk(5, '2026-10-30', '2026-10-30', 'past'),
      mk(6, '2026-10-12', '2026-10-14', 'planned'),
    ]
    const now = new Date('2026-10-13T10:00:00Z')
    const { upcoming, past } = splitTourDates(items, now)
    expect(upcoming.map((i) => i.id)).toEqual([6, 3, 1])
    expect(past.map((i) => i.id)).toEqual([5, 2, 4])
    expect(splitTourDates(items, now, 1).past.map((i) => i.id)).toEqual([5])
  })
})

describe('Texte', () => {
  it('P12.8 Datum DE/EN: eintägig, mehrtägig, über Monatsgrenze, ISO', () => {
    const one = range('2026-10-10', '')
    expect(tourDateText(one, 'de')).toBe('Sa 10.10.2026')
    expect(tourDateText(one, 'en')).toBe('Sat 10 Oct 2026')
    const multi = range('2026-10-12', '2026-10-13')
    expect(tourDateText(multi, 'de')).toBe('12.–13.10.2026')
    expect(tourDateText(multi, 'en')).toBe('12–13 Oct 2026')
    const months = range('2026-10-30', '2026-11-02')
    expect(tourDateText(months, 'de')).toBe('30.10.–02.11.2026')
    expect(tourDateText(months, 'en')).toBe('30 Oct–2 Nov 2026')
    expect(tourDateIso(one)).toBe('2026-10-10')
    expect(tourDateIso(multi)).toBe('2026-10-12/2026-10-13')
  })

  it('P12.8 Uhrzeiten DE/EN', () => {
    expect(tourHoursText('10:00', '18:00', 'de')).toBe('10–18 Uhr')
    expect(tourHoursText('10:30', '18:00', 'de')).toBe('10:30–18:00 Uhr')
    expect(tourHoursText('10:00', null, 'de')).toBe('ab 10 Uhr')
    expect(tourHoursText('10:00', '18:00', 'en')).toBe('10:00–18:00')
    expect(tourHoursText(null, '18:00', 'en')).toBe('until 18:00')
    expect(tourHoursText(null, null, 'de')).toBeNull()
  })
})

describe('Adresse und Link', () => {
  it('P12.8 E-50: die Straße des Privatstudios erscheint nie (ß/ss, Kürzel, ohne Hausnummer)', () => {
    expect(containsStreet('Hof der Bäckerei, Beispielweg 3', 'Musterstraße 12')).toBe(false)
    expect(containsStreet('Am Musterstrasse 5, 10115 Berlin', 'Musterstraße 12')).toBe(true)
    expect(containsStreet('Musterstr. 7', 'Musterstraße 12')).toBe(true)
    expect(containsStreet('Musterstraße', 'Musterstraße 12')).toBe(true)
    expect(containsStreet('irgendwo', null)).toBe(false)
  })

  it('P12.8 nur ein Textlink: https/http, mit Punkt im Host, ohne Zugangsdaten und Leerzeichen', () => {
    expect(parseTourLink('https://www.beispiel.de/markt')).toBe('https://www.beispiel.de/markt')
    expect(parseTourLink('www.beispiel.de')).toBe('https://www.beispiel.de/')
    expect(parseTourLink('javascript:alert(1)')).toBeNull()
    expect(parseTourLink('https://user:pw@beispiel.de')).toBeNull()
    expect(parseTourLink('https://beispiel')).toBeNull()
    expect(parseTourLink('https://bei spiel.de')).toBeNull()
    expect(parseTourLink('')).toBeNull()
  })
})
