import { describe, expect, it } from 'vitest'

import { customerStatus } from '@/lib/commerce/orderStatusLine'
import {
  checkoutRawFromFormData,
  GIFT_MESSAGE_MAX,
  normalizeGiftMessage,
  orderedCheckoutErrors,
  validateCheckoutInput,
  type CheckoutRawInput,
  type CheckoutSchemaContext,
} from '@/lib/commerce/checkoutSchema'

// P4.9 – gemeinsames Schema der Kasse (KONZEPT §4.4, R-060, R-061, R-048): Pflichtfelder je Lieferart, Grenzen, PLZ,
// Lieferland fest DE, Rechnungsland EU/EWR (V-17), Geschenk mit Gruß (V-18 b), Zahlwege, Abweichungs-Bestätigungen,
// Formular-Reihenfolge der Fehler.

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
      isGift: false,
      giftMessage: null,
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

  it('R-060 Lieferland nur Deutschland – auch mit Rechnungsadresse in Österreich', () => {
    const r = validateCheckoutInput({ ...shipping, shippingCountry: 'AT' }, ctx)
    expect(!r.ok && r.errors).toEqual({ shippingCountry: 'country' })
    const both = validateCheckoutInput(
      {
        ...shipping,
        shippingCountry: 'AT',
        shippingPostalCode: '1010',
        billingAddressDiffers: 'on',
        billingName: 'Erika Beispiel',
        billingLine1: 'Ringstraße 1',
        billingPostalCode: '1010',
        billingCity: 'Wien',
        billingCountry: 'AT',
      },
      ctx,
    )
    // Versand nach AT bleibt abgelehnt (Land), die österreichische Rechnungsadresse ist in Ordnung
    expect(!both.ok && both.errors).toEqual({
      shippingCountry: 'country',
      shippingPostalCode: 'postalCode',
    })
  })

  it('V-17 Abholung mit Rechnungsadresse in Österreich: PLZ 4 Ziffern, Land AT übernommen', () => {
    const r = validateCheckoutInput(
      {
        email: 'a@b.at',
        fulfillmentMethod: 'pickup',
        name: 'Anna Alpen',
        billingLine1: 'Ringstraße 1',
        billingPostalCode: '1010',
        billingCity: 'Wien',
        billingCountry: 'at',
        paymentChoice: 'stripe',
      },
      ctx,
    )
    expect(r.ok && r.value.billingAddress).toEqual({
      name: 'Anna Alpen',
      addressLine1: 'Ringstraße 1',
      postalCode: '1010',
      city: 'Wien',
      country: 'AT',
    })
  })

  it('V-17 Versand nach DE mit abweichender Rechnungsadresse in den Niederlanden, Island oder Norwegen', () => {
    for (const [country, postalCode, expected] of [
      ['NL', '1012 ab', '1012 AB'],
      ['IS', '101', '101'],
      ['NO', '0150', '0150'],
      ['PL', '00-950', '00-950'],
    ] as const) {
      const r = validateCheckoutInput(
        {
          ...shipping,
          billingAddressDiffers: 'on',
          billingName: 'Rita Rechnung',
          billingLine1: 'Weg 1',
          billingPostalCode: postalCode,
          billingCity: 'Stadt',
          billingCountry: country,
        },
        ctx,
      )
      expect(r.ok, country).toBe(true)
      expect(r.ok && r.value.billingAddress).toMatchObject({ country, postalCode: expected })
      expect(r.ok && r.value.shippingAddress?.country).toBe('DE')
    }
  })

  it('V-17 kein GB, keine Schweiz, kein Unsinn; PLZ im Ausland 3–10 Zeichen, in DE genau 5 Ziffern', () => {
    const pickup = {
      email: 'a@b.de',
      fulfillmentMethod: 'pickup',
      name: 'Erika Beispiel',
      billingLine1: 'Weg 2',
      billingPostalCode: '8001',
      billingCity: 'Zürich',
      paymentChoice: 'stripe',
    }
    for (const country of ['GB', 'CH', 'US', 'XX']) {
      const r = validateCheckoutInput({ ...pickup, billingCountry: country }, ctx)
      expect(!r.ok && r.errors.billingCountry, country).toBe('billingCountry')
    }
    for (const postalCode of ['12', '12345678901', '-1234', '1234-', '12_34']) {
      const r = validateCheckoutInput(
        { ...pickup, billingCountry: 'AT', billingPostalCode: postalCode },
        ctx,
      )
      expect(!r.ok && r.errors, postalCode).toEqual({ billingPostalCode: 'postalCodeForeign' })
    }
    const de = validateCheckoutInput({ ...pickup, billingPostalCode: '1010' }, ctx)
    expect(!de.ok && de.errors).toEqual({ billingPostalCode: 'postalCode' })
  })

  it('V-18 b Geschenk: Häkchen nie Pflicht, Gruß nur mit Häkchen, reiner Text, höchstens 300 Zeichen', () => {
    const plain = validateCheckoutInput({ ...shipping, giftMessage: 'Alles Liebe!' }, ctx)
    expect(plain.ok && [plain.value.isGift, plain.value.giftMessage]).toEqual([false, null])
    const gift = validateCheckoutInput(
      {
        ...shipping,
        isGift: 'on',
        giftMessage: '  Alles Liebe,\r\n\r\n\r\n\r\ndeine Erika\u0007  ',
      },
      ctx,
    )
    expect(gift.ok && [gift.value.isGift, gift.value.giftMessage]).toEqual([
      true,
      'Alles Liebe,\n\ndeine Erika',
    ])
    const empty = validateCheckoutInput({ ...shipping, isGift: 'on', giftMessage: '   ' }, ctx)
    expect(empty.ok && [empty.value.isGift, empty.value.giftMessage]).toEqual([true, null])
    const max = validateCheckoutInput(
      { ...shipping, isGift: 'on', giftMessage: 'x'.repeat(GIFT_MESSAGE_MAX) },
      ctx,
    )
    expect(max.ok).toBe(true)
    const long = validateCheckoutInput(
      { ...shipping, isGift: 'on', giftMessage: 'x'.repeat(GIFT_MESSAGE_MAX + 1) },
      ctx,
    )
    expect(!long.ok && long.errors).toEqual({ giftMessage: 'tooLong' })
    // Abholung: Geschenk geht auch (Karte liegt bei der Übergabe bei)
    const pickup = validateCheckoutInput(
      {
        email: 'a@b.de',
        fulfillmentMethod: 'pickup',
        name: 'Erika Beispiel',
        billingLine1: 'Weg 2',
        billingPostalCode: '12043',
        billingCity: 'Berlin',
        isGift: 'true',
        paymentChoice: 'stripe',
      },
      ctx,
    )
    expect(pickup.ok && pickup.value.isGift).toBe(true)
    expect(normalizeGiftMessage('a\tb\u0000c')).toBe('abc')
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

  it('P18.5 Abholung ausgeschaltet → pickup abgelehnt (choice), Versand unberührt; ohne Angabe wählbar', () => {
    const pickup: CheckoutRawInput = {
      email: 'erika@beispiel.de',
      fulfillmentMethod: 'pickup',
      name: 'Erika Beispiel',
      billingLine1: 'Musterstraße 1',
      billingPostalCode: '10115',
      billingCity: 'Berlin',
      paymentChoice: 'stripe',
    }
    const off = validateCheckoutInput(pickup, { ...ctx, pickupAvailable: false })
    expect(off.ok).toBe(false)
    if (off.ok) return
    expect(off.errors).toEqual({ fulfillmentMethod: 'choice' })
    expect(validateCheckoutInput(pickup, ctx).ok).toBe(true)
    expect(validateCheckoutInput(pickup, { ...ctx, pickupAvailable: true }).ok).toBe(true)
    expect(validateCheckoutInput(shipping, { ...ctx, pickupAvailable: false }).ok).toBe(true)
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
