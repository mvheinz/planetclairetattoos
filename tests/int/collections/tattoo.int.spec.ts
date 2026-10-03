import type { Payload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { resetEnvCache } from '@/lib/env'
import { formatFlashNumber } from '@/lib/tattoo/flash'

import { getTestPayload } from '../helpers/payload'
import { createTestImage } from '../helpers/products'
import { rest } from '../helpers/rest'

// P1.23: Tattoo-Collections `flash`, `tattoo-offers`, `tattoo-gallery` (DATENMODELL §6.14–§6.16, E-42, E-52, E-53).

const NOW = '2026-10-10T10:00:00.000Z'

let payload: Payload
let imageA: number
let imageB: number
let imageC: number

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

async function cleanup() {
  for (const collection of ['tattoo-gallery', 'tattoo-offers', 'flash'] as const) {
    await payload.delete({
      collection,
      where: { id: { exists: true } },
      overrideAccess: true,
      context: { seed: true },
    })
  }
}

function setEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v)
  resetEnvCache()
}

beforeAll(async () => {
  payload = await getTestPayload()
  await cleanup()
  imageA = await createTestImage(payload, 'Rose auf dem Unterarm')
  imageB = await createTestImage(payload, 'Schlange am Knöchel')
  imageC = await createTestImage(payload, 'Kelch mit Schlange')
})

afterEach(() => {
  vi.unstubAllEnvs()
  resetEnvCache()
})

afterAll(async () => {
  await cleanup()
  for (const id of [imageA, imageB, imageC]) {
    await payload.delete({ collection: 'media', id, overrideAccess: true }).catch(() => null)
  }
})

const publicFind = (collection: 'flash' | 'tattoo-offers' | 'tattoo-gallery', now = NOW) =>
  payload.find({
    collection,
    overrideAccess: false,
    user: undefined,
    context: { now },
    depth: 0,
    pagination: false,
  })

