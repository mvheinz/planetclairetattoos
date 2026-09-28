import { randomUUID } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  createOrderFromCheckout,
  CreateOrderError,
  type CreateOrderOptions,
} from '@/lib/commerce/createOrderFromCheckout'
import { prepaymentDeadlines } from '@/lib/commerce/deadlines'
import { statusTokenForMail } from '@/lib/commerce/statusToken'
import { deriveKey } from '@/lib/security/keys'
import { createToken, hashToken, matchesHash, sealToken, unsealToken } from '@/lib/security/tokens'
import type { Checkout, Order } from '@/payload-types'

import { createOrder, dbOf, deleteCommerce, orderData } from '../helpers/commerce'
import { ensureLegalTextFixtures } from '../helpers/legal'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'

// P4.1: createOrderFromCheckout() – O1, O2, O19 aus einer vorbereiteten Kasse, Snapshot-Treue, statusHistory,
// Parallelität, Status-Token (Hash + Siegel), Rotation bei defektem Siegel, keine Rotation bei `seed = true`.

let payload: Payload
let products: { id: number; itemNumber: number }[]
let mediaId: number
let legal: Record<string, number>

const SUBMITTED = '2026-09-27T10:02:00.000Z'
const NOW = new Date('2026-09-27T10:05:00.000Z')
const SNIPPETS = {
  'checkout.legalNotice': { version: 'draft-1', sha256: 'a'.repeat(64) },
  'checkout.dhlEmailConsent': { version: 'draft-1', sha256: 'b'.repeat(64) },
}
const ADDRESS = {
  name: 'Erika Beispiel',
  addressLine1: 'Musterstraße 1',
  postalCode: '10115',
  city: 'Berlin',
  country: 'DE',
}
const BILLING = {
  name: 'Max Rechnung',
  addressLine1: 'Rechnungsweg 2',
  postalCode: '10117',
  city: 'Berlin',
  country: 'DE',
}

interface CheckoutOptions {
  count?: number
  pickup?: boolean
  differs?: boolean
  submittedAt?: string | null
  seed?: boolean
  deviation?: boolean
}

/** Kasse wie nach „Zahlungspflichtig bestellen“ (P4.10a): Snapshot, Eingaben, Rechtsstand, `submittedAt`. */
async function preparedCheckout(o: CheckoutOptions = {}) {
  const token = createToken()
  const rows = products.slice(0, o.count ?? 2).map((p, i) => ({
    product: p.id,
    itemNumber: p.itemNumber,
    titleDe: `Teststück ${p.itemNumber}`,
    titleEn: `Test piece ${p.itemNumber}`,
    category: 'keramik',
    priceCents: 4500 + i * 100,
    vatCategory: 'standard',
    shippingClass: 'keramik',
    characteristicsDe: `Keramik · Ø 14 cm · Nr. ${p.itemNumber}`,
    characteristicsEn: `Ceramics · Ø 14 cm · No. ${p.itemNumber}`,
    ...(o.deviation && i === 0
      ? { deviationText: 'Kleine Glasurblase am Rand, gut sichtbar.' }
      : {}),
  }))
  const subtotal = rows.reduce((n, r) => n + r.priceCents, 0)
  const shippingCents = o.pickup ? 0 : 890
  const submittedAt = o.submittedAt === undefined ? SUBMITTED : o.submittedAt
  const checkout = (await payload.create({
    collection: 'checkouts',
    data: {
      tokenHash: hashToken(token),
      status: 'open',
      locale: 'en',
      reservationRef: randomUUID(),
      items: rows,
      fulfillmentMethod: o.pickup ? 'pickup' : 'shipping',
      ...(o.pickup ? {} : { shippingZone: 'DE' }),
      shippingClass: 'keramik',
      subtotalCents: subtotal,
      shippingCents,
      totalCents: subtotal + shippingCents,
      expiresAt: '2026-09-27T10:36:00.000Z',
      displayExpiresAt: '2026-09-27T10:30:00.000Z',
      paymentChoice: o.pickup ? 'prepayment' : 'stripe',
      customer: { email: 'erika@example.com' },
      ...(o.pickup ? {} : { shippingAddress: ADDRESS }),
      billingAddressDiffers: o.differs === true,
      ...(o.pickup || o.differs ? { billingAddress: BILLING } : {}),
      carrierEmailConsent: true,
      deviationAgreements: o.deviation
        ? [{ product: products[0]!.id, agreedAt: '2026-09-27T10:01:30.000Z' }]
        : [],
      legalTextVersions: legal,
      legalSnippetVersions: SNIPPETS,
      ...(submittedAt ? { submittedAt } : {}),
      stripe: { checkoutSessionId: `cs_mock_${randomUUID()}`, sessionSeq: 1 },
      seed: o.seed === true,
    } as never,
    depth: 0,
    overrideAccess: true,
    context: { system: true },
  })) as Checkout
  return { checkout, token }
}

