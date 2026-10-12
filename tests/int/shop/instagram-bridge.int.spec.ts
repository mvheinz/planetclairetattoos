import type { Payload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { GET as icsGET } from '@/app/(api)/api/public/tour-dates/[file]/route'
import { GET as nrGET } from '@/app/(api)/nr/route'
import { loadShopStartedAt } from '@/lib/data/products'
import { loadSitemapData } from '@/lib/data/sitemap'
import { loadTourDates } from '@/lib/data/tour'
import { resetEnvCache } from '@/lib/env'
import { tourIcsResponse } from '@/lib/tour/icsResponse'

import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
  type ProductFixtures,
} from '../helpers/products'

// V-60 / V-61 b (U-93, P20.3) gegen die Test-Datenbank: Start des Shops für den Stempel „frisch im Shop“, Nummernfeld
// mit Sprache der Seite (`/nr?nummer=…&locale=…`), Kalender-Datei eines Markttermins und Fotos in der Sitemap. Eigene
// Stücke im Fixture-Bereich 990–994; SEED_PREVIEW_MODE=false blendet den Beispielbestand aus.

let payload: Payload
let fx: ProductFixtures
const NUMBERS = [990, 991, 992, 993, 994]
const tourIds: number[] = []

function setEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v)
  resetEnvCache()
}

const piece = (nr: number, extra: Record<string, unknown>) =>
  createProduct(payload, completeProduct('keramik', nr, fx, extra))

beforeAll(async () => {
  payload = await getTestPayload()
  fx = await createProductFixtures(payload)
  await deleteProducts(payload, NUMBERS)
})

afterEach(async () => {
  vi.unstubAllEnvs()
  resetEnvCache()
  await deleteProducts(payload, NUMBERS)
  for (const id of tourIds.splice(0))
    await payload
      .delete({ collection: 'tour-dates', id, overrideAccess: true, context: { seed: true } })
      .catch(() => null)
})

afterAll(() => {
  vi.unstubAllEnvs()
  resetEnvCache()
})

describe('V-60 Start des Shops (Stempel „frisch im Shop“)', () => {
  it('frühestes firstPublishedAt aller Stücke – auch verkaufte und ausgeblendete zählen; Seed nur im Vorschau-Modus', async () => {
    setEnv({ SEED_PREVIEW_MODE: 'false' })
    await piece(990, { status: 'available', firstPublishedAt: '2026-09-10T10:00:00.000Z' })
    await piece(991, {
      status: 'sold',
      firstPublishedAt: '2026-09-01T08:00:00.000Z',
      soldAt: '2026-09-05T08:00:00.000Z',
      soldChannel: 'offline',
      showInArchiveAfterSale: false,
    })
    await piece(992, { status: 'draft' })
    await piece(993, {
      status: 'available',
      firstPublishedAt: '2026-08-01T08:00:00.000Z',
      seed: true,
    })
    // ausgeblendet verkauft (991) zählt, das Seed-Stück (993) ohne Vorschau-Modus nicht
    expect(await loadShopStartedAt()).toBe('2026-09-01T08:00:00.000Z')
    setEnv({ SEED_PREVIEW_MODE: 'true' })
    const withSeed = await loadShopStartedAt()
    expect(withSeed && withSeed <= '2026-08-01T08:00:00.000Z').toBe(true)
  })
})

describe('V-60 Nummernfeld: GET /nr?nummer=…&locale=… (Sprache der Seite vor Accept-Language)', () => {
  it('locale=en schlägt Accept-Language de; „Nr. 990“ wird verstanden; kein Cookie, Vary, no-store', async () => {
    setEnv({ SEED_PREVIEW_MODE: 'false' })
    await piece(990, { status: 'available', firstPublishedAt: '2026-09-10T10:00:00.000Z' })
    const call = (query: string, lang = 'de-DE,de;q=0.9') =>
      nrGET(
        new Request(`http://localhost:3000/nr?${query}`, { headers: { 'accept-language': lang } }),
      )
    const en = await call('nummer=990&locale=en')
    expect(en.status).toBe(307)
    expect(new URL(en.headers.get('location')!).pathname).toMatch(/^\/en\/shop\/990-/)
    expect(en.headers.get('set-cookie')).toBeNull()
    expect(en.headers.get('cache-control')).toBe('no-store')
    expect(en.headers.get('vary')).toMatch(/Accept-Language/)
    const de = await call(`nummer=${encodeURIComponent('Nr. 990')}&locale=de`, 'en-US,en;q=0.9')
    expect(new URL(de.headers.get('location')!).pathname).toMatch(/^\/de\/shop\/990-/)
    // ohne locale wie bisher: Accept-Language
    const accept = await call('nummer=990', 'en-US,en;q=0.9')
    expect(new URL(accept.headers.get('location')!).pathname).toMatch(/^\/en\/shop\/990-/)
    // unbekannte Nummer → 404 (die Seite selbst liefert hier kein Server – Rückfall-Text)
    const unknown = await call('nummer=12345&locale=en')
    expect(unknown.status).toBe(404)
    expect(unknown.headers.get('set-cookie')).toBeNull()
  })
})

