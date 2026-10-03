import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { statusTokenForMail } from '@/lib/commerce/statusToken'
import { seedPreviewModeActive } from '@/lib/env'
import { packagingTotals } from '@/lib/export/packagingReport'
import {
  CHECKOUT_STATUSES,
  FULFILLMENT_METHODS,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PRODUCT_STATUSES,
  REFUND_REASONS,
} from '@/lib/enums'
import { hashToken, sealToken, unsealToken } from '@/lib/security/tokens'
import { SEED_EXPECTED_DETAIL, expectedCount } from '@/lib/seed/expected'
import { seedToken } from '@/lib/seed/tokens'

import { resetAdmin } from '../helpers/admin'
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

// P8.4: Bestellungen, Kassen und Reservierungen des Beispielbestands (SEED-SPEC §6–§8) – AK-SEED-03, AK-SEED-07,
// Kassen-Modell, Verpackung, Summen §7.1, Sendungsverfolgung O03/O10, Status-Token aus `seedToken`.

let payload: Payload
let orders: SeedDoc[]
let checkouts: SeedDoc[]
let reservations: SeedDoc[]

const SPEC = path.join(process.cwd(), 'content/seed/SEED-SPEC.md')
const DAY = 86_400_000

beforeAll(async () => {
  payload = await getTestPayload()
  await runCanonicalSeed(payload)
  orders = await findAll(payload, 'orders', { seed: { equals: true } })
  checkouts = await findAll(payload, 'checkouts', { seed: { equals: true } })
  reservations = await findAll(payload, 'reservations', { seed: { equals: true } })
}, SEED_TIMEOUT)

afterAll(async () => {
  await runCanonicalSeed(payload, 'remove', { yes: true, dropTexts: true })
}, SEED_TIMEOUT)

const ts = (doc: SeedDoc, field: string) => {
  const v = (doc.timestamps as Record<string, string | null | undefined>)[field]
  return v ? new Date(v).getTime() : null
}

