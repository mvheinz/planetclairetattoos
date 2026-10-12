import * as z from 'zod/mini'

import { BILLING_COUNTRY_CODES, type BillingCountryCode } from '@/lib/enums'

// Gemeinsames Schema der Kasse (KONZEPT §4.4, DATENMODELL §6.25.1, RECHT R-060/R-061, PLAN P4.9): dieselbe Prüfung im
// Browser (vor dem Absenden, Fehler am Feld + Zusammenfassung) und auf dem Server (`submitCheckout`, P4.10a). Reines
// Modul ohne `server-only` (Ausnahme in `check:static`) und ohne Texte: Fehler sind Codes, die Oberfläche übersetzt
// sie (`checkout.errors.<code>`). Pflichtfelder genau nach R-061: E-Mail, Vor- und Nachname, bei Versand die
// Lieferadresse, bei Abholung und bei „Rechnungsadresse weicht ab“ die Rechnungsadresse; kein Telefon-, Firmen- oder
// Anredefeld. Lieferland fest Deutschland (R-060); die Rechnungsadresse darf in EU und EWR liegen (V-17, R-061,
// VO (EU) 2018/302) – PLZ bei DE genau 5 Ziffern, sonst 3–10 Zeichen aus Ziffern, Buchstaben, Leerzeichen, Bindestrich.
// V-18 b: freiwilliges, nicht vorangekreuztes Häkchen „Das ist ein Geschenk“ mit optionalem Gruß (≤ 300 Zeichen,
// reiner Text) für eine handgeschriebene Karte.

export const CHECKOUT_FULFILLMENT = ['shipping', 'pickup'] as const
export type CheckoutFulfillment = (typeof CHECKOUT_FULFILLMENT)[number]
export const CHECKOUT_CHOICES = ['stripe', 'prepayment'] as const
export type CheckoutChoice = (typeof CHECKOUT_CHOICES)[number]

/** Einziges Lieferland zum Start (R-060, `settings.shipping.enabledCountries`). */
export const CHECKOUT_COUNTRY = 'DE'

/** Länder der Rechnungsadresse (EU/EWR, V-17); Standard `DE`. */
export const CHECKOUT_BILLING_COUNTRIES: readonly BillingCountryCode[] = BILLING_COUNTRY_CODES

/** Höchstlänge des Grußes für die Geschenkkarte (V-18 b). */
export const GIFT_MESSAGE_MAX = 300

/** Feldnamen im Formular (= Pfade laut DATENMODELL §6.25.1; der Name steht nur einmal im Formular). */
export const CHECKOUT_FIELDS = {
  email: 'email',
  fulfillmentMethod: 'fulfillmentMethod',
  name: 'name',
  shippingLine1: 'shippingAddress.addressLine1',
  shippingLine2: 'shippingAddress.addressLine2',
  shippingPostalCode: 'shippingAddress.postalCode',
  shippingCity: 'shippingAddress.city',
  shippingCountry: 'shippingAddress.country',
  carrierEmailConsent: 'carrierEmailConsent',
  billingAddressDiffers: 'billingAddressDiffers',
  billingName: 'billingAddress.name',
  billingLine1: 'billingAddress.addressLine1',
  billingLine2: 'billingAddress.addressLine2',
  billingPostalCode: 'billingAddress.postalCode',
  billingCity: 'billingAddress.city',
  billingCountry: 'billingAddress.country',
  isGift: 'isGift',
  giftMessage: 'giftMessage',
  paymentChoice: 'paymentChoice',
  deviationAgreements: 'deviationAgreements',
} as const
export type CheckoutFieldKey = keyof typeof CHECKOUT_FIELDS

/** DOM-IDs der Felder (Sprunglinks der Fehlerzusammenfassung, „Ändern“-Links). */
export const CHECKOUT_FIELD_IDS: Record<CheckoutFieldKey, string> = {
  email: 'checkout-email',
  fulfillmentMethod: 'checkout-delivery-shipping',
  name: 'checkout-name',
  shippingLine1: 'checkout-shipping-line1',
  shippingLine2: 'checkout-shipping-line2',
  shippingPostalCode: 'checkout-shipping-postal-code',
  shippingCity: 'checkout-shipping-city',
  shippingCountry: 'checkout-shipping-country',
  carrierEmailConsent: 'checkout-carrier-consent',
  billingAddressDiffers: 'checkout-billing-differs',
  billingName: 'checkout-billing-name',
  billingLine1: 'checkout-billing-line1',
  billingLine2: 'checkout-billing-line2',
  billingPostalCode: 'checkout-billing-postal-code',
  billingCity: 'checkout-billing-city',
  billingCountry: 'checkout-billing-country',
  isGift: 'checkout-gift',
  giftMessage: 'checkout-gift-message',
  paymentChoice: 'checkout-payment-stripe',
  deviationAgreements: 'checkout-deviation',
}