describe('V-60 Kalender-Datei GET /api/public/tour-dates/<id>.ics', () => {
  async function tourDate(data: Record<string, unknown>) {
    const doc = await payload.create({
      collection: 'tour-dates',
      data: {
        name: 'Kunstmarkt am Kanal (Test)',
        place: 'Berlin-Neukölln',
        address: 'Maybachufer',
        startsAt: '2026-10-24T08:00:00.000Z',
        endsAt: '2026-10-25T08:00:00.000Z',
        timeFrom: '10:00',
        timeTo: '18:00',
        standNumber: '7',
        published: true,
        ...data,
      } as never,
      locale: 'de',
      overrideAccess: true,
    })
    tourIds.push(doc.id)
    return doc
  }
  const call = (file: string, locale = 'de') =>
    icsGET(new Request(`http://localhost:3000/api/public/tour-dates/${file}?locale=${locale}`), {
      params: Promise.resolve({ file }),
    })

  it('text/calendar mit Dateinamen, ein VEVENT in Ortszeit über die Zeitumstellung, kein Cookie', async () => {
    const doc = await tourDate({})
    const res = await call(`${doc.id}.ics`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/calendar; charset=utf-8')
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="planet-claire-on-tour-2026-10-24.ics"',
    )
    expect(res.headers.get('cache-control')).toBe('public, max-age=300')
    expect(res.headers.get('set-cookie')).toBeNull()
    const body = (await res.text()).replace(/\r\n /g, '')
    expect(body).toContain('BEGIN:VCALENDAR\r\n')
    expect(body).toContain(`UID:tour-${doc.id}@`)
    expect(body).toContain('DTSTART;TZID=Europe/Berlin:20261024T100000')
    expect(body).toContain('DTEND;TZID=Europe/Berlin:20261024T180000')
    expect(body).toContain('RRULE:FREQ=DAILY;COUNT=2')
    expect(body).toContain('SUMMARY:Kunstmarkt am Kanal (Test) · Planet Claire')
    expect(body).toContain('LOCATION:Berlin-Neukölln\\, Maybachufer')
    expect(body).toContain('Stand 7')
    expect(body).toMatch(/URL:https?:\/\/[^\r]+\/de#on-tour/)
    expect((body.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1)
  })

  it('EN-Texte mit ?locale=en; unveröffentlicht, unbekannt oder falsches Format → 404', async () => {
    const doc = await tourDate({})
    await payload.update({
      collection: 'tour-dates',
      id: doc.id,
      locale: 'en',
      data: { name: 'Canal art market (test)', place: 'Berlin-Neukölln' } as never,
      overrideAccess: true,
    })
    const en = await (await call(`${doc.id}.ics`, 'en')).text()
    expect(en).toContain('SUMMARY:Canal art market (test) · Planet Claire')
    expect(en).toContain('PRODID:-//Planet Claire//on Tour//EN')
    expect(en.replace(/\r\n /g, '')).toMatch(/All dates: https?:\/\/[^\r]+\/en#on-tour/)
    const hidden = await tourDate({ published: false })
    expect((await call(`${hidden.id}.ics`)).status).toBe(404)
    expect((await call('999999.ics')).status).toBe(404)
    expect((await call(`${doc.id}.txt`)).status).toBe(404)
    expect((await call('abc.ics')).status).toBe(404)
  })

  it('liest die gecachte Liste der Startseite (eine Quelle) – ohne Treffer 404', async () => {
    const doc = await tourDate({ status: 'cancelled' })
    const items = await loadTourDates('de')
    const res = await tourIcsResponse(`${doc.id}.ics`, 'de', {
      now: new Date('2026-10-12T08:00:00.000Z'),
      load: async () => items,
    })
    const body = await res.text()
    expect(body).toContain('STATUS:CANCELLED')
    expect(body).toContain('DTSTAMP:20261012T080000Z')
    const none = await tourIcsResponse(`${doc.id}.ics`, 'de', {
      now: new Date(),
      load: async () => [],
    })
    expect(none.status).toBe(404)
  })
})

describe('V-61 b Sitemap: Fotos nur bei Stücken im Shop', () => {
  it('verfügbar/reserviert mit Foto-Adressen (detail-Größe, absolut), verkauft ohne', async () => {
    setEnv({ SEED_PREVIEW_MODE: 'false' })
    await piece(990, { status: 'available', firstPublishedAt: '2026-09-10T10:00:00.000Z' })
    await piece(991, {
      status: 'sold',
      firstPublishedAt: '2026-09-01T08:00:00.000Z',
      soldAt: '2026-09-05T08:00:00.000Z',
      soldChannel: 'offline',
      showInArchiveAfterSale: true,
    })
    const data = await loadSitemapData()
    const available = data.products.find((p) => p.itemNumber === 990)!
    const sold = data.products.find((p) => p.itemNumber === 991)!
    expect(available.images?.length).toBe(1)
    expect(available.images![0]).toMatch(/^https?:\/\/[^/]+\/.+\.(webp|jpe?g)$/)
    expect(sold).toBeDefined()
    expect(sold.images).toBeUndefined()
  })
})
