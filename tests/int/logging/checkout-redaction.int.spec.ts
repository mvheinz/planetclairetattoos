import { createLocalReq } from 'payload'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { CheckoutRawInput } from '@/lib/commerce/checkoutSchema'
import { mockConfirmOutcome } from '@/lib/commerce/mockConfirm'
import { markPrepaymentPaid } from '@/lib/commerce/prepayment'
import { submitCheckout } from '@/lib/commerce/submitCheckout'
import { getThanksState } from '@/lib/commerce/thanksState'

import { checkoutById } from '../helpers/checkout'
import { shopHarness } from '../helpers/shop'

// P4.25 T-20 (ARCHITEKTUR §7.4/§8.11, R-137): nach einem kompletten Kassen-Durchlauf – Kasse starten, Pflichtfelder mit
// Fehler, Absenden, Mock „Abgelehnt“, erneut „Erfolg“, Danke-Seite, dazu Vorkasse mit „Zahlung erhalten“ – steht in
// keiner Log-Zeile eine Eingabe der Kundin (E-Mail, Name, Straße, PLZ + Ort), kein Kassen- oder Status-Token und keine
// IBAN. Die Unit-Tests `tests/unit/logging/redact.unit.spec.ts` prüfen die Schwärzung einzeln; hier zählt, was die
// echten Dienste tatsächlich schreiben (Logger nach stdout/stderr, abgefangen über `console`).

const NUMBERS = [990, 991]
const h = shopHarness({ start: '2026-10-09T10:00:00.000Z', numbers: NUMBERS, tag: 'redact' })

const EMAIL = 'Erika.Geheim@Beispiel-Kundin.example'
const input = (o: Partial<CheckoutRawInput> = {}): CheckoutRawInput => ({
  email: EMAIL,
  fulfillmentMethod: 'shipping',
  name: 'Erika Geheimnisvoll',
  shippingLine1: 'Verschwiegene Gasse 17',
  shippingPostalCode: '10999',
  shippingCity: 'Berlin',
  paymentChoice: 'stripe',
  ...o,
})

let lines: string[] = []
beforeEach(() => {
  lines = []
  const capture =
    (level: string) =>
    (...args: unknown[]) =>
      lines.push(
        `${level} ${args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}`,
      )
  for (const level of ['log', 'info', 'warn', 'error', 'debug'] as const)
    vi.spyOn(console, level).mockImplementation(capture(level))
})
afterEach(() => {
  vi.restoreAllMocks()
})

function expectRedacted(secrets: string[]) {
  const all = lines.join('\n')
  for (const s of secrets)
    expect(all.toLowerCase(), `Log enthält „${s}“`).not.toContain(s.toLowerCase())
}

describe('T-20 Logger-Schwärzung nach einem kompletten Kassen-Durchlauf', () => {
  it('R-137 Karte: Fehler, Abgelehnt, Erfolg, Danke-Seite – keine Eingaben, kein Token in den Logs', async () => {
    const a = await h.piece(990)
    const r = await h.start([a])
    const deps = { payload: h.payload, payments: h.mock }

    const invalid = await submitCheckout(
      {
        token: r.token,
        raw: input({ shippingPostalCode: '1099' }),
        cartItemIds: [a],
        now: h.now(),
      },
      deps,
    )
    expect(invalid).toMatchObject({ ok: false })
    const ok = await submitCheckout(
      { token: r.token, raw: input(), cartItemIds: [a], now: h.now() },
      deps,
    )
    expect(ok).toMatchObject({ ok: true, paymentChoice: 'stripe' })
    const declined = await mockConfirmOutcome(
      { token: r.token, outcome: 'declined', now: h.now() },
      deps,
    )
    expect(declined).toMatchObject({ ok: false, code: 'declined' })
    await submitCheckout({ token: r.token, raw: input(), cartItemIds: [a], now: h.now() }, deps)
    const paid = await mockConfirmOutcome(
      { token: r.token, outcome: 'success', now: h.now() },
      deps,
    )
    expect(paid.ok).toBe(true)
    const thanks = await getThanksState(r.token, h.now(), deps)
    expect(thanks?.code).toBe('paid')
    // Ein zweiter Aufruf mit einem unbekannten Token (Rate-Limit-/Fehlerpfad) schreibt ebenfalls nichts Persönliches.
    expect(await getThanksState('x'.repeat(43), h.now(), deps)).toBeNull()

    const checkout = await checkoutById(h.payload, r.checkoutId)
    expect(checkout.status).toBe('completed')
    expect(lines.length, 'die Dienste schreiben Log-Zeilen').toBeGreaterThan(0)
    expectRedacted([
      EMAIL,
      'Erika',
      'Geheimnisvoll',
      'Verschwiegene',
      '10999 Berlin',
      r.token,
      checkout.reservationRef,
    ])
  })

  it('R-137 Vorkasse: Bestellung, „Zahlung erhalten“ – keine Eingaben, keine IBAN, kein Token in den Logs', async () => {
    const b = await h.piece(991)
    const r = await h.start([b])
    const deps = { payload: h.payload, payments: h.mock }
    const res = await submitCheckout(
      {
        token: r.token,
        raw: input({ paymentChoice: 'prepayment' }),
        cartItemIds: [b],
        now: h.now(),
      },
      deps,
    )
    expect(res).toMatchObject({ ok: true, paymentChoice: 'prepayment' })
    const order = await h.orderOfCheckout(r.checkoutId)
    expect(order.status).toBe('awaiting_prepayment')
    const req = await createLocalReq({ context: { system: true } }, h.payload)
    const done = await markPrepaymentPaid(order.id as number, req, {
      now: h.now(),
      amountCents: order.totalCents,
    })
    await done.afterCommit()
    expect((await h.order(order.id as number)).status).toBe('paid')

    const settings = (await h.payload.findGlobal({
      slug: 'settings',
      depth: 0,
      overrideAccess: true,
    })) as { payment?: { iban?: string | null } | null }
    const iban = settings.payment?.iban?.replace(/\s+/g, '') ?? ''
    expect(lines.length).toBeGreaterThan(0)
    expectRedacted([
      EMAIL,
      'Erika',
      'Geheimnisvoll',
      'Verschwiegene',
      r.token,
      ...(iban ? [iban] : []),
    ])
  })
})
