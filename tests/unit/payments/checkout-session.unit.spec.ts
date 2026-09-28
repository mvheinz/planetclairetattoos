import { describe, expect, it } from 'vitest'

import {
  assertCheckoutSessionInput,
  buildSessionParams,
  checkoutIdempotencyKey,
  clientSecretMissing,
  loggableSessionParams,
  refundIdempotencyKey,
} from '@/lib/payments/checkoutSession'
import {
  InvalidCheckoutSessionInputError,
  type CreateCheckoutSessionInput,
} from '@/lib/payments/types'
import { createToken } from '@/lib/security/tokens'

// P4.4 – gemeinsame Session-Regeln aller Zahlungs-Treiber (ARCHITEKTUR §3.1 Nr. 6, §3.5; KONZEPT §4.7; R-062).

const NOW = new Date('2026-10-15T08:00:00.000Z')
const REF = '6f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f'
const TOKEN = createToken()

const input = (over: Partial<CreateCheckoutSessionInput> = {}): CreateCheckoutSessionInput => ({
  checkoutRef: REF,
  locale: 'en',
  lineItems: [{ productId: 17, name: 'No. 017 · Bowl', amountCents: 4500 }],
  shipping: { label: 'DHL parcel (ceramics)', amountCents: 690 },
  expiresAt: new Date(NOW.getTime() + 31 * 60_000),
  returnUrl: `https://planetclairetattoos.com/en/thank-you/${TOKEN}`,
  customerEmail: 'erika@example.com',
  metadata: { checkoutRef: REF, appEnv: 'test' },
  ...over,
})

describe('Session-Parameter (KONZEPT §4.7)', () => {
  it('R-062: nur card und paypal, elements/payment/eur, eine feste Versandoption, Menge 1', () => {
    expect(buildSessionParams(input())).toEqual({
      ui_mode: 'elements',
      mode: 'payment',
      currency: 'eur',
      payment_method_types: ['card', 'paypal'],
      expires_at: Math.floor(NOW.getTime() / 1000) + 31 * 60,
      client_reference_id: REF,
      metadata: { checkoutRef: REF, appEnv: 'test' },
      locale: 'en',
      return_url: `https://planetclairetattoos.com/en/thank-you/${TOKEN}`,
      customer_email: 'erika@example.com',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: 4500,
            product_data: { name: 'No. 017 · Bowl' },
          },
        },
      ],
      shipping_options: [
        {
          shipping_rate_data: {
            type: 'fixed_amount',
            display_name: 'DHL parcel (ceramics)',
            fixed_amount: { amount: 690, currency: 'eur' },
          },
        },
      ],
    })
    expect(buildSessionParams(input({ customerEmail: undefined }))).not.toHaveProperty(
      'customer_email',
    )
  })

  it('ARCHITEKTUR §3.1 Nr. 6: der Token steht nur in return_url; Protokoll ohne Token, E-Mail und Titel', () => {
    const params = buildSessionParams(input())
    const { return_url: _returnUrl, ...rest } = params
    expect(JSON.stringify(rest)).not.toContain(TOKEN)
    const logged = loggableSessionParams(params)
    expect(logged).toEqual({
      ui_mode: 'elements',
      mode: 'payment',
      currency: 'eur',
      payment_method_types: ['card', 'paypal'],
      expires_at: params.expires_at,
      client_reference_id: REF,
      metadata: { checkoutRef: REF, appEnv: 'test' },
      locale: 'en',
      line_item_amounts: [4500],
      shipping_amount: 690,
    })
    expect(JSON.stringify(logged)).not.toMatch(new RegExp(`${TOKEN}|erika|Bowl`))
  })
})

describe('Eingaberegeln (assertCheckoutSessionInput)', () => {
  it('gültige Eingabe besteht', () => {
    expect(() => assertCheckoutSessionInput(input(), NOW)).not.toThrow()
  })

  it.each<[string, Partial<CreateCheckoutSessionInput>]>([
    [
      'Token statt Referenz',
      { checkoutRef: TOKEN, metadata: { checkoutRef: TOKEN, appEnv: 'test' } },
    ],
    [
      'metadata ≠ checkoutRef',
      { metadata: { checkoutRef: '11111111-1111-4111-8111-111111111111', appEnv: 'test' } },
    ],
    [
      'zusätzliche metadata',
      { metadata: { checkoutRef: REF, appEnv: 'test', email: 'x' } as never },
    ],
    ['appEnv leer', { metadata: { checkoutRef: REF, appEnv: '' } }],
    ['Sprache', { locale: 'fr' as never }],
    ['keine Position', { lineItems: [] }],
    [
      '11 Positionen',
      {
        lineItems: Array.from({ length: 11 }, (_, i) => ({
          productId: i + 1,
          name: `Nr. ${i}`,
          amountCents: 100,
        })),
      },
    ],
    ['Kommabetrag', { lineItems: [{ productId: 1, name: 'Nr. 1', amountCents: 45.5 }] }],
    ['leerer Name', { lineItems: [{ productId: 1, name: ' ', amountCents: 100 }] }],
    ['negativer Versand', { shipping: { label: 'Paket', amountCents: -690 } }],
    ['Ablauf < 30 min', { expiresAt: new Date(NOW.getTime() + 29 * 60_000) }],
    ['Ablauf > 24 h', { expiresAt: new Date(NOW.getTime() + 25 * 3_600_000) }],
    ['relative returnUrl', { returnUrl: '/de/danke/x' }],
  ])('%s → InvalidCheckoutSessionInputError', (_what, over) => {
    expect(() => assertCheckoutSessionInput(input(over), NOW)).toThrow(
      InvalidCheckoutSessionInputError,
    )
  })
})

describe('Idempotenz und Client-Secret (ARCHITEKTUR §3.5)', () => {
  it('Schlüssel checkout:<checkoutRef>:<n> und refund:<orderId>:<refundSeq>', () => {
    expect(checkoutIdempotencyKey(REF, 2)).toBe(`checkout:${REF}:2`)
    expect(refundIdempotencyKey(42, 1)).toBe('refund:42:1')
  })

  it('fehlt das Client-Secret einer offenen Session, wird neu angelegt (sessionSeq + 1)', () => {
    const base = { sessionId: 'cs_x', paymentStatus: 'unpaid' as const }
    expect(clientSecretMissing({ ...base, status: 'open' })).toBe(true)
    expect(clientSecretMissing({ ...base, status: 'open', clientSecret: 'mock_secret_x' })).toBe(
      false,
    )
    expect(clientSecretMissing({ ...base, status: 'expired' })).toBe(false)
  })
})
