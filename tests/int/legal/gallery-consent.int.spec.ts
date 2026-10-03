import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { Payload, PayloadRequest } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { toPublicGallery } from '@/lib/data/tattoo'
import { getEnv, resetEnvCache, type Env } from '@/lib/env'
import { fileResponseHandler } from '@/lib/storage'
import { isMediaPubliclyVisible, isPubliclyVisible } from '@/lib/tattoo/visibility'
import type { Media, TattooGallery } from '@/payload-types'

import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P7.5 – Einwilligungsregel überall (KONZEPT §9.7, E-42, R-172, R-181, R-182; DATENMODELL §6.2, §6.16): Galerie-Abfragen,
// Teaser und die Auslieferung der Bilddatei (404 statt 403, kurze Cache-Dauer für einwilligungsabhängige und Seed-
// Medien). Fixtures analog G1–G6 (SEED-SPEC §12.3): G1/G2 Kundenfotos ohne Einwilligung (`seed = true`), G3–G6 ohne
// Kund:in (echte Datensätze, weil das Kriterium sie ohne Vorschau-Modus sichtbar verlangt). Die Umgebung wird als
// Parameter injiziert.

const IMAGE = path.resolve('tests/fixtures/images/landscape-small.jpg')
const TAG = 'p7-gallery-consent'

let payload: Payload
const mediaIds: number[] = []
const entryIds: number[] = []
let g1Media: Media

const envWith = (over: Partial<Env>): Env => ({ ...getEnv(), ...over })
const PRODUCTION_PREVIEW = () => envWith({ APP_ENV: 'production', SEED_PREVIEW_MODE: true })
const PREVIEW = () => envWith({ APP_ENV: 'preview', SEED_PREVIEW_MODE: true })
const PREVIEW_WITHOUT_FLAG = () => envWith({ APP_ENV: 'preview', SEED_PREVIEW_MODE: false })

async function upload(alt: string, data: Record<string, unknown> = {}): Promise<Media> {
  const buf = await readFile(IMAGE)
  const doc = await payload.create({
    collection: 'media',
    data: { alt, ...data } as never,
    file: {
      data: buf,
      name: `galerie-${randomUUID().slice(0, 8)}.jpg`,
      mimetype: 'image/jpeg',
      size: buf.length,
    },
    overrideAccess: true,
    context: { seed: true },
  })
  mediaIds.push(doc.id)
  return doc as Media
}

async function entry(data: Record<string, unknown>): Promise<TattooGallery> {
  const doc = await payload.create({
    collection: 'tattoo-gallery',
    data: { caption: TAG, sortOrder: 900, ...data } as never,
    overrideAccess: true,
    context: { seed: true },
  })
  entryIds.push(doc.id)
  return doc as TattooGallery
}

/** Datei-Handler der Mediathek mit injizierter Umgebung (anonym, ohne Anmeldung). */
async function serve(media: Media, env: Env, user: unknown = null): Promise<Response | undefined> {
  const handler = fileResponseHandler('media', env)
  const req = { payload, user, headers: new Headers() } as unknown as PayloadRequest
  return (await handler(req, {
    doc: undefined as never,
    headers: new Headers(),
    params: { collection: 'media', filename: media.filename! },
  })) as Response | undefined
}

function setPreview(on: boolean) {
  vi.stubEnv('SEED_PREVIEW_MODE', on ? 'true' : 'false')
  vi.stubEnv('APP_ENV', 'development')
  resetEnvCache()
}

beforeAll(async () => {
  payload = await getTestPayload()
  await payload.delete({
    collection: 'tattoo-gallery',
    where: { caption: { equals: TAG } },
    overrideAccess: true,
    context: { seed: true },
  })
  setPreview(true)
  // G1/G2: Kundenfotos ohne Einwilligung, Beispieldaten (nur im Vorschau-Modus veröffentlichbar und sichtbar).
  g1Media = await upload('Fine Line am Unterarm, verheilt', { showsPerson: 'customer', seed: true })
  const g2Media = await upload('Frisches Tattoo an der Wade', {
    showsPerson: 'customer',
    seed: true,
  })
  await entry({
    image: g1Media.id,
    kind: 'healed',
    healedDurationMonths: 42,
    seed: true,
    published: true,
    featured: true,
  })
  await entry({ image: g2Media.id, kind: 'fresh', seed: true, published: true })
  // G3–G6: ohne Kund:in (Zeichnungen/Platzhalter), echte Datensätze.
  for (const [kind, months] of [
    ['fresh', null],
    ['healed', 12],
    ['fresh', null],
    ['healed', 8],
  ] as const) {
    const m = await upload(`Platzhalter-Foto ${kind} ${months ?? ''}`.trim())
    await entry({
      image: m.id,
      kind,
      healedDurationMonths: months ?? undefined,
      showsCustomer: false,
      published: true,
    })
  }
  vi.unstubAllEnvs()
  resetEnvCache()
})

afterEach(() => {
  vi.unstubAllEnvs()
  resetEnvCache()
})

afterAll(async () => {
  await payload.delete({
    collection: 'tattoo-gallery',
    where: { id: { in: entryIds } },
    overrideAccess: true,
    context: { seed: true },
  })
  for (const id of mediaIds) {
    await payload.delete({ collection: 'media', id, overrideAccess: true }).catch(() => null)
  }
})

