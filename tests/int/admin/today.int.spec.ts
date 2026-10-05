import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getTodaySummary, legalHoldReviewDue, type TodaySummary } from '@/lib/admin/today'
import type { Setting } from '@/payload-types'

import { createOrder, dbOf, deleteCommerce, orderData } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'

// P5.28 – „Heute“ (KONZEPT §7.3): Fixtures analog SEED-SPEC §17 „Admin Heute“ (O14 `paid`, O12 `packed`, O13
// `awaiting_prepayment`, O09 `ready_for_pickup`, O03 `disputed`, W3–W5 offen, A4 `new`; `seed = true`) bei fester Uhr.
// Dazu `adminAttention` an Stück und Bestellung, Aufbewahrungssperren (6-Monats-Regel) und Kostenwarnung (≥ Schwelle).

const N = new Date('2026-10-10T08:00:00.000Z') // Sa 10.10.2026 10:00 Berlin
const iso = (days: number) => new Date(N.getTime() + days * 86_400_000).toISOString()
const NUMBERS = [993, 994, 995]
let payload: Payload
let summary: TodaySummary
let costsBefore: Setting['costs']
const ids: Record<string, number> = {}

const order = async (key: string, nr: number, overrides: Record<string, unknown>) => {
  const data = orderData(nr, [{ id: ids.piece!, itemNumber: 993 }], { seed: true, ...overrides })
  if (overrides.fulfillmentMethod === 'pickup') {
    Object.assign(data, {
      shippingAddress: undefined,
      shippingZone: undefined,
      shippingClass: undefined,
      shippingCents: 0,
      totalCents: data.subtotalCents,
      billingAddress: {
        name: 'Erika Beispiel',
        addressLine1: 'Musterstraße 1',
        postalCode: '10115',
        city: 'Berlin',
        country: 'DE',
      },
    })
  }
  const doc = await createOrder(payload, data, { seed: true })
  ids[key] = doc.id as number
  return doc
}
const withdrawal = (reference: string, receivedAt: string, status: string, extra = {}) =>
  payload.create({
    collection: 'withdrawals',
    data: {
      reference,
      receivedAt,
      status,
      channel: 'online_form',
      locale: 'de',
      seed: true,
      name: 'Mia Beispiel',
      email: 'mia@example.com',
      contractIdentification: 'PC-2026-90004',
      itemsText: 'graue Cap',
      matchStatus: 'needs_manual_match',
      ...extra,
    } as never,
    overrideAccess: true,
    context: { seed: true },
  })
const inquiry = (reference: string, status: string) =>
  payload.create({
    collection: 'inquiries',
    data: {
      reference,
      status,
      name: 'Erika Beispiel',
      email: 'erika@example.com',
      idea: 'Eine Tasse mit meinem Hund im Planet-Claire-Stil, gern in Blau.',
      objectType: 'tasse',
      locale: 'de',
      seed: true,
    } as never,
    overrideAccess: true,
    context: { seed: true },
  })
const setCosts = (amountCents: number) =>
  payload.updateGlobal({
    slug: 'settings',
    data: {
      costs: { ...costsBefore, monthlyEntries: [{ month: '2026-09', amountCents }] },
    } as never,
    overrideAccess: true,
    context: { seed: true, skipAudit: true },
  })
const hint = (s: TodaySummary, id: string) => s.hints.find((h) => h.id === id)

