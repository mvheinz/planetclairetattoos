import type { Payload } from 'payload'
import { describe, expect, it } from 'vitest'

import { buildOrderView, EPC_QR_DISPLAY_PX, statusTokenOf } from '@/lib/commerce/orderView'
import { createToken, hashToken, sealToken } from '@/lib/security/tokens'
import type { Order, Setting } from '@/payload-types'

// P4.17/P4.23 Anzeige-Daten für Danke-Seite R08 und Bestellstatus R09 (`buildOrderView`, KONZEPT §4.12/§4.13, R-066,
// R-067): Positionen je Sprache, S4-Block „Leider schon weg“, Erstattungssumme, Bankdaten nur bei offener Vorkasse (mit
// EPC-QR), Sendungsverfolgung, Anschrift je Lieferart, maskierte E-Mail, Status für die Kund:in bei Anfechtung; dazu
// `statusTokenOf` (Siegel prüfen, nie rotieren). Ohne Datenbank: `payload.findGlobal` liefert feste Einstellungen.

const SETTINGS = {
  payment: {
    accountHolder: 'Jutta Beispiel',
    iban: 'DE36 0000 0000 0000 0000 00',
    bic: 'TESTDEFFXXX',
    bankName: 'Beispielbank',
  },
  shipping: {
    trackingUrlTemplates: [
      {
        carrier: 'dhl',
        urlTemplate:
          'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode={trackingNumber}',
      },
      { carrier: 'deutsche_post', urlTemplate: '' },
      null,
    ],
  },
} as unknown as Setting

const fakePayload = (settings: Partial<Setting> = SETTINGS) =>
  ({ findGlobal: async () => settings }) as unknown as Payload

const address = (name: string, city: string) => ({
  name,
  line1: 'Musterstraße 1',
  postalCode: '10115',
  city,
  country: 'DE',
})

function order(o: Record<string, unknown> = {}): Order {
  return {
    id: 17,
    orderNumber: 'PC-2026-00017',
    locale: 'de',
    seed: false,
    status: 'paid',
    fulfillmentMethod: 'shipping',
    paymentMethod: 'card',
    taxModeAtOrder: 'kleinunternehmer',
    shippingCents: 890,
    totalCents: 10_890,
    subtotalCents: 10_000,
    timestamps: { placedAt: '2026-10-14T09:28:00.000Z' },
    customer: { name: 'Erika Beispiel', email: 'erika@example.org' },
    shippingAddress: address('Erika Beispiel', 'Berlin'),
    billingAddress: address('Firma Beispiel', 'Potsdam'),
    billingAddressDiffers: false,
    items: [
      { id: 'a', product: 5, itemNumber: 17, titleDe: 'Tasse', titleEn: 'Mug', priceCents: 4500 },
      {
        id: 'b',
        product: { id: 6 },
        itemNumber: 23,
        titleDe: 'Cap',
        titleEn: null,
        priceCents: 5500,
        coverImageUrl: '/media/cap.webp',
      },
    ],
    refunds: [],
    statusHistory: [],
    ...o,
  } as unknown as Order
}

