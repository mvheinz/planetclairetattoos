import { createLocalReq } from 'payload'
import { beforeAll, describe, expect, it } from 'vitest'

import { loadPackingList } from '@/admin/views/orders/orderQuery'
import { loadPickupList, loadShippedList } from '@/admin/views/orders/fulfillmentQuery'
import { refundDialogData, refundProposal, requestRefund } from '@/lib/commerce/refundOrder'
import { markDeliveredAuto } from '@/lib/commerce/shipped'
import { submitWithdrawal } from '@/lib/legal/withdrawal'
import { markGoodsReturned } from '@/lib/legal/withdrawalInbox'
import { inTransaction } from '@/lib/payload/transaction'
import type { Order, Withdrawal } from '@/payload-types'

import { readOutbox } from '../../helpers/outbox'
import { resetAdmin } from '../helpers/admin'
import { createOrder, orderData, type ItemInput } from '../helpers/commerce'
import { rest } from '../helpers/rest'
import { shopHarness } from '../helpers/shop'

// Teil-Widerruf und Teil-Erstattung vor Versand bzw. Abholung (DATENMODELL §6.8.5/§6.11 Umsetzungsnotizen, KONZEPT
// §5.3/§5.4): Die Stücke, die die Kundin behält, lassen sich weiter packen, versenden bzw. übergeben – M06/M07, Packliste
// und Abholkarte nennen nur sie. Widerruf des ganzen Vertrags sperrt weiter (409). Teil-Widerruf nur im Freitext: nichts
// automatisch gebucht, Versand gesperrt, bis Jutta die Stücke zuordnet.

const NUMBERS = [980, 981, 982, 983]
const h = shopHarness({
  start: '2026-10-01T08:00:00.000Z',
  numbers: NUMBERS,
  tag: 'partial-delivery',
})
const EMAIL = 'teil@planetclaire.local'
const NOW = new Date('2026-10-02T10:00:00.000Z')
let token: string
let seq = 0
let ipSeq = 0

beforeAll(async () => {
  ;({ token } = await resetAdmin(h.payload, '198.51.100.83'))
})

const PICKUP = {
  fulfillmentMethod: 'pickup',
  shippingAddress: undefined,
  shippingZone: undefined,
  shippingClass: undefined,
  shippingCents: 0,
  billingAddress: {
    name: 'Erika Beispiel',
    addressLine1: 'Musterstraße 1',
    postalCode: '10115',
    city: 'Berlin',
    country: 'DE',
  },
}

/** Bezahlte Bestellung mit zwei Stücken (Paket klein; bei Abholung ohne Versand). */
async function twoPieces(
  [a, b]: [number, number],
  options: { pickup?: boolean; prepayment?: boolean } = {},
): Promise<Order> {
  const items: ItemInput[] = [
    { id: await h.piece(a), itemNumber: a, shippingClass: 'paket_klein' },
    { id: await h.piece(b), itemNumber: b, shippingClass: 'paket_klein' },
  ]
  const over: Record<string, unknown> = {
    shippingClass: 'paket_klein',
    customer: { name: 'Erika Teil', email: EMAIL },
    ...(options.pickup ? { ...PICKUP, totalCents: 9000 } : {}),
    ...(options.prepayment
      ? { paymentMethod: 'prepayment', paymentProvider: 'bank_transfer' }
      : {}),
  }
  return (await createOrder(h.payload, orderData(97_700 + ++seq, items, over))) as Order
}

const itemId = (o: Order, nr: number) => String(o.items.find((i) => i.itemNumber === nr)!.id)

async function withdraw(
  o: Order,
  over: { affectedItemIds?: string[]; itemsText?: string | null } = {},
): Promise<Withdrawal> {
  const res = await submitWithdrawal(
    {
      name: 'Erika Teil',
      contractIdentification: `Bestellung ${o.orderNumber}`,
      email: EMAIL,
      locale: 'de',
      affectedItemIds: over.affectedItemIds ?? [],
      itemsText: over.itemsText ?? null,
    },
    { now: NOW, ip: `203.0.113.${100 + ++ipSeq}`, payload: h.payload },
  )
  if (!res.ok || res.spam) throw new Error('kein Widerruf')
  expect(res.receipt.matchStatus).toBe('auto_matched')
  return (await h.payload.findByID({
    collection: 'withdrawals',
    id: res.receipt.id,
    depth: 0,
    overrideAccess: true,
  })) as Withdrawal
}

