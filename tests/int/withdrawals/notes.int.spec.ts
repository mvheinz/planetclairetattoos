import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loadWithdrawalDetail, loadWithdrawalList } from '@/admin/views/withdrawals/withdrawalQuery'
import type { Withdrawal } from '@/payload-types'

import { resetAdmin } from '../helpers/admin'
import { createOrder, deleteCommerce, orderData } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'
import { rest } from '../helpers/rest'

// P5.19 – „Widerrufe“ (KONZEPT §7.10, DATENMODELL §6.11): Fixtures analog W3, W4, W5 (SEED-SPEC §10) erscheinen als
// offen, W4 „nicht zugeordnet“, W5 mit „erstatten bis“ Eingang + 14 Tage (bei fester Uhr D+13). Die Erklärung ist über
// die API nicht änderbar (DM-WDR-03), Notizen schon (eigener Endpunkt `POST /api/withdrawals/:id/notes`).

const D = '2026-10-10T08:00:00.000Z' // Sa 10.10.2026 10:00 Berlin („heute“ der festen Uhr)
const NUMBERS = [996, 997]
let payload: Payload
let token: string
let w3: Withdrawal
let w4: Withdrawal
let w5: Withdrawal

const fixture = (data: Record<string, unknown>) =>
  payload.create({
    collection: 'withdrawals',
    data: { channel: 'online_form', locale: 'de', seed: true, ...data } as never,
    overrideAccess: true,
    context: { seed: true },
  })

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
  ;({ token } = await resetAdmin(payload, '198.51.100.63'))
  const fx = await createProductFixtures(payload)
  const [a, b] = await Promise.all(
    NUMBERS.map((nr) => createProduct(payload, completeProduct('keramik', nr, fx))),
  )
  const o4 = await createOrder(
    payload,
    orderData(90_004, [{ id: a!.id as number, itemNumber: 996 }], {
      status: 'delivered',
      paymentMethod: 'prepayment',
      paymentProvider: 'bank_transfer',
    }),
    { seed: true },
  )
  const o6 = await createOrder(
    payload,
    orderData(90_006, [{ id: b!.id as number, itemNumber: 997 }], { status: 'delivered' }),
    { seed: true },
  )
  w3 = await fixture({
    reference: 'WR-2026-90003',
    order: o4.id,
    receivedAt: '2026-10-01T17:30:00.000Z', // D-9 19:30
    name: 'Mia Beispiel',
    email: 'mia@example.com',
    contractIdentification: 'PC-2026-90004',
    itemsText: 'graue Cap',
    matchStatus: 'auto_matched',
    status: 'goods_returned',
    goodsReturnedAt: '2026-10-08T09:15:00.000Z',
  })
  w4 = await fixture({
    reference: 'WR-2026-90004',
    receivedAt: '2026-10-06T14:02:00.000Z', // D-4 16:02
    name: 'Rudi Beispiel',
    email: 'rudi@example.com',
    contractIdentification:
      'Hab bei dir auf dem Flohmarkt eine Tasse gekauft, die möchte ich zurückgeben.',
    itemsText: 'Tasse mit Hund',
    matchStatus: 'needs_manual_match',
    status: 'received',
    adminNotes: 'Kauf auf dem Flohmarkt.',
  })
  w5 = await fixture({
    reference: 'WR-2026-90005',
    order: o6.id,
    receivedAt: '2026-10-09T19:18:00.000Z', // D-1 21:18
    name: 'Erika Beispiel',
    email: 'erika@example.com',
    contractIdentification: 'Order PC-2026-90006',
    itemsText: 'Dress “Bunny Border”',
    reason: 'Lovely dress, but too long for me.',
    locale: 'en',
    matchStatus: 'auto_matched',
    status: 'received',
  })
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
})

const req = () => createLocalReq({}, payload)

