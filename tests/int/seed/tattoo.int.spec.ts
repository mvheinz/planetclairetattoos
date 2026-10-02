import type { Payload, PayloadRequest } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { loadFlash, loadGallery, loadOffers, toPublicGallery } from '@/lib/data/tattoo'
import { getEnv, resetEnvCache, type Env } from '@/lib/env'
import { fileResponseHandler } from '@/lib/storage'
import { expectedCount } from '@/lib/seed/expected'
import { resolveSeedDate } from '@/lib/seed/time'
import { tattooMailSubject } from '@/lib/tattoo/mailto'
import { currentOrNextOffer } from '@/lib/tattoo/offers'
import { isMediaPubliclyVisible } from '@/lib/tattoo/visibility'
import type { TattooGallery } from '@/payload-types'

import { withClock } from '../helpers/payload'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'
import {
  SEED_N,
  SEED_TIMEOUT,
  bySeedKey,
  findAll,
  runCanonicalSeed,
  type SeedDoc,
} from './canonical'

// P8.6: Tattoo-Bestand (SEED-SPEC §12) – Flash F901–F910, Angebote TO1–TO3 mit vorgestellter Uhr (AK-SEED-10,
// AK-9-03), Galerie G1–G6 mit Einwilligungsregel (AK-SEED-11, AK-9-04, AK-1-03), Mail-Betreff (AK-9-02).

let payload: Payload
const key = (doc: SeedDoc) => String(doc.seedKey).split(':')[1]!
const N_ISO = SEED_N.toISOString()

/** Datei-Handler der Mediathek mit injizierter Umgebung (anonym), wie die Route `/api/media/file/:name`. */
async function serveFile(filename: string, env: Env): Promise<number | undefined> {
  const handler = fileResponseHandler('media', env)
  const req = { payload, user: null, headers: new Headers() } as unknown as PayloadRequest
  const res = (await handler(req, {
    doc: undefined as never,
    headers: new Headers(),
    params: { collection: 'media', filename },
  })) as Response | undefined
  return res?.status
}

const envOf = (preview: boolean, appEnv: Env['APP_ENV']): Env => ({
  ...getEnv(),
  SEED_PREVIEW_MODE: preview,
  APP_ENV: appEnv,
})

function setEnv(preview: boolean, appEnv: string) {
  vi.stubEnv('SEED_PREVIEW_MODE', preview ? 'true' : 'false')
  vi.stubEnv('APP_ENV', appEnv)
  resetEnvCache()
}

beforeAll(async () => {
  payload = await getTestPayload()
  await runCanonicalSeed(payload)
}, SEED_TIMEOUT)

afterEach(() => {
  vi.unstubAllEnvs()
  resetEnvCache()
})

afterAll(async () => {
  await runCanonicalSeed(payload, 'remove', { yes: true, dropTexts: true })
}, SEED_TIMEOUT)

