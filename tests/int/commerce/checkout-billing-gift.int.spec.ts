import { createLocalReq } from 'payload'
import { describe, expect, it } from 'vitest'

import { reopenCheckout } from '@/lib/commerce/changeDelivery'
import { packingChecklist, packingHints } from '@/lib/commerce/packing'
import type { CheckoutRawInput } from '@/lib/commerce/checkoutSchema'
import { submitCheckout } from '@/lib/commerce/submitCheckout'
import { buildOrderMailData } from '@/lib/email/orderMailData'
import { addressBlocks } from '@/lib/email/templates/orderSections'
import { packingSlipData } from '@/lib/pdf/packingDocs'
import type { Invoice } from '@/payload-types'

import { checkoutById } from '../helpers/checkout'
import { shopHarness } from '../helpers/shop'

// P20.3 Teil 2 (U-93) – Kasse: V-17 Rechnungsadresse aus EU/EWR (Lieferung weiter nur innerhalb Deutschlands, R-060,
// R-061, VO (EU) 2018/302) und V-18 b Geschenk mit Gruß für eine handgeschriebene Karte (Kasse → Bestellung, nur für
// Jutta sichtbar, nie in Mails). Fixture-Nummern 990–992.

const NUMBERS = [990, 991, 992]
const h = shopHarness({ start: '2026-10-12T10:00:00.000Z', numbers: NUMBERS, tag: 'billing-gift' })

const pickupAt = (o: Partial<CheckoutRawInput> = {}): CheckoutRawInput => ({
  email: 'anna.alpen@planetclaire.local',
  fulfillmentMethod: 'pickup',
  name: 'Anna Alpen',
  billingLine1: 'Ringstraße 1',
  billingPostalCode: '1010',
  billingCity: 'Wien',
  billingCountry: 'AT',
  paymentChoice: 'stripe',
  ...o,
})

const shippingDe = (o: Partial<CheckoutRawInput> = {}): CheckoutRawInput => ({
  email: 'erika@planetclaire.local',
  fulfillmentMethod: 'shipping',
  name: 'Bruno Beschenkt',
  shippingLine1: 'Musterstraße 1',
  shippingPostalCode: '10115',
  shippingCity: 'Berlin',
  paymentChoice: 'stripe',
  ...o,
})

async function invoiceOf(orderId: number): Promise<Invoice> {
  const res = await h.payload.find({
    collection: 'invoices',
    where: { order: { equals: orderId } },
    depth: 0,
    overrideAccess: true,
  })
  return res.docs[0] as Invoice
}