describe('„Widerrufe“ (P5.19)', () => {
  it('Fixtures analog W3, W4, W5 offen; W4 „nicht zugeordnet“; W5 erstatten bis Eingang + 14 Tage (D+13); ab Tag 10 rot', async () => {
    const list = await loadWithdrawalList(await req(), new Date(D))
    const refs = list.open.map((c) => c.reference)
    expect(refs).toEqual(['WR-2026-90003', 'WR-2026-90004', 'WR-2026-90005'])
    const [c3, c4, c5] = list.open
    expect(c3).toMatchObject({
      orderNumber: 'PC-2026-90004',
      statusLabel: expect.any(String),
      refundDue: '15.10.2026',
      refundUrgent: false,
      daysSinceReceipt: 9,
    })
    expect(c4).toMatchObject({ orderNumber: null, receivedAt: '06.10.2026, 16:02 Uhr' })
    expect(c5).toMatchObject({ refundDue: '23.10.2026', orderNumber: 'PC-2026-90006' })
    expect(w5.refundDueAt).toBe('2026-10-23T19:18:00.000Z')
    // Tag 10 nach Eingang → rot
    const later = await loadWithdrawalList(await req(), new Date('2026-10-11T08:00:00.000Z'))
    expect(later.open.find((c) => c.id === w3.id)?.refundUrgent).toBe(true)
  })

  it('Detail: Erklärung aus dem Snapshot, Bestellung mit Positionen und Zahlart', async () => {
    const detail = await loadWithdrawalDetail(await req(), w3.id, new Date(D))
    expect(detail?.declaration).toMatchObject({ name: 'Mia Beispiel', itemsText: 'graue Cap' })
    expect(detail?.order).toMatchObject({
      orderNumber: 'PC-2026-90004',
      paymentLabel: 'Vorkasse (Überweisung)',
    })
    expect(detail?.order?.items).toHaveLength(1)
    const unmatched = await loadWithdrawalDetail(await req(), w4.id, new Date(D))
    expect(unmatched?.order).toBeNull()
    expect(unmatched?.adminNotes).toBe('Kauf auf dem Flohmarkt.')
  })

  it('DM-WDR-03 Erklärung über die API nicht änderbar, Notizen schon (POST /notes, REST)', async () => {
    const auth = { authorization: `JWT ${token}`, 'idempotency-key': crypto.randomUUID() }
    // anonym: kein Zugriff
    expect((await rest('POST', `/withdrawals/${w4.id}/notes`, { adminNotes: 'x' })).status).toBe(
      403,
    )

    const res = await rest(
      'POST',
      `/withdrawals/${w4.id}/notes`,
      { adminNotes: 'Rudi per Mail antworten.', name: 'Jemand Anderes', itemsText: 'nichts' },
      auth,
    )
    expect(res.status).toBe(200)
    const again = await rest(
      'POST',
      `/withdrawals/${w4.id}/notes`,
      { adminNotes: 'Rudi per Mail antworten.' },
      auth,
    )
    expect(((await again.json()) as { unchanged: boolean }).unchanged).toBe(true)

    // REST-Update der Erklärung: Felder bleiben unverändert (Feldzugriff gesperrt)
    await rest(
      'PATCH',
      `/withdrawals/${w4.id}`,
      { name: 'Jemand Anderes', contractIdentification: 'geändert', reason: 'neu' },
      auth,
    )
    const reread = await payload.findByID({
      collection: 'withdrawals',
      id: w4.id,
      overrideAccess: true,
    })
    expect(reread).toMatchObject({
      adminNotes: 'Rudi per Mail antworten.',
      name: 'Rudi Beispiel',
      itemsText: 'Tasse mit Hund',
      contractIdentification: w4.contractIdentification,
      receivedAt: w4.receivedAt,
    })
    expect(reread.reason ?? null).toBeNull()
    expect(reread.submissionSnapshot).toEqual(w4.submissionSnapshot)

    // Local API (ohne Seed-Kontext): Hook lehnt ab
    await expect(
      payload.update({
        collection: 'withdrawals',
        id: w4.id,
        data: { name: 'Jemand Anderes' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
    expect(
      (await payload.findByID({ collection: 'withdrawals', id: w4.id, overrideAccess: true })).name,
    ).toBe('Rudi Beispiel')
  })
})