describe('Flash (SEED-SPEC §12.1)', () => {
  it('10 Motive 901–910; F903/F905 vergeben mit claimedAt, sonst verfügbar; 4 wiederholbar; sortOrder 10 × Position', async () => {
    const flash = await findAll(payload, 'flash', { seed: { equals: true } }, { locale: 'de' })
    expect(flash).toHaveLength(expectedCount('flash'))
    expect(flash.map((f) => f.number).sort()).toEqual([
      901, 902, 903, 904, 905, 906, 907, 908, 909, 910,
    ])
    const claimed = flash
      .filter((f) => f.status === 'claimed')
      .map(key)
      .sort()
    expect(claimed).toEqual(['F903', 'F905'])
    expect(flash.find((f) => key(f) === 'F903')!.claimedAt).toBe(
      resolveSeedDate('D-12@15:00', SEED_N).toISOString(),
    )
    expect(flash.filter((f) => f.status === 'available' && f.claimedAt)).toEqual([])
    expect(
      flash
        .filter((f) => f.repeatable)
        .map(key)
        .sort(),
    ).toEqual(['F902', 'F906', 'F907', 'F910'])
    for (const f of flash) {
      expect(f.sortOrder, key(f)).toBe((Number(f.number) - 900) * 10)
      expect(f.published).toBe(true)
    }
  })

  it('F-901 zeigt das Instagram-Bild ig:DbJ1QRrjCcb; Platzhalter für F-902…F-910', async () => {
    const f901 = await bySeedKey(payload, 'flash', 'F901', { depth: 1 })
    const image = f901.image as { seedKey: string; sourceRef: string; source: string }
    expect(image.seedKey).toBe('media:ig:DbJ1QRrjCcb')
    expect(image.sourceRef).toBe('DbJ1QRrjCcb')
    const f907 = await bySeedKey(payload, 'flash', 'F907', { depth: 1 })
    expect((f907.image as { seedKey: string }).seedKey).toBe('media:ph:flash-907')
  })

  it('AK-9-02: Mail-Knopf F-907 – Betreff DE „Flash-Anfrage F-907 – Winziger Planet“, EN „Flash request F-907 – Tiny planet“', async () => {
    setEnv(true, 'preview')
    const de = (await loadFlash('de')).find((f) => f.number === 907)!
    const en = (await loadFlash('en')).find((f) => f.number === 907)!
    expect(tattooMailSubject({ kind: 'flash', number: de.number, title: de.title }, 'de')).toBe(
      'Flash-Anfrage F-907 – Winziger Planet',
    )
    expect(tattooMailSubject({ kind: 'flash', number: en.number, title: en.title }, 'en')).toBe(
      'Flash request F-907 – Tiny planet',
    )
    expect(en.sizeNote).toBeNull()
    expect((await loadFlash('en')).find((f) => f.number === 902)!.sizeNote).toBe('size adjustable')
  })
})

describe('Angebote (SEED-SPEC §12.2)', () => {
  it('AK-SEED-10 / AK-9-03: bei kanonischem N sind TO1 und TO2 sichtbar (R11, R13, Startseite), TO3 nicht', async () => {
    setEnv(true, 'preview')
    const titles = await withClock(N_ISO, async () => {
      const offers = await loadOffers('de')
      return {
        list: offers.map((o) => o.title),
        current: currentOrNextOffer(offers, SEED_N)?.title,
      }
    })
    expect(titles.list).toEqual([
      'Spontane Lücken: winzige Planeten',
      'Flash-Day: kleine Motive ab 80 €',
    ])
    // Startseite und R11 zeigen das laufende bzw. nächste Angebot: TO2 läuft gerade.
    expect(titles.current).toBe('Spontane Lücken: winzige Planeten')
    const to1 = await bySeedKey(payload, 'tattoo-offers', 'TO1', { locale: 'de' })
    expect(to1).toMatchObject({
      startsAt: '2026-12-12T11:00:00.000Z',
      endsAt: '2026-12-12T18:00:00.000Z',
      type: 'flash_day',
    })
    expect(String(to1.locationNote)).toMatch(/^Privatstudio in /)
    const to3 = await bySeedKey(payload, 'tattoo-offers', 'TO3')
    expect(to3.endsAt).toBe('2026-08-29T17:00:00.000Z')
    const flashes = (to1.flashes as number[]).length
    expect(flashes).toBe(4)
  })

  it('EN-Texte der Angebote', async () => {
    setEnv(true, 'preview')
    const en = await withClock(N_ISO, () => loadOffers('en'))
    expect(en.map((o) => o.title)).toEqual([
      'Last-minute gaps: tiny planets',
      'Flash day: small designs from 80 €',
    ])
    expect(en[1]!.flashes.map((f) => f.display)).toEqual(['F-902', 'F-906', 'F-907', 'F-910'])
  })
})

