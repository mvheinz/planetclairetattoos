import { sql } from '@payloadcms/db-postgres'
import { createLocalReq } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { reopenCheckout } from '@/lib/commerce/changeDelivery'
import type { CheckoutRawInput } from '@/lib/commerce/checkoutSchema'
import { transitionCheckout } from '@/lib/commerce/checkoutTransitions'
import { submitCheckout } from '@/lib/commerce/submitCheckout'
import { jobAlarm } from '@/lib/jobs/alarm'
import { getSnippet } from '@/lib/legal/snippets'

import { checkoutById, productRow } from '../helpers/checkout'
import { dbOf } from '../helpers/commerce'
import { shopHarness } from '../helpers/shop'

// P4.10a – `submitCheckout` (KONZEPT §4.5, DATENMODELL §6.25.3): Eingaben und Rechtsstand an der Kasse, keine Bestellung
// vor der Zahlung (R-013/R-065), Consent-Log (R-101/R-048), Prüfungen S6/S7/Ablauf/Status (DM-CHK-02), Land (R-060),
// erneutes Absenden nach `confirming → open`, Vorkasse (P4.19) und Log-Schwärzung (R-137/V-22).

const NUMBERS = [986, 987, 988, 989]
const h = shopHarness({ start: '2026-10-08T10:00:00.000Z', numbers: NUMBERS, tag: 'submit' })

const shippingInput = (o: Partial<CheckoutRawInput> = {}): CheckoutRawInput => ({
  email: 'Erika.Beispiel@Planetclaire.local',
  fulfillmentMethod: 'shipping',
  name: 'Erika Beispiel',
  shippingLine1: 'Musterstraße 1',
  shippingPostalCode: '10115',
  shippingCity: 'Berlin',
  paymentChoice: 'stripe',
  ...o,
})

const DEVIATION = {
  hasDeviation: true,
  deviationDecision: 'described',
  deviationDescription: 'Kleiner Glasurfehler am Rand',
}

afterEach(async () => {
  await dbOf(h.payload).execute(
    sql`DELETE FROM consent_log WHERE checkout_id IS NOT NULL OR snippet_key LIKE 'checkout.%'`,
  )
})

async function consents(checkoutId: number) {
  const r = await dbOf(h.payload).execute(
    sql`SELECT purpose, granted, snippet_key, snippet_version, text_sha256, text_snapshot, product_id, email
          FROM consent_log WHERE checkout_id = ${checkoutId} ORDER BY id`,
  )
  return r.rows as {
    purpose: string
    snippet_key: string
    snippet_version: string
    text_sha256: string
    text_snapshot: string
    product_id: number | null
    email: string
  }[]
}