describe('flash (DATENMODELL §6.14)', () => {
  it('Nummer max + 1 (ohne Seed), Anzeige F-012, vergeben setzt claimedAt, wiederholbar nie vergeben', async () => {
    setEnv({ SEED_PREVIEW_MODE: 'false' })
    const base = { title: 'Kelch mit Schlange', image: imageC, sizeCm: 9.5, priceCents: 12000 }
    await payload.create({
      collection: 'flash',
      data: { ...base, number: 901, seed: true } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    const first = await payload.create({
      collection: 'flash',
      data: { ...base, number: 11 } as never,
      overrideAccess: true,
    })
    const next = await payload.create({
      collection: 'flash',
      data: base as never,
      overrideAccess: true,
    })
    expect(next.number).toBe(12)
    expect(formatFlashNumber(next.number!)).toBe('F-012')
    expect(formatFlashNumber(901)).toBe('F-901')
    await rejects(
      payload.create({
        collection: 'flash',
        data: { ...base, number: 11 } as never,
        overrideAccess: true,
      }),
      /number|Nummer/,
    )
    await rejects(
      payload.create({
        collection: 'flash',
        data: { ...base, number: 10000 } as never,
        overrideAccess: true,
      }),
      /Nummer|9999/,
    )
    await rejects(
      payload.create({
        collection: 'flash',
        data: { ...base, priceCents: 999 } as never,
        overrideAccess: true,
      }),
      /10,00/,
    )

    const claimed = await payload.update({
      collection: 'flash',
      id: first.id,
      data: { status: 'claimed' },
      overrideAccess: true,
      context: { now: NOW },
    })
    expect(claimed.claimedAt).toBe(NOW)
    const again = await payload.update({
      collection: 'flash',
      id: first.id,
      data: { status: 'available' },
      overrideAccess: true,
    })
    expect(again.claimedAt).toBeNull()
    await rejects(
      payload.update({
        collection: 'flash',
        id: next.id,
        data: { repeatable: true, status: 'claimed' },
        overrideAccess: true,
      }),
      /wiederholbares Motiv/,
    )

    // öffentlich nur veröffentlichte (und ohne Vorschau keine Seed-Motive)
    await payload.update({
      collection: 'flash',
      id: next.id,
      data: { published: false },
      overrideAccess: true,
    })
    const pub = await publicFind('flash')
    expect(pub.docs.map((d) => (d as { number?: number }).number)).toEqual([11])
  })
})

describe('tattoo-offers (DATENMODELL §6.15)', () => {
  it('DM-OFF-01 abgelaufene Angebote fehlen in öffentlichen Abfragen; Ende standardmäßig 23:59 Berlin', async () => {
    const offer = (data: Record<string, unknown>) =>
      payload.create({
        collection: 'tattoo-offers',
        data: {
          title: 'Flash-Day Oktober',
          description: 'Kleine Motive zum Festpreis, ohne Termin einfach vorbeischreiben.',
          ...data,
        } as never,
        overrideAccess: true,
      })
    const past = await offer({ startsAt: '2026-10-09T08:00:00.000Z' })
    // Ende des Starttags 23:59 Uhr Berlin (MESZ = UTC+2)
    expect(past.endsAt).toBe('2026-10-09T21:59:00.000Z')
    const running = await offer({
      startsAt: '2026-10-10T08:00:00.000Z',
      endsAt: '2026-10-10T16:00:00.000Z',
    })
    const hidden = await offer({ startsAt: '2026-10-20T08:00:00.000Z', published: false })
    const winter = await offer({ startsAt: '2026-12-05T08:00:00.000Z' })
    expect(winter.endsAt).toBe('2026-12-05T22:59:00.000Z')

    const ids = (await publicFind('tattoo-offers')).docs.map((d) => d.id)
    expect(ids).toContain(running.id)
    expect(ids).toContain(winter.id)
    expect(ids).not.toContain(past.id)
    expect(ids).not.toContain(hidden.id)
    // nach dem Ende verschwindet auch das laufende Angebot
    const later = (await publicFind('tattoo-offers', '2026-10-10T16:00:01.000Z')).docs.map(
      (d) => d.id,
    )
    expect(later).not.toContain(running.id)
    // anonymes REST (Systemuhr) zeigt keine abgelaufenen Angebote
    const old = await offer({ startsAt: '2020-01-01T08:00:00.000Z' })
    const res = await rest('GET', '/tattoo-offers?limit=50&depth=0')
    const body = (await res.json()) as { docs: { id: number }[] }
    expect(body.docs.map((d) => d.id)).not.toContain(old.id)

    await rejects(
      offer({ startsAt: '2026-10-20T08:00:00.000Z', endsAt: '2026-10-20T07:00:00.000Z' }),
      /nach dem Beginn/,
    )
    await rejects(
      offer({ startsAt: '2026-10-20T08:00:00.000Z', locationNote: 'Musterstraße 12, Berlin' }),
      /keine Adresse/,
    )
    await rejects(
      offer({ startsAt: '2026-10-20T08:00:00.000Z', locationNote: 'Studio, 12043 Berlin' }),
      /keine Adresse/,
    )
    expect((await rest('POST', '/tattoo-offers', { title: 'x' })).status).toBe(403)
  })
})

describe('tattoo-gallery (DATENMODELL §6.16)', () => {
  const entry = (data: Record<string, unknown>, context = {}) =>
    payload.create({
      collection: 'tattoo-gallery',
      data: { image: imageA, kind: 'fresh', ...data } as never,
      overrideAccess: true,
      context: { now: NOW, ...context },
    })
  const media = (id: number) =>
    payload.findByID({ collection: 'media', id, depth: 0, overrideAccess: true })

  it('DM-GAL-01 published ohne Einwilligung bei showsCustomer wird abgelehnt; media.restricted folgt', async () => {
    await rejects(
      entry({ published: true }),
      /Ohne Einwilligung der Kundin\/des Kunden nicht veröffentlichen/,
    )
    await rejects(
      entry({ published: true, consentGiven: true, consentDate: '2026-10-02T00:00:00.000Z' }),
      /Einwilligung erteilt|5–300/,
    )
    await rejects(
      entry({ consentGiven: true, consentDate: '2027-01-01T00:00:00.000Z', consentNote: 'per DM' }),
      /Zukunft/,
    )
    await rejects(entry({ kind: 'healed' }), /healed/)

    const ok = await entry({
      published: true,
      consentGiven: true,
      consentDate: '2026-10-02T00:00:00.000Z',
      consentNote: 'per DM am 02.10.2026',
      extraImages: [imageB],
      creditHandle: '@erika.tattoo',
    })
    expect(ok.published).toBe(true)
    expect((await media(imageA)).restricted).toBe(false)
    expect((await media(imageB)).restricted).toBe(false)
    // öffentlich sichtbar, Einwilligungsdetails nicht; Instagram-Name nur mit Freigabe
    const pub = await publicFind('tattoo-gallery')
    const doc = pub.docs.find((d) => d.id === ok.id) as Record<string, unknown> | undefined
    expect(doc).toBeTruthy()
    expect(doc!.consentNote).toBeUndefined()
    expect(doc!.creditHandle ?? null).toBeNull()

    // eigene Zeichnung ohne Kund:in darf ohne Einwilligung online
    const drawing = await entry({ image: imageC, showsCustomer: false, published: true })
    expect(drawing.published).toBe(true)

    // offline → Bilder wieder gesperrt, anonym nicht abrufbar
    await payload.update({
      collection: 'tattoo-gallery',
      id: ok.id,
      data: { published: false },
      overrideAccess: true,
    })
    expect((await media(imageA)).restricted).toBe(true)
    expect((await media(imageB)).restricted).toBe(true)
    expect((await rest('GET', `/media/${imageA}`)).status).not.toBe(200)
    // Einwilligung zurücknehmen bei veröffentlichtem Eintrag ist nicht möglich
    await payload.update({
      collection: 'tattoo-gallery',
      id: ok.id,
      data: { published: true },
      overrideAccess: true,
    })
    await rejects(
      payload.update({
        collection: 'tattoo-gallery',
        id: ok.id,
        data: { consentGiven: false },
        overrideAccess: true,
      }),
      /Ohne Einwilligung der Kundin\/des Kunden/,
    )
    await rejects(
      payload.update({
        collection: 'tattoo-gallery',
        id: ok.id,
        data: { consentWithdrawnAt: NOW },
        overrideAccess: true,
      }),
      /Einwilligung widerrufen/,
    )
  })

  it('AK-1-03 mit APP_ENV=production und SEED_PREVIEW_MODE=true keine Bilder ohne Einwilligung', async () => {
    // ohne Vorschau: Seed-Eintrag ohne Einwilligung wird nicht veröffentlicht
    setEnv({ SEED_PREVIEW_MODE: 'false', APP_ENV: 'development' })
    await rejects(
      entry({ image: imageB, seed: true, published: true }, { seed: true }),
      /Ohne Einwilligung der Kundin\/des Kunden/,
    )
    // Vorschau (nicht Produktion): Beispiel-Eintrag ohne Einwilligung erlaubt und sichtbar
    setEnv({ SEED_PREVIEW_MODE: 'true', APP_ENV: 'development' })
    const sample = await entry({ image: imageB, seed: true, published: true }, { seed: true })
    expect((await publicFind('tattoo-gallery')).docs.map((d) => d.id)).toContain(sample.id)

    // Produktion: Vorschau wirkt nie – keine Kund:innen-Fotos ohne Einwilligung
    setEnv({ SEED_PREVIEW_MODE: 'true', APP_ENV: 'production' })
    const prod = await publicFind('tattoo-gallery')
    expect(prod.docs.map((d) => d.id)).not.toContain(sample.id)
    for (const d of prod.docs as { showsCustomer?: boolean; consentGiven?: boolean }[]) {
      expect(d.showsCustomer === false || d.consentGiven === true).toBe(true)
    }
    const res = await rest('GET', '/tattoo-gallery?limit=100&depth=0')
    const body = (await res.json()) as {
      docs: { id: number; consentGiven?: boolean; showsCustomer?: boolean }[]
    }
    expect(body.docs.map((d) => d.id)).not.toContain(sample.id)
    for (const d of body.docs)
      expect(d.showsCustomer === false || d.consentGiven === true).toBe(true)
  })
})