describe('Bestellungen (AK-SEED-07, SEED-SPEC §7)', () => {
  it('AK-SEED-03: Mengen laut SEED_EXPECTED_COUNTS; keine Kasse älter als 30 Tage, keine beendete Reservierung älter als 7 Tage', () => {
    expect(orders).toHaveLength(expectedCount('orders'))
    expect(checkouts).toHaveLength(expectedCount('checkouts'))
    expect(reservations).toHaveLength(expectedCount('reservations'))
    for (const [status, n] of Object.entries(SEED_EXPECTED_DETAIL.checkouts)) {
      expect(
        checkouts.filter((c) => c.status === status),
        status,
      ).toHaveLength(n)
    }
    for (const c of checkouts) {
      expect(SEED_N.getTime() - new Date(String(c.createdAt)).getTime()).toBeLessThan(30 * DAY)
    }
    for (const r of reservations) {
      const end = (r.convertedAt ?? r.releasedAt) as string | null
      if (r.status === 'active') continue
      expect(SEED_N.getTime() - new Date(end!).getTime(), String(r.seedKey)).toBeLessThan(7 * DAY)
    }
    // O01 und O02 haben keine Kasse mehr (L-03)
    const byKey = (k: string) => orders.find((o) => o.seedKey === `orders:${k}`)!
    expect([byKey('O01').checkout ?? null, byKey('O02').checkout ?? null]).toEqual([null, null])
  })

  it('AK-SEED-07: jeder ORDER_STATUS, jede Zahlart, beide Lieferarten, jeder Stückstatus; Endstatus-Regeln', async () => {
    expect(new Set(orders.map((o) => o.status))).toEqual(new Set(ORDER_STATUSES))
    expect(orders.every((o) => (ORDER_STATUSES as readonly string[]).includes(String(o.status))))
    expect(new Set(orders.map((o) => o.paymentMethod))).toEqual(new Set(PAYMENT_METHODS))
    expect(new Set(orders.map((o) => o.fulfillmentMethod))).toEqual(new Set(FULFILLMENT_METHODS))
    const products = await findAll(payload, 'products', { seed: { equals: true } })
    expect(new Set(products.map((p) => p.status))).toEqual(new Set(PRODUCT_STATUSES))
    // Wallets (Apple Pay, Google Pay) über stripe.paymentMethodType
    expect(
      new Set(orders.map((o) => (o.stripe as { paymentMethodType?: string })?.paymentMethodType)),
    ).toEqual(new Set(['card', 'apple_pay', 'google_pay', 'paypal', null]))
    for (const o of orders) {
      if (o.status === 'cancelled') expect(o.cancelReason).toBe('payment_timeout')
      else expect(o.cancelReason ?? null).toBeNull()
      if (o.status === 'disputed') {
        expect(o.statusBeforeDispute).toBe('delivered')
        expect((o.dispute as { status: string }).status).toBe('open')
        expect(o.adminAttention).toMatchObject({ flag: true, reason: 'dispute_open' })
      } else expect((o.dispute as { status: string }).status).toBe('none')
      for (const r of (o.refunds ?? []) as { reason: string }[]) {
        expect(REFUND_REASONS).toContain(r.reason)
      }
      expect((o.statusHistory as { to: string }[]).at(-1)!.to).toBe(o.status)
    }
    const o08 = await bySeedKey(payload, 'orders', 'O08')
    expect(o08.status).toBe('refunded')
    expect((o08.refunds as { reason: string }[]).map((r) => r.reason)).toEqual(['breakage'])
    expect((o08.statusHistory as { transition: string }[]).map((h) => h.transition)).toEqual([
      'O1',
      'O15',
    ])
    expect((await bySeedKey(payload, 'products', 'S09')).status).toBe('archived')
    const refunded = orders.filter((o) => o.status === 'refunded')
    expect(refunded).toHaveLength(2)
  })

  it('Kassen-Modell: Vorgänge ohne Bestellung nur als Kassen (expired mit freigegebener, open mit aktiver Reservierung); Verknüpfungen', async () => {
    expect(new Set(checkouts.map((c) => c.status))).toEqual(
      new Set(CHECKOUT_STATUSES.filter((s) => ['completed', 'expired', 'open'].includes(s))),
    )
    const ks1 = await bySeedKey(payload, 'checkouts', 'KS1')
    expect([ks1.status, ks1.closeReason, ks1.order ?? null]).toEqual([
      'expired',
      'reservation_expired',
      null,
    ])
    const r1 = await bySeedKey(payload, 'reservations', 'KS1')
    expect([r1.status, r1.releaseReason]).toEqual(['released', 'session_expired'])
    const ks2 = await bySeedKey(payload, 'checkouts', 'KS2')
    expect([ks2.status, ks2.order ?? null]).toEqual(['open', null])
    expect((await bySeedKey(payload, 'reservations', 'KS2')).status).toBe('active')
    expect(
      orders.map((o) => o.orderNumber).filter((n) => !/^PC-2026-900\d{2}$/.test(String(n))),
    ).toEqual([])
    for (const c of checkouts.filter((x) => x.status === 'completed')) {
      const o = orders.find((x) => x.id === c.order)!
      expect(o.checkout).toBe(c.id)
      expect(c.tokenHash).toBe(hashToken(seedToken(String(c.seedKey), 'checkout')))
      expect(new Date(String(c.createdAt)).getTime()).toBeLessThan(ts(o, 'placedAt')!)
    }
    for (const r of reservations.filter((x) => x.order)) {
      const o = orders.find((x) => x.id === r.order)!
      expect(r.checkout).toBe(o.checkout)
      expect(r.ref).toBe(checkouts.find((c) => c.id === o.checkout)!.reservationRef)
    }
    // Stücke zeigen auf ihre Bestellung (§1.7 Schritt 5)
    for (const [s, o] of [
      ['S02', 'O10'],
      ['S14', 'O13'],
      ['S24', 'O14'],
      ['S30', 'O09'],
    ]) {
      expect((await bySeedKey(payload, 'products', s!)).currentOrder, s).toBe(
        (await bySeedKey(payload, 'orders', o!)).id,
      )
    }
    const o13 = await bySeedKey(payload, 'orders', 'O13')
    expect((o13.prepayment as { dueAt: string }).dueAt).toBe('2026-10-18T21:59:59.000Z')
    const item = (o13.items as { deviationText?: string; deviationAgreedAt?: string }[])[0]!
    expect(item.deviationText).toMatch(/ausgeblichen/)
    expect(item.deviationAgreedAt).toBe((o13.timestamps as { placedAt: string }).placedAt)
  })

  it('Summen wie SEED-SPEC §7.1; stripe.livemode = false; Tracking-Nummern im Format; Rechtstexte = v1-Platzhalter', async () => {
    const md = await readFile(SPEC, 'utf8')
    const sec = md.slice(md.indexOf('### 7.1'), md.indexOf('### 7.2'))
    const rows = sec.split('\n').filter((l) => /^\| O\d\d \|/.test(l))
    expect(rows).toHaveLength(expectedCount('orders'))
    for (const line of rows) {
      const cells = line.split('|').map((c) => c.trim())
      const [key, number, , , , , , shipping, total] = cells.slice(1)
      const o = await bySeedKey(payload, 'orders', key!)
      expect([o.orderNumber, o.shippingCents, o.totalCents], key).toEqual([
        number,
        Number(shipping),
        Number(total),
      ])
      expect(o.taxModeAtOrder).toBe('kleinunternehmer')
      if (o.stripe) expect((o.stripe as { livemode: boolean }).livemode, key).toBe(false)
      const tn = (o.shipment as { trackingNumber?: string } | undefined)?.trackingNumber
      if (tn) expect(tn).toMatch(/^[A-Z0-9]{8,35}$/)
      const legal = o.legalTextVersions as Record<string, number>
      for (const id of Object.values(legal)) {
        const text = await payload.findByID({
          collection: 'legal-texts',
          id,
          depth: 0,
          overrideAccess: true,
        })
        expect([text.origin, text.version], key).toEqual(['placeholder', 1])
      }
    }
  })

  it('Sendungsverfolgung: O03 aus der Vorlage deutsche_post, O10 aus der Vorlage dhl (Grund-Seed, DM-12)', async () => {
    const settings = (await payload.findGlobal({ slug: 'settings', overrideAccess: true })) as {
      shipping: { trackingUrlTemplates: { carrier: string; urlTemplate: string }[] }
    }
    const template = (carrier: string) =>
      settings.shipping.trackingUrlTemplates.find((t) => t.carrier === carrier)!.urlTemplate
    const o03 = await bySeedKey(payload, 'orders', 'O03')
    expect(o03.shipment).toMatchObject({
      carrier: 'deutsche_post',
      trackingNumber: 'SEEDDP000000003DE',
      trackingUrl: template('deutsche_post').replace('{trackingNumber}', 'SEEDDP000000003DE'),
      deliveredSource: 'auto',
    })
    const o10 = await bySeedKey(payload, 'orders', 'O10')
    expect(o10.shipment).toMatchObject({
      carrier: 'dhl',
      trackingNumber: 'SEEDDHL9000000000010',
      trackingUrl: template('dhl').replace('{trackingNumber}', 'SEEDDHL9000000000010'),
    })
    // ohne Sendungsnummer kein Link
    for (const o of orders) {
      const s = o.shipment as { trackingNumber?: string; trackingUrl?: string } | undefined
      if (!s?.trackingNumber) expect(s?.trackingUrl ?? null).toBeNull()
    }
  })

  it('Verpackung: jede gepackte/versendete Bestellung mit Vorlage, ≥ 1 Bestandteil und recordedAt; Jahres-Export ohne Seed-Sendung (auch im Vorschau-Modus)', async () => {
    const packed = orders.filter((o) => ts(o, 'packedAt') !== null)
    expect(packed.map((o) => o.seedKey).sort()).toEqual(
      ['O01', 'O03', 'O04', 'O05', 'O06', 'O10', 'O11', 'O12'].map((k) => `orders:${k}`),
    )
    for (const o of packed) {
      const p = o.packaging as { templateKey: string; components: unknown[]; recordedAt: string }
      expect(p.templateKey, String(o.seedKey)).toBeTruthy()
      expect(p.components.length).toBeGreaterThanOrEqual(1)
      expect(new Date(p.recordedAt).getTime()).toBe(ts(o, 'packedAt'))
    }
    expect((await bySeedKey(payload, 'orders', 'O10')).packaging).toMatchObject({
      templateKey: 'keramik-doppelkarton',
    })
    const o12 = await bySeedKey(payload, 'orders', 'O12')
    expect(o12.packingPhotos).toHaveLength(2)
    const photo = await bySeedKey(payload, 'private-uploads', 'O12:packing-1')
    expect(photo.relatedOrder).toBe(o12.id)

    expect(seedPreviewModeActive()).toBe(true)
    const { token } = await resetAdmin(payload, '198.51.100.84')
    const res = await rest('GET', '/admin/packaging-report?year=2026', undefined, {
      authorization: `JWT ${token}`,
    })
    expect(res.status).toBe(200)
    expect(await res.text()).not.toMatch(/SEED|PC-2026-900/)
    const totals = await packagingTotals(payload, 2026)
    expect([totals.shipments, totals.withoutPackaging]).toEqual([0, 0])
    expect(totals.materials.every((m) => m.grams === 0 && m.shipments === 0)).toBe(true)
  })

  it('AK-SEED-09 (DB): Zeitlogik je Bestellung monoton; Statusverlauf aus der Zeitleiste', () => {
    const order = [
      'placedAt',
      'paidAt',
      'packedAt',
      'shippedAt',
      'deliveredAt',
      'readyForPickupAt',
      'pickedUpAt',
      'withdrawalReceivedAt',
      'returnReceivedAt',
      'refundedAt',
      'cancelledAt',
      'disputedAt',
    ]
    for (const o of orders) {
      const times = order.map((f) => ts(o, f)).filter((v): v is number => v !== null)
      expect(
        [...times].sort((a, b) => a - b),
        String(o.seedKey),
      ).toEqual(times)
      const history = o.statusHistory as { at: string }[]
      const at = history.map((h) => new Date(h.at).getTime())
      expect([...at].sort((a, b) => a - b)).toEqual(at)
    }
  })
})

describe('Status-Token der Beispiel-Bestellungen (SEED-SPEC §2.5, DM-36)', () => {
  it('Hash und Siegel aus seedToken; unsealToken ergibt seedToken; Siegel nicht lesbar → keine Rotation, kein Link', async () => {
    for (const o of orders) {
      const token = seedToken(String(o.seedKey), 'status')
      expect(o.statusTokenHash).toBe(hashToken(token))
      expect(unsealToken(String(o.statusTokenSealed))).toBe(token)
    }
    const o10 = await bySeedKey(payload, 'orders', 'O10')
    // Schlüsselwechsel simulieren: Siegel mit einem fremden Schlüssel
    const foreign = sealToken(seedToken('orders:O10', 'status'), Buffer.alloc(32, 7))
    await payload.update({
      collection: 'orders',
      id: o10.id,
      data: { statusTokenSealed: foreign } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    const req = await createLocalReq({}, payload)
    expect(await statusTokenForMail(req, o10.id, { now: SEED_N })).toBeNull()
    const after = await bySeedKey(payload, 'orders', 'O10')
    expect(after.statusTokenHash).toBe(o10.statusTokenHash)
    expect(after.statusTokenSealed).toBe(foreign)
  })
})
