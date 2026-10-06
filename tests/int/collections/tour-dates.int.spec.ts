import type { Payload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { resetEnvCache } from '@/lib/env'
import { loadTourDates } from '@/lib/data/tour'
import { splitTourDates } from '@/lib/tour/dates'

import { getTestPayload } from '../helpers/payload'
import { createTestImage } from '../helpers/products'
import { rest } from '../helpers/rest'

// P12.8 (U-20, DATENMODELL §6.30): `tour-dates` – Zugriff (öffentlich nur veröffentlichte, Seed-Filter, Schreiben nur
// Admin), Hook (ganze Berliner Tage, Adresse nie die des Privatstudios, Textlink), Lokalisierung DE/EN, öffentlicher
// Loader (Reihenfolge, vergangene/abgesagte, keine unveröffentlichten).

let payload: Payload
let image: number

type Err = { message?: string; data?: { errors?: { message: string }[] } }
async function rejects(promise: Promise<unknown>, re: RegExp): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e as Err,
  )
  expect(err, `erwartet Ablehnung mit ${re}`).not.toBeNull()
  const text = [err!.message ?? '', ...(err!.data?.errors ?? []).map((x) => x.message)].join(' | ')
  expect(text).toMatch(re)
}

const create = (
  data: Record<string, unknown>,
  locale: 'de' | 'en' = 'de',
  context: Record<string, unknown> = {},
) =>
  payload.create({
    collection: 'tour-dates',
    data: {
      name: 'Hinterhof-Flohmarkt (Test)',
      place: 'Berlin-Wedding',
      startsAt: '2026-10-10T08:00:00.000Z',
      ...data,
    } as never,
    locale,
    overrideAccess: true,
    context,
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
  image = await createTestImage(payload, 'Stand mit Zeichnungen')
})

afterEach(() => {
  vi.unstubAllEnvs()
  resetEnvCache()
})

afterAll(async () => {
  await cleanup()
  await payload.delete({ collection: 'media', id: image, overrideAccess: true }).catch(() => null)
})

describe('tour-dates (DATENMODELL §6.30)', () => {
  it('DM-TOUR-01 Zeitraum wird auf ganze Berliner Tage gelegt; Enddatum leer = eintägig; Enddatum vor Beginn abgelehnt', async () => {
    const one = await create({ startsAt: '2026-10-10T13:30:00.000Z' })
    expect(one.startsAt).toBe('2026-10-09T22:00:00.000Z')
    expect(one.endsAt).toBe('2026-10-10T21:59:59.000Z')
    const multi = await create({
      startsAt: '2026-10-24T10:00:00.000Z',
      endsAt: '2026-10-26T07:00:00.000Z',
    })
    expect(multi.startsAt).toBe('2026-10-23T22:00:00.000Z')
    expect(multi.endsAt).toBe('2026-10-26T22:59:59.000Z')
    await rejects(
      create({ startsAt: '2026-10-24T10:00:00.000Z', endsAt: '2026-10-20T10:00:00.000Z' }),
      /Enddatum liegt vor dem Startdatum/,
    )
  })

  it('DM-TOUR-02 Adresse: nie die Straße des Privatstudios (E-50); Link nur http(s); Uhrzeit HH:mm; Name Pflicht', async () => {
    const settings = (await payload.findGlobal({
      slug: 'settings',
      depth: 0,
      overrideAccess: true,
    })) as { business?: { street?: string | null } }
    const street = settings.business?.street?.replace(/\s*\d+.*$/, '').trim()
    if (street && street.length >= 3) {
      await rejects(create({ address: `${street} 5, 10115 Berlin` }), /Privatstudios/)
    }
    const ok = await create({
      address: 'Hof der Alten Bäckerei, Beispielweg 3',
      link: 'www.beispiel.de/markt',
      timeFrom: '10:00',
      timeTo: '18:00',
      standNumber: 'B12',
    })
    expect(ok.link).toBe('https://www.beispiel.de/markt')
    await rejects(create({ link: 'javascript:alert(1)' }), /Link/)
    await rejects(create({ timeFrom: '25:00' }), /Uhrzeit/)
    await rejects(create({ name: 'ab' }), /3–100/)
  })

  it('DM-TOUR-03 Zugriff: öffentlich nur veröffentlichte, ohne Beispieldaten; Schreiben nur Admin; DE/EN getrennt gespeichert', async () => {
    const pub = await create({ name: 'Öffentlicher Markt', published: true })
    const hidden = await create({ name: 'Versteckter Markt', published: false })
    const seeded = await create({ name: 'Beispiel-Markt', seed: true }, 'de', { seed: true })
    vi.stubEnv('SEED_PREVIEW_MODE', 'false')
    resetEnvCache()
    await create(
      { name: 'Public market', place: 'Berlin-Wedding', note: 'Coco is coming along.' },
      'en',
    ).catch(() => null)
    const read = async (path: string) =>
      (await (await rest('GET', path)).json()) as { docs: { id: number }[] }
    const ids = (await read('/tour-dates?limit=100&depth=0')).docs.map((d) => d.id)
    expect(ids).toContain(pub.id)
    expect(ids).not.toContain(hidden.id)
    expect(ids).not.toContain(seeded.id)
    expect((await rest('POST', '/tour-dates', { name: 'x', place: 'y' })).status).toBe(403)
    expect((await rest('PATCH', `/tour-dates/${pub.id}`, { name: 'hack' })).status).toBe(403)
    expect((await rest('DELETE', `/tour-dates/${pub.id}`)).status).toBe(403)

    const en = await payload.update({
      collection: 'tour-dates',
      id: pub.id,
      locale: 'en',
      data: {
        name: 'Public market',
        place: 'Berlin-Wedding',
        note: 'Coco is coming along.',
      } as never,
      overrideAccess: true,
    })
    expect(en.name).toBe('Public market')
    const de = await payload.findByID({
      collection: 'tour-dates',
      id: pub.id,
      locale: 'de',
      overrideAccess: true,
    })
    expect(de.name).toBe('Öffentlicher Markt')
  })

  it('DM-TOUR-04 Loader: veröffentlichte Termine nach Beginn, Status und Foto; Aufteilung kommend/vergangen folgt dem Datum', async () => {
    await cleanup()
    const now = new Date()
    const day = (n: number) => new Date(now.getTime() + n * 86_400_000).toISOString()
    const past = await create({ name: 'Vergangener Markt', startsAt: day(-30), image })
    const soon = await create({
      name: 'Nächster Markt',
      startsAt: day(5),
      status: 'planned',
      image,
    })
    const cancelled = await create({
      name: 'Abgesagter Markt',
      startsAt: day(12),
      status: 'cancelled',
    })
    await create({ name: 'Nicht online', startsAt: day(7), published: false })
    const list = await loadTourDates('de')
    expect(list.map((i) => i.name)).toEqual([
      'Vergangener Markt',
      'Nächster Markt',
      'Abgesagter Markt',
    ])
    expect(list.find((i) => i.id === soon.id)?.image?.id).toBe(image)
    const { upcoming, past: gone } = splitTourDates(list, now)
    expect(upcoming.map((i) => i.id)).toEqual([soon.id, cancelled.id])
    expect(gone.map((i) => i.id)).toEqual([past.id])
    expect(upcoming[1]!.status).toBe('cancelled')
    // Bild eines veröffentlichten Termins ist vor dem Löschen geschützt (DATENMODELL §6.2)
    await rejects(
      payload.delete({ collection: 'media', id: image, overrideAccess: true }),
      /Termin|verwendet|Verweis/i,
    )
  })
})