beforeAll(async () => {
  payload = await getTestPayload()
  const db = dbOf(payload)
  await deleteCommerce(payload)
  await db.execute(sql`DELETE FROM inquiries`)
  await deleteProducts(payload, NUMBERS)
  const fx = await createProductFixtures(payload)
  const [piece, flagged, unflagged] = await Promise.all(
    NUMBERS.map((nr) => createProduct(payload, completeProduct('keramik', nr, fx))),
  )
  ids.piece = piece!.id as number
  ids.flagged = flagged!.id as number
  await db.execute(
    sql`UPDATE products SET admin_attention_flag = true, admin_attention_reason = 'conformity_revoked' WHERE id = ${ids.flagged}`,
  )
  // ohne Flag kein Hinweis, auch wenn ein Grund eingetragen ist
  await db.execute(
    sql`UPDATE products SET admin_attention_flag = false, admin_attention_reason = 'manual' WHERE id = ${unflagged!.id}`,
  )

  await order('o14', 90_014, { status: 'paid', timestamps: { placedAt: iso(-1) } })
  await order('o12', 90_012, { status: 'packed', timestamps: { placedAt: iso(-2) } })
  await order('o13', 90_013, {
    status: 'awaiting_prepayment',
    paymentMethod: 'prepayment',
    paymentProvider: 'bank_transfer',
    prepayment: { dueAt: iso(3) },
    timestamps: { placedAt: iso(-3) },
  })
  await order('o09', 90_009, {
    status: 'ready_for_pickup',
    fulfillmentMethod: 'pickup',
    timestamps: { placedAt: iso(-6), readyForPickupAt: iso(-2) },
  })
  await order('o03', 90_003, {
    status: 'disputed',
    statusBeforeDispute: 'delivered',
    dispute: { status: 'open' },
    timestamps: { placedAt: iso(-30), disputedAt: iso(-1) },
  })
  await order('o10', 90_010, { status: 'shipped', timestamps: { placedAt: iso(-5) } })
  // Bestellungen mit Hinweis-Bedarf (zählen in keiner Kachel)
  await order('mismatch', 90_020, { status: 'delivered', timestamps: { placedAt: iso(-40) } })
  await order('noflag', 90_021, { status: 'delivered', timestamps: { placedAt: iso(-41) } })
  await order('hold7', 90_022, { status: 'delivered', timestamps: { placedAt: iso(-400) } })
  await order('hold5', 90_023, { status: 'delivered', timestamps: { placedAt: iso(-401) } })
  await order('holdReviewed', 90_024, { status: 'delivered', timestamps: { placedAt: iso(-402) } })
  await db.execute(
    sql`UPDATE orders SET admin_attention_flag = true, admin_attention_reason = 'payment_amount_mismatch' WHERE id = ${ids.mismatch}`,
  )
  await db.execute(
    sql`UPDATE orders SET admin_attention_flag = false, admin_attention_reason = 'payment_amount_mismatch' WHERE id = ${ids.noflag}`,
  )
  const hold = (id: number, since: string, reviewed: string | null) =>
    db.execute(sql`UPDATE orders SET privacy_legal_hold = true,
      privacy_legal_hold_reason = 'Laufender Rechtsstreit um die Bestellung',
      privacy_legal_hold_since = ${since}::timestamptz,
      privacy_legal_hold_reviewed_at = ${reviewed}::timestamptz WHERE id = ${id}`)
  await hold(ids.hold7!, '2026-03-09T08:00:00.000Z', null) // 7 Monate vor N
  await hold(ids.hold5!, '2026-05-10T08:00:00.000Z', null) // 5 Monate vor N
  await hold(ids.holdReviewed!, '2026-02-01T08:00:00.000Z', '2026-09-10T08:00:00.000Z') // geprüft vor 1 Monat

  await withdrawal('WR-2026-90003', iso(-9), 'goods_returned') // erstatten bis D+5
  await withdrawal('WR-2026-90004', iso(-4), 'received')
  await withdrawal('WR-2026-90005', iso(-1), 'received')
  await withdrawal('WR-2026-90006', iso(-20), 'closed', { closeReason: 'duplicate' })
  await inquiry('AA-2026-90004', 'new')
  await inquiry('AA-2026-90002', 'in_progress')

  costsBefore = (await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true }))
    .costs
  await setCosts(3000)
  summary = await getTodaySummary(N, payload)
})

afterAll(async () => {
  await payload.updateGlobal({
    slug: 'settings',
    data: { costs: costsBefore } as never,
    overrideAccess: true,
    context: { seed: true, skipAudit: true },
  })
  await deleteCommerce(payload)
  await dbOf(payload).execute(sql`DELETE FROM inquiries`)
  await deleteProducts(payload, NUMBERS)
})