describe('Galerie (SEED-SPEC §12.3)', () => {
  const envWith = (over: Partial<Env>): Env => ({ ...getEnv(), ...over })

  it('6 Einträge; G1/G2 echte Kundenfotos ohne Einwilligung, Medien gesperrt; G3–G6 Platzhalter ohne Kund:in', async () => {
    const gallery = await findAll(
      payload,
      'tattoo-gallery',
      { seed: { equals: true } },
      { depth: 1 },
    )
    expect(gallery).toHaveLength(expectedCount('tattoo-gallery'))
    const byKey = Object.fromEntries(gallery.map((g) => [key(g), g]))
    for (const k of ['G1', 'G2']) {
      expect(byKey[k]).toMatchObject({ showsCustomer: true, consentGiven: false, published: true })
      expect((byKey[k]!.image as { restricted: boolean }).restricted, k).toBe(true)
    }
    for (const k of ['G3', 'G4', 'G5', 'G6']) {
      expect(byKey[k]).toMatchObject({ showsCustomer: false, published: true })
    }
    expect(byKey.G1).toMatchObject({ kind: 'healed', healedDurationMonths: 42, featured: true })
    expect(byKey.G2!.caption).toBe('Godzilla and the bunnies')
  })

  it('AK-SEED-11 / AK-9-04 / AK-1-03: ohne Vorschau-Modus fehlen G1/G2 in der öffentlichen API, ihre Bild-URLs liefern 404', async () => {
    setEnv(false, 'development')
    const g1 = await bySeedKey(payload, 'tattoo-gallery', 'G1', { depth: 1 })
    const g2 = await bySeedKey(payload, 'tattoo-gallery', 'G2', { depth: 1 })
    const list = await rest('GET', '/tattoo-gallery?limit=100&depth=0')
    expect(list.status).toBe(200)
    const ids = ((await list.json()) as { docs: { id: number }[] }).docs.map((d) => d.id)
    expect(ids).not.toContain(g1.id)
    expect(ids).not.toContain(g2.id)
    for (const g of [g1, g2]) {
      const media = g.image as { filename: string; id: number }
      expect(await serveFile(media.filename, envOf(false, 'development'))).toBe(404)
      expect((await rest('GET', `/media/${media.id}`)).status).not.toBe(200)
    }
    expect((await loadGallery('de')).some((e) => e.id === g1.id || e.id === g2.id)).toBe(false)
  })

  it('AK-SEED-11: SEED_PREVIEW_MODE=true + APP_ENV=preview → G1/G2 sichtbar (Etikett „intern“), APP_ENV=production → 404; G3–G6 in jeder Vorschau sichtbar', async () => {
    setEnv(true, 'preview')
    const preview = await loadGallery('de')
    const gallery = await findAll(
      payload,
      'tattoo-gallery',
      { seed: { equals: true } },
      { depth: 1 },
    )
    const id = (k: string) => gallery.find((g) => key(g) === k)!.id
    expect(preview.map((e) => e.id)).toEqual(['G1', 'G2', 'G3', 'G4', 'G5', 'G6'].map(id))
    expect(preview.filter((e) => e.internal).map((e) => e.id)).toEqual([id('G1'), id('G2')])
    const g1Media = gallery.find((g) => key(g) === 'G1')!.image as { filename: string }
    expect(await serveFile(g1Media.filename, envOf(true, 'preview'))).toBe(200)

    const prod = envWith({ APP_ENV: 'production', SEED_PREVIEW_MODE: true })
    expect(toPublicGallery(gallery as unknown as TattooGallery[], prod)).toEqual([])
    expect(isMediaPubliclyVisible(g1Media as never, prod)).toBe(false)
    expect(await serveFile(g1Media.filename, prod)).toBe(404)

    // „immer sichtbar“: G3–G6 brauchen keine Einwilligung – als übernommene Einträge (seed = false) bleiben sie ohne
    // Vorschau-Modus sichtbar, G1/G2 nie (Seed-Inhalte selbst nur in der Vorschau, DATENMODELL §1.4 Regel 4).
    const adopted = gallery.map((g) => ({
      ...g,
      seed: false,
      image: { ...(g.image as object), seed: false },
    })) as unknown as TattooGallery[]
    const noPreview = envWith({ APP_ENV: 'development', SEED_PREVIEW_MODE: false })
    expect(toPublicGallery(adopted, noPreview).map((e) => e.id)).toEqual(
      ['G3', 'G4', 'G5', 'G6'].map(id),
    )
  })
})
