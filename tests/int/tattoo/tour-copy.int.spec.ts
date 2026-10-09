import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { shiftDateKey } from '@/lib/tour/copy'
import { tourInputFromRange } from '@/lib/tour/dates'

import { resetAdmin } from '../helpers/admin'
import { getTestPayload } from '../helpers/payload'
import { createTestImage } from '../helpers/products'
import { rest } from '../helpers/rest'

// U-60 (P14.11): „Termin kopieren“ – `POST /api/tour-dates/:id/copy` (nur Verwaltung): neuer Termin mit Name, Ort,
// Notiz (DE/EN), Adresse, Link und Uhrzeiten, eine Woche später (ganze Berliner Tage, auch über die Zeitumstellung),
// Status „geplant“, offline; Standnummer und Foto bleiben beim Original.

let payload: Payload
let token: string
let image: number

const post = (id: number, auth = true) =>
  rest('POST', `/tour-dates/${id}/copy`, {}, auth ? { authorization: `JWT ${token}` } : {})
const read = (id: number, locale: 'de' | 'en' = 'de') =>
  payload.findByID({
    collection: 'tour-dates',
    id,
    locale,
    fallbackLocale: false,
    depth: 0,
    overrideAccess: true,
  })

async function cleanup() {
  await payload.delete({
    collection: 'tour-dates',
    where: { id: { exists: true } },
    overrideAccess: true,
    context: { seed: true },
  })
}

beforeAll(async () => {
  payload = await getTestPayload()
  await cleanup()
  token = (await resetAdmin(payload, '198.51.100.62')).token
  image = await createTestImage(payload, 'Stand mit Zeichnungen')
})

afterAll(async () => {
  await cleanup()
  await payload.delete({ collection: 'media', id: image, overrideAccess: true }).catch(() => null)
})

describe('Termin kopieren (U-60)', () => {
  it('shiftDateKey verschiebt reine Kalendertage (Monats-/Jahreswechsel)', () => {
    expect(shiftDateKey('2026-10-24', 7)).toBe('2026-10-31')
    expect(shiftDateKey('2026-12-28', 7)).toBe('2027-01-04')
    expect(shiftDateKey('2028-02-25', 7)).toBe('2028-03-03')
  })

  it('Kopie: +7 Tage über die Zeitumstellung, Texte DE/EN, offline, geplant, ohne Stand/Foto', async () => {
    const src = await payload.create({
      collection: 'tour-dates',
      locale: 'de',
      data: {
        name: 'Kunstmarkt am Kanal (Test)',
        place: 'Berlin-Neukölln',
        note: 'Coco ist dabei.',
        address: 'Maybachufer, Höhe Brücke',
        link: 'www.beispiel.de',
        timeFrom: '11:00',
        timeTo: '17:00',
        standNumber: 'C7',
        image,
        // Sa 24.10. – So 25.10.2026 (Zeitumstellung in der Nacht zum 25.10.)
        startsAt: '2026-10-24T08:00:00.000Z',
        endsAt: '2026-10-25T08:00:00.000Z',
        status: 'cancelled',
        published: true,
      } as never,
      overrideAccess: true,
    })
    await payload.update({
      collection: 'tour-dates',
      id: src.id,
      locale: 'en',
      data: {
        name: 'Canal art market (test)',
        place: 'Berlin-Neukölln',
        note: 'Coco is coming along.',
      } as never,
      overrideAccess: true,
    })

    const res = await post(src.id)
    expect(res.status).toBe(200)
    const { doc } = (await res.json()) as { doc: { id: number; published: boolean } }
    expect(doc.id).not.toBe(src.id)
    expect(doc.published).toBe(false)

    const de = await read(doc.id)
    expect(de).toMatchObject({
      name: 'Kunstmarkt am Kanal (Test)',
      place: 'Berlin-Neukölln',
      note: 'Coco ist dabei.',
      address: 'Maybachufer, Höhe Brücke',
      timeFrom: '11:00',
      timeTo: '17:00',
      status: 'planned',
      published: false,
    })
    expect(de.link).toBe((await read(src.id)).link)
    expect(de.standNumber ?? null).toBeNull()
    expect(de.image ?? null).toBeNull()
    expect(tourInputFromRange({ startsAt: de.startsAt, endsAt: de.endsAt! })).toEqual({
      startDate: '2026-10-31',
      endDate: '2026-11-01',
    })
    // ganze Berliner Tage (Winterzeit: Beginn 23:00 UTC am Vortag)
    expect(de.startsAt).toBe('2026-10-30T23:00:00.000Z')
    expect(de.endsAt).toBe('2026-11-01T22:59:59.000Z')

    const en = await read(doc.id, 'en')
    expect(en).toMatchObject({ name: 'Canal art market (test)', note: 'Coco is coming along.' })
    // Original unverändert
    expect((await read(src.id)).status).toBe('cancelled')
  })

  it('nur Verwaltung: ohne Anmeldung 403; unbekannter Termin 404', async () => {
    const src = await payload.create({
      collection: 'tour-dates',
      data: {
        name: 'Hofflohmarkt (Test)',
        place: 'Berlin-Wedding',
        startsAt: '2026-11-07T09:00:00.000Z',
      } as never,
      overrideAccess: true,
    })
    expect((await post(src.id, false)).status).toBe(403)
    expect((await post(999_999_999)).status).toBe(404)
  })
})