describe('V-17 Rechnungsadresse im EU/EWR-Ausland', () => {
  it('Abholung in Berlin mit österreichischer Rechnungsadresse geht: Kasse, Bestellung und Rechnung tragen AT', async () => {
    const a = await h.piece(990)
    const r = await h.start([a], { delivery: 'pickup' })
    const res = await submitCheckout(
      { token: r.token, raw: pickupAt(), cartItemIds: [a], now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(res).toMatchObject({ ok: true, paymentChoice: 'stripe' })
    const c = await checkoutById(h.payload, r.checkoutId)
    expect(c.billingAddress).toMatchObject({ postalCode: '1010', city: 'Wien', country: 'AT' })

    await h.deliver(c.stripe!.checkoutSessionId!, 'checkout.session.completed')
    const order = await h.orderOfCheckout(r.checkoutId)
    expect(order.status).toBe('paid')
    expect(order.fulfillmentMethod).toBe('pickup')
    expect(order.billingAddress).toMatchObject({ name: 'Anna Alpen', country: 'AT' })
    const invoice = await invoiceOf(order.id)
    expect((invoice.data as { buyer: { country: string; city: string } }).buyer).toMatchObject({
      city: 'Wien',
      country: 'AT',
    })
    // Bestellmails nennen das Land in der Sprache der Mail (M01/M02/M05 v3)
    const req = await createLocalReq({ context: { system: true } }, h.payload)
    const mail = await buildOrderMailData(req, order)
    const lines = JSON.stringify(addressBlocks(mail, 'de'))
    expect(lines).toContain('1010 Wien')
    expect(lines).toContain('Österreich')
    expect(JSON.stringify(addressBlocks(mail, 'en'))).toContain('Austria')
  })

  it('Versand nach Deutschland mit Rechnungsadresse in Norwegen geht; Versand nach Österreich wird mit klarer Meldung abgelehnt', async () => {
    const a = await h.piece(991)
    const r = await h.start([a])
    const toAt = await submitCheckout(
      {
        token: r.token,
        raw: shippingDe({ shippingCountry: 'AT', shippingPostalCode: '10115' }),
        now: h.now(),
      },
      { payload: h.payload, payments: h.mock },
    )
    // „Ich liefere nur innerhalb Deutschlands.“ (checkout.errors.country) am Feld „Land“
    expect(toAt).toMatchObject({ ok: false, status: 400, code: 'invalid' })
    expect(!toAt.ok && toAt.errors).toEqual({ shippingCountry: 'country' })

    const gb = await submitCheckout(
      {
        token: r.token,
        raw: shippingDe({
          billingAddressDiffers: 'on',
          billingName: 'Erika Beispiel',
          billingLine1: 'High Street 1',
          billingPostalCode: 'SW1A 1AA',
          billingCity: 'London',
          billingCountry: 'GB',
        }),
        now: h.now(),
      },
      { payload: h.payload, payments: h.mock },
    )
    expect(!gb.ok && gb.errors).toEqual({ billingCountry: 'billingCountry' })

    const ok = await submitCheckout(
      {
        token: r.token,
        raw: shippingDe({
          billingAddressDiffers: 'on',
          billingName: 'Erika Beispiel',
          billingLine1: 'Karl Johans gate 1',
          billingPostalCode: '0154',
          billingCity: 'Oslo',
          billingCountry: 'NO',
        }),
        now: h.now(),
      },
      { payload: h.payload, payments: h.mock },
    )
    expect(ok.ok).toBe(true)
    const c = await checkoutById(h.payload, r.checkoutId)
    expect(c.shippingAddress?.country).toBe('DE')
    expect(c.billingAddress).toMatchObject({ city: 'Oslo', country: 'NO' })
  })
})

describe('V-18 b Geschenk mit Gruß für die Karte', () => {
  it('Kasse speichert Häkchen und Gruß, die Bestellung übernimmt sie; „Zu packen“ und Checkliste zeigen sie, der Packzettel ohne Gruß und ohne Preise', async () => {
    const a = await h.piece(992)
    const r = await h.start([a])
    const res = await submitCheckout(
      {
        token: r.token,
        raw: shippingDe({
          isGift: 'on',
          giftMessage: 'Alles Liebe zum Geburtstag!\r\nDeine Erika',
        }),
        cartItemIds: [a],
        now: h.now(),
      },
      { payload: h.payload, payments: h.mock },
    )
    expect(res.ok).toBe(true)
    const c = await checkoutById(h.payload, r.checkoutId)
    expect(c.gift).toMatchObject({
      isGift: true,
      message: 'Alles Liebe zum Geburtstag!\nDeine Erika',
    })

    await h.deliver(c.stripe!.checkoutSessionId!, 'checkout.session.completed')
    const order = await h.orderOfCheckout(r.checkoutId)
    expect(order.gift).toMatchObject({
      isGift: true,
      message: 'Alles Liebe zum Geburtstag!\nDeine Erika',
    })
    const hints = packingHints(order)
    expect(hints.find((x) => x.key === 'gift')?.text).toBe(
      'Geschenk – Karte von Hand schreiben: „Alles Liebe zum Geburtstag!\nDeine Erika“',
    )
    const settings = await h.payload.findGlobal({
      slug: 'settings',
      depth: 0,
      overrideAccess: true,
    })
    expect(packingChecklist(order, settings).map((x) => x.text)).toContain(
      'Geschenk: handgeschriebene Karte beilegen',
    )
    // Packzettel (liegt im Paket): keine Preise, kein Gruß – nur der Punkt auf der Checkliste
    const req = await createLocalReq({ context: { system: true } }, h.payload)
    const slip = await packingSlipData(req, order)
    const slipText = JSON.stringify(slip)
    expect(slipText).not.toContain('Geburtstag')
    expect(slipText).not.toMatch(/€|priceCents|\d+,\d{2}/)
    expect(slip.checklist).toContain('Geschenk: handgeschriebene Karte beilegen')
    // Kundenmail M01: weder Gruß noch Geschenk-Vermerk (Entscheidung: konservativ, OFFENE-PUNKTE)
    const mail = await buildOrderMailData(req, order)
    expect(JSON.stringify(mail)).not.toContain('Geburtstag')
  })

  it('ohne Häkchen wird kein Gruß gespeichert (auch wenn das Feld gefüllt war); ein erneutes Absenden überschreibt', async () => {
    const a = await h.piece(990)
    const r = await h.start([a])
    const first = await submitCheckout(
      {
        token: r.token,
        raw: shippingDe({ isGift: 'on', giftMessage: 'Erster Gruß' }),
        now: h.now(),
      },
      { payload: h.payload, payments: h.mock },
    )
    expect(first.ok).toBe(true)
    expect((await checkoutById(h.payload, r.checkoutId)).gift?.message).toBe('Erster Gruß')
    // Zahlung gescheitert → Kasse wieder offen, neues Absenden ohne Häkchen (Vorkasse legt die Bestellung sofort an)
    h.clock.set(new Date(h.now().getTime() + 60_000))
    const reopened = await reopenCheckout(
      { token: r.token, now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(reopened.ok).toBe(true)
    h.clock.set(new Date(h.now().getTime() + 60_000))
    const second = await submitCheckout(
      {
        token: r.token,
        raw: shippingDe({ giftMessage: 'Bleibt nicht', paymentChoice: 'prepayment' }),
        now: h.now(),
      },
      { payload: h.payload, payments: h.mock },
    )
    expect(second).toMatchObject({ ok: true, paymentChoice: 'prepayment' })
    expect((await checkoutById(h.payload, r.checkoutId)).gift).toMatchObject({
      isGift: false,
      message: null,
    })
    const order = await h.orderOfCheckout(r.checkoutId)
    expect(order.gift).toMatchObject({ isGift: false, message: null })
    expect(packingHints(order).some((x) => x.key === 'gift')).toBe(false)
  })
})
