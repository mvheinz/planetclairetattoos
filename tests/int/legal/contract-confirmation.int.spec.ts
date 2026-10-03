import { sql } from '@payloadcms/db-postgres'
import { createLocalReq } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { CheckoutRawInput } from '@/lib/commerce/checkoutSchema'
import { submitCheckout } from '@/lib/commerce/submitCheckout'
import { activateLegalText } from '@/lib/legal/activate'
import type { EmailLog, Order } from '@/payload-types'

import { readOutbox } from '../../helpers/outbox'
import { checkoutById } from '../helpers/checkout'
import { deleteCommerce } from '../helpers/commerce'
import { deleteLegalTexts, lexical } from '../helpers/legal'
import { shopHarness } from '../helpers/shop'

// P6.12 – Prüf-Suite Bestellprozess, Teil Vertragsbestätigung (§ 312f, § 312i BGB; R-013, R-015, R-065, R-081,
// AK-6-02): echter Kassenabschluss `submitCheckout` mit dem Mock-Anbieter. Der Klick speichert die Kasse mit Zeitpunkt,
// Snapshot und Rechtstext-Fassungen; erst die bestätigte Zahlung legt die Bestellung an, die diese Angaben unverändert
// übernimmt. M01 kommt sofort danach (Zugangs- und Vertragsbestätigung) mit genau drei PDF-Anhängen in der Fassung der
// Bestellung (Rechnung, AGB, Widerrufsbelehrung mit Muster-Formular) – auch wenn inzwischen neue Fassungen aktiv sind;
// EN-Bestellungen bekommen zusätzlich die vorhandenen EN-PDFs. Gescheiterte Zahlung → keine Bestellung, keine M01.

const NOW = '2026-10-08T10:00:00.000Z'
const LATER = '2026-10-08T10:10:00.000Z'
const NUMBERS = [990, 991, 992, 993, 994]
const h = shopHarness({ start: NOW, numbers: NUMBERS, tag: 'contract-confirmation' })

const texts: Record<string, { id: number; version: number }> = {}
/** Eigene Adressen je Lauf (das Mail-Protokoll bleibt über Läufe hinweg stehen). */
const RUN = crypto.randomUUID().slice(0, 8)

async function draft(type: string, de: string[], en: string[] | null, validFrom = NOW) {
  const d = await h.payload.create({
    collection: 'legal-texts',
    locale: 'de',
    data: { type, validFrom, origin: 'placeholder', content: lexical(...de) } as never,
    overrideAccess: true,
    context: { now: validFrom },
  })
  if (en) {
    await h.payload.update({
      collection: 'legal-texts',
      id: d.id,
      locale: 'en',
      data: { content: lexical(...en) } as never,
      overrideAccess: true,
      context: { now: validFrom },
    })
  }
  const req = await createLocalReq({ context: { now: validFrom } }, h.payload)
  const res = await activateLegalText(req, d.id, {})
  if (res.pdfJobId !== null) {
    await h.payload.jobs.runByID({
      id: res.pdfJobId,
      req: await createLocalReq({ context: { now: validFrom } }, h.payload),
    })
  }
  const doc = await h.payload.findByID({ collection: 'legal-texts', id: d.id, depth: 0 })
  return { id: doc.id as number, version: doc.version as number }
}

beforeAll(async () => {
  // Eigene Bestellfassungen v1 (AGB und Belehrung mit EN-Übersetzung, Formular nur DE)
  await deleteCommerce(h.payload)
  await deleteLegalTexts(h.payload)
  texts.agb = await draft('agb', ['§ 1 AGB Fassung eins', 'Anbieterin: {{name}}'], ['Terms v1'])
  texts.widerrufsbelehrung = await draft(
    'widerrufsbelehrung',
    ['Widerrufsrecht Fassung eins', 'Widerruf über {{withdrawalUrl}}'],
    ['Right of withdrawal v1', 'Withdraw at {{withdrawalUrl}}'],
  )
  texts.widerrufsformular = await draft('widerrufsformular', ['Muster-Widerrufsformular'], null)
  texts.datenschutz = await draft('datenschutz', ['Datenschutz'], null)
  texts['versand-zahlung'] = await draft('versand-zahlung', ['Versand'], null)
})

