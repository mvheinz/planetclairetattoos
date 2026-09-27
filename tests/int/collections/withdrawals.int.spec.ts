import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { createOrder, deleteCommerce, orderData, type ItemInput } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// P1.21: Widerrufe (DATENMODELL §6.11, § 356a BGB, R-093/R-094).

let payload: Payload
let item: ItemInput
let ref = 0
const nextRef = () => `WR-2026-${String(++ref).padStart(5, '0')}`

type Err = { message?: string; data?: { errors?: { message: string }[] } }
async function rejects(promise: Promise<unknown>, re: RegExp): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e as Err,
  )
  expect(err, 'erwartet Ablehnung').not.toBeNull()
  expect([err!.message, ...(err!.data?.errors ?? []).map((e) => e.message)].join(' | ')).toMatch(re)
}

const submit = (data: Record<string, unknown>, now = '2026-10-05T08:15:30.000Z') =>
  payload.create({
    collection: 'withdrawals',
    data: {
      reference: nextRef(),
      channel: 'online_form',
      name: 'Erika Beispiel',
      contractIdentification: 'Bestellung PC-2026-00980',
      email: 'Erika@Example.com',
      locale: 'de',
      ...data,
    } as never,
    overrideAccess: true,
    context: { system: true, now },
  })

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  const fx = await createProductFixtures(payload)
  const p = await createProduct(payload, completeProduct('keramik', 980, fx))
  item = { id: p.id as number, itemNumber: 980 }
  await createOrder(payload, orderData(980, [item]))
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload)
})

describe('withdrawals (DATENMODELL §6.11)', () => {
  it('Eingang: Serverzeit statt Clientwert, Frist + 14 Tage, Snapshot, Auto-Zuordnung, Audit', async () => {
    const w = await submit({ receivedAt: '2020-01-01T00:00:00.000Z', reason: 'passt nicht' })
    expect(w.receivedAt).toBe('2026-10-05T08:15:30.000Z')
    expect(w.refundDueAt).toBe('2026-10-19T08:15:30.000Z')
    expect(w.status).toBe('received')
    expect(w.matchStatus).toBe('auto_matched')
    expect(w.order).toBeTruthy()
    expect(w.submissionSnapshot).toMatchObject({
      name: 'Erika Beispiel',
      reason: 'passt nicht',
      receivedAt: '2026-10-05T08:15:30.000Z',
      receivedAtBerlin: '05.10.2026, 10:15:30 Uhr (Europe/Berlin)',
    })
    expect(JSON.stringify(w)).not.toMatch(/ipHash|userAgent/)
    const audit = await payload.find({
      collection: 'audit-log',
      where: {
        and: [
          { entityCollection: { equals: 'withdrawals' } },
          { entityId: { equals: String(w.id) } },
        ],
      },
      overrideAccess: true,
    })
    expect(audit.docs.map((d) => d.action)).toEqual(['withdrawal_received'])
  })

  it('ohne passende Bestellung: needs_manual_match, Aufbewahrung bis Ende Eingangsjahr + 6', async () => {
    const w = await submit({
      contractIdentification: 'Die Tasse vom Flohmarkt',
      email: 'x@planetclairetattoos.com',
    })
    expect(w.matchStatus).toBe('needs_manual_match')
    expect(w.order ?? null).toBeNull()
    expect(w.retainUntil).toBe('2032-12-31T23:00:00.000Z')
    const wrongMail = await submit({ email: 'jemand@planetclairetattoos.com' })
    expect(wrongMail.matchStatus).toBe('needs_manual_match')
  })

  it('DM-WDR-03 name und receivedAt (und die übrigen Angaben) lassen sich nicht ändern', async () => {
    const w = await submit({})
    for (const [field, value] of [
      ['name', 'Jemand Anderes'],
      ['receivedAt', '2026-10-06T10:00:00.000Z'],
      ['contractIdentification', 'geändert'],
      ['email', 'neu@planetclairetattoos.com'],
      ['reason', 'nachträglich'],
      ['channel', 'letter'],
    ] as const) {
      await rejects(
        payload.update({
          collection: 'withdrawals',
          id: w.id,
          data: { [field]: value } as never,
          overrideAccess: true,
          context: { system: true },
        }),
        /unveränderlich/,
      )
    }
    const reread = await payload.findByID({
      collection: 'withdrawals',
      id: w.id,
      overrideAccess: true,
    })
    expect(reread.name).toBe('Erika Beispiel')
    expect(reread.receivedAt).toBe('2026-10-05T08:15:30.000Z')
    // Notizen bleiben änderbar
    const noted = await payload.update({
      collection: 'withdrawals',
      id: w.id,
      data: { adminNotes: 'Paket kommt per DHL' },
      overrideAccess: true,
    })
    expect(noted.adminNotes).toBe('Paket kommt per DHL')
  })

  it('manuelle Erfassung: eingegebener Zugang, nicht in der Zukunft; Anlage nur über Server-Code', async () => {
    const letter = await submit({
      channel: 'letter',
      email: null,
      receivedAt: '2026-10-03T09:00:00.000Z',
    })
    expect(letter.receivedAt).toBe('2026-10-03T09:00:00.000Z')
    await rejects(submit({ channel: 'email', receivedAt: '2026-10-09T09:00:00.000Z' }), /Zukunft/)
    await rejects(submit({ email: null }), /Pflichtfeld/)
    await rejects(
      payload.create({
        collection: 'withdrawals',
        data: {
          reference: nextRef(),
          name: 'A B',
          contractIdentification: 'xyz',
          locale: 'de',
        } as never,
        overrideAccess: true,
      }),
      /Widerrufsfunktion/,
    )
    await rejects(submit({ reference: 'WR-26-1' }), /WR-JJJJ-NNNNN/)
  })

  it('Status nur über Übergänge; Ablehnen nie automatisch (R-094)', async () => {
    const w = await submit({})
    await rejects(
      payload.update({
        collection: 'withdrawals',
        id: w.id,
        data: { status: 'refunded' },
        overrideAccess: true,
      }),
      /Aktionsknöpfe/,
    )
    await rejects(
      payload.update({
        collection: 'withdrawals',
        id: w.id,
        data: { status: 'rejected', closeNote: 'eindeutig verfristet' },
        overrideAccess: true,
        context: { system: true, transition: 'reject' },
      }),
      /nie automatisch/,
    )
    const closed = await payload.update({
      collection: 'withdrawals',
      id: w.id,
      data: { status: 'closed', closeReason: 'duplicate' },
      overrideAccess: true,
      context: { system: true, transition: 'close' },
    })
    expect(closed.closedAt).toBeTruthy()
    await rejects(
      payload.update({
        collection: 'withdrawals',
        id: w.id,
        data: { status: 'received' },
        overrideAccess: true,
        context: { system: true, transition: 'x' },
      }),
      /nicht von „closed“/,
    )
  })

  it('anonymes REST: 403/404', async () => {
    for (const [method, path] of [
      ['GET', '/withdrawals'],
      ['POST', '/withdrawals'],
      ['GET', '/invoices'],
      ['POST', '/invoices'],
      ['GET', '/invoice-counters'],
    ] as const) {
      const res = await rest(method, path, method === 'POST' ? { name: 'x' } : undefined)
      expect([401, 403, 404], `${method} ${path}`).toContain(res.status)
    }
  })
})
