import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { setFlashPublished, setFlashStatus, suggestFlashNumber } from '@/lib/tattoo/admin'

import { adminReq, resetAdmin } from '../helpers/admin'
import { dbOf } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import { createTestImage } from '../helpers/products'
import { rest } from '../helpers/rest'

// P7.6 – Tattoo-Verwaltung Flash (KONZEPT §7.12): Nummernvorschlag ohne Seed/Fixtures, Status-Wechsel
// „verfügbar ↔ vergeben“ (setzt/leert `claimedAt`, idempotent), wiederholbare Motive nie „vergeben“ (Hook + DB-CHECK),
// „Offline nehmen“ und die Endpunkte nur für die Verwaltung.

let payload: Payload
let image: number
let token: string
let userId: number
const created: number[] = []

async function flash(data: Record<string, unknown>, seed = true): Promise<number> {
  const doc = await payload.create({
    collection: 'flash',
    data: { image, sizeCm: 8, priceCents: 9000, title: 'Motiv', seed, ...data } as never,
    overrideAccess: true,
    context: seed ? { seed: true } : {},
  })
  created.push(doc.id as number)
  return doc.id as number
}

beforeAll(async () => {
  payload = await getTestPayload()
  await payload.delete({
    collection: 'flash',
    where: { number: { in: [7, 991, 992, 993, 999] } },
    overrideAccess: true,
    context: { seed: true },
  })
  image = await createTestImage(payload, 'Hase mit Blume, Tusche')
  ;({ token, userId } = await resetAdmin(payload))
})

afterAll(async () => {
  await payload.delete({
    collection: 'flash',
    where: { id: { in: created } },
    overrideAccess: true,
    context: { seed: true },
  })
  await payload.delete({ collection: 'media', id: image, overrideAccess: true }).catch(() => null)
})

describe('Tattoo-Verwaltung: Flash (P7.6)', () => {
  it('AK Nummernvorschlag ignoriert seed = true (Seed 901–910, Fixtures 980–999) → 1 bei leerem echten Bestand', async () => {
    await flash({ number: 999 })
    await flash({ number: 991 })
    const real = await payload.count({
      collection: 'flash',
      where: { seed: { not_equals: true } },
      overrideAccess: true,
    })
    const req = await adminReq(payload, userId)
    if (real.totalDocs === 0) expect(await suggestFlashNumber(req)).toBe(1)
    const own = await flash({ number: 7 }, false)
    const next = await suggestFlashNumber(req)
    expect(next).toBeGreaterThanOrEqual(8)
    expect(next).toBeLessThan(980)
    // Endpunkt liefert dasselbe, nur für die Verwaltung
    const res = await rest('GET', '/flash/next-number', undefined, {
      authorization: `JWT ${token}`,
    })
    expect(await res.json()).toEqual({ number: next })
    expect((await rest('GET', '/flash/next-number')).status).toBe(403)
    await payload.delete({ collection: 'flash', id: own, overrideAccess: true })
  })

  it('Status-Chip: verfügbar → vergeben setzt claimedAt, zurück leert es; zweiter Klick ändert nichts', async () => {
    const id = await flash({ number: 992 })
    const req = await adminReq(payload, userId)
    const claimed = await setFlashStatus(req, id, 'claimed')
    expect(claimed.doc.status).toBe('claimed')
    expect(claimed.doc.claimedAt).toBeTruthy()
    expect((await setFlashStatus(req, id, 'claimed')).unchanged).toBe(true)
    const back = await setFlashStatus(req, id, 'available')
    expect(back.doc.status).toBe('available')
    expect(back.doc.claimedAt ?? null).toBeNull()
    // über den Endpunkt (2. Tap = Bestätigen im Dialog)
    const res = await rest(
      'POST',
      `/flash/${id}/status`,
      { status: 'claimed' },
      { authorization: `JWT ${token}` },
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { doc: { status: string } }).doc.status).toBe('claimed')
    expect((await rest('POST', `/flash/${id}/status`, { status: 'available' })).status).toBe(403)
  })

  it('AK wiederholbares Motiv auf „vergeben“ → verständliche Ablehnung mit Hinweis auf „Offline nehmen“ (DB-CHECK §9.2)', async () => {
    const id = await flash({ number: 993, repeatable: true })
    const res = await rest(
      'POST',
      `/flash/${id}/status`,
      { status: 'claimed' },
      { authorization: `JWT ${token}` },
    )
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toMatch(/wiederholbares Motiv/)
    expect(body.error).toContain('„Offline nehmen“')
    // auch der direkte Weg über die REST-API scheitert am Hook …
    const patch = await rest(
      'PATCH',
      `/flash/${id}`,
      { status: 'claimed' },
      { authorization: `JWT ${token}` },
    )
    expect(patch.status).toBe(400)
    // … und an der Datenbank
    await expect(
      dbOf(payload).execute(sql`UPDATE flash SET status = 'claimed' WHERE id = ${id}`),
    ).rejects.toThrow()
    // Pausieren = offline nehmen
    const req = await adminReq(payload, userId)
    const off = await setFlashPublished(req, id, false)
    expect(off.doc.published).toBe(false)
    expect(off.doc.status).toBe('available')
    expect((await setFlashPublished(req, id, false)).unchanged).toBe(true)
  })
})