/** Reihenfolge im Formular (Fehlerzusammenfassung). */
export const CHECKOUT_FIELD_ORDER: readonly CheckoutFieldKey[] = [
  'email',
  'fulfillmentMethod',
  'name',
  'shippingLine1',
  'shippingLine2',
  'shippingPostalCode',
  'shippingCity',
  'shippingCountry',
  'carrierEmailConsent',
  'isGift',
  'giftMessage',
  'billingAddressDiffers',
  'billingName',
  'billingLine1',
  'billingLine2',
  'billingPostalCode',
  'billingCity',
  'billingCountry',
  'paymentChoice',
  'deviationAgreements',
]

export type CheckoutErrorCode =
  | 'required'
  | 'email'
  | 'tooShort'
  | 'tooLong'
  | 'postalCode'
  | 'postalCodeForeign'
  | 'country'
  | 'billingCountry'
  | 'choice'
  | 'deviation'

export type CheckoutFieldErrors = Partial<Record<CheckoutFieldKey, CheckoutErrorCode>>

export interface CheckoutAddressInput {
  name: string
  addressLine1: string
  addressLine2?: string
  postalCode: string
  city: string
  /** Lieferadresse immer `DE`; Rechnungsadresse ein Land aus EU/EWR (V-17). */
  country: BillingCountryCode
}

/** Geprüfte Eingaben – Form der Felder an der Kasse (DATENMODELL §6.25.1). */
export interface CheckoutInput {
  email: string
  fulfillmentMethod: CheckoutFulfillment
  /** Nur bei Versand. */
  shippingAddress?: CheckoutAddressInput
  billingAddressDiffers: boolean
  /** Bei Abholung immer, bei Versand nur mit `billingAddressDiffers`. */
  billingAddress?: CheckoutAddressInput
  carrierEmailConsent: boolean
  /** „Das ist ein Geschenk“ (V-18 b, nie vorangekreuzt). */
  isGift: boolean
  /** Gruß für die Karte – nur mit `isGift`, sonst `null`; leer → `null`. */
  giftMessage: string | null
  paymentChoice: CheckoutChoice
  /** Produkt-IDs mit bestätigter Abweichung. */
  deviationAgreements: number[]
}

/** Rohwerte (Formular oder direkter Aufruf); fehlende Felder sind leer. */
export type CheckoutRawInput = Partial<Record<CheckoutFieldKey, string | string[] | null>>

export interface CheckoutSchemaContext {
  /** Stücke mit `deviationText`: je Stück ist eine eigene Bestätigung Pflicht (R-048). */
  deviationProductIds: readonly number[]
  /** Erlaubte Zahlwege (ohne Session nur `prepayment`, ohne Vorkasse nur `stripe`). */
  paymentChoices: readonly CheckoutChoice[]
  /** Stück „nur Abholung“ im Korb → Versand nicht wählbar. */
  pickupOnly?: boolean
  /** `false` → Abholung gerade nicht wählbar (`settings.shipping.pickupEnabled` aus, P18.5); fehlt → wählbar. */
  pickupAvailable?: boolean
}

export type CheckoutValidation =
  { ok: true; value: CheckoutInput } | { ok: false; errors: CheckoutFieldErrors }

const LIMITS = {
  email: { max: 254 },
  name: { min: 2, max: 100 },
  addressLine1: { min: 3, max: 100 },
  addressLine2: { max: 100 },
  city: { min: 2, max: 60 },
} as const