describe('submitCheckout (P4.10a)', () => {
  it('R-013/R-065 Stripe: keine Bestellung; Kasse confirming mit submittedAt, Eingaben, Snapshot, legalTextVersions, legalSnippetVersions; keine M01; Weckzeit +10 min', async () => {
    const a = await h.piece(986)
    const r = await h.start([a])
    const res = await submitCheckout(
      {
        token: r.token,
        raw: shippingInput({ carrierEmailConsent: 'on' }),
        cartItemIds: [a],
        now: h.now(),
      },
      { payload: h.payload, payments: h.mock },
    )
    expect(res).toMatchObject({ ok: true, paymentChoice: 'stripe', checkoutId: r.checkoutId })
    expect(res.ok && res.paymentChoice === 'stripe' && res.returnUrl).toContain(
      `/de/danke/${r.token}`,
    )
    expect(await h.count('orders')).toBe(0)
    expect(await h.count('email_log', sql`template = 'order_confirmation'`)).toBe(0)

    const c = await checkoutById(h.payload, r.checkoutId)
    expect(c.status).toBe('confirming')
    expect(c.timestamps?.confirmingAt).toBe(h.now().toISOString())
    expect(c.submittedAt).toBe(h.now().toISOString())
    expect(c.customer?.email).toBe('erika.beispiel@planetclaire.local')
    expect(c.shippingAddress).toMatchObject({
      name: 'Erika Beispiel',
      addressLine1: 'Musterstraße 1',
      postalCode: '10115',
      city: 'Berlin',
      country: 'DE',
    })
    expect(c.billingAddressDiffers).toBe(false)
    expect(c.carrierEmailConsent).toBe(true)
    expect(c.paymentChoice).toBe('stripe')
    expect(c.legalTextVersions).toMatchObject(h.legal)
    const snippets = c.legalSnippetVersions as Record<string, { version: string; sha256: string }>
    expect(snippets['checkout.legalNotice']).toEqual({
      version: getSnippet('checkout.legalNotice', 'de').version,
      sha256: getSnippet('checkout.legalNotice', 'de').sha256,
    })
    expect(snippets['checkout.dhlEmailConsent']?.sha256).toBe(
      getSnippet('checkout.dhlEmailConsent', 'de').sha256,
    )
    expect(snippets['checkout.deviationAgreement']).toBeUndefined()
    const alarm = (await jobAlarm.read()).nextDueAt
    expect(alarm && Date.parse(alarm)).toBeLessThanOrEqual(h.now().getTime() + 10 * 60_000)

    // Spätere Produktänderung ändert den Kassen-Snapshot nicht.
    const priceBefore = c.items[0]!.priceCents
    await dbOf(h.payload).execute(
      sql`UPDATE products SET price_cents = ${priceBefore + 1000} WHERE id = ${a}`,
    )
    const again = await checkoutById(h.payload, r.checkoutId)
    expect(again.items[0]!.priceCents).toBe(priceBefore)
    expect(again.totalCents).toBe(c.totalCents)
    expect(again.legalTextVersions).toEqual(c.legalTextVersions)

    // R-101: Einwilligung mit Textsnapshot, Baustein und Fassung
    const log = await consents(r.checkoutId)
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({
      purpose: 'carrier_email_forwarding',
      snippet_key: 'checkout.dhlEmailConsent',
      snippet_version: '1',
      email: 'erika.beispiel@planetclaire.local',
    })
    expect(log[0]!.text_snapshot).toContain('DHL')
    expect(log[0]!.text_sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('R-101 ohne Häkchen kein consent-log-Eintrag und carrierEmailConsent = false', async () => {
    const a = await h.piece(986)
    const r = await h.start([a])
    const res = await submitCheckout(
      { token: r.token, raw: shippingInput(), now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(res.ok).toBe(true)
    expect((await checkoutById(h.payload, r.checkoutId)).carrierEmailConsent).toBe(false)
    expect(await consents(r.checkoutId)).toEqual([])
  })

  it('R-048 ohne Abweichungs-Bestätigung → 400; mit → deviationAgreements (agreedAt = now) und consent-log je Stück', async () => {
    const a = await h.piece(987, DEVIATION)
    const b = await h.piece(988)
    const r = await h.start([a, b])
    const missing = await submitCheckout(
      { token: r.token, raw: shippingInput(), now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(missing).toMatchObject({ ok: false, status: 400, code: 'deviation_missing' })
    expect((await checkoutById(h.payload, r.checkoutId)).status).toBe('open')

    const ok = await submitCheckout(
      {
        token: r.token,
        raw: shippingInput({ deviationAgreements: [String(a)] }),
        now: h.now(),
      },
      { payload: h.payload, payments: h.mock },
    )
    expect(ok.ok).toBe(true)
    const c = await checkoutById(h.payload, r.checkoutId)
    expect(c.deviationAgreements?.map((d) => [d.product, d.agreedAt])).toEqual([
      [a, h.now().toISOString()],
    ])
    expect(
      (c.legalSnippetVersions as Record<string, unknown>)['checkout.deviationAgreement'],
    ).toBeTruthy()
    const log = await consents(r.checkoutId)
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({
      purpose: 'deviation_agreement',
      snippet_key: 'checkout.deviationAgreement',
      product_id: a,
    })
    expect(log[0]!.text_snapshot).toContain('Kleiner Glasurfehler am Rand')
    expect(log[0]!.text_snapshot).toContain('Nr. 987')
  })

  it('Pflichtfelder über das Schema (400 mit Feldfehlern); R-060 Land nur DE', async () => {
    const a = await h.piece(986)
    const r = await h.start([a])
    const res = await submitCheckout(
      {
        token: r.token,
        raw: { fulfillmentMethod: 'shipping', paymentChoice: 'stripe' },
        now: h.now(),
      },
      { payload: h.payload, payments: h.mock },
    )
    expect(res).toMatchObject({ ok: false, status: 400, code: 'invalid' })
    expect(!res.ok && res.errors).toMatchObject({
      email: 'required',
      name: 'required',
      shippingLine1: 'required',
    })
    const country = await submitCheckout(
      { token: r.token, raw: shippingInput({ shippingCountry: 'AT' }), now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(country).toMatchObject({
      ok: false,
      status: 400,
      errors: { shippingCountry: 'country' },
    })
    expect((await checkoutById(h.payload, r.checkoutId)).submittedAt).toBeFalsy()
  })

  it('DM-CHK-02 (Teil): Kasse in confirming, completed, expired, cancelled oder failed wird abgelehnt', async () => {
    for (const [nr, to] of [
      [986, 'confirming'],
      [987, 'expired'],
      [988, 'cancelled'],
      [989, 'failed'],
    ] as const) {
      const id = await h.piece(nr)
      const r = await h.start([id])
      const req = await createLocalReq({ context: { system: true } }, h.payload)
      if (to === 'failed') {
        await transitionCheckout(req, r.checkoutId, 'confirming', { now: h.now() })
      }
      await transitionCheckout(req, r.checkoutId, to, {
        now: h.now(),
        ...(to === 'confirming'
          ? {}
          : {
              closeReason:
                to === 'failed'
                  ? 'payment_failed'
                  : to === 'expired'
                    ? 'reservation_expired'
                    : 'cart_changed',
            }),
      })
      const res = await submitCheckout(
        { token: r.token, raw: shippingInput(), now: h.now() },
        { payload: h.payload, payments: h.mock },
      )
      expect(res, to).toMatchObject({ ok: false, status: 409, code: 'not_open' })
    }
  })

  it('DM-CHK-02 (Teil): abgeschlossene Kasse (Vorkasse) wird abgelehnt', async () => {
    const a = await h.piece(986)
    const r = await h.start([a])
    const placed = await submitCheckout(
      { token: r.token, raw: shippingInput({ paymentChoice: 'prepayment' }), now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(placed).toMatchObject({ ok: true, paymentChoice: 'prepayment' })
    expect(placed.ok && placed.paymentChoice === 'prepayment' && placed.redirectTo).toBe(
      `/de/danke/${r.token}`,
    )
    const c = await checkoutById(h.payload, r.checkoutId)
    expect(c.status).toBe('completed')
    expect(c.legalTextVersions).toMatchObject(h.legal)
    expect(c.submittedAt).toBe(h.now().toISOString())
    const order = await h.orderOfCheckout(r.checkoutId)
    expect(order.status).toBe('awaiting_prepayment')
    const res = await submitCheckout(
      { token: r.token, raw: shippingInput(), now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(res).toMatchObject({ ok: false, status: 409, code: 'not_open' })
  })

  it('abgelaufene Kasse → 410; unbekannter Token → 404', async () => {
    const a = await h.piece(986)
    const r = await h.start([a])
    h.clock.set(new Date(h.now().getTime() + 40 * 60_000))
    const res = await submitCheckout(
      { token: r.token, raw: shippingInput(), now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(res).toMatchObject({ ok: false, status: 410, code: 'expired' })
    const unknown = await submitCheckout(
      { token: 'x'.repeat(43), raw: shippingInput(), now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(unknown).toMatchObject({ ok: false, status: 404 })
  })

  it('S6: Korb ≠ Kassen-Snapshot oder Reservierung verloren → „Dein Korb hat sich geändert“ (cart_changed)', async () => {
    const a = await h.piece(986)
    const b = await h.piece(987)
    const r = await h.start([a])
    const res = await submitCheckout(
      { token: r.token, raw: shippingInput(), cartItemIds: [a, b], now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(res).toMatchObject({ ok: false, status: 409, code: 'cart_changed' })

    await dbOf(h.payload).execute(
      sql`UPDATE products SET reservation_ref = 'fremde-referenz' WHERE id = ${a}`,
    )
    const lost = await submitCheckout(
      { token: r.token, raw: shippingInput(), cartItemIds: [a], now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(lost).toMatchObject({ ok: false, status: 409, code: 'cart_changed' })
    expect((await checkoutById(h.payload, r.checkoutId)).status).toBe('open')
  })

  it('S7: Preisänderung während der Kasse – der Snapshot-Preis gilt', async () => {
    const a = await h.piece(986)
    const r = await h.start([a])
    const before = await checkoutById(h.payload, r.checkoutId)
    const row = await productRow(h.payload, a)
    await dbOf(h.payload).execute(sql`UPDATE products SET price_cents = ${99_00} WHERE id = ${a}`)
    expect(row.status).toBe('reserved')
    const res = await submitCheckout(
      { token: r.token, raw: shippingInput(), now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(res.ok).toBe(true)
    const c = await checkoutById(h.payload, r.checkoutId)
    expect(c.items[0]!.priceCents).toBe(before.items[0]!.priceCents)
    expect(c.totalCents).toBe(before.totalCents)
  })

  it('erneutes Absenden nach gescheitertem Zahlungsversuch überschreibt Eingaben und submittedAt; Wechsel auf Abholung-Adresse bleibt sauber', async () => {
    const a = await h.piece(986)
    const r = await h.start([a])
    await submitCheckout(
      { token: r.token, raw: shippingInput(), now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    h.clock.set(new Date(h.now().getTime() + 60_000))
    const reopened = await reopenCheckout(
      { token: r.token, now: h.now() },
      { payload: h.payload, payments: h.mock },
    )
    expect(reopened.ok).toBe(true)
    h.clock.set(new Date(h.now().getTime() + 60_000))
    const again = await submitCheckout(
      {
        token: r.token,
        raw: shippingInput({
          email: 'neu@planetclaire.local',
          billingAddressDiffers: 'on',
          billingName: 'Firma Egal',
          billingLine1: 'Weg 2',
          billingPostalCode: '12043',
          billingCity: 'Berlin',
        }),
        now: h.now(),
      },
      { payload: h.payload, payments: h.mock },
    )
    expect(again.ok).toBe(true)
    const c = await checkoutById(h.payload, r.checkoutId)
    expect(c.status).toBe('confirming')
    expect(c.customer?.email).toBe('neu@planetclaire.local')
    expect(c.submittedAt).toBe(h.now().toISOString())
    expect(c.billingAddressDiffers).toBe(true)
    expect(c.billingAddress).toMatchObject({ name: 'Firma Egal', addressLine1: 'Weg 2' })
  })

  it('R-137/V-22 Logs enthalten weder E-Mail noch Name noch Adresse', async () => {
    const lines: string[] = []
    const capture = (...args: unknown[]) => {
      lines.push(args.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '))
    }
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(capture),
      vi.spyOn(console, 'info').mockImplementation(capture),
      vi.spyOn(console, 'warn').mockImplementation(capture),
      vi.spyOn(console, 'error').mockImplementation(capture),
    ]
    try {
      const a = await h.piece(986)
      const r = await h.start([a])
      await submitCheckout(
        { token: r.token, raw: shippingInput({ name: 'Heimlich Geheim' }), now: h.now() },
        { payload: h.payload, payments: h.mock },
      )
      await submitCheckout(
        { token: r.token, raw: shippingInput({ name: 'Heimlich Geheim' }), now: h.now() },
        { payload: h.payload, payments: h.mock },
      )
    } finally {
      for (const s of spies) s.mockRestore()
    }
    const all = lines.join('\n')
    expect(all).toContain('checkout.submitted')
    expect(all.toLowerCase()).not.toContain('erika.beispiel')
    expect(all).not.toContain('Heimlich Geheim')
    expect(all).not.toContain('Musterstraße')
  })
})