const fixtures = async () =>
  (
    await payload.find({
      collection: 'tattoo-gallery',
      where: { id: { in: entryIds } },
      depth: 1,
      sort: 'createdAt',
      pagination: false,
      overrideAccess: true,
    })
  ).docs as TattooGallery[]

describe('Galerie-Einwilligung (P7.5)', () => {
  it('R-172 ohne Einwilligung nicht in der API-Antwort (SEED_PREVIEW_MODE=false), mit Einwilligung sichtbar; Cache-Header', async () => {
    setPreview(false)
    const res = await rest('GET', `/tattoo-gallery?limit=200&depth=0&where[caption][equals]=${TAG}`)
    const ids = ((await res.json()) as { docs: { id: number }[] }).docs.map((d) => d.id)
    expect(ids).toHaveLength(4)
    expect(ids).not.toContain(entryIds[0])
    expect(ids).not.toContain(entryIds[1])

    // Kundenfoto mit dokumentierter Einwilligung: öffentlich, Datei kurz gecacht (nie `immutable`, R-172 ≤ 24 h).
    const consentMedia = await upload('Rose am Handgelenk, verheilt', { showsPerson: 'customer' })
    expect(consentMedia.restricted).toBe(true)
    expect((await rest('GET', `/media/file/${consentMedia.filename}`)).status).toBe(404)
    const withConsent = await entry({
      image: consentMedia.id,
      kind: 'fresh',
      consentGiven: true,
      consentDate: '2026-09-30T00:00:00.000Z',
      consentNote: 'per DM am 30.09.2026',
      published: true,
    })
    const after = await rest('GET', `/tattoo-gallery/${withConsent.id}?depth=0`)
    expect(after.status).toBe(200)
    const file = await rest('GET', `/media/file/${consentMedia.filename}`)
    expect(file.status).toBe(200)
    expect(file.headers.get('cache-control')).toBe('public, max-age=300')
    expect(file.headers.get('cdn-cache-control')).toBe('max-age=300')
    expect(file.headers.get('cache-control')).not.toContain('immutable')

    // Widerruf (offline): sofort wieder 404 für alle außer der Verwaltung.
    await payload.update({
      collection: 'tattoo-gallery',
      id: withConsent.id,
      data: { published: false } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    expect((await rest('GET', `/media/file/${consentMedia.filename}`)).status).toBe(404)
    expect((await rest('GET', `/media/${consentMedia.id}`)).status).not.toBe(200)
  })

  it('AK-9-04 Bildroute eines Seed-Tattoofotos (G1): 404 in Produktion, 200 in der Vorschau, 404 ohne Variable', async () => {
    expect(g1Media.restricted).toBe(true)
    expect(g1Media.seed).toBe(true)
    expect((await serve(g1Media, PRODUCTION_PREVIEW()))?.status).toBe(404)
    const ok = await serve(g1Media, PREVIEW())
    expect(ok?.status).toBe(200)
    expect(ok?.headers.get('cache-control')).toBe('public, max-age=300')
    expect(ok?.headers.get('cdn-cache-control')).toBe('max-age=300')
    expect((await serve(g1Media, PREVIEW_WITHOUT_FLAG()))?.status).toBe(404)
    // Auch die Bildgrößen (erratene URL einer Größe) und eine unbekannte Datei: 404, nicht 403.
    const thumb = { ...g1Media, filename: g1Media.sizes?.thumb?.filename ?? g1Media.filename }
    expect((await serve(thumb as Media, PRODUCTION_PREVIEW()))?.status).toBe(404)
    expect((await serve({ ...g1Media, filename: 'gibt-es-nicht.webp' }, PREVIEW()))?.status).toBe(
      404,
    )
    // Angemeldete Verwaltung sieht das Bild, nie in einem geteilten Cache.
    const admin = await serve(g1Media, PRODUCTION_PREVIEW(), { collection: 'users', id: 1 })
    expect(admin?.status).toBe(200)
    expect(admin?.headers.get('cache-control')).toBe('private, no-store')
    // Über die echte Route (Umgebung der Test-Instanz): 404 statt 403, wenn das Bild nicht sichtbar ist.
    expect(isMediaPubliclyVisible(g1Media, PRODUCTION_PREVIEW())).toBe(false)
  })

  it('G1–G6: mit Vorschau-Modus G1/G2 mit Etikett sichtbar, ohne nur G3–G6; Teaser nur sichtbare', async () => {
    const docs = await fixtures()
    const preview = toPublicGallery(docs, PREVIEW())
    expect(preview).toHaveLength(6)
    expect(preview.filter((e) => e.internal).map((e) => e.id)).toEqual(entryIds.slice(0, 2))
    const g1 = preview.find((e) => e.id === entryIds[0])!
    expect(g1).toMatchObject({ kind: 'healed', healedDurationMonths: 42, internal: true })

    for (const env of [PREVIEW_WITHOUT_FLAG(), PRODUCTION_PREVIEW()]) {
      const visible = toPublicGallery(docs, env)
      expect(visible.map((e) => e.id)).toEqual(entryIds.slice(2, 6))
      expect(visible.some((e) => e.internal)).toBe(false)
    }
    expect(
      isPubliclyVisible({ published: true, showsCustomer: true, consentGiven: false }, PREVIEW()),
    ).toBe(false)
    expect(isPubliclyVisible({ published: false, showsCustomer: false }, PREVIEW())).toBe(false)
    expect(isPubliclyVisible({ published: true, showsCustomer: true, consentGiven: true })).toBe(
      true,
    )
  })
})
