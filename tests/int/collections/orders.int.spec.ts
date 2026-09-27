import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { getTestPayload } from '../helpers/payload'
import {
  checkoutData,
  createOrder,
  dbOf,
  deleteCommerce,
  orderData,
  type ItemInput,
} from '../helpers/commerce'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'
import { ensureLegalTextFixtures, lexical } from '../helpers/legal'
import { rest } from '../helpers/rest'

// P1.20: checkouts, reservations, orders (DATENMODELL §6.7, §6.8, §6.25).

let payload: Payload
let items: ItemInput[]

type Err = { message?: string; data?: { errors?: { path: string; message: string }[] } }
async function rejects(promise: Promise<unknown>, re: RegExp): Promise<void> {
  const err = await promise.then(
    () => null,
    (e: unknown) => e as Err,
  )
  expect(err, 'erwartet Ablehnung').not.toBeNull()
  const text = [err!.message, ...(err!.data?.errors ?? []).map((e) => e.message)].join(' | ')
  expect(text).toMatch(re)
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  const fx = await createProductFixtures(payload)
  items = []
  for (const nr of [980, 981, 982]) {
    const doc = await createProduct(payload, completeProduct('keramik', nr, fx))
    items.push({ id: doc.id as number, itemNumber: nr })
  }
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteProducts(payload)
})

