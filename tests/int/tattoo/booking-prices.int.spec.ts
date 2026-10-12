import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  initialTattooBooking,
  initialTattooPricesConfirm,
  type Obj,
} from '@/admin/views/settings/settingsAreas'
import {
  loadFlash,
  loadGallery,
  loadTattooAvailability,
  pickTattooSettings,
} from '@/lib/data/tattoo'
import { loadSitemapData } from '@/lib/data/sitemap'
import { resetEnvCache } from '@/lib/env'
import { runGoliveCheck } from '@/lib/golive/collect'
import { getPublicSettings } from '@/lib/payload/public'
import { activeBooking } from '@/lib/tattoo/booking'
import { fixedClock } from '@/lib/time'

import { resetAdmin } from '../helpers/admin'
import { getTestPayload } from '../helpers/payload'
import { createTestImage } from '../helpers/products'
import { rest } from '../helpers/rest'

// P20.5 – Tattoo (U-93: V-28 a, V-64; DATENMODELL §7.1, §13.7):
// - Migration `p20_tattoo_booking`: `settings.tattoo.pricesConfirmedAt`, `inquiriesOpen` (Standard an), `bookedUntil`,
//   `bookedNote` (DE/EN); Speichern über `POST /api/globals/settings/area` (Bereiche `tattooBooking`,
//   `tattooPricesConfirm`), öffentlich nur Schalter, Monat und Hinweis.
// - Startklar R210-16 bleibt rot, bis Jutta die Tattoo-Preise bestätigt; eine Änderung der Beträge setzt die Bestätigung
//   zurück.
// - Flash und Galerie zählen nur mit Inhalt (Beispieldaten nur im Vorschau-Modus); leere Unterseiten fehlen in der
//   Sitemap.

let payload: Payload
let token: string
let snapshot: { de: Obj; en: Obj }
let image: number
const NUMBERS = [988, 989]

const load = async (locale: 'de' | 'en') =>
  (await payload.findGlobal({
    slug: 'settings',
    depth: 0,
    locale,
    fallbackLocale: false,
    overrideAccess: true,
  })) as unknown as Obj

const tattooOf = async (locale: 'de' | 'en' = 'de') => (await load(locale)).tattoo as Obj

async function save(area: string, values: unknown) {
  const res = await rest(
    'POST',
    '/globals/settings/area',
    { area, values },
    { authorization: `JWT ${token}`, 'idempotency-key': crypto.randomUUID() },
  )
  return {
    status: res.status,
    json: (await res.json()) as { error?: string; errors?: { path: string; message: string }[] },
  }
}
const paths = (r: Awaited<ReturnType<typeof save>>) => (r.json.errors ?? []).map((e) => e.path)
const r21016 = async () =>
  (await runGoliveCheck(payload, new Date('2026-10-20T10:00:00Z'))).checks.find(
    (c) => c.id === 'R210-16',
  )!

async function cleanupFixtures() {
  await payload.delete({
    collection: 'tattoo-gallery',
    where: { caption: { equals: 'P20.5 Galerie-Fixture' } },
    overrideAccess: true,
    context: { seed: true },
  })
  await payload.delete({
    collection: 'flash',
    where: { number: { in: NUMBERS } },
    overrideAccess: true,
    context: { seed: true },
  })
}

beforeAll(async () => {
  payload = await getTestPayload()
  ;({ token } = await resetAdmin(payload, '198.51.100.85'))
  snapshot = { de: await load('de'), en: await load('en') }
  await cleanupFixtures()
  image = await createTestImage(payload, 'Kleiner Stern, Tusche')
})

afterEach(() => {
  vi.unstubAllEnvs()
  resetEnvCache()
})

afterAll(async () => {
  for (const locale of ['de', 'en'] as const) {
    await payload.updateGlobal({
      slug: 'settings',
      locale,
      data: { tattoo: snapshot[locale].tattoo } as never,
      overrideAccess: true,
      context: { seed: true, skipAudit: true },
    })
  }
  await cleanupFixtures()
  await payload.delete({ collection: 'media', id: image, overrideAccess: true }).catch(() => null)
})