describe('getTodaySummary (P5.28, KONZEPT §7.3)', () => {
  it('Kacheln analog SEED-SPEC §17: Zu packen 2, Vorkasse offen 1, Abholung 1, Widerrufe offen 3 (nächste Frist W3), Neue Anfragen 1', () => {
    expect(summary.tiles.packen.count).toBe(2)
    expect(summary.tiles.vorkasse).toEqual({ count: 1, dueToday: 0 })
    expect(summary.tiles.abholung.count).toBe(1)
    expect(summary.tiles.widerrufe.count).toBe(3)
    expect(summary.tiles.widerrufe.nextReference).toBe('WR-2026-90003')
    expect(summary.tiles.anfragen.count).toBe(1)
  })

  it('roter Hinweis Anfechtung mit Link auf die Bestellung; Hinweis „Beispieldaten vorhanden“', () => {
    const dispute = hint(summary, `dispute-${ids.o03}`)
    expect(dispute).toMatchObject({ tone: 'error', href: `/bestellungen/${ids.o03}` })
    expect(dispute!.text).toContain('PC-2026-90003')
    const seed = hint(summary, 'seed')
    expect(seed?.text).toMatch(/^Beispieldaten vorhanden \(\d+ Einträge\)/)
    expect(seed?.href).toBe('/einstellungen#beispieldaten')
  })

  it('adminAttention: Stück `conformity_revoked` und Bestellung `payment_amount_mismatch` rot mit Grund und Link; ohne Flag kein Hinweis', () => {
    const piece = hint(summary, `attention-product-${ids.flagged}`)
    expect(piece).toMatchObject({ tone: 'error', href: `/stuecke/${ids.flagged}` })
    expect(piece!.text).toContain('Konformitätserklärung widerrufen')
    const order = hint(summary, `attention-order-${ids.mismatch}`)
    expect(order).toMatchObject({ tone: 'error', href: `/bestellungen/${ids.mismatch}` })
    expect(order!.text).toContain('Betrag stimmt nicht')
    expect(hint(summary, `attention-order-${ids.noflag}`)).toBeUndefined()
    expect(summary.hints.filter((h) => h.id.startsWith('attention-product-'))).toHaveLength(1)
  })

  it('Aufbewahrungssperren zur Prüfung: seit 7 Monaten → Hinweis; seit 5 Monaten oder vor 1 Monat geprüft → keiner', () => {
    expect(hint(summary, `legal-hold-order-${ids.hold7}`)).toMatchObject({
      tone: 'warning',
      href: `/bestellungen/${ids.hold7}`,
    })
    expect(hint(summary, `legal-hold-order-${ids.hold5}`)).toBeUndefined()
    expect(hint(summary, `legal-hold-order-${ids.holdReviewed}`)).toBeUndefined()
    // dieselbe Regel für P6.15 (Task `legalHoldReview`)
    expect(legalHoldReviewDue({ legalHold: false, legalHoldSince: '2020-01-01' }, N)).toBe(false)
    expect(legalHoldReviewDue({ legalHold: true, legalHoldSince: '2026-04-10T08:00:00Z' }, N)).toBe(
      true,
    )
  })

  it('Kostenwarnung bei letztem Monatswert 30,00 € (Standard-Schwelle), keine bei 29,99 €', async () => {
    const settings = await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })
    expect(settings.costs?.warningThresholdCents ?? 3000).toBe(3000)
    expect(hint(summary, 'costs')).toMatchObject({ tone: 'warning', href: '/einstellungen#kosten' })
    expect(hint(summary, 'costs')!.text).toContain('30,00 €')
    await setCosts(2999)
    expect(hint(await getTodaySummary(N, payload), 'costs')).toBeUndefined()
    await setCosts(3000)
  })

  it('letzte 5 Bestellungen (Nummer, Betrag, Status), neueste zuerst', () => {
    expect(summary.recentOrders.map((o) => o.orderNumber)).toEqual([
      'PC-2026-90014',
      'PC-2026-90012',
      'PC-2026-90013',
      'PC-2026-90010',
      'PC-2026-90009',
    ])
    expect(summary.recentOrders[0]).toMatchObject({ statusLabel: 'bezahlt', seed: true })
    expect(summary.recentOrders[0]!.totalCents).toBeGreaterThan(0)
  })
})
