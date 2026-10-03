import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { containsStreet } from '@/collections/TattooOffers'
import { offerInputFromTimes, offerTimesFromInput } from '@/lib/tattoo/offers'

import { resetAdmin } from '../helpers/admin'
import { withBusiness } from '../helpers/invoices'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P7.7 – Tattoo-Verwaltung Angebote (KONZEPT §7.12, DATENMODELL §6.15): Formularwerte → `startsAt`/`endsAt` in
// Europe/Berlin (mit Uhrzeit; ohne Uhrzeit 00:00 bis 23:59:59 am Enddatum), Ort-Text ohne Straße aus den Stammdaten
// (E-50), Übersetzen über `POST /api/tattoo-offers/:id/translate` (Mock „[EN] …“).

const TAG = 'p7-offers-admin'
let payload: Payload
let token: string
let restoreBusiness: () => Promise<void>

const times = (input: Parameters<typeof offerTimesFromInput>[0]) => {
  const r = offerTimesFromInput(input)
  if ('issues' in r) throw new Error(r.issues.map((i) => i.message).join(' '))
  return r
}

beforeAll(async () => {
  payload = await getTestPayload()
  ;({ token } = await resetAdmin(payload))
  restoreBusiness = await withBusiness(payload, { street: 'Werkstattweg 7' })
})

afterAll(async () => {
  await payload.delete({
    collection: 'tattoo-offers',
    where: { priceNote: { equals: TAG } },
    overrideAccess: true,
    context: { seed: true },
  })
  await restoreBusiness()
})

describe('Tattoo-Verwaltung: Angebote (P7.7)', () => {
  it('AK „Sa 12.12.2026, 12–19 Uhr“ → startsAt 11:00 UTC, endsAt 18:00 UTC; ohne Uhrzeit Ende 23:59:59 Berlin', async () => {
    const day = times({ startDate: '2026-12-12', startTime: '12:00', endTime: '19:00' })
    expect(day.startsAt.toISOString()).toBe('2026-12-12T11:00:00.000Z')
    expect(day.endsAt.toISOString()).toBe('2026-12-12T18:00:00.000Z')

    const allDay = times({ startDate: '2026-12-12', endDate: '2026-12-13' })
    expect(allDay.startsAt.toISOString()).toBe('2026-12-11T23:00:00.000Z')
    expect(allDay.endsAt.toISOString()).toBe('2026-12-13T22:59:59.000Z')
    // Sommerzeit: 23:59:59 MESZ = 21:59:59 UTC
    expect(times({ startDate: '2027-07-03' }).endsAt.toISOString()).toBe('2027-07-03T21:59:59.000Z')

    // Umkehrung fürs Bearbeiten
    expect(offerInputFromTimes(day)).toEqual({
      startDate: '2026-12-12',
      endDate: '2026-12-12',
      startTime: '12:00',
      endTime: '19:00',
    })
    expect(offerInputFromTimes(allDay)).toMatchObject({ startTime: '', endTime: '' })

    // Fehler je Feld
    const bad = offerTimesFromInput({
      startDate: '2026-12-12',
      startTime: '19:00',
      endTime: '12:00',
    })
    expect('issues' in bad && bad.issues[0]!.path).toBe('endTime')
    const before = offerTimesFromInput({ startDate: '2026-12-12', endDate: '2026-12-10' })
    expect('issues' in before && before.issues[0]!.path).toBe('endDate')

    // So gespeichert (REST wie das Formular)
    const res = await rest(
      'POST',
      '/tattoo-offers?locale=de&depth=0',
      {
        type: 'flash_day',
        title: 'Flash-Day im Dezember',
        description: 'Alle Motive aus dem Flash-Ordner, ohne Termin vorbei kommen.',
        startsAt: day.startsAt.toISOString(),
        endsAt: day.endsAt.toISOString(),
        priceNote: TAG,
        published: false,
      },
      { authorization: `JWT ${token}` },
    )
    expect(res.status).toBe(201)
    const doc = ((await res.json()) as { doc: { startsAt: string; endsAt: string } }).doc
    expect(doc.startsAt).toBe('2026-12-12T11:00:00.000Z')
    expect(doc.endsAt).toBe('2026-12-12T18:00:00.000Z')
  })

  it('AK Ort-Text mit der Straße aus den Stammdaten wird abgelehnt (E-50)', async () => {
    expect(containsStreet('Treffpunkt Werkstattweg, Hinterhof', 'Werkstattweg 7')).toBe(true)
    expect(containsStreet('Privatstudio in Kreuzberg', 'Werkstattweg 7')).toBe(false)
    expect(containsStreet('Musterstr. Ecke Park', 'Musterstraße 12a')).toBe(true)
    const base = {
      type: 'aktion',
      title: 'Kleine Aktion',
      description: 'Kleine Motive zum festen Preis an einem Nachmittag.',
      startsAt: '2026-12-19T13:00:00.000Z',
      priceNote: TAG,
      published: false,
    }
    const rejected = await rest(
      'POST',
      '/tattoo-offers?locale=de&depth=0',
      { ...base, locationNote: 'Treffpunkt Werkstattweg, Hinterhof' },
      { authorization: `JWT ${token}` },
    )
    expect(rejected.status).toBe(400)
    expect(JSON.stringify(await rejected.json())).toContain('keine Adresse')
    const ok = await rest(
      'POST',
      '/tattoo-offers?locale=de&depth=0',
      { ...base, locationNote: 'Privatstudio in Kreuzberg' },
      { authorization: `JWT ${token}` },
    )
    expect(ok.status).toBe(201)
    const id = ((await ok.json()) as { doc: { id: number } }).doc.id

    // „Übersetzen“: alle Textfelder EN (Mock)
    const tr = await rest(
      'POST',
      `/tattoo-offers/${id}/translate`,
      {},
      { authorization: `JWT ${token}` },
    )
    expect(tr.status).toBe(200)
    const en = (await tr.json()) as { doc: Record<string, string> }
    expect(en.doc.title).toBe('[EN] Kleine Aktion')
    expect(en.doc.description).toMatch(/^\[EN\] /)
    expect(en.doc.locationNote).toBe('[EN] Privatstudio in Kreuzberg')
  })
})