describe('Migration p20_tattoo_booking', () => {
  it('neue Felder mit Standardwerten: Anfragen offen, nichts bestätigt', async () => {
    const t = await tattooOf()
    expect(t.inquiriesOpen).toBe(true)
    expect(t.bookedUntil ?? null).toBe(null)
    expect(t.bookedNote ?? null).toBe(null)
    expect(t.pricesConfirmedAt ?? null).toBe(null)
    const db = payload.db as unknown as {
      drizzle: {
        execute: (q: ReturnType<typeof sql>) => Promise<{ rows: { column_name: string }[] }>
      }
    }
    const rows = await db.drizzle.execute(
      sql`SELECT column_name FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name IN ('settings', 'settings_locales')
            AND column_name IN ('tattoo_inquiries_open', 'tattoo_booked_until', 'tattoo_booked_note',
                                'tattoo_prices_confirmed_at')
          ORDER BY column_name`,
    )
    expect(rows.rows.map((r) => r.column_name)).toEqual([
      'tattoo_booked_note',
      'tattoo_booked_until',
      'tattoo_inquiries_open',
      'tattoo_prices_confirmed_at',
    ])
  })
})

describe('V-64 Schalter „Anfragen offen / ausgebucht bis …“', () => {
  it('aus mit Monat und Hinweis DE/EN: gespeichert, öffentlich lesbar, Hinweis bis Monatsende', async () => {
    const r = await save('tattooBooking', {
      inquiriesOpen: false,
      bookedUntil: '2099-02',
      bookedNote: {
        de: 'Gerade ausgebucht – neue Anfragen ab März',
        en: 'Fully booked – new requests from March',
      },
    })
    expect(r.status, JSON.stringify(r.json)).toBe(200)
    expect(await tattooOf()).toMatchObject({ inquiriesOpen: false, bookedUntil: '2099-02' })
    expect((await tattooOf('en')).bookedNote).toBe('Fully booked – new requests from March')
    expect(initialTattooBooking(await load('de'), await load('en'))).toEqual({
      inquiriesOpen: false,
      bookedUntil: '2099-02',
      bookedNote: {
        de: 'Gerade ausgebucht – neue Anfragen ab März',
        en: 'Fully booked – new requests from March',
      },
    })

    // Öffentlich (Whitelist): Schalter, Monat und Hinweis in der Sprache der Seite – nie das Bestätigungsdatum
    const pubEn = await getPublicSettings(fixedClock('2026-10-12T10:00:00Z'), { locale: 'en' })
    expect(pubEn.tattoo).toMatchObject({
      inquiriesOpen: false,
      bookedUntil: '2099-02',
      bookedNote: 'Fully booked – new requests from March',
    })
    expect(pubEn.tattoo).not.toHaveProperty('pricesConfirmedAt')
    const booking = pickTattooSettings(pubEn).booking
    expect(activeBooking(booking, new Date('2099-02-28T22:00:00Z'))).toEqual({
      until: '2099-02',
      resumesFrom: '2099-03',
      note: 'Fully booked – new requests from March',
    })
    expect(activeBooking(booking, new Date('2099-03-01T00:00:00Z'))).toBe(null)
  })

  it('ungültiger Monat, vergangener Monat und zu langer Hinweis werden abgelehnt', async () => {
    const bad = await save('tattooBooking', {
      inquiriesOpen: false,
      bookedUntil: '2099-13',
      bookedNote: { de: '', en: '' },
    })
    expect(bad.status).toBe(400)
    expect(paths(bad)).toEqual(['tattoo.bookedUntil'])
    const past = await save('tattooBooking', {
      inquiriesOpen: false,
      bookedUntil: '2020-01',
      bookedNote: { de: '', en: '' },
    })
    expect(past.status).toBe(400)
    expect(paths(past)).toContain('tattoo.bookedUntil')
    expect(JSON.stringify(past.json)).toContain('schon vorbei')
    const long = await save('tattooBooking', {
      inquiriesOpen: false,
      bookedUntil: '',
      bookedNote: { de: 'x'.repeat(161), en: '' },
    })
    expect(long.status).toBe(400)
    expect(paths(long)).toContain('tattoo.bookedNote.de')
    // nichts davon gespeichert
    expect(await tattooOf()).toMatchObject({ inquiriesOpen: false, bookedUntil: '2099-02' })
  })

  it('wieder offen: Monat geleert, Hinweis wirkt nicht mehr', async () => {
    const r = await save('tattooBooking', {
      inquiriesOpen: true,
      bookedUntil: '2099-02',
      bookedNote: { de: '', en: '' },
    })
    expect(r.status, JSON.stringify(r.json)).toBe(200)
    const t = await tattooOf()
    expect(t).toMatchObject({ inquiriesOpen: true, bookedUntil: null })
    expect(activeBooking(pickTattooSettings({ tattoo: t }).booking, new Date())).toBe(null)
  })
})

