import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { formatBerlin } from '@/lib/time'

import { resetAdmin } from '../helpers/admin'
import { dbOf } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P1.24: Collection `privacy-requests` (DATENMODELL §6.26, L-17, R-150 bis R-153).

let payload: Payload
let seq = 0

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

async function create(data: Record<string, unknown>, now: string) {
  seq += 1
  return payload.create({
    collection: 'privacy-requests',
    data: {
      reference: `DS-2026-${String(seq).padStart(4, '0')}`,
      types: ['access'],
      contactEmail: 'Erika@Example.com',
      ...data,
    } as never,
    overrideAccess: true,
    context: { now },
  })
}

const update = (id: number, data: Record<string, unknown>, now = '2026-10-20T10:00:00.000Z') =>
  payload.update({
    collection: 'privacy-requests',
    id,
    data: data as never,
    overrideAccess: true,
    context: { now },
  })

async function wipe() {
  await dbOf(payload).execute(sql`DELETE FROM privacy_requests`)
}

beforeAll(async () => {
  payload = await getTestPayload()
  await wipe()
})

afterAll(wipe)

describe('privacy-requests (DATENMODELL §6.26)', () => {
  it('DM-PRQ-01 dueAt kalendergenau (15.10. → 15.11.; 31.01.2027 → 28.02.2027) in Europe/Berlin', async () => {
    const oct = await create(
      { receivedAt: '2026-10-14T22:00:00.000Z' }, // 15.10.2026 00:00 Berlin
      '2026-10-15T09:00:00.000Z',
    )
    expect(formatBerlin(new Date(oct.dueAt!), 'dd.MM.yyyy HH:mm')).toBe('15.11.2026 00:00')
    const jan = await create({ receivedAt: '2027-01-31T10:00:00.000Z' }, '2027-02-01T09:00:00.000Z')
    expect(formatBerlin(new Date(jan.dueAt!), 'dd.MM.yyyy')).toBe('28.02.2027')
    // Schaltjahr
    const leap = await create(
      { receivedAt: '2028-01-31T10:00:00.000Z' },
      '2028-02-01T09:00:00.000Z',
    )
    expect(formatBerlin(new Date(leap.dueAt!), 'dd.MM.yyyy')).toBe('29.02.2028')
    // Eingang in der Zukunft wird abgelehnt
    await rejects(
      create({ receivedAt: '2026-10-16T10:00:00.000Z' }, '2026-10-15T09:00:00.000Z'),
      /Zukunft/,
    )
    // Verlängerung höchstens + 2 Monate, begründet und im ersten Monat mitgeteilt
    await rejects(update(oct.id, { extendedDueAt: '2027-01-20T00:00:00.000Z' }), /zwei weitere/)
    await rejects(update(oct.id, { extendedDueAt: '2026-12-15T00:00:00.000Z' }), /begründen/)
    const ext = await update(oct.id, {
      extendedDueAt: '2026-12-15T00:00:00.000Z',
      extensionReason: 'Viele Datenquellen zu prüfen',
      extensionNotifiedAt: '2026-11-01T10:00:00.000Z',
    })
    expect(ext.extendedDueAt).toBeTruthy()
  })

  it('Status received → identity_check → in_progress → answered; Frist L-17, Audit ohne Inhalte', async () => {
    const r = await create({ receivedAt: '2026-10-14T22:00:00.000Z' }, '2026-10-15T09:00:00.000Z')
    expect(r).toMatchObject({
      status: 'received',
      contactEmail: 'erika@example.com',
      retainUntil: null,
    })
    await rejects(update(r.id, { status: 'answered' }), /nicht erlaubt/)
    await update(r.id, { status: 'identity_check' })
    await rejects(update(r.id, { identityVerified: true }), /wie die Identität/)
    const verified = await update(r.id, {
      identityVerified: true,
      identityMethod: 'stored_email',
      status: 'in_progress',
    })
    expect(verified.identityVerifiedAt).toBe('2026-10-20T10:00:00.000Z')
    await rejects(update(r.id, { status: 'answered' }), /Antwortdatum/)
    const done = await update(r.id, { status: 'answered', answeredAt: '2026-11-02T10:00:00.000Z' })
    // Ende des Abschlussjahres + 3 Jahre = 01.01.2030 00:00 Berlin
    expect(formatBerlin(new Date(done.retainUntil!), 'dd.MM.yyyy HH:mm')).toBe('01.01.2030 00:00')
    await rejects(update(r.id, { status: 'in_progress' }), /nicht erlaubt/)
    await rejects(update(r.id, { reference: 'DS-2026-9999' }), /unveränderlich/)

    const rej = await create({ receivedAt: '2026-10-14T22:00:00.000Z' }, '2026-10-15T09:00:00.000Z')
    await update(rej.id, { status: 'identity_check' })
    await rejects(
      update(rej.id, { status: 'rejected', answeredAt: '2026-11-02T10:00:00.000Z' }),
      /Begründung/,
    )
    await update(rej.id, {
      status: 'rejected',
      answeredAt: '2026-11-02T10:00:00.000Z',
      resultNote: 'Identität nicht nachgewiesen (Art. 12 Abs. 6 DSGVO).',
    })

    const audits = await payload.find({
      collection: 'audit-log',
      where: {
        and: [
          { entityCollection: { equals: 'privacy-requests' } },
          { entityId: { equals: String(r.id) } },
        ],
      },
      overrideAccess: true,
    })
    expect(audits.docs.length).toBeGreaterThanOrEqual(4)
    for (const a of audits.docs) {
      expect(a.action).toBe('privacy_request_changed')
      expect(a.summary).not.toMatch(/erika/i)
    }

    await rejects(update(r.id, { types: [] }), /mindestens eine/)
    // Nummer aus privacy_request_number_seq (§8.7): mitgegebene Werte ersetzt der Server; der Seed bringt sie mit
    const own = await create(
      { reference: 'DS-26-1', receivedAt: '2026-10-14T22:00:00.000Z' },
      '2026-10-15T09:00:00.000Z',
    )
    expect(own.reference).toMatch(/^DS-2026-\d{4}$/)
    await rejects(
      payload.create({
        collection: 'privacy-requests',
        data: {
          reference: 'DS-26-1',
          types: ['access'],
          contactEmail: 'seed@example.com',
          receivedAt: '2026-10-14T22:00:00.000Z',
          seed: true,
        } as never,
        overrideAccess: true,
        context: { seed: true, now: '2026-10-15T09:00:00.000Z' },
      }),
      /DS-JJJJ-NNNN/,
    )
  })

  it('P1.26 Verwaltung legt eine Anfrage ohne Nummer an: DS-<Jahr>-NNNN fortlaufend aus der Sequenz', async () => {
    const { token } = await resetAdmin(payload)
    const now = new Date()
    const post = () =>
      rest(
        'POST',
        '/privacy-requests',
        { types: ['access'], contactEmail: 'anfrage@example.com', receivedAt: now.toISOString() },
        { authorization: `JWT ${token}` },
      )
    const first = await post()
    expect(first.status).toBe(201)
    const a = ((await first.json()) as { doc: { reference: string } }).doc.reference
    const b = ((await (await post()).json()) as { doc: { reference: string } }).doc.reference
    const year = formatBerlin(now, 'yyyy')
    expect(a).toMatch(new RegExp(`^DS-${year}-\\d{4}$`))
    expect(Number(b.slice(-4))).toBe(Number(a.slice(-4)) + 1)
    await payload.delete({
      collection: 'users',
      where: { id: { exists: true } },
      overrideAccess: true,
    })
  })

  it('Zugriff: anonym 403, Löschen gesperrt (nur Task)', async () => {
    const r = await create({ receivedAt: '2026-10-14T22:00:00.000Z' }, '2026-10-15T09:00:00.000Z')
    expect((await rest('GET', '/privacy-requests')).status).toBe(403)
    expect((await rest('GET', `/privacy-requests/${r.id}`)).status).toBe(403)
    expect((await rest('POST', '/privacy-requests', { reference: 'DS-2026-0999' })).status).toBe(
      403,
    )
    expect((await rest('DELETE', `/privacy-requests/${r.id}`)).status).toBe(403)
    // Verwaltung: auch mit Login kein Löschen (access delete: none)
    await rejects(
      payload.delete({
        collection: 'privacy-requests',
        id: r.id,
        overrideAccess: false,
        user: { id: 1, collection: 'users' } as never,
      }),
      /Berechtigung|not allowed|Forbidden/i,
    )
  })
})