// Eigene Fassungen wieder entfernen: folgende Dateien legen ihre Test-Fassungen selbst an (wie legal-pdf.int.spec.ts).
afterAll(async () => {
  await deleteCommerce(h.payload)
  await deleteLegalTexts(h.payload)
})

const shippingInput = (email: string, o: Partial<CheckoutRawInput> = {}): CheckoutRawInput => ({
  email,
  fulfillmentMethod: 'shipping',
  name: 'Vera Vertrag',
  shippingLine1: 'Musterstraße 1',
  shippingPostalCode: '10115',
  shippingCity: 'Berlin',
  paymentChoice: 'stripe',
  ...o,
})

/** Kasse starten und wie im Browser „Zahlungspflichtig bestellen“ (echter Abschluss). */
async function clickOrder(nr: number, email: string, locale: 'de' | 'en' = 'de') {
  const id = await h.piece(nr)
  const r = await h.start([id], { locale })
  const res = await submitCheckout(
    { token: r.token, raw: shippingInput(email), cartItemIds: [id], now: h.now() },
    { payload: h.payload, payments: h.mock },
  )
  expect(res).toMatchObject({ ok: true, paymentChoice: 'stripe' })
  const checkout = await checkoutById(h.payload, r.checkoutId)
  return { productId: id, checkoutId: r.checkoutId, session: checkout.stripe!.checkoutSessionId! }
}

const m01Rows = (email: string) =>
  h.count('email_log', sql`template = 'order_confirmation' AND "to" = ${email}`)
const m01 = (email: string) => readOutbox({ to: email, type: 'order_confirmation' }, h.outboxDir)
const pdfNames = (m: { attachments: { filename: string; contentType: string }[] }) =>
  m.attachments.filter((a) => a.contentType === 'application/pdf').map((a) => a.filename)

async function m01Log(orderId: number): Promise<EmailLog> {
  const log = await h.payload.find({
    collection: 'email-log',
    where: { order: { equals: orderId }, template: { equals: 'order_confirmation' } },
    depth: 0,
    overrideAccess: true,
  })
  expect(log.docs).toHaveLength(1)
  return log.docs[0] as EmailLog
}

const idOf = (v: unknown) => (typeof v === 'object' && v !== null ? (v as { id: number }).id : v)