const post = async (path: string, body: unknown = {}) => {
  const res = await rest('POST', path, body, {
    authorization: `JWT ${token}`,
    'idempotency-key': crypto.randomUUID(),
  })
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}
const order = (id: number, action: string, body: unknown = {}) =>
  post(`/orders/${id}/${action}`, body)

const systemReq = () =>
  createLocalReq({ context: { system: true, now: NOW.toISOString() } }, h.payload)

/** Teil-Erstattung mit Pflicht-Grund (Vorkasse: sofort abgeschlossen, ohne Zahlungsanbieter). */
async function refundItems(o: Order, ids: string[], reason = 'breakage', withdrawalId?: number) {
  const req = await systemReq()
  const { proposedCents } = await refundProposal(req, o.id, ids)
  const res = await requestRefund(
    req,
    o.id,
    {
      reason,
      itemIds: ids,
      amountCents: proposedCents,
      manualTransferConfirmed: true,
      ...(withdrawalId ? { withdrawalId } : {}),
    },
    NOW,
  )
  await res.afterCommit?.()
}

/** „Gepackt“ und „Versendet melden“ über die Endpunkte. */
async function packAndShip(o: Order, trackingNumber: string) {
  expect((await order(o.id, 'packed')).status).toBe(200)
  expect((await order(o.id, 'ship', { carrier: 'dhl', trackingNumber })).status).toBe(200)
}

const mails = async (type: 'order_shipped' | 'pickup_ready', orderNumber: string) =>
  (await readOutbox({ to: EMAIL, type }, h.outboxDir)).filter((m) =>
    m.subject.includes(orderNumber),
  )

const packingCard = async (id: number) =>
  (await loadPackingList(await systemReq())).find((c) => c.id === id)
const pickupCard = async (id: number) =>
  (await loadPickupList(await systemReq(), NOW)).find((c) => c.id === id)