const sysReq = () => createLocalReq({ context: { system: true } }, payload)

const o1 = (extra: Partial<CreateOrderOptions> = {}): CreateOrderOptions => ({
  transition: 'O1',
  now: NOW,
  actorType: 'webhook',
  payment: {
    method: 'card',
    provider: 'mock',
    stripe: { paymentIntentId: `pi_mock_${randomUUID()}`, paymentMethodType: 'card' },
  },
  ...extra,
})

async function sealedOf(orderId: number): Promise<string | null> {
  const { rows } = await dbOf(payload).execute(
    sql`SELECT status_token_sealed AS s FROM orders WHERE id = ${orderId}`,
  )
  return (rows[0]?.s as string | null) ?? null
}

async function auditCount(action: string, orderId: number): Promise<number> {
  const res = await payload.count({
    collection: 'audit-log',
    where: { and: [{ action: { equals: action } }, { entityId: { equals: String(orderId) } }] },
    overrideAccess: true,
  })
  return res.totalDocs
}

async function rejectsWith(promise: Promise<unknown>, code: string): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(err, 'erwartet Ablehnung').toBeInstanceOf(CreateOrderError)
  expect((err as CreateOrderError).code).toBe(code)
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  const fx = await createProductFixtures(payload)
  mediaId = fx.mediaId
  products = []
  for (const nr of [990, 991, 992]) {
    const doc = await createProduct(payload, completeProduct('keramik', nr, fx))
    products.push({ id: doc.id as number, itemNumber: nr })
  }
  legal = await ensureLegalTextFixtures(payload)
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload)
})