describe('orders (DATENMODELL §6.8)', () => {
  it('orderNumber: Format PC-JJJJ-NNNNN (Sequenz folgt in P1.26)', async () => {
    await rejects(
      createOrder(payload, orderData(980, [items[0]!], { orderNumber: 'PC-26-1' })),
      /PC-JJJJ-NNNNN/,
    )
    const order = await createOrder(payload, orderData(980, [items[0]!]))
    expect(order.orderNumber).toMatch(/^PC-\d{4}-\d{5}$/)
    expect(order.customer.email).toBe('erika@example.com')
    // Anlage O1: Statusverlauf, Zeitstempel, Audit
    expect(order.statusHistory).toHaveLength(1)
    expect(order.statusHistory![0]).toMatchObject({
      from: null,
      to: 'paid',
      transition: 'O1',
      actorType: 'system',
    })
    expect(order.timestamps?.paidAt).toBeTruthy()
  })

  it('Anlage nur als paid, awaiting_prepayment oder refunded (O1, O2, O19)', async () => {
    await rejects(
      createOrder(payload, orderData(981, [items[0]!], { status: 'shipped' })),
      /entsteht nur/,
    )
    const prepayment = await createOrder(
      payload,
      orderData(982, [items[1]!], { status: 'awaiting_prepayment', paymentMethod: 'prepayment' }),
    )
    expect(prepayment.statusHistory![0]!.transition).toBe('O2')
  })

  it('DM-ORD-02 Positionen und Summen sind nach der Anlage per Local API unveränderlich', async () => {
    const order = await createOrder(payload, orderData(983, [items[0]!, items[1]!]))
    const rows = order.items.map((i) => ({ ...i, product: i.product as { id: number } | number }))
    await rejects(
      payload.update({
        collection: 'orders',
        id: order.id,
        data: { items: [{ ...rows[0]!, priceCents: 100 }, rows[1]!] } as never,
        overrideAccess: true,
      }),
      /unveränderlich/,
    )
    await rejects(
      payload.update({
        collection: 'orders',
        id: order.id,
        data: { items: [rows[0]!] } as never,
        overrideAccess: true,
      }),
      /unveränderlich/,
    )
    for (const [field, value] of [
      ['subtotalCents', 100],
      ['shippingCents', 0],
      ['totalCents', 9999],
      ['orderNumber', 'PC-2026-00999'],
      ['taxModeAtOrder', 'regelbesteuert'],
      ['paymentMethod', 'paypal'],
      ['legalSnippetVersions', {}],
    ] as const) {
      await rejects(
        payload.update({
          collection: 'orders',
          id: order.id,
          data: { [field]: value } as never,
          overrideAccess: true,
          context: { system: true },
        }),
        /unveränderlich/,
      )
    }
    // Erlaubt: Positionsstatus und erstatteter Betrag (Teilwiderruf, Erstattung)
    const updated = await payload.update({
      collection: 'orders',
      id: order.id,
      data: {
        items: [{ ...rows[0]!, status: 'withdrawn', refundedCents: 4500 }, rows[1]!],
      } as never,
      overrideAccess: true,
    })
    expect(updated.items[0]!.status).toBe('withdrawn')
    expect(updated.items[0]!.refundedCents).toBe(4500)
    expect(updated.totalCents).toBe(order.totalCents)
  })

  it('DM-ORD-02 legalTextVersions: Pflicht beim Anlegen, danach per Local API unveränderlich (R-012)', async () => {
    const versions = await ensureLegalTextFixtures(payload)
    const { agb: _agb, ...withoutAgb } = versions
    await rejects(
      createOrder(payload, orderData(990, [items[2]!], { legalTextVersions: withoutAgb })),
      /AGB|legalTextVersions/,
    )
    const order = await createOrder(
      payload,
      orderData(990, [items[2]!], { legalTextVersions: versions }),
    )
    expect(order.legalTextVersions).toMatchObject({
      agb: expect.objectContaining({ id: versions.agb }),
      versandZahlung: expect.objectContaining({ id: versions.versandZahlung }),
    })
    const other = await payload.create({
      collection: 'legal-texts',
      data: {
        type: 'agb',
        validFrom: '2027-01-01T00:00:00.000Z',
        content: lexical('Neue AGB'),
      } as never,
      overrideAccess: true,
    })
    for (const value of [
      { ...versions, agb: other.id },
      { ...versions, datenschutz: null },
    ]) {
      await rejects(
        payload.update({
          collection: 'orders',
          id: order.id,
          data: { legalTextVersions: value } as never,
          overrideAccess: true,
          context: { system: true },
        }),
        /unveränderlich/,
      )
    }
    // Kassen verweisen ebenfalls auf Fassungen (Stand beim Absenden)
    const { data } = checkoutData([items[2]!], { legalTextVersions: versions })
    const checkout = await payload.create({
      collection: 'checkouts',
      data: data as never,
      overrideAccess: true,
      context: { system: true },
    })
    expect(checkout.legalTextVersions?.widerrufsbelehrung).toMatchObject({
      id: versions.widerrufsbelehrung,
    })
  })

  it('Summen beim Anlegen: Zwischensumme = Σ Positionen, Summe = Zwischensumme + Versand', async () => {
    await rejects(
      createOrder(payload, orderData(984, [items[0]!], { subtotalCents: 1000, totalCents: 1890 })),
      /Zwischensumme/,
    )
    await rejects(createOrder(payload, orderData(984, [items[0]!], { totalCents: 1 })), /Summe/)
  })

  it('Statuswechsel nur mit context.transition und erlaubtem Übergang; Verlauf und Audit je Wechsel', async () => {
    const order = await createOrder(payload, orderData(985, [items[2]!]))
    await rejects(
      payload.update({
        collection: 'orders',
        id: order.id,
        data: { status: 'packed' },
        overrideAccess: true,
      }),
      /Aktionsknöpfe/,
    )
    await rejects(
      payload.update({
        collection: 'orders',
        id: order.id,
        data: { status: 'delivered' },
        overrideAccess: true,
        context: { system: true, transition: 'test' },
      }),
      /nicht von „paid“ nach „delivered“/,
    )
    const packed = await payload.update({
      collection: 'orders',
      id: order.id,
      data: { status: 'packed' },
      overrideAccess: true,
      context: { transition: 'pack', note: 'Zwei Fotos gemacht' },
    })
    expect(packed.statusHistory!.map((h) => [h.from, h.to, h.transition])).toEqual([
      [null, 'paid', 'O1'],
      ['paid', 'packed', 'O6'],
    ])
    expect(packed.statusHistory![1]!.note).toBe('Zwei Fotos gemacht')
    expect(packed.timestamps?.packedAt).toBeTruthy()
    const disputed = await payload.update({
      collection: 'orders',
      id: order.id,
      data: { status: 'disputed' },
      overrideAccess: true,
      context: { system: true, transition: 'dispute' },
    })
    expect(disputed.statusBeforeDispute).toBe('packed')
    const won = await payload.update({
      collection: 'orders',
      id: order.id,
      data: { status: 'packed' },
      overrideAccess: true,
      context: { system: true, transition: 'disputeWon' },
    })
    expect(won.statusHistory!.at(-1)!.transition).toBe('O17')
    const audit = await payload.find({
      collection: 'audit-log',
      where: {
        and: [
          { entityCollection: { equals: 'orders' } },
          { entityId: { equals: String(order.id) } },
        ],
      },
      sort: 'createdAt',
      overrideAccess: true,
    })
    expect(audit.docs.map((d) => d.action)).toEqual([
      'order_created',
      'order_status_changed',
      'order_status_changed',
      'order_status_changed',
    ])
  })

  it('Endstatus setzt finalStatusAt und retainUntil (Stufe D, Ende des Jahres + 6)', async () => {
    const order = await createOrder(payload, orderData(986, [items[0]!], { status: 'refunded' }), {
      system: true,
      transition: 'O19',
      now: '2026-10-05T10:00:00.000Z',
    })
    expect(order.statusHistory![0]!.transition).toBe('O19')
    expect(order.timestamps?.finalStatusAt).toBe('2026-10-05T10:00:00.000Z')
    expect(order.retainUntil).toBe('2032-12-31T23:00:00.000Z')
  })

  it('L-12/L-19 a: Mail- und Einwilligungsnachweise mit Bestellbezug folgen der Frist der Bestellung', async () => {
    const order = await createOrder(payload, orderData(991, [items[1]!]))
    const mail = await payload.create({
      collection: 'email-log',
      data: {
        template: 'order_confirmation',
        to: 'erika@planetclairetattoos.com',
        locale: 'de',
        subject: 'Bestellung',
        order: order.id,
      } as never,
      overrideAccess: true,
      context: { skipAudit: true },
    })
    // Ohne Endstatus vorsorglich Stufe D ab Anlage (nie kürzer als die Bestellung)
    expect(new Date(mail.retainUntil).getTime()).toBeGreaterThan(Date.parse('2032-01-01'))
    const consent = await payload.create({
      collection: 'consent-log',
      data: {
        purpose: 'carrier_email_forwarding',
        granted: true,
        textSnapshot: 'Ja, E-Mail an DHL.',
        locale: 'de',
        email: 'erika@planetclairetattoos.com',
        order: order.id,
      } as never,
      overrideAccess: true,
      context: { skipAudit: true },
    })
    const refunded = await payload.update({
      collection: 'orders',
      id: order.id,
      data: { status: 'refunded' },
      overrideAccess: true,
      context: { system: true, transition: 'refund', now: '2027-02-01T10:00:00.000Z' },
    })
    expect(refunded.retainUntil).toBe('2033-12-31T23:00:00.000Z')
    const [m, c] = await Promise.all([
      payload.findByID({ collection: 'email-log', id: mail.id, overrideAccess: true }),
      payload.findByID({ collection: 'consent-log', id: consent.id, overrideAccess: true }),
    ])
    expect(m.retainUntil).toBe(refunded.retainUntil)
    expect(c.retainUntil).toBe(refunded.retainUntil)
  })

  it('Löschen einer echten Bestellung wird abgelehnt', async () => {
    const order = await createOrder(payload, orderData(987, [items[0]!]))
    await rejects(
      payload.delete({
        collection: 'orders',
        id: order.id,
        overrideAccess: true,
        context: { system: true },
      }),
      /nie gelöscht/,
    )
  })
})