describe('buildOrderView (R08/R09)', () => {
  it('R-066 bezahlt, Versand: Positionen DE, Lieferanschrift, maskierte E-Mail, keine Bankdaten, kein Tracking', async () => {
    const v = await buildOrderView(fakePayload(), order(), 'de')
    expect(v.items.map((i) => [i.productId, i.title, i.imageUrl])).toEqual([
      [5, 'Tasse', null],
      [6, 'Cap', '/media/cap.webp'],
    ])
    expect(v.customer).toEqual({
      name: 'Erika Beispiel',
      postalCode: '10115',
      city: 'Berlin',
      email: expect.stringContaining('@example.org'),
    })
    expect(v.customer.email).not.toBe('erika@example.org')
    expect(v.bank).toBeNull()
    expect(v.tracking).toBeNull()
    expect(v.unavailable).toEqual([])
    expect(v.refundedCents).toBe(0)
    expect(v.seed).toBe(false)
    expect(v.paymentMethodType).toBeNull()
    expect(v.shownStatus).toBe('paid')
    expect(v.placedAt).toBe('2026-10-14T09:28:00.000Z')
    expect(v.steps.length).toBeGreaterThan(0)
  })

  it('EN-Titel mit Rückfall auf Deutsch; Abholung bzw. abweichende Rechnungsadresse zeigt die Rechnungsanschrift', async () => {
    const en = await buildOrderView(fakePayload(), order({ customer: { email: null } }), 'en')
    expect(en.items.map((i) => i.title)).toEqual(['Mug', 'Cap'])
    expect(en.customer.name).toBe('Erika Beispiel')
    expect(en.customer.email).toBeNull()
    const pickup = await buildOrderView(
      fakePayload(),
      order({ fulfillmentMethod: 'pickup', shippingCents: 0 }),
      'de',
    )
    expect(pickup.customer.city).toBe('Potsdam')
    const differs = await buildOrderView(
      fakePayload(),
      order({ billingAddressDiffers: true }),
      'de',
    )
    expect(differs.customer.city).toBe('Potsdam')
    const noAddress = await buildOrderView(
      fakePayload(),
      order({ customer: null, shippingAddress: null }),
      'de',
    )
    expect(noAddress.customer).toEqual({ name: null, postalCode: null, city: null, email: null })
  })

  it('AK-4-10 S4: fehlende Stücke als „Leider schon weg“ mit Erstattung; fehlgeschlagene Erstattungen zählen nicht', async () => {
    const v = await buildOrderView(
      fakePayload(),
      order({
        items: [
          {
            id: 'a',
            product: 5,
            itemNumber: 17,
            titleDe: 'Tasse',
            priceCents: 4500,
            refundedCents: 4500,
          },
          { id: 'b', product: 6, itemNumber: 23, titleDe: 'Cap', priceCents: 5500 },
          { id: null, product: null, itemNumber: 24, titleDe: 'Ohne ID', priceCents: 100 },
        ],
        refunds: [
          { reason: 'item_unavailable', itemIds: ['a'], amountCents: 4500, status: 'succeeded' },
          { reason: 'item_unavailable', itemIds: 'kaputt', amountCents: 100, status: 'failed' },
          { reason: 'withdrawal', amountCents: null, status: 'pending' },
        ],
      }),
      'de',
    )
    expect(v.items.map((i) => i.itemNumber)).toEqual([23, 24])
    expect(v.items[1]!.productId).toBeNull()
    expect(v.unavailable).toEqual([{ itemNumber: 17, refundedCents: 4500 }])
    expect(v.refundedCents).toBe(4500)
    const noRefundAmount = await buildOrderView(
      fakePayload(),
      order({
        items: [{ id: 'a', product: 5, itemNumber: 17, titleDe: 'Tasse', priceCents: 4500 }],
        refunds: [{ reason: 'item_unavailable', itemIds: ['a'], amountCents: 4500 }],
      }),
      'de',
    )
    expect(noRefundAmount.unavailable).toEqual([{ itemNumber: 17, refundedCents: 4500 }])
  })

  it('R-070 Vorkasse offen: Bankdaten, formatierte IBAN, Frist und EPC-QR (168 px); ohne Bankverbindung keine Bankdaten', async () => {
    const open = order({
      status: 'awaiting_prepayment',
      paymentMethod: 'prepayment',
      prepayment: { dueAt: '2026-10-21T21:59:59.000Z' },
    })
    const v = await buildOrderView(fakePayload(), open, 'de')
    expect(v.bank).toMatchObject({
      accountHolder: 'Jutta Beispiel',
      iban: 'DE36 0000 0000 0000 0000 00',
      ibanRaw: 'DE36000000000000000000',
      bic: 'TESTDEFFXXX',
      bankName: 'Beispielbank',
      amountCents: 10_890,
      reference: 'PC-2026-00017',
      dueAt: '2026-10-21T21:59:59.000Z',
    })
    expect(v.bank!.qrDataUri).toMatch(/^data:image\/svg\+xml;base64,/)
    expect(Buffer.from(v.bank!.qrDataUri!.split(',')[1]!, 'base64').toString()).toContain(
      `${EPC_QR_DISPLAY_PX}`,
    )
    const noDue = await buildOrderView(
      fakePayload({ payment: { accountHolder: 'Jutta', iban: 'DE36000000000000000000' } } as never),
      order({ status: 'awaiting_prepayment', paymentMethod: 'prepayment', prepayment: null }),
      'de',
    )
    expect(noDue.bank).toMatchObject({ bic: null, bankName: null, dueAt: null })
    // Ungültige IBAN: Bankdaten ohne QR (Warnung im Log statt Fehlerseite).
    const broken = await buildOrderView(
      fakePayload({ payment: { accountHolder: 'Jutta', iban: 'XX00' } } as never),
      open,
      'de',
    )
    expect(broken.bank?.qrDataUri).toBeNull()
    expect((await buildOrderView(fakePayload({}), open, 'de')).bank).toBeNull()
  })

  it('R-067 Sendungsverfolgung: DHL mit Link, Deutsche Post ohne Vorlage und sonstiger Versender ohne Link', async () => {
    const dhl = await buildOrderView(
      fakePayload(),
      order({
        status: 'shipped',
        shipment: { carrier: 'dhl', trackingNumber: '00340434161234567890' },
      }),
      'de',
    )
    expect(dhl.tracking).toEqual({
      carrier: 'dhl',
      number: '00340434161234567890',
      url: expect.stringContaining('00340434161234567890'),
    })
    const post = await buildOrderView(
      fakePayload(),
      order({ status: 'shipped', shipment: { carrier: 'deutsche_post', trackingNumber: 'RR123' } }),
      'en',
    )
    expect(post.tracking?.number).toBe('RR123')
    const other = await buildOrderView(
      fakePayload({ shipping: {} } as never),
      order({ status: 'shipped', shipment: { carrier: null, trackingNumber: 'X1' } }),
      'de',
    )
    expect(other.tracking).toEqual({ carrier: null, number: 'X1', url: null })
  })

  it('angefochten: die Kund:in sieht den Status vor der Anfechtung; Beispielbestellung und Wallet-Kennung', async () => {
    const v = await buildOrderView(
      fakePayload(),
      order({
        status: 'disputed',
        statusBeforeDispute: 'shipped',
        seed: true,
        stripe: { paymentMethodType: 'apple_pay' },
        statusHistory: [{ to: 'shipped', at: '2026-10-15T09:00:00.000Z' }],
      }),
      'de',
    )
    expect(v.status).toBe('disputed')
    expect(v.shownStatus).toBe('shipped')
    expect(v.seed).toBe(true)
    expect(v.paymentMethodType).toBe('apple_pay')
  })
})

describe('statusTokenOf', () => {
  it('R-067 liefert den Token nur bei lesbarem Siegel und passendem Hash', () => {
    const token = createToken()
    const sealed = sealToken(token)
    expect(statusTokenOf({ statusTokenHash: hashToken(token), statusTokenSealed: sealed })).toBe(
      token,
    )
    expect(
      statusTokenOf({ statusTokenHash: hashToken(createToken()), statusTokenSealed: sealed }),
    ).toBeNull()
    expect(
      statusTokenOf({ statusTokenHash: hashToken(token), statusTokenSealed: 'kaputt' }),
    ).toBeNull()
    expect(statusTokenOf({ statusTokenHash: null, statusTokenSealed: sealed })).toBeNull()
    expect(statusTokenOf({ statusTokenHash: hashToken(token), statusTokenSealed: null })).toBeNull()
  })
})