describe('createOrderFromCheckout (P4.1)', () => {
  it('O1: paid aus der Kasse – Snapshot-Treue, Summen, Rechtsstand, statusHistory, Token, Audit, checkouts.order', async () => {
    const { checkout } = await preparedCheckout({ deviation: true })
    const req = await sysReq()
    const { order, statusToken } = await createOrderFromCheckout(req, checkout.id, o1())

    expect(order.orderNumber).toMatch(/^PC-2026-\d{5}$/)
    expect(order.status).toBe('paid')
    expect(order.checkout).toBe(checkout.id)
    expect(order.locale).toBe('en')
    // Positionen = Kassen-Snapshot (+ Titelbild, Lebensmittelkontakt, bestätigte Abweichung)
    const media = await payload.findByID({ collection: 'media', id: mediaId, overrideAccess: true })
    expect(order.items).toHaveLength(2)
    order.items.forEach((item, i) => {
      const row = checkout.items[i]!
      expect(item).toMatchObject({
        product: row.product,
        itemNumber: row.itemNumber,
        titleDe: row.titleDe,
        titleEn: row.titleEn,
        category: row.category,
        characteristicsDe: row.characteristicsDe,
        characteristicsEn: row.characteristicsEn,
        priceCents: row.priceCents,
        vatCategory: row.vatCategory,
        shippingClass: row.shippingClass,
        coverImage: mediaId,
        coverImageUrl: media.sizes?.card?.url ?? media.url,
        foodContact: 'deko',
        status: 'active',
        refundedCents: 0,
      })
    })
    expect(order.items[0]!.deviationText).toBe(checkout.items[0]!.deviationText)
    expect(order.items[0]!.deviationAgreedAt).toBe('2026-09-27T10:01:30.000Z')
    expect(order.items[1]!.deviationText ?? null).toBeNull()
    expect(order.items[1]!.deviationAgreedAt ?? null).toBeNull()
    // Summen, Versand, Steuer, Lieferart, Adressen, Einwilligung
    expect(order).toMatchObject({
      subtotalCents: checkout.subtotalCents,
      shippingCents: checkout.shippingCents,
      totalCents: checkout.totalCents,
      currency: 'EUR',
      shippingZone: 'DE',
      shippingClass: 'keramik',
      taxModeAtOrder: 'kleinunternehmer',
      fulfillmentMethod: 'shipping',
      shippingAddress: ADDRESS,
      billingAddressDiffers: false,
      customer: { name: ADDRESS.name, email: 'erika@example.com' },
      carrierEmailConsent: true,
      paymentMethod: 'card',
      paymentProvider: 'mock',
    })
    expect(order.stripe?.checkoutSessionId).toBe(checkout.stripe?.checkoutSessionId)
    expect(order.stripe?.paymentMethodType).toBe('card')
    expect(order.legalTextVersions).toEqual(checkout.legalTextVersions)
    expect(order.legalSnippetVersions).toEqual(SNIPPETS)
    expect(order.timestamps.placedAt).toBe(SUBMITTED)
    expect(order.timestamps.paidAt).toBe(NOW.toISOString())
    expect(order.prepayment?.dueAt ?? null).toBeNull()
    // statusHistory: ein Eintrag der Anlage
    expect(order.statusHistory).toHaveLength(1)
    expect(order.statusHistory![0]).toMatchObject({
      from: null,
      to: 'paid',
      at: NOW.toISOString(),
      actorType: 'webhook',
      transition: 'O1',
    })
    // Status-Token: Hash + Siegel, Klartext nur im Rückgabewert
    expect(statusToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(order.statusTokenHash).toBe(hashToken(statusToken))
    expect(order.statusTokenIssuedAt).toBe(NOW.toISOString())
    const sealed = await sealedOf(order.id)
    expect(sealed).toBeTruthy()
    expect(unsealToken(sealed!)).toBe(statusToken)
    // Kasse zeigt auf die Bestellung; Audit order_created
    const after = await payload.findByID({
      collection: 'checkouts',
      id: checkout.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(after.order).toBe(order.id)
    expect(after.status).toBe('open') // Kassenstatus setzt der Aufrufer (fulfillCheckout/submitCheckout)
    expect(await auditCount('order_created', order.id)).toBe(1)
  })

  it('O1 mit abweichender Rechnungsadresse: Name aus der Rechnungsadresse', async () => {
    const { checkout } = await preparedCheckout({ differs: true, count: 1 })
    const { order } = await createOrderFromCheckout(await sysReq(), checkout.id, o1())
    expect(order.billingAddressDiffers).toBe(true)
    expect(order.billingAddress).toMatchObject(BILLING)
    expect(order.shippingAddress).toMatchObject(ADDRESS)
    expect(order.customer.name).toBe(BILLING.name)
  })

  it('O2: Vorkasse bei Abholung – awaiting_prepayment, Überweisung, Fristen, Name aus der Rechnungsadresse', async () => {
    // Sa 26.09.2026 10:00 Berlin (DM-ORD-06)
    const submittedAt = '2026-09-26T08:00:00.000Z'
    const { checkout } = await preparedCheckout({ pickup: true, submittedAt })
    const { order, statusToken } = await createOrderFromCheckout(await sysReq(), checkout.id, {
      transition: 'O2',
      now: new Date('2026-09-26T08:00:05.000Z'),
    })
    const settings = await payload.findGlobal({ slug: 'settings', overrideAccess: true })
    const deadlines = prepaymentDeadlines(new Date(submittedAt), settings)
    expect(order).toMatchObject({
      status: 'awaiting_prepayment',
      paymentMethod: 'prepayment',
      paymentProvider: 'bank_transfer',
      fulfillmentMethod: 'pickup',
      shippingCents: 0,
      shippingZone: null,
      billingAddress: BILLING,
      customer: { name: BILLING.name },
      carrierEmailConsent: false, // nur bei Versand
      timestamps: { placedAt: submittedAt },
    })
    expect(order.stripe?.checkoutSessionId ?? null).toBeNull()
    expect(order.shippingAddress?.addressLine1 ?? null).toBeNull()
    expect(order.timestamps.paidAt ?? null).toBeNull()
    expect(order.prepayment?.dueAt).toBe(deadlines.dueAt.toISOString())
    expect(order.prepayment?.reminderDueAt).toBe(deadlines.reminderDueAt.toISOString())
    expect(order.statusHistory![0]).toMatchObject({
      from: null,
      to: 'awaiting_prepayment',
      actorType: 'customer',
      transition: 'O2',
    })
    expect(order.statusTokenHash).toBe(hashToken(statusToken))
  })

  it('O19: bezahlt, aber alle Stücke weg – refunded mit Zeitstempeln und Endstatus', async () => {
    const { checkout } = await preparedCheckout({ count: 1 })
    const { order } = await createOrderFromCheckout(
      await sysReq(),
      checkout.id,
      o1({ transition: 'O19' }),
    )
    expect(order.status).toBe('refunded')
    expect(order.statusHistory![0]).toMatchObject({ from: null, to: 'refunded', transition: 'O19' })
    expect(order.timestamps).toMatchObject({
      placedAt: SUBMITTED,
      paidAt: NOW.toISOString(),
      refundedAt: NOW.toISOString(),
      finalStatusAt: NOW.toISOString(),
    })
    expect(order.retainUntil).toBeTruthy()
  })

  it('lehnt Kassen ohne submittedAt, mit Bestellung, beendete Kassen und falsche Zahlungsangaben ab', async () => {
    const draft = await preparedCheckout({ submittedAt: null })
    await rejectsWith(
      createOrderFromCheckout(await sysReq(), draft.checkout.id, o1()),
      'not_submitted',
    )

    const { checkout } = await preparedCheckout({ count: 1 })
    await createOrderFromCheckout(await sysReq(), checkout.id, o1())
    await rejectsWith(createOrderFromCheckout(await sysReq(), checkout.id, o1()), 'order_exists')
    const count = await payload.count({
      collection: 'orders',
      where: { checkout: { equals: checkout.id } },
      overrideAccess: true,
    })
    expect(count.totalDocs).toBe(1)

    const expired = await preparedCheckout({ count: 1 })
    await payload.update({
      collection: 'checkouts',
      id: expired.checkout.id,
      data: { status: 'expired', closeReason: 'reservation_expired' } as never,
      overrideAccess: true,
      context: { system: true, transition: 'expire' },
    })
    await rejectsWith(
      createOrderFromCheckout(await sysReq(), expired.checkout.id, o1()),
      'checkout_closed',
    )

    const other = await preparedCheckout({ count: 1 })
    await rejectsWith(
      createOrderFromCheckout(await sysReq(), other.checkout.id, { transition: 'O1', now: NOW }),
      'payment_invalid',
    )
    await rejectsWith(
      createOrderFromCheckout(await sysReq(), other.checkout.id, {
        transition: 'O2',
        now: NOW,
        payment: { method: 'card', provider: 'mock' },
      }),
      'payment_invalid',
    )
    await rejectsWith(
      createOrderFromCheckout(await sysReq(), 99_999_999, o1()),
      'checkout_not_found',
    )
  })

  it('Parallelität: zwei gleichzeitige Aufrufe für dieselbe Kasse ergeben genau eine Bestellung', async () => {
    const { checkout } = await preparedCheckout({ count: 1 })
    const [a, b] = [await sysReq(), await sysReq()]
    const results = await Promise.allSettled([
      createOrderFromCheckout(a, checkout.id, o1()),
      createOrderFromCheckout(b, checkout.id, o1()),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult
    expect(failed.reason).toBeInstanceOf(CreateOrderError)
    expect((failed.reason as CreateOrderError).code).toBe('order_exists')
    const count = await payload.count({
      collection: 'orders',
      where: { checkout: { equals: checkout.id } },
      overrideAccess: true,
    })
    expect(count.totalDocs).toBe(1)
    // UNIQUE orders.checkout_id als zweite Sicherung: eine zweite Bestellung zur Kasse scheitert auch ohne Sperre
    await expect(
      createOrder(payload, orderData(990, [products[0]!], { checkout: checkout.id })),
    ).rejects.toThrow()
  })

  it('DM-ORD-02: items, Summen, legalTextVersions und legalSnippetVersions sind nach der Anlage fest', async () => {
    const { checkout } = await preparedCheckout({ count: 1 })
    const { order } = await createOrderFromCheckout(await sysReq(), checkout.id, o1())
    const rows = order.items.map((i) => ({ ...i }))
    const attempts: Record<string, unknown>[] = [
      { items: [{ ...rows[0]!, priceCents: 100 }] },
      { items: [{ ...rows[0]!, titleDe: 'Anders' }] },
      { subtotalCents: 1 },
      { shippingCents: 0 },
      { totalCents: 1 },
      { legalTextVersions: { ...legal, agb: legal.datenschutz } },
      {
        legalSnippetVersions: { 'checkout.legalNotice': { version: '2', sha256: 'c'.repeat(64) } },
      },
    ]
    for (const data of attempts) {
      const err = await payload
        .update({
          collection: 'orders',
          id: order.id,
          data: data as never,
          overrideAccess: true,
          context: { system: true },
        })
        .then(
          () => null,
          (e: unknown) => e as Error,
        )
      expect(err, JSON.stringify(Object.keys(data))).not.toBeNull()
      expect(JSON.stringify(err)).toMatch(/unveränderlich/)
    }
    const again = (await payload.findByID({
      collection: 'orders',
      id: order.id,
      depth: 0,
      overrideAccess: true,
    })) as Order
    expect(again.items).toEqual(order.items)
    expect(again.legalSnippetVersions).toEqual(SNIPPETS)
    expect(again.totalCents).toBe(order.totalCents)
  })
})

describe('Status-Token der Bestellung (DM-CHK-01, R-067, DM-36)', () => {
  it('weder DB noch Log enthalten den Klartext von Kassen- oder Status-Token; Siegel passt zum Hash', async () => {
    const lines: string[] = []
    const capture = (...args: unknown[]) => {
      lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '))
    }
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(capture),
      vi.spyOn(console, 'info').mockImplementation(capture),
      vi.spyOn(console, 'warn').mockImplementation(capture),
      vi.spyOn(console, 'error').mockImplementation(capture),
      vi.spyOn(console, 'debug').mockImplementation(capture),
    ]
    const out = process.stdout.write.bind(process.stdout)
    const err = process.stderr.write.bind(process.stderr)
    process.stdout.write = ((chunk: unknown, ...rest: unknown[]) => {
      lines.push(String(chunk))
      return (out as (...a: unknown[]) => boolean)(chunk, ...rest)
    }) as typeof process.stdout.write
    process.stderr.write = ((chunk: unknown, ...rest: unknown[]) => {
      lines.push(String(chunk))
      return (err as (...a: unknown[]) => boolean)(chunk, ...rest)
    }) as typeof process.stderr.write
    let checkoutToken = ''
    let statusToken = ''
    let rotated = ''
    try {
      const prepared = await preparedCheckout({ count: 1 })
      checkoutToken = prepared.token
      const req = await sysReq()
      const res = await createOrderFromCheckout(req, prepared.checkout.id, o1())
      statusToken = res.statusToken
      expect(await statusTokenForMail(req, res.order.id, { now: NOW })).toBe(statusToken)
      // Rotation (Siegel unlesbar) schreibt eine Warnung – auch die ohne Token
      await dbOf(payload).execute(
        sql`UPDATE orders SET status_token_sealed = ${sealToken(statusToken, deriveKey('statusTokenSeal', 'z'.repeat(64)))} WHERE id = ${res.order.id}`,
      )
      rotated = (await statusTokenForMail(req, res.order.id, { now: NOW }))!
      expect(rotated).toBeTruthy()

      const sealed = await sealedOf(res.order.id)
      const order = await payload.findByID({
        collection: 'orders',
        id: res.order.id,
        depth: 0,
        overrideAccess: true,
      })
      expect(matchesHash(unsealToken(sealed!), order.statusTokenHash)).toBe(true)
    } finally {
      spies.forEach((s) => s.mockRestore())
      process.stdout.write = out
      process.stderr.write = err
    }
    const tokens = [checkoutToken, statusToken, rotated]
    expect(lines.some((l) => l.includes('status_token_unreadable'))).toBe(true)
    for (const t of tokens) {
      expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/)
      expect(lines.filter((l) => l.includes(t))).toEqual([])
    }
    // Ganze Datenbank (jede Zeile jeder Tabelle als Text) nach den Klartext-Token durchsuchen
    const db = dbOf(payload)
    const { rows: tables } = await db.execute(
      sql`SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
    )
    expect(tables.length).toBeGreaterThan(20)
    for (const { t } of tables) {
      for (const token of tokens) {
        const { rows } = await db.execute(
          sql`SELECT count(*)::int AS n FROM ${sql.identifier(String(t))} x WHERE strpos(x::text, ${token}) > 0`,
        )
        expect(rows[0]?.n, `${String(t)} enthält einen Klartext-Token`).toBe(0)
      }
    }
  })

  it('Rotation bei defektem Siegel: neuer Token (Hash + Siegel), Audit, alter Link ungültig', async () => {
    const { checkout } = await preparedCheckout({ count: 1 })
    const req = await sysReq()
    const { order, statusToken } = await createOrderFromCheckout(req, checkout.id, o1())
    // Intaktes Siegel: derselbe Link, keine Rotation
    expect(await statusTokenForMail(req, order.id, { now: NOW })).toBe(statusToken)
    expect(await auditCount('order_status_link_rotated', order.id)).toBe(0)
    // Siegel mit altem Schlüssel (Tausch von PAYLOAD_SECRET simuliert)
    const foreign = sealToken(statusToken, deriveKey('statusTokenSeal', 'q'.repeat(64)))
    await dbOf(payload).execute(
      sql`UPDATE orders SET status_token_sealed = ${foreign} WHERE id = ${order.id}`,
    )
    const later = new Date('2026-10-02T09:00:00.000Z')
    const fresh = await statusTokenForMail(req, order.id, { now: later })
    expect(fresh).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(fresh).not.toBe(statusToken)
    const after = await payload.findByID({
      collection: 'orders',
      id: order.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(after.statusTokenHash).toBe(hashToken(fresh!))
    expect(matchesHash(statusToken, after.statusTokenHash)).toBe(false)
    expect(after.statusTokenIssuedAt).toBe(later.toISOString())
    expect(unsealToken((await sealedOf(order.id))!)).toBe(fresh)
    expect(after.status).toBe('paid')
    expect(after.statusHistory).toHaveLength(1)
    expect(await auditCount('order_status_link_rotated', order.id)).toBe(1)
    // danach wieder stabil
    expect(await statusTokenForMail(req, order.id, { now: later })).toBe(fresh)
    expect(await auditCount('order_status_link_rotated', order.id)).toBe(1)
  })

  it('DM-36: Bestellungen mit seed = true werden nie automatisch rotiert', async () => {
    const { checkout } = await preparedCheckout({ count: 1, seed: true })
    const req = await sysReq()
    const { order, statusToken } = await createOrderFromCheckout(req, checkout.id, o1())
    expect(order.seed).toBe(true)
    expect(unsealToken((await sealedOf(order.id))!)).toBe(statusToken)
    const foreign = sealToken(statusToken, deriveKey('statusTokenSeal', 'q'.repeat(64)))
    await dbOf(payload).execute(
      sql`UPDATE orders SET status_token_sealed = ${foreign} WHERE id = ${order.id}`,
    )
    expect(await statusTokenForMail(req, order.id, { now: NOW })).toBeNull()
    const after = await payload.findByID({
      collection: 'orders',
      id: order.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(after.statusTokenHash).toBe(order.statusTokenHash)
    expect(await sealedOf(order.id)).toBe(foreign)
    expect(await auditCount('order_status_link_rotated', order.id)).toBe(0)
  })

  it('ohne Hash (nach Stufe B) gibt es keinen Link und keine Rotation', async () => {
    const { checkout } = await preparedCheckout({ count: 1 })
    const req: PayloadRequest = await sysReq()
    const { order } = await createOrderFromCheckout(req, checkout.id, o1())
    await payload.update({
      collection: 'orders',
      id: order.id,
      data: { statusTokenHash: null, statusTokenSealed: null } as never,
      overrideAccess: true,
      context: { system: true },
    })
    expect(await sealedOf(order.id)).toBeNull()
    expect(await statusTokenForMail(req, order.id, { now: NOW })).toBeNull()
    expect(await auditCount('order_status_link_rotated', order.id)).toBe(0)
  })
})