describe('checkouts (DATENMODELL §6.25)', () => {
  it('DM-CHK-01 eine Kasse speichert nur tokenHash; der Token erscheint in keinem Log', async () => {
    const logs: string[] = []
    const capture = (...a: unknown[]) => void logs.push(a.map(String).join(' '))
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(capture),
      vi.spyOn(console, 'error').mockImplementation(capture),
      vi.spyOn(console, 'warn').mockImplementation(capture),
      vi.spyOn(console, 'info').mockImplementation(capture),
      vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
        logs.push(String(chunk))
        return true
      }),
    ]
    const { token, data } = checkoutData([items[0]!])
    let id: number
    try {
      const doc = await payload.create({
        collection: 'checkouts',
        data: data as never,
        overrideAccess: true,
      })
      id = doc.id as number
      expect(doc.tokenHash).toMatch(/^[0-9a-f]{64}$/)
      await payload.update({
        collection: 'checkouts',
        id,
        data: { status: 'confirming', paymentChoice: 'stripe' } as never,
        overrideAccess: true,
        context: { system: true, transition: 'submitCheckout' },
      })
    } finally {
      for (const s of spies) s.mockRestore()
    }
    expect(logs.join('\n')).not.toContain(token)
    const rows = await dbOf(payload).execute(
      sql`SELECT row_to_json(c) AS r FROM checkouts c WHERE id = ${id!}`,
    )
    expect(JSON.stringify(rows.rows)).not.toContain(token)
    const audit = await dbOf(payload).execute(sql`SELECT row_to_json(a) AS r FROM audit_log a`)
    expect(JSON.stringify(audit.rows)).not.toContain(token)
    // Der Klartext-Token passt nicht in das Feld
    const raw = checkoutData([items[1]!])
    await rejects(
      payload.create({
        collection: 'checkouts',
        data: { ...raw.data, tokenHash: raw.token } as never,
        overrideAccess: true,
      }),
      /SHA-256/,
    )
  })

  it('DM-CHK-02 Übergänge im Speicher-Hook: Zeitstempel, Grund und Snapshot fest', async () => {
    const { data } = checkoutData([items[1]!])
    const doc = await payload.create({
      collection: 'checkouts',
      data: data as never,
      overrideAccess: true,
    })
    const ctx = { system: true, transition: 'test' }
    await rejects(
      payload.update({
        collection: 'checkouts',
        id: doc.id,
        data: { status: 'failed' },
        overrideAccess: true,
        context: ctx,
      }),
      /nicht von „open“ nach „failed“/,
    )
    await rejects(
      payload.update({
        collection: 'checkouts',
        id: doc.id,
        data: { status: 'expired' },
        overrideAccess: true,
        context: ctx,
      }),
      /Grund/,
    )
    await rejects(
      payload.update({
        collection: 'checkouts',
        id: doc.id,
        data: { status: 'cancelled', closeReason: 'cart_changed' },
        overrideAccess: true,
      }),
      /nur über die Kasse/,
    )
    await rejects(
      payload.update({
        collection: 'checkouts',
        id: doc.id,
        data: { reservationRef: crypto.randomUUID() },
        overrideAccess: true,
        context: ctx,
      }),
      /unveränderlich/,
    )
    const cancelled = await payload.update({
      collection: 'checkouts',
      id: doc.id,
      data: { status: 'cancelled', closeReason: 'cart_changed' },
      overrideAccess: true,
      context: ctx,
    })
    expect(cancelled.timestamps?.cancelledAt).toBeTruthy()
    await rejects(
      payload.update({
        collection: 'checkouts',
        id: doc.id,
        data: { status: 'open' },
        overrideAccess: true,
        context: ctx,
      }),
      /nicht von „cancelled“/,
    )
  })

  it('Reservierung: active → released nur mit Grund, danach fest', async () => {
    const { data } = checkoutData([items[2]!])
    const checkout = await payload.create({
      collection: 'checkouts',
      data: data as never,
      overrideAccess: true,
    })
    const res = await payload.create({
      collection: 'reservations',
      data: {
        ref: data.reservationRef,
        checkout: checkout.id,
        product: items[2]!.id,
        expiresAt: data.expiresAt,
      } as never,
      overrideAccess: true,
    })
    expect(res.status).toBe('active')
    await rejects(
      payload.update({
        collection: 'reservations',
        id: res.id,
        data: { status: 'released' },
        overrideAccess: true,
      }),
      /Grund/,
    )
    const released = await payload.update({
      collection: 'reservations',
      id: res.id,
      data: { status: 'released', releaseReason: 'customer_cancelled' },
      overrideAccess: true,
    })
    expect(released.releasedAt).toBeTruthy()
    await rejects(
      payload.update({
        collection: 'reservations',
        id: res.id,
        data: { status: 'active' },
        overrideAccess: true,
      }),
      /nicht von „released“/,
    )
  })
})

