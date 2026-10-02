import { describe, expect, it } from 'vitest'

import { customerStatus } from '@/lib/commerce/orderStatusLine'
import {
  checkoutRawFromFormData,
  orderedCheckoutErrors,
  validateCheckoutInput,
  type CheckoutRawInput,
  type CheckoutSchemaContext,
} from '@/lib/commerce/checkoutSchema'

// P4.9 – gemeinsames Schema der Kasse (KONZEPT §4.4, R-060, R-061, R-048): Pflichtfelder je Lieferart, Grenzen, PLZ,
// Land fest DE, Zahlwege, Abweichungs-Bestätigungen, Formular-Reihenfolge der Fehler.

const ctx: CheckoutSchemaContext = {
  deviationProductIds: [],
  paymentChoices: ['stripe', 'prepayment'],
}

const shipping: CheckoutRawInput = {
  email: '  Erika@Beispiel.DE ',
  fulfillmentMethod: 'shipping',
  name: 'Erika Beispiel',
  shippingLine1: 'Musterstraße 1',
  shippingPostalCode: '10115',
  shippingCity: 'Berlin',
  paymentChoice: 'stripe',
}

describe('checkoutSchema', () => {
  it('R-061 Versand: E-Mail, Name, Lieferadresse Pflicht; E-Mail kleingeschrieben; Land DE; keine Rechnungsadresse', () => {
    const r = validateCheckoutInput(shipping, ctx)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.value).toEqual({
      email: 'erika@beispiel.de',
      fulfillmentMethod: 'shipping',
      shippingAddress: {
        name: 'Erika Beispiel',
        addressLine1: 'Musterstraße 1',
        postalCode: '10115',
        city: 'Berlin',
        country: 'DE',
      },
      billingAddressDiffers: false,
      carrierEmailConsent: false,
      paymentChoice: 'stripe',
      deviationAgreements: [],
    })
    const empty = validateCheckoutInput({ fulfillmentMethod: 'shipping' }, ctx)
    expect(empty.ok).toBe(false)
    if (empty.ok) return
    expect(empty.errors).toEqual({
      email: 'required',
      name: 'required',
      shippingLine1: 'required',
      shippingPostalCode: 'required',
      shippingCity: 'required',
      paymentChoice: 'required',
    })
  })

  it('R-061 Abholung: Rechnungsadresse immer Pflicht, Name aus dem einen Feld; keine Lieferadresse, keine DHL-Einwilligung', () => {
    const r = validateCheckoutInput(
      {
        email: 'a@b.de',
        fulfillmentMethod: 'pickup',
        name: 'Erika Beispiel',
        shippingLine1: 'wird ignoriert',
        carrierEmailConsent: 'on',
        paymentChoice: 'prepayment',
      },
      ctx,
    )
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.errors).toEqual({
      billingLine1: 'required',
      billingPostalCode: 'required',
      billingCity: 'required',
    })
    const ok = validateCheckoutInput(
      {
        email: 'a@b.de',
        fulfillmentMethod: 'pickup',
        name: 'Erika Beispiel',
        billingLine1: 'Weg 2',
        billingPostalCode: '12043',
        billingCity: 'Berlin',
        carrierEmailConsent: 'on',
        paymentChoice: 'prepayment',
      },
      ctx,
    )
    expect(ok.ok && ok.value).toMatchObject({
      billingAddress: { name: 'Erika Beispiel', addressLine1: 'Weg 2', country: 'DE' },
      carrierEmailConsent: false,
      billingAddressDiffers: false,
    })
    expect(ok.ok && ok.value.shippingAddress).toBeUndefined()
  })

  it('R-061 „Rechnungsadresse weicht ab“ → eigene Felder samt Name Pflicht', () => {
    const r = validateCheckoutInput({ ...shipping, billingAddressDiffers: 'on' }, ctx)
    expect(!r.ok && r.errors).toEqual({
      billingName: 'required',
      billingLine1: 'required',
      billingPostalCode: 'required',
      billingCity: 'required',
    })
  })

  it('Grenzen: PLZ genau 5 Ziffern, Name 2–100, E-Mail gültig und ≤ 254', () => {
    const r = validateCheckoutInput(
      { ...shipping, shippingPostalCode: '1011', name: 'E', email: 'kein-at' },
      ctx,
    )
    expect(!r.ok && r.errors).toEqual({
      shippingPostalCode: 'postalCode',
      name: 'tooShort',
      email: 'email',
    })
    const long = validateCheckoutInput({ ...shipping, email: `${'a'.repeat(250)}@b.de` }, ctx)
    expect(!long.ok && long.errors.email).toBe('tooLong')
  })

  it('R-060 Land nur Deutschland', () => {
    const r = validateCheckoutInput({ ...shipping, shippingCountry: 'AT' }, ctx)
    expect(!r.ok && r.errors).toEqual({ shippingCountry: 'country' })
  })

  it('Zahlweg nur aus der erlaubten Menge (S13: ohne Session nur Vorkasse)', () => {
    const r = validateCheckoutInput(shipping, { ...ctx, paymentChoices: ['prepayment'] })
    expect(!r.ok && r.errors).toEqual({ paymentChoice: 'choice' })
  })

  it('R-048 je Stück mit Abweichung eine Bestätigung', () => {
    const c = { ...ctx, deviationProductIds: [5, 9] }
    expect(validateCheckoutInput({ ...shipping, deviationAgreements: ['5'] }, c).ok).toBe(false)
    const r = validateCheckoutInput({ ...shipping, deviationAgreements: ['9', '5', '77'] }, c)
    expect(r.ok && r.value.deviationAgreements).toEqual([5, 9])
  })

  it('nur Abholung erzwingt pickup', () => {
    const r = validateCheckoutInput(shipping, { ...ctx, pickupOnly: true })
    expect(!r.ok && r.errors.fulfillmentMethod).toBe('choice')
  })

  it('FormData lesen und Fehler in Formular-Reihenfolge', () => {
    const fd = new FormData()
    fd.set('email', 'a@b.de')
    fd.set('shippingAddress.postalCode', '10115')
    fd.append('deviationAgreements', '3')
    fd.append('deviationAgreements', '4')
    const raw = checkoutRawFromFormData(fd)
    expect(raw.email).toBe('a@b.de')
    expect(raw.shippingPostalCode).toBe('10115')
    expect(raw.deviationAgreements).toEqual(['3', '4'])
    const r = validateCheckoutInput({ fulfillmentMethod: 'shipping' }, ctx)
    expect(!r.ok && orderedCheckoutErrors(r.errors).map((e) => e.key)).toEqual([
      'email',
      'name',
      'shippingLine1',
      'shippingPostalCode',
      'shippingCity',
      'paymentChoice',
    ])
  })
})