describe('V-28 a Startklar R210-16: Tattoo-Preise bestätigen', () => {
  it('Grundzustand (Seed mit 80 € und 150–400 €): rot mit Weg in der Verwaltung', async () => {
    const check = await r21016()
    expect(check.ok).toBe(false)
    expect(check.detail).toContain('Mindestpreis 80 €')
    expect(check.detail).toContain('Tattoo → Reiter „Texte“')
    expect(initialTattooPricesConfirm(await load('de'))).toEqual({
      confirmedAt: '',
      hasPrices: true,
    })
  })

  it('„Preise stimmen – bestätigen“ → grün; gleiche Beträge erneut speichern bleibt grün', async () => {
    const r = await save('tattooPricesConfirm', {})
    expect(r.status, JSON.stringify(r.json)).toBe(200)
    expect((await tattooOf()).pricesConfirmedAt).toBeTruthy()
    expect((await r21016()).ok).toBe(true)
    expect(initialTattooPricesConfirm(await load('de')).confirmedAt).toMatch(
      /^\d{2}\.\d{2}\.\d{4}$/,
    )
    const same = await save('tattooPrices', {
      minPrice: '80,00',
      customFrom: '150,00',
      customTo: '400,00',
      priceNote: { de: 'Alle Preise sind Endpreise.', en: 'All prices are final prices.' },
    })
    expect(same.status, JSON.stringify(same.json)).toBe(200)
    expect((await r21016()).ok).toBe(true)
  })

  it('geänderter Betrag setzt die Bestätigung zurück → wieder rot', async () => {
    const r = await save('tattooPrices', {
      minPrice: '90,00',
      customFrom: '150,00',
      customTo: '400,00',
      priceNote: { de: 'Alle Preise sind Endpreise.', en: 'All prices are final prices.' },
    })
    expect(r.status, JSON.stringify(r.json)).toBe(200)
    expect((await tattooOf()).pricesConfirmedAt ?? null).toBe(null)
    const check = await r21016()
    expect(check.ok).toBe(false)
    expect(check.detail).toContain('Mindestpreis 90 €')
  })
})

describe('V-28 a Flash und Galerie nur mit Inhalt', () => {
  async function flash(number: number, seed: boolean) {
    return payload.create({
      collection: 'flash',
      data: {
        number,
        title: `Stern ${number}`,
        image,
        sizeCm: 4,
        priceCents: 8000,
        status: 'available',
        sortOrder: 1,
        seed,
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
  }

  it('ohne Motive und Fotos: beides leer, Sitemap ohne R12/R15', async () => {
    vi.stubEnv('SEED_PREVIEW_MODE', 'false')
    resetEnvCache()
    expect(await loadTattooAvailability('de')).toEqual({ flash: false, gallery: false })
    expect((await loadSitemapData()).hiddenRoutes).toEqual(['R12', 'R15'])
  })

  it('Beispiel-Motiv zählt nur im Vorschau-Modus und trägt dort „Beispiel“; ein echtes Motiv zählt immer', async () => {
    await flash(988, true)
    vi.stubEnv('SEED_PREVIEW_MODE', 'false')
    resetEnvCache()
    expect((await loadTattooAvailability('de')).flash).toBe(false)
    vi.stubEnv('SEED_PREVIEW_MODE', 'true')
    resetEnvCache()
    expect((await loadTattooAvailability('de')).flash).toBe(true)
    expect((await loadFlash('de')).find((f) => f.number === 988)?.example).toBe(true)

    await flash(989, false)
    vi.stubEnv('SEED_PREVIEW_MODE', 'false')
    resetEnvCache()
    expect((await loadTattooAvailability('de')).flash).toBe(true)
    expect((await loadFlash('de')).find((f) => f.number === 989)?.example).toBe(false)
    expect((await loadSitemapData()).hiddenRoutes).toEqual(['R15'])

    // offline genommen zählt nicht
    await payload.update({
      collection: 'flash',
      where: { number: { equals: 989 } },
      data: { published: false } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    expect((await loadTattooAvailability('de')).flash).toBe(false)
  })

  it('Galerie: Beispiel-Foto nur im Vorschau-Modus, mit Stempel-Kennzeichen', async () => {
    await payload.create({
      collection: 'tattoo-gallery',
      data: {
        image,
        kind: 'fresh',
        caption: 'P20.5 Galerie-Fixture',
        showsCustomer: false,
        consentGiven: false,
        published: true,
        sortOrder: 99,
        seed: true,
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    vi.stubEnv('SEED_PREVIEW_MODE', 'false')
    resetEnvCache()
    expect((await loadTattooAvailability('de')).gallery).toBe(false)
    vi.stubEnv('SEED_PREVIEW_MODE', 'true')
    resetEnvCache()
    expect((await loadTattooAvailability('de')).gallery).toBe(true)
    const entry = (await loadGallery('de')).find((e) => e.caption === 'P20.5 Galerie-Fixture')
    expect(entry?.example).toBe(true)
  })
})