describe('Teil-Widerruf bzw. Teil-Erstattung vor dem Versand: Rest wird geliefert', () => {
  it('Teil-Widerruf (angehakt) vor dem Versand → Bestellung bleibt bezahlt; Rest packen und versenden, M06 nur mit dem Rest', async () => {
    const o = await twoPieces([980, 981])
    const w = await withdraw(o, { affectedItemIds: [itemId(o, 980)] })
    expect(w.affectedItemIds).toEqual([itemId(o, 980)])
    const after = await h.order(o.id)
    expect(after.status).toBe('paid')
    expect(after.items.map((i) => [i.itemNumber, i.status])).toEqual([
      [980, 'withdrawn'],
      [981, 'active'],
    ])

    // Packliste: nur das behaltene Stück, „Nicht mehr versenden“ nur am widerrufenen
    const card = await packingCard(o.id)
    expect(card?.items.map((i) => i.nr)).toEqual(['Nr. 981'])
    expect(card?.hints.find((x) => x.key === 'withdrawnItems')?.text).toBe(
      'Nicht mehr versenden – Widerruf: Nr. 980',
    )
    expect(card?.hints.some((x) => x.key === 'withdrawal')).toBe(false)
    expect(card).toMatchObject({ canPack: true, canShip: true, withdrawn: false })

    expect((await order(o.id, 'packed')).status).toBe(200)
    const shipped = await order(o.id, 'ship', {
      carrier: 'dhl',
      trackingNumber: '00340434312345678',
    })
    expect(shipped.status).toBe(200)
    const s = await h.order(o.id)
    expect(s.status).toBe('shipped')
    expect(s.timestamps.shippedAt).toBeTruthy()
    const m06 = await mails('order_shipped', o.orderNumber)
    expect(m06).toHaveLength(1)
    expect(m06[0]!.text).toContain('Teststück 981')
    expect(m06[0]!.text).not.toContain('Teststück 980')
  })

  it('Teil-Erstattung wegen Bruch vor dem Versand → partially_refunded; Rest „Gepackt“ (O6) und „Versendet“ (O7), M06 nur mit dem Rest', async () => {
    const o = await twoPieces([982, 983], { prepayment: true })
    await refundItems(o, [itemId(o, 982)])
    const refunded = await h.order(o.id)
    expect(refunded.status).toBe('partially_refunded')
    expect(refunded.items.map((i) => i.status)).toEqual(['refunded', 'active'])

    const card = await packingCard(o.id)
    expect(card?.items.map((i) => i.nr)).toEqual(['Nr. 983'])
    expect(card?.hints.find((x) => x.key === 'refundedItems')?.text).toBe(
      'Nicht mehr versenden – erstattet: Nr. 982',
    )
    expect(card).toMatchObject({ canPack: true, canShip: true })

    expect((await order(o.id, 'packed')).status).toBe(200)
    expect((await h.order(o.id)).status).toBe('packed')
    expect(
      (await order(o.id, 'ship', { carrier: 'dhl', trackingNumber: '00340434312345679' })).status,
    ).toBe(200)
    const s = await h.order(o.id)
    expect(s.status).toBe('shipped')
    expect(s.statusHistory?.map((x) => x.transition)).toEqual(['O1', 'O15', 'O6', 'O7'])
    const m06 = await mails('order_shipped', o.orderNumber)
    expect(m06).toHaveLength(1)
    expect(m06[0]!.text).toContain('Teststück 983')
    expect(m06[0]!.text).not.toContain('Teststück 982')
    // nach dem Versand keine zweite Rest-Lieferung
    expect((await h.order(o.id)).status).toBe('shipped')
  })

  it('Teil-Widerruf vor dem Versand, Erstattung erst während des Transports → „Zugestellt“ (O10) aus partially_refunded, auch automatisch', async () => {
    const o = await twoPieces([980, 981], { prepayment: true })
    const w = await withdraw(o, { affectedItemIds: [itemId(o, 980)] })
    await packAndShip(o, '00340434312345675')
    await refundItems(o, [itemId(o, 980)], 'withdrawal', w.id)
    const refunded = await h.order(o.id)
    expect(refunded.status).toBe('partially_refunded')
    expect(refunded.items.map((i) => i.status)).toEqual(['refunded', 'active'])
    const wd = await h.payload.findByID({
      collection: 'withdrawals',
      id: w.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(wd.status).toBe('refunded')
    const card = (await loadShippedList(await systemReq(), NOW)).find((c) => c.id === o.id)
    expect(card).toMatchObject({ status: 'partially_refunded', canDeliver: true })
    expect(await packingCard(o.id)).toBeUndefined()
    expect((await order(o.id, 'delivered')).status).toBe(200)
    const d = await h.order(o.id)
    expect(d.status).toBe('delivered')
    expect(d.timestamps.deliveredAt).toBeTruthy()
    expect(d.statusHistory?.at(-1)?.transition).toBe('O10')
    expect((await order(o.id, 'delivered')).json.unchanged).toBe(true)

    // Task `markDelivered`: nach 10 Tagen auch die Teil-Erstattung während des Transports
    const p = await twoPieces([982, 983], { prepayment: true })
    await packAndShip(p, '00340434312345676')
    await refundItems(p, [itemId(p, 983)], 'goodwill')
    const shippedAt = (await h.order(p.id)).timestamps.shippedAt!
    expect((await h.order(p.id)).status).toBe('partially_refunded')
    const auto = await markDeliveredAuto(
      h.payload,
      new Date(Date.parse(shippedAt) + 11 * 86_400_000),
    )
    expect(auto.errors).toBe(0)
    const pd = await h.order(p.id)
    expect(pd.status).toBe('delivered')
    expect(pd.shipment?.deliveredSource).toBe('auto')
  })

  it('Teil-Erstattung, danach Rest widerrufen → nichts mehr zu versenden (409, nicht auf der Packliste)', async () => {
    const o = await twoPieces([980, 981], { prepayment: true })
    await refundItems(o, [itemId(o, 980)])
    await withdraw(o, { affectedItemIds: [itemId(o, 981)] })
    const after = await h.order(o.id)
    expect(after.status).toBe('partially_refunded')
    expect(after.items.map((i) => i.status)).toEqual(['refunded', 'withdrawn'])
    expect(await packingCard(o.id)).toBeUndefined()
    expect((await order(o.id, 'packed')).status).toBe(409)
    expect(
      (await order(o.id, 'ship', { carrier: 'dhl', trackingNumber: '00340434312345670' })).status,
    ).toBe(409)
    expect((await h.order(o.id)).status).toBe('partially_refunded')
  })
})

describe('Teil-Widerruf bzw. Teil-Erstattung vor der Abholung', () => {
  it('Teil-Widerruf vor der Abholung → „Bereit zur Abholung“ (M07 nur mit dem Rest) und „Abgeholt“', async () => {
    const o = await twoPieces([980, 981], { pickup: true })
    await withdraw(o, { affectedItemIds: [itemId(o, 981)] })
    expect((await h.order(o.id)).status).toBe('paid')
    const card = await pickupCard(o.id)
    expect(card).toMatchObject({ step: 'ready', blocked: false })
    expect(card?.items).toEqual(['Nr. 980 Teststück 980'])
    expect(card?.warnings).toEqual(['Nicht mehr übergeben – Widerruf: Nr. 981'])

    const ready = await order(o.id, 'pickup-ready', { messageText: 'Abholung im Studio, Mo–Fr' })
    expect(ready.status).toBe(200)
    expect((await h.order(o.id)).status).toBe('ready_for_pickup')
    const m07 = await mails('pickup_ready', o.orderNumber)
    expect(m07).toHaveLength(1)
    expect(m07[0]!.text).toContain('Teststück 980')
    expect(m07[0]!.text).not.toContain('Teststück 981')

    expect((await order(o.id, 'picked-up')).status).toBe(200)
    const done = await h.order(o.id)
    expect(done.status).toBe('picked_up')
    expect(done.timestamps.pickedUpAt).toBeTruthy()
  })

  it('Teil-Erstattung bei abholbereiter Bestellung → „Abgeholt“ (O9) aus partially_refunded; bezahlt → „Bereit“ (O8)', async () => {
    const o = await twoPieces([982, 983], { pickup: true, prepayment: true })
    expect((await order(o.id, 'pickup-ready', { messageText: 'Abholung im Studio' })).status).toBe(
      200,
    )
    await refundItems(o, [itemId(o, 982)], 'goodwill')
    expect((await h.order(o.id)).status).toBe('partially_refunded')
    expect(await pickupCard(o.id)).toMatchObject({ step: 'handover', blocked: false })
    // „Bereit zur Abholung“ geht nicht noch einmal (Text und M07 stehen fest)
    expect((await order(o.id, 'pickup-ready', { messageText: 'nochmal' })).status).toBe(409)
    expect((await order(o.id, 'picked-up')).status).toBe(200)
    const done = await h.order(o.id)
    expect(done.status).toBe('picked_up')
    expect(done.statusHistory?.at(-1)?.transition).toBe('O9')

    const p = await twoPieces([980, 981], { pickup: true, prepayment: true })
    await refundItems(p, [itemId(p, 981)])
    expect((await h.order(p.id)).status).toBe('partially_refunded')
    expect((await order(p.id, 'picked-up')).status).toBe(409)
    expect((await order(p.id, 'pickup-ready', { messageText: 'Abholung im Studio' })).status).toBe(
      200,
    )
    const r = await h.order(p.id)
    expect(r.status).toBe('ready_for_pickup')
    expect(r.statusHistory?.at(-1)?.transition).toBe('O8')
    const m07 = await mails('pickup_ready', p.orderNumber)
    expect(m07[0]!.text).toContain('Teststück 980')
    expect(m07[0]!.text).not.toContain('Teststück 981')
  })
})

describe('Widerruf des ganzen Vertrags vor Versand bzw. Abholung: weiter gesperrt', () => {
  it('ohne Auswahl und ohne Freitext → withdrawal_received, Packen/Versand/Abholung 409', async () => {
    const o = await twoPieces([980, 981])
    await withdraw(o)
    const after = await h.order(o.id)
    expect(after.status).toBe('withdrawal_received')
    expect(after.items.map((i) => i.status)).toEqual(['withdrawn', 'withdrawn'])
    const pack = await order(o.id, 'packing', { checklist: {} })
    expect(pack.status).toBe(409)
    expect(JSON.stringify(pack.json)).toContain('Nicht mehr versenden – Widerruf!')
    expect((await order(o.id, 'packed')).status).toBe(409)
    const ship = await order(o.id, 'ship', { carrier: 'dhl', trackingNumber: '00340434312345671' })
    expect(ship.status).toBe(409)
    expect(JSON.stringify(ship.json)).toContain('Nicht mehr versenden – Widerruf!')

    const p = await twoPieces([982, 983], { pickup: true })
    await withdraw(p, { affectedItemIds: [itemId(p, 982), itemId(p, 983)] })
    expect((await h.order(p.id)).status).toBe('withdrawal_received')
    const ready = await order(p.id, 'pickup-ready', { messageText: 'Abholung im Studio' })
    expect(ready.status).toBe(409)
    expect(JSON.stringify(ready.json)).toContain('Nicht mehr übergeben – Widerruf!')
    expect(await pickupCard(p.id)).toBeUndefined()
  })
})

describe('Teil-Widerruf nur im Freitext (keins angehakt)', () => {
  it('nichts automatisch gebucht, Versand und Erstattung gesperrt; „Stücke zuordnen“ bucht die Auswahl, danach geht der Rest raus', async () => {
    const o = await twoPieces([980, 981])
    const w = await withdraw(o, { itemsText: 'nur die Nr. 980, die andere behalte ich' })
    expect(w.affectedItemIds ?? []).toEqual([])
    const after = await h.order(o.id)
    expect(after.status).toBe('paid')
    expect(after.items.map((i) => i.status)).toEqual(['active', 'active'])
    expect(after.adminAttention).toMatchObject({
      flag: true,
      reason: 'manual',
      note: `Teil-Widerruf ${w.reference} im Freitext – bitte Stücke zuordnen`,
    })

    // M08 bestätigt, was gebucht ist: den erklärten Teil-Widerruf (Freitext), nicht „ganzer Vertrag“; A04 bittet ums
    // Zuordnen
    const ofRef = <T extends { subject: string }>(list: T[]) =>
      list.filter((m) => m.subject.includes(w.reference))
    const m08 = ofRef(await readOutbox({ to: EMAIL, type: 'withdrawal_receipt' }, h.outboxDir))
    expect(m08).toHaveLength(1)
    expect(m08[0]!.text).toContain('Betroffene Stücke: nur die Nr. 980, die andere behalte ich')
    expect(m08[0]!.text).not.toContain('der ganze Vertrag')
    const a04 = ofRef(await readOutbox({ type: 'admin_withdrawal_received' }, h.outboxDir))
    expect(a04).toHaveLength(1)
    expect(a04[0]!.text).toContain('„Stücke zuordnen“')
    expect(a04[0]!.text).not.toContain('ganze Bestellung')

    // Packen, Versand, „Ware ist zurück“ und Erstattung mit Grund Widerruf: erst zuordnen
    const card = await packingCard(o.id)
    expect(card?.hints.find((x) => x.key === 'withdrawalUnassigned')?.text).toContain(w.reference)
    expect(card).toMatchObject({ canPack: false, canShip: false })
    const packed = await order(o.id, 'packed')
    expect(packed.status).toBe(409)
    expect(JSON.stringify(packed.json)).toContain('Erst die Stücke zuordnen')
    expect(
      (await order(o.id, 'ship', { carrier: 'dhl', trackingNumber: '00340434312345672' })).status,
    ).toBe(409)
    const req = await systemReq()
    const dialog = await refundDialogData(req, o.id, w)
    expect(dialog.needsItemAssignment).toBe(true)
    expect(dialog.items.filter((i) => i.preselected)).toEqual([])
    expect(dialog.proposal.proposedCents).toBe(0)
    await expect(
      requestRefund(
        req,
        o.id,
        { reason: 'withdrawal', withdrawalId: w.id, itemIds: [itemId(o, 980)], amountCents: 4500 },
        NOW,
      ),
    ).rejects.toThrow(/Stücke zuordnen/)
    await expect(inTransaction(req, () => markGoodsReturned(req, w.id, {}, NOW))).rejects.toThrow(
      /Stücke zuordnen/,
    )

    // „Stücke zuordnen“: nur mit Auswahl aus der Bestellung
    expect((await post(`/withdrawals/${w.id}/assign-items`, { itemIds: [] })).status).toBe(400)
    expect(
      (await post(`/withdrawals/${w.id}/assign-items`, { itemIds: ['gibt-es-nicht'] })).status,
    ).toBe(400)
    const assigned = await post(`/withdrawals/${w.id}/assign-items`, {
      itemIds: [itemId(o, 980)],
    })
    expect(assigned.status).toBe(200)
    const again = await post(`/withdrawals/${w.id}/assign-items`, { itemIds: [itemId(o, 980)] })
    expect(again.json.unchanged).toBe(true)
    const wd = (await h.payload.findByID({
      collection: 'withdrawals',
      id: w.id,
      depth: 0,
      overrideAccess: true,
    })) as Withdrawal
    expect(wd.affectedItemIds).toEqual([itemId(o, 980)])
    expect(wd.status).toBe('received')
    const booked = await h.order(o.id)
    expect(booked.status).toBe('paid')
    expect(booked.items.map((i) => i.status)).toEqual(['withdrawn', 'active'])
    expect(booked.adminAttention?.flag ?? false).toBe(false)
    const preselected = await refundDialogData(await systemReq(), o.id, wd)
    expect(preselected.needsItemAssignment).toBe(false)
    expect(preselected.items.filter((i) => i.preselected).map((i) => i.id)).toEqual([
      itemId(o, 980),
    ])

    // Rest packen und versenden: M06 nur mit dem behaltenen Stück
    expect((await order(o.id, 'packed')).status).toBe(200)
    expect(
      (await order(o.id, 'ship', { carrier: 'dhl', trackingNumber: '00340434312345673' })).status,
    ).toBe(200)
    const m06 = await mails('order_shipped', o.orderNumber)
    expect(m06[0]!.text).toContain('Teststück 981')
    expect(m06[0]!.text).not.toContain('Teststück 980')
  })

  it('nach dem Versand: O11 wie bisher, Stücke danach zuordnen (Status bleibt); abschließen ohne Erstattung → O20', async () => {
    const o = await twoPieces([982, 983])
    expect((await order(o.id, 'packed')).status).toBe(200)
    expect(
      (await order(o.id, 'ship', { carrier: 'dhl', trackingNumber: '00340434312345674' })).status,
    ).toBe(200)
    const w = await withdraw(o, { itemsText: 'Nr. 983' })
    const after = await h.order(o.id)
    expect(after.status).toBe('withdrawal_received')
    expect(after.statusBeforeWithdrawal).toBe('shipped')
    expect(after.items.map((i) => i.status)).toEqual(['active', 'active'])
    expect(after.adminAttention?.flag).toBe(true)
    expect(
      (await post(`/withdrawals/${w.id}/assign-items`, { itemIds: [itemId(o, 983)] })).status,
    ).toBe(200)
    const assigned = await h.order(o.id)
    expect(assigned.status).toBe('withdrawal_received')
    expect(assigned.items.map((i) => i.status)).toEqual(['active', 'withdrawn'])
    expect(assigned.adminAttention?.flag ?? false).toBe(false)
    const closed = await post(`/withdrawals/${w.id}/close`, { closeReason: 'retracted' })
    expect(closed.status).toBe(200)
    const back = await h.order(o.id)
    expect(back.status).toBe('shipped')
    expect(back.items.map((i) => i.status)).toEqual(['active', 'active'])
    expect(back.statusHistory?.at(-1)?.transition).toBe('O20')
  })

  it('abschließen ohne Erstattung vor dem Zuordnen hebt Sperre und Hinweis auf', async () => {
    const o = await twoPieces([980, 981])
    const w = await withdraw(o, { itemsText: 'die blaue Tasse' })
    expect((await order(o.id, 'packed')).status).toBe(409)
    expect((await post(`/withdrawals/${w.id}/close`, { closeReason: 'retracted' })).status).toBe(
      200,
    )
    const after = await h.order(o.id)
    expect(after.status).toBe('paid')
    expect(after.adminAttention?.flag ?? false).toBe(false)
    expect((await order(o.id, 'packed')).status).toBe(200)
  })
})