// P4.25 Grenzfälle (Abdeckung): Mehrfachwerte aus FormData, fehlende/unbekannte Lieferart, zu lange Felder,
// Adresszusatz, Statuszeile ohne erledigten Schritt und Anfechtung ohne gespeicherten Vorstatus.
describe('Kassen-Eingaben – Grenzfälle (P4.25)', () => {
  const ctx = { deviationProductIds: [], paymentChoices: ['stripe', 'prepayment'] } as const
  const base = {
    email: ['Erika@Example.org', 'zweite@example.org'],
    name: 'Erika Beispiel',
    shippingLine1: 'Musterstraße 1',
    shippingLine2: 'Hinterhaus',
    shippingPostalCode: '10115',
    shippingCity: 'Berlin',
    paymentChoice: 'stripe',
  }

  it('R-060 Lieferart fehlt → required, unbekannt → choice; Mehrfachwert nimmt den ersten; Adresszusatz bleibt', () => {
    const missing = validateCheckoutInput({ ...base } as never, ctx)
    expect(missing.ok).toBe(false)
    expect(!missing.ok && missing.errors.fulfillmentMethod).toBe('required')
    const unknown = validateCheckoutInput({ ...base, fulfillmentMethod: 'drohne' } as never, ctx)
    expect(!unknown.ok && unknown.errors.fulfillmentMethod).toBe('choice')
    const ok = validateCheckoutInput({ ...base, fulfillmentMethod: ['shipping'] } as never, ctx)
    expect(ok.ok).toBe(true)
    expect(ok.ok && ok.value.email).toBe('erika@example.org')
    expect(ok.ok && ok.value.shippingAddress?.addressLine2).toBe('Hinterhaus')
    const long = validateCheckoutInput(
      {
        ...base,
        fulfillmentMethod: 'shipping',
        shippingCity: 'B'.repeat(500),
        email: undefined,
      } as never,
      ctx,
    )
    expect(!long.ok && long.errors.shippingCity).toBe('tooLong')
    expect(!long.ok && long.errors.email).toBe('required')
  })

  it('R-067 Statuszeile: Anfechtung ohne Vorstatus zeigt „bezahlt“', () => {
    expect(customerStatus('disputed', null)).toBe('paid')
    expect(customerStatus('disputed', 'shipped')).toBe('shipped')
  })
})