describe('Zugriff (DATENMODELL §6.7, §6.8.4, §6.25.4)', () => {
  it('anonymes REST auf checkouts, reservations, orders: 403/404 für alle Methoden', async () => {
    const order = await createOrder(payload, orderData(988, [items[0]!]))
    for (const slug of ['checkouts', 'reservations', 'orders']) {
      for (const [method, path] of [
        ['GET', `/${slug}`],
        ['GET', `/${slug}/${order.id}`],
        ['POST', `/${slug}`],
        ['PATCH', `/${slug}/${order.id}`],
        ['DELETE', `/${slug}/${order.id}`],
      ] as const) {
        const res = await rest(
          method,
          path,
          method === 'POST' || method === 'PATCH' ? { status: 'paid' } : undefined,
        )
        expect([401, 403, 404], `${method} ${path}`).toContain(res.status)
      }
    }
  })

  it('DM-PROD-07 öffentliche Produktabfragen enthalten currentOrder nicht', async () => {
    const order = await createOrder(payload, orderData(989, [items[0]!]))
    const fx = await createProductFixtures(payload)
    const sold = await createProduct(
      payload,
      completeProduct('keramik', 990, fx, {
        status: 'sold',
        soldChannel: 'online',
        soldAt: '2026-09-27T10:00:00.000Z',
        showInArchiveAfterSale: true,
        currentOrder: order.id,
      }),
      { seed: true },
    )
    const admin = await payload.findByID({
      collection: 'products',
      id: sold.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(admin.currentOrder).toBe(order.id)
    const res = await rest('GET', `/products/${sold.id}?depth=0`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.itemNumber).toBe(990)
    expect(body).not.toHaveProperty('currentOrder')
  })
})
