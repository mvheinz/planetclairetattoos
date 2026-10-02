import { describe, expect, it } from 'vitest'

import { mockConfirmOutcome } from '@/lib/commerce/mockConfirm'
import { submitCheckout } from '@/lib/commerce/submitCheckout'

import { readOutbox } from '../../helpers/outbox'
import { shopHarness } from '../helpers/shop'

// R-102 Abholung in Berlin (RECHT §4.10, E-29; P4-Teil): Abholung kostet 0 €, ist ein Fernabsatzvertrag mit vollem
// Widerrufsrecht – die Bestellbestätigung M01 enthält den Widerrufs-Link und die Widerrufsbelehrung, aber keinen
// Abholort (der steht erst in der Abholmail M07, R-083, P5). Die Fristberechnung ab `timestamps.pickedUpAt` gehört zum
// Widerrufsablauf (P5).

const h = shopHarness({ start: '2026-10-09T12:00:00.000Z', numbers: [992], tag: 'pickup' })

describe('R-102 Abholung (P4)', () => {
  it('R-102 Abholbestellung: Versand 0 €, Rechnungsadresse Pflicht, M01 mit Widerrufs-Link und Belehrung, ohne Abholort', async () => {
    const a = await h.piece(992)
    const r = await h.start([a], { delivery: 'pickup' })
    const deps = { payload: h.payload, payments: h.mock }
    const email = 'abholung@planetclaire.local'
    const base = {
      email,
      fulfillmentMethod: 'pickup',
      name: 'Erika Beispiel',
      paymentChoice: 'stripe',
    } as const
    const missing = await submitCheckout(
      { token: r.token, raw: base, cartItemIds: [a], now: h.now() },
      deps,
    )
    expect(missing).toMatchObject({ ok: false, status: 400 })
    const ok = await submitCheckout(
      {
        token: r.token,
        raw: {
          ...base,
          billingLine1: 'Musterstraße 1',
          billingPostalCode: '10115',
          billingCity: 'Berlin',
        },
        cartItemIds: [a],
        now: h.now(),
      },
      deps,
    )
    expect(ok).toMatchObject({ ok: true })
    const paid = await mockConfirmOutcome(
      { token: r.token, outcome: 'success', now: h.now() },
      deps,
    )
    expect(paid.ok).toBe(true)

    const order = await h.orderOfCheckout(r.checkoutId)
    expect(order).toMatchObject({ fulfillmentMethod: 'pickup', shippingCents: 0, status: 'paid' })
    expect(order.totalCents).toBe(order.subtotalCents)

    const [m01] = await readOutbox({ to: email, type: 'order_confirmation' }, h.outboxDir)
    expect(m01, 'M01 an die Kundin').toBeDefined()
    const text = `${m01!.html ?? ''}\n${m01!.text ?? ''}`
    expect(text).toMatch(/vertrag-widerrufen/)
    expect(m01!.attachments.map((x) => x.filename).join(' ')).toMatch(/widerruf/i)
    // Der Abholtext (Ort und Absprache) steht nur in der Abholmail M07.
    const settings = (await h.payload.findGlobal({
      slug: 'settings',
      depth: 0,
      overrideAccess: true,
      locale: 'de',
    })) as { pickup?: { instructions?: string | null } | null }
    const instructions = settings.pickup?.instructions?.trim()
    expect(instructions, 'Abholtext in den Einstellungen').toBeTruthy()
    expect(text).not.toContain(instructions!.slice(0, 40))
  })
})
