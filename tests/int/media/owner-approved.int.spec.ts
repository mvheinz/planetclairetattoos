import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { resetAdmin } from '../helpers/admin'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P8.20 – DM-MEDIA-06 / R-181: Bilder mit `showsPerson = jutta` sind öffentlich nur mit dem Häkchen `ownerApproved`
// (DATENMODELL §6.2): Dateiroute (Original und Größen) und Dokument-API für Anonyme 404/leer, für die angemeldete
// Verwaltung 200; mit Häkchen → 200 für alle. Kund:innen-Bilder bleiben gesperrt (DM-MEDIA-04).

const FIXTURE = path.resolve('tests/fixtures/images/landscape-small.jpg')
let payload: Payload
let token: string
const created: number[] = []

async function upload(data: Record<string, unknown>) {
  const buf = await readFile(FIXTURE)
  const doc = await payload.create({
    collection: 'media',
    data: { alt: 'Jutta in der Werkstatt am Tisch', ...data } as never,
    file: { data: buf, name: 'jutta-werkstatt.jpg', mimetype: 'image/jpeg', size: buf.length },
    overrideAccess: true,
  })
  created.push(doc.id as number)
  return doc
}

beforeAll(async () => {
  payload = await getTestPayload()
  token = (await resetAdmin(payload, '198.51.100.87')).token
})

afterAll(async () => {
  for (const id of created)
    await payload.delete({ collection: 'media', id, overrideAccess: true }).catch(() => null)
})

describe('P8.20 Fotos von Jutta nur mit Freigabe (R-181)', () => {
  it('DM-MEDIA-06: showsPerson = jutta ohne ownerApproved → Bildroute 404 für Anonyme, 200 für die Verwaltung; Dokument nicht lesbar', async () => {
    const doc = await upload({ showsPerson: 'jutta' })
    expect(doc.ownerApproved).toBe(false)
    expect(doc.restricted).toBe(false)
    const anon = await rest('GET', `/media/file/${doc.filename}`)
    expect(anon.status).toBe(404)
    const thumb = await rest('GET', `/media/file/${doc.sizes?.thumb?.filename}`)
    expect(thumb.status).toBe(404)
    const anonDoc = await rest('GET', `/media/${doc.id}`)
    expect([403, 404]).toContain(anonDoc.status)
    const list = (await (await rest('GET', `/media?where[id][equals]=${doc.id}`)).json()) as {
      docs: unknown[]
    }
    expect(list.docs).toHaveLength(0)

    const authed = await rest('GET', `/media/file/${doc.filename}`, undefined, {
      authorization: `JWT ${token}`,
    })
    expect(authed.status).toBe(200)
    expect(authed.headers.get('cache-control')).toContain('private')
  })

  it('DM-MEDIA-06: mit Häkchen ownerApproved → 200 für Anonyme (Datei und Dokument)', async () => {
    const doc = await upload({ showsPerson: 'jutta', ownerApproved: true })
    const anon = await rest('GET', `/media/file/${doc.filename}`)
    expect(anon.status).toBe(200)
    expect((await rest('GET', `/media/${doc.id}`)).status).toBe(200)

    // Häkchen wieder entfernen → sofort wieder 404
    await payload.update({
      collection: 'media',
      id: doc.id,
      data: { ownerApproved: false } as never,
      overrideAccess: true,
    })
    expect((await rest('GET', `/media/file/${doc.filename}`)).status).toBe(404)
  })

  it('ownerApproved wirkt nur bei showsPerson = jutta: Kund:innen-Bild bleibt gesperrt (DM-MEDIA-04)', async () => {
    const doc = await upload({
      showsPerson: 'customer',
      ownerApproved: true,
      alt: 'Tattoo am Unterarm, Linien',
    })
    expect(doc.restricted).toBe(true)
    expect([403, 404]).toContain((await rest('GET', `/media/file/${doc.filename}`)).status)
  })
})

describe('P8.20 Startklar-Punkt vorgemerkt (P10.14)', () => {
  it('countUnapprovedOwnerPhotos zählt nur Fotos von Jutta ohne Freigabe', async () => {
    const { countUnapprovedOwnerPhotos } = await import('@/lib/media/ownerPhotos')
    const { STARTKLAR_PLANNED } = await import('@/lib/settings/readiness')
    expect(STARTKLAR_PLANNED.map((p) => p.id)).toContain('owner-photos-unapproved')
    const before = await countUnapprovedOwnerPhotos(payload)
    await upload({ showsPerson: 'jutta' })
    await upload({ showsPerson: 'jutta', ownerApproved: true })
    expect(await countUnapprovedOwnerPhotos(payload)).toBe(before + 1)
  })
})