// E-Mail: zod-Prüfung plus Längengrenze (RFC 5321, KONZEPT §4.4). `zod/mini` (gleiche Prüfungen wie `zod`, aber
// baumschüttelbar): das Modul läuft auch im Browser, das volle `zod` brächte ~95 KB gz in die Kasse (T-09, P4.25).
const emailSchema = z.email()
const postalCodeSchema = z.string().check(z.regex(/^\d{5}$/))
/** PLZ außerhalb Deutschlands (V-17): bewusst großzügig – 3–10 Zeichen, vorne und hinten Ziffer oder Buchstabe. */
const foreignPostalCodeSchema = z
  .string()
  .check(z.regex(/^[A-Za-z0-9](?:[A-Za-z0-9 -]{1,8})[A-Za-z0-9]$/))

const isBillingCountry = (v: string): v is BillingCountryCode =>
  (CHECKOUT_BILLING_COUNTRIES as readonly string[]).includes(v)

/**
 * Gruß für die Geschenkkarte als reiner Text: Steuerzeichen (außer Zeilenumbruch) raus, Zeilenenden vereinheitlicht,
 * höchstens eine Leerzeile, außen getrimmt.
 */
export function normalizeGiftMessage(value: string): string {
  return (
    value
      .replace(/\r\n?/g, '\n')
      // Steuerzeichen bewusst entfernen (Zeilenumbruch bleibt)
      .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

const one = (v: string | string[] | null | undefined): string =>
  (Array.isArray(v) ? (v[0] ?? '') : (v ?? '')).trim()

const many = (v: string | string[] | null | undefined): string[] =>
  (Array.isArray(v) ? v : v ? [v] : []).map((s) => s.trim()).filter(Boolean)

const truthy = (v: string | string[] | null | undefined) =>
  ['on', 'true', '1', 'yes'].includes(one(v).toLowerCase())

function text(
  errors: CheckoutFieldErrors,
  key: CheckoutFieldKey,
  value: string,
  limits: { min?: number; max: number },
  required: boolean,
): string {
  if (!value) {
    if (required) errors[key] = 'required'
    return value
  }
  if (value.length > limits.max) errors[key] = 'tooLong'
  else if (limits.min !== undefined && value.length < limits.min) errors[key] = 'tooShort'
  return value
}

function address(
  raw: CheckoutRawInput,
  errors: CheckoutFieldErrors,
  prefix: 'shipping' | 'billing',
  name: string,
): CheckoutAddressInput {
  const k = (field: string) => `${prefix}${field}` as CheckoutFieldKey
  const addressLine1 = text(errors, k('Line1'), one(raw[k('Line1')]), LIMITS.addressLine1, true)
  const addressLine2 = text(errors, k('Line2'), one(raw[k('Line2')]), LIMITS.addressLine2, false)
  // Lieferland fest DE (R-060); Rechnungsland aus EU/EWR (V-17), Standard DE.
  const rawCountry = (one(raw[k('Country')]) || CHECKOUT_COUNTRY).toUpperCase()
  let country: BillingCountryCode = CHECKOUT_COUNTRY
  if (prefix === 'shipping') {
    if (rawCountry !== CHECKOUT_COUNTRY) errors[k('Country')] = 'country'
  } else if (isBillingCountry(rawCountry)) {
    country = rawCountry
  } else {
    errors[k('Country')] = 'billingCountry'
  }
  // PLZ: in Deutschland genau 5 Ziffern; sonst großzügig (auch bei unzulässigem Land – dort meldet das Feld „Land“)
  const germanPostal = prefix === 'shipping' || rawCountry === CHECKOUT_COUNTRY
  const postalCode = one(raw[k('PostalCode')])
  if (!postalCode) errors[k('PostalCode')] = 'required'
  else if (germanPostal) {
    if (!postalCodeSchema.safeParse(postalCode).success) errors[k('PostalCode')] = 'postalCode'
  } else if (!foreignPostalCodeSchema.safeParse(postalCode).success) {
    errors[k('PostalCode')] = 'postalCodeForeign'
  }
  const city = text(errors, k('City'), one(raw[k('City')]), LIMITS.city, true)
  return {
    name,
    addressLine1,
    ...(addressLine2 ? { addressLine2 } : {}),
    postalCode: germanPostal ? postalCode : postalCode.toUpperCase(),
    city,
    country,
  }
}

/** Prüft die Eingaben der Kasse (Client und Server). */
export function validateCheckoutInput(
  raw: CheckoutRawInput,
  ctx: CheckoutSchemaContext,
): CheckoutValidation {
  const errors: CheckoutFieldErrors = {}

  const email = one(raw.email).toLowerCase()
  if (!email) errors.email = 'required'
  else if (email.length > LIMITS.email.max) errors.email = 'tooLong'
  else if (!emailSchema.safeParse(email).success) errors.email = 'email'

  const method = one(raw.fulfillmentMethod)
  let fulfillmentMethod: CheckoutFulfillment = 'shipping'
  if ((CHECKOUT_FULFILLMENT as readonly string[]).includes(method)) {
    fulfillmentMethod = method as CheckoutFulfillment
    if (fulfillmentMethod === 'shipping' && ctx.pickupOnly) errors.fulfillmentMethod = 'choice'
    if (fulfillmentMethod === 'pickup' && ctx.pickupAvailable === false) {
      errors.fulfillmentMethod = 'choice'
    }
  } else {
    errors.fulfillmentMethod = method ? 'choice' : 'required'
  }
  const shipping = fulfillmentMethod === 'shipping'

  const name = text(errors, 'name', one(raw.name), LIMITS.name, true)
  const shippingAddress = shipping ? address(raw, errors, 'shipping', name) : undefined

  const differs = shipping && truthy(raw.billingAddressDiffers)
  let billingAddress: CheckoutAddressInput | undefined
  if (!shipping) {
    billingAddress = address(raw, errors, 'billing', name)
  } else if (differs) {
    const billingName = text(errors, 'billingName', one(raw.billingName), LIMITS.name, true)
    billingAddress = address(raw, errors, 'billing', billingName)
  }

  // V-18 b: Gruß nur mit Häkchen; ohne Häkchen wird nichts gespeichert (Datenminimierung).
  const isGift = truthy(raw.isGift)
  let giftMessage: string | null = null
  if (isGift) {
    const rawGift = Array.isArray(raw.giftMessage)
      ? (raw.giftMessage[0] ?? '')
      : (raw.giftMessage ?? '')
    const msg = normalizeGiftMessage(rawGift)
    if (msg.length > GIFT_MESSAGE_MAX) errors.giftMessage = 'tooLong'
    giftMessage = msg || null
  }

  const choice = one(raw.paymentChoice)
  let paymentChoice: CheckoutChoice = 'stripe'
  if (!choice) errors.paymentChoice = 'required'
  else if (!(ctx.paymentChoices as readonly string[]).includes(choice)) {
    errors.paymentChoice = 'choice'
  } else paymentChoice = choice as CheckoutChoice

  const agreed = new Set(
    many(raw.deviationAgreements)
      .filter((s) => /^\d{1,10}$/.test(s))
      .map(Number),
  )
  if (ctx.deviationProductIds.some((id) => !agreed.has(id))) {
    errors.deviationAgreements = 'deviation'
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: {
      email,
      fulfillmentMethod,
      ...(shippingAddress ? { shippingAddress } : {}),
      billingAddressDiffers: differs,
      ...(billingAddress ? { billingAddress } : {}),
      carrierEmailConsent: shipping && truthy(raw.carrierEmailConsent),
      isGift,
      giftMessage,
      paymentChoice,
      deviationAgreements: ctx.deviationProductIds.filter((id) => agreed.has(id)),
    },
  }
}

/** Liest die Rohwerte aus einem Formular (`FormData`) – nur die bekannten Felder. */
export function checkoutRawFromFormData(fd: Pick<FormData, 'get' | 'getAll'>): CheckoutRawInput {
  const raw: CheckoutRawInput = {}
  for (const key of Object.keys(CHECKOUT_FIELDS) as CheckoutFieldKey[]) {
    const name = CHECKOUT_FIELDS[key]
    if (key === 'deviationAgreements') {
      raw[key] = fd.getAll(name).filter((v): v is string => typeof v === 'string')
    } else {
      const v = fd.get(name)
      raw[key] = typeof v === 'string' ? v : null
    }
  }
  return raw
}

/** Fehler in Formular-Reihenfolge (für die Zusammenfassung oben). */
export function orderedCheckoutErrors(
  errors: CheckoutFieldErrors,
): { key: CheckoutFieldKey; code: CheckoutErrorCode }[] {
  return CHECKOUT_FIELD_ORDER.flatMap((key) => (errors[key] ? [{ key, code: errors[key] }] : []))
}