describe('Vertragsschluss und Vertragsbestätigung (P6.12)', () => {
  it('R-065 Klick speichert die Kasse (submittedAt, Eingaben, Snapshot, Rechtstext- und Baustein-Fassungen); keine Bestellung und keine M01 vor der Zahlung; die Bestellung übernimmt den Stand unverändert', async () => {
    const email = `vertrag-r065-${RUN}@planetclaire.local`
    const c = await clickOrder(990, email)
    const checkout = await checkoutById(h.payload, c.checkoutId)
    expect(checkout.status).toBe('confirming')
    expect(checkout.submittedAt).toBe(NOW)
    expect(checkout.customer?.email).toBe(email)
    expect(checkout.shippingAddress).toMatchObject({ name: 'Vera Vertrag', postalCode: '10115' })
    expect(checkout.items).toHaveLength(1)
    expect(checkout.items[0]).toMatchObject({ itemNumber: 990, priceCents: 4500 })
    const versions = checkout.legalTextVersions as Record<string, unknown>
    expect(idOf(versions.agb)).toBe(texts.agb!.id)
    expect(idOf(versions.widerrufsbelehrung)).toBe(texts.widerrufsbelehrung!.id)
    expect(idOf(versions.widerrufsformular)).toBe(texts.widerrufsformular!.id)
    expect(idOf(versions.datenschutz)).toBe(texts.datenschutz!.id)
    expect(
      (checkout.legalSnippetVersions as Record<string, unknown>)['checkout.legalNotice'],
    ).toBeTruthy()
    expect(await h.count('orders')).toBe(0)
    expect(await m01Rows(email)).toBe(0)
    expect(await m01(email)).toEqual([])

    await h.deliver(c.session, 'checkout.session.completed')
    const order = await h.orderOfCheckout(c.checkoutId)
    expect(order.status).toBe('paid')
    expect(order.items[0]).toMatchObject({ itemNumber: 990, priceCents: 4500 })
    expect(order.totalCents).toBe(checkout.totalCents)
    for (const key of ['agb', 'widerrufsbelehrung', 'widerrufsformular', 'datenschutz']) {
      expect(idOf((order.legalTextVersions as Record<string, unknown>)[key]), key).toBe(
        idOf(versions[key]),
      )
    }
    expect(order.legalSnippetVersions).toEqual(checkout.legalSnippetVersions)
  })

  it('R-065 gescheiterte Zahlung (verzögert, dann fehlgeschlagen) bzw. abgelaufene Session → keine Bestellung, keine M01', async () => {
    const email = `vertrag-failed-${RUN}@planetclaire.local`
    const a = await clickOrder(991, email)
    await h.mock.setNextOutcome(a.session, { result: 'delayed' })
    await h.deliver(a.session, 'checkout.session.completed')
    await h.deliver(a.session, 'checkout.session.async_payment_failed')
    const b = await clickOrder(992, email)
    await h.deliver(b.session, 'checkout.session.expired')
    expect(await h.count('orders')).toBe(0)
    expect(await m01Rows(email)).toBe(0)
    expect(await m01(email)).toEqual([])
    expect((await checkoutById(h.payload, a.checkoutId)).status).not.toBe('completed')
    expect((await checkoutById(h.payload, b.checkoutId)).status).not.toBe('completed')
  })

  it('AK-6-02 R-081 R-013 M01 einer DE-Bestellung mit Karte bzw. PayPal: sofort nach der Zahlung, genau drei PDF-Anhänge (Rechnung, AGB, Widerrufsbelehrung und Muster-Formular) in der Fassung der Bestellung', async () => {
    for (const [nr, method] of [
      [993, 'card'],
      [994, 'paypal'],
    ] as const) {
      const email = `vertrag-${method}-${RUN}@planetclaire.local`
      const c = await clickOrder(nr, email)
      if (method === 'paypal') {
        await h.mock.setNextOutcome(c.session, { paymentMethod: { type: 'paypal' } })
      }
      await h.deliver(c.session, 'checkout.session.completed')
      const order = (await h.orderOfCheckout(c.checkoutId)) as Order
      expect(order.paymentMethod).toBe(method)
      const mails = await m01(email)
      expect(mails).toHaveLength(1)
      const invoice = await h.payload.findByID({
        collection: 'invoices',
        id: idOf(order.invoice) as number,
        depth: 0,
        overrideAccess: true,
      })
      expect(pdfNames(mails[0]!)).toEqual([
        `${invoice.number}.pdf`,
        `AGB_v${texts.agb!.version}.pdf`,
        `Widerrufsbelehrung-und-Formular_v${texts.widerrufsbelehrung!.version}.pdf`,
      ])
      const log = await m01Log(order.id)
      expect(log.status).toBe('sent')
      expect(log.sentAt).toBeTruthy()
      expect(log.attachments?.map((a) => a.filename)).toEqual(pdfNames(mails[0]!))
    }
  })

  it('R-015 R-013 EN-Bestellung: zusätzlich die vorhandenen EN-PDFs; nach einer neuen AGB-Fassung bleiben die Anhänge der Bestellfassung', async () => {
    const email = `vertrag-en-${RUN}@planetclaire.local`
    const c = await clickOrder(990, email, 'en')
    // Zwischen Klick und Zahlung wird eine neue AGB-Fassung aktiv – die Bestellung bleibt bei ihrer Fassung.
    const agb2 = await draft('agb', ['§ 1 AGB Fassung zwei'], ['Terms v2'], LATER)
    expect(agb2.version).toBe(texts.agb!.version + 1)
    h.clock.set(LATER)
    await h.deliver(c.session, 'checkout.session.completed')
    const order = await h.orderOfCheckout(c.checkoutId)
    expect(order.locale).toBe('en')
    expect(idOf((order.legalTextVersions as Record<string, unknown>).agb)).toBe(texts.agb!.id)
    const mails = await m01(email)
    expect(mails).toHaveLength(1)
    const names = pdfNames(mails[0]!)
    const v = texts.agb!.version
    const b = texts.widerrufsbelehrung!.version
    expect(names.slice(1)).toEqual([
      `AGB_v${v}.pdf`,
      `Widerrufsbelehrung-und-Formular_v${b}.pdf`,
      `AGB_v${v}_EN.pdf`,
      `Widerrufsbelehrung-und-Formular_v${b}_EN.pdf`,
    ])
    expect(names.some((n) => n.includes(`_v${agb2.version}`))).toBe(false)
  })
})
