import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import config from '@payload-config'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'

import { dbFor } from '@/lib/db/tx'
import { getEnv } from '@/lib/env'
import type { LegalSnippetKey, Locale } from '@/lib/enums'
import { jobAlarm } from '@/lib/jobs/alarm'
import { getActiveLegalText } from '@/lib/legal/getActive'
import { getSnippet, type RenderedSnippet } from '@/lib/legal/snippets'
import { createLogger } from '@/lib/monitoring/logger'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import { getPaymentsAdapter, type PaymentsAdapter } from '@/lib/payments'
import { checkoutReturnUrl } from '@/lib/payments/checkoutSession'
import { localizedPath } from '@/lib/routes/paths'
import { padItemNumber } from '@/lib/products/itemNumber'
import {
  LEGAL_TEXT_VERSION_KEYS,
  LEGAL_TEXT_VERSION_TYPES,
  type LegalTextVersionKey,
} from '@/fields/legalTextVersions'
import type { Checkout } from '@/payload-types'

import { findCheckoutByToken } from './checkout'
import {
  validateCheckoutInput,
  type CheckoutAddressInput,
  type CheckoutChoice,
  type CheckoutFieldErrors,
  type CheckoutInput,
  type CheckoutRawInput,
} from './checkoutSchema'
import { transitionCheckout } from './checkoutTransitions'
import { placePrepaymentOrder, PrepaymentError } from './prepayment'
import { intArray } from './reservation'
import { hit } from '@/lib/security/rateLimit'
import { hashToken } from '@/lib/security/tokens'

// „Zahlungspflichtig bestellen“ – Absenden der Kasse (KONZEPT §4.5, DATENMODELL §6.25.3, PLAN P4.10a/P4.19). Prüft
// Kasse `open`, Ablauf (bei Stripe auch der Session), Reservierung der Stücke mit dieser `reservationRef`, Korb =
// Kassen-Snapshot (S6), Lieferart = Kasse, Pflichtfelder über das gemeinsame Schema (R-061), Land (R-060) und die
// Abweichungs-Bestätigungen (R-048, fehlt eine → 400). Preise und Versand kommen immer aus dem Snapshot (S7). In **einer**
// Transaktion speichert es die Eingaben samt Rechtsstand **an der Kasse** (R-013/R-065; keine Bestellung vor der
// Zahlung): `customer.email`, Adressen, Einwilligungen, `deviationAgreements`, `paymentChoice`, `legalTextVersions`,
// `legalSnippetVersions`, `submittedAt`; dazu `consent-log`-Einträge. Stripe: `open → confirming` + Weckzeit
// `confirmingAt + 10 min` (Abgleich); Vorkasse: weiter mit `placePrepaymentOrder` (O2). Ein erneutes Absenden nach
// `confirming → open` überschreibt Eingaben und `submittedAt`. Logs ohne Personendaten (R-137/V-22).

const log = createLogger()

/** Abgleich einer Kasse in `confirming` nach 10 min (KONZEPT §4.10). */
export const CONFIRMING_RECONCILE_MS = 10 * 60_000

export type SubmitCheckoutCode =
  | 'not_found'
  | 'not_open'
  | 'expired'
  | 'session_expired'
  | 'cart_changed'
  | 'delivery_changed'
  | 'invalid'
  | 'deviation_missing'
  | 'prepayment_disabled'
  | 'legal_missing'

export type SubmitCheckoutResult =
  | {
      ok: true
      paymentChoice: 'stripe'
      checkoutId: number
      /** Rückkehr nach der Zahlung (Danke-Seite mit Kassen-Token) – nur für die Person mit `pc_checkout`. */
      returnUrl: string
    }
  | {
      ok: true
      paymentChoice: 'prepayment'
      checkoutId: number
      orderId: number
      /** `/de/danke/<Kassen-Token>` bzw. `/en/thank-you/<Kassen-Token>`. */
      redirectTo: string
    }
  | {
      ok: false
      /** HTTP-Sinn: 400 Eingaben, 404 unbekannt, 409 Zustand, 410 abgelaufen. */
      status: 400 | 404 | 409 | 410
      code: SubmitCheckoutCode
      errors?: CheckoutFieldErrors
    }

export interface SubmitCheckoutInput {
  /** Wert von `pc_checkout`. */
  token: string | null | undefined
  raw: CheckoutRawInput
  /** Stück-IDs aus `pc_cart` (fehlt → keine Korbprüfung, z. B. direkter Aufruf im Test). */
  cartItemIds?: readonly number[] | null
  now: Date
}

export interface SubmitCheckoutDeps {
  payload?: Payload
  payments?: PaymentsAdapter
}

type Fail = Extract<SubmitCheckoutResult, { ok: false }>
const fail = (
  status: Fail['status'],
  code: SubmitCheckoutCode,
  errors?: CheckoutFieldErrors,
): Fail => ({
  ok: false,
  status,
  code,
  ...(errors ? { errors } : {}),
})

class SubmitAbort extends Error {
  constructor(readonly result: Fail) {
    super(result.code)
    this.name = 'SubmitAbort'
  }
}

const idOf = (v: unknown): number =>
  typeof v === 'object' && v !== null ? (v as { id: number }).id : (v as number)

const sameIds = (a: readonly number[], b: readonly number[]) =>
  a.length === b.length &&
  [...a].sort((x, y) => x - y).every((v, i) => v === [...b].sort((x, y) => x - y)[i])

export interface CheckoutPaymentOptions {
  prepaymentEnabled: boolean
  prepaymentDays: number
  /** Zahlwege, die diese Kasse anbieten darf (ohne Session nur Vorkasse, S13). */
  choices: CheckoutChoice[]
}

/** Zahlwege einer Kasse aus Einstellungen und Session (gemeinsam für Seite und Absenden). */
export function paymentOptionsFor(
  checkout: Pick<Checkout, 'stripe'>,
  settings: {
    payment?: { prepaymentEnabled?: boolean | null; prepaymentDays?: number | null } | null
  },
): CheckoutPaymentOptions {
  const prepaymentEnabled = settings.payment?.prepaymentEnabled === true
  const choices: CheckoutChoice[] = []
  if (checkout.stripe?.checkoutSessionId) choices.push('stripe')
  if (prepaymentEnabled) choices.push('prepayment')
  return {
    prepaymentEnabled,
    prepaymentDays: settings.payment?.prepaymentDays ?? 5,
    choices,
  }
}

/** Stücke mit Abweichung (je Stück eine eigene Bestätigung). */
export const deviationProductIds = (checkout: Pick<Checkout, 'items'>): number[] =>
  checkout.items.filter((i) => !!i.deviationText).map((i) => idOf(i.product))

/**
 * Bausteine, die die Übersicht beim Klick zeigt (R-013): immer `checkout.legalNotice` und
 * `withdrawal.returnCostsNote`, bei Versand `checkout.dhlEmailConsent`, bei Vorkasse `checkout.vorkasseInfo`, bei einem
 * Stück mit Abweichung `checkout.deviationAgreement` (je Stück mit eigenem Text).
 */
export function shownSnippets(
  checkout: Pick<Checkout, 'items'>,
  input: Pick<CheckoutInput, 'fulfillmentMethod' | 'paymentChoice'>,
  locale: Locale,
  prepaymentDays: number,
): { key: LegalSnippetKey; snippet: RenderedSnippet; productId?: number }[] {
  const out: { key: LegalSnippetKey; snippet: RenderedSnippet; productId?: number }[] = [
    { key: 'checkout.legalNotice', snippet: getSnippet('checkout.legalNotice', locale) },
    {
      key: 'withdrawal.returnCostsNote',
      snippet: getSnippet('withdrawal.returnCostsNote', locale),
    },
  ]
  if (input.fulfillmentMethod === 'shipping') {
    out.push({
      key: 'checkout.dhlEmailConsent',
      snippet: getSnippet('checkout.dhlEmailConsent', locale),
    })
  }
  if (input.paymentChoice === 'prepayment') {
    out.push({
      key: 'checkout.vorkasseInfo',
      snippet: getSnippet('checkout.vorkasseInfo', locale, { vorkasseDays: prepaymentDays }),
    })
  }
  for (const item of checkout.items) {
    if (!item.deviationText) continue
    out.push({
      key: 'checkout.deviationAgreement',
      productId: idOf(item.product),
      snippet: deviationSnippet(item, locale),
    })
  }
  return out
}

/** Baustein `checkout.deviationAgreement` für ein Stück des Snapshots. */
export function deviationSnippet(item: Checkout['items'][number], locale: Locale): RenderedSnippet {
  const title = (locale === 'en' ? item.titleEn : undefined) ?? item.titleDe
  return getSnippet('checkout.deviationAgreement', locale, {
    itemTitle: title,
    objectNumber: padItemNumber(item.itemNumber),
    deviationText: item.deviationText ?? '',
  })
}

const emptyAddress = {
  name: null,
  addressLine1: null,
  addressLine2: null,
  postalCode: null,
  city: null,
}

const addressData = (a: CheckoutAddressInput | undefined) =>
  a
    ? {
        name: a.name,
        addressLine1: a.addressLine1,
        addressLine2: a.addressLine2 ?? null,
        postalCode: a.postalCode,
        city: a.city,
        country: a.country,
      }
    : emptyAddress

async function activeLegalVersions(
  req: PayloadRequest,
  now: Date,
): Promise<Record<LegalTextVersionKey, number>> {
  const out = {} as Record<LegalTextVersionKey, number>
  for (const key of LEGAL_TEXT_VERSION_KEYS) {
    const doc = await getActiveLegalText(LEGAL_TEXT_VERSION_TYPES[key], now, { req })
    if (!doc) throw new SubmitAbort(fail(409, 'legal_missing'))
    out[key] = doc.id as number
  }
  return out
}

/** Rate-Limit `checkout_submit` je Kassen-Token (10 / 30 min, ARCHITEKTUR §8.5; Schlüssel ist der Token-Hash). */
export async function checkoutSubmitAllowed(
  token: string,
  now: Date,
  payload?: Payload,
): Promise<boolean> {
  payload ??= await getPayload({ config })
  return (await hit('checkout_submit', hashToken(token), now, payload)).allowed
}

/** Absenden der Kasse (Ablauf siehe Kopfkommentar). Setzt kein Cookie und leitet nicht weiter – das macht die Action. */
export async function submitCheckout(
  input: SubmitCheckoutInput,
  deps: SubmitCheckoutDeps = {},
): Promise<SubmitCheckoutResult> {
  const payload = deps.payload ?? (await getPayload({ config }))
  const { now } = input
  const checkout = await findCheckoutByToken(payload, input.token)
  if (!checkout) return fail(404, 'not_found')
  const checkoutId = checkout.id as number
  if (checkout.status !== 'open') return fail(409, 'not_open')
  if (new Date(checkout.expiresAt).getTime() <= now.getTime()) return fail(410, 'expired')
  const items = checkout.items.map((i) => idOf(i.product))
  if (input.cartItemIds && !sameIds(items, input.cartItemIds)) return fail(409, 'cart_changed')

  const settings = (await payload.findGlobal({
    slug: 'settings',
    depth: 0,
    overrideAccess: true,
  })) as unknown as Parameters<typeof paymentOptionsFor>[1]
  const options = paymentOptionsFor(checkout, settings)
  const validation = validateCheckoutInput(input.raw, {
    deviationProductIds: deviationProductIds(checkout),
    paymentChoices: options.choices,
    pickupOnly: checkout.items.some((i) => i.shippingClass === 'nur_abholung'),
  })
  if (!validation.ok) {
    const onlyChoice =
      validation.errors.paymentChoice === 'choice' &&
      input.raw.paymentChoice === 'prepayment' &&
      !options.prepaymentEnabled
    if (onlyChoice) return fail(409, 'prepayment_disabled', validation.errors)
    return fail(
      400,
      validation.errors.deviationAgreements ? 'deviation_missing' : 'invalid',
      validation.errors,
    )
  }
  const value = validation.value
  // Die Lieferart der Übersicht ist die der Kasse; ein Wechsel läuft über `changeCheckoutDelivery` (R-063).
  if (value.fulfillmentMethod !== checkout.fulfillmentMethod) return fail(409, 'delivery_changed')
  if (value.paymentChoice === 'stripe') {
    const sessionEnd = checkout.stripe?.sessionExpiresAt
    if (!sessionEnd || new Date(sessionEnd).getTime() <= now.getTime()) {
      return fail(410, 'session_expired')
    }
  }

  const locale = checkout.locale as Locale
  const at = now.toISOString()
  const snippets = shownSnippets(checkout, value, locale, options.prepaymentDays)
  const legalSnippetVersions = Object.fromEntries(
    snippets.map((s) => [s.key, { version: s.snippet.version, sha256: s.snippet.sha256 }]),
  )
  const payments = deps.payments ?? getPaymentsAdapter()
  const req = await createLocalReq({ context: { system: true, now: at } }, payload)

  let result: SubmitCheckoutResult
  let afterCommit: (() => Promise<void>) | null = null
  try {
    result = await inTransaction(req, async () => {
      const db = await dbFor(req)
      // Reservierung: alle Stücke noch mit dieser Referenz reserviert (sonst S5/S6 – Korb hat sich geändert).
      const held = await db.execute(sql`
        SELECT id FROM products
         WHERE reservation_ref = ${checkout.reservationRef} AND status = 'reserved' AND id = ANY(${intArray(items)})
         FOR UPDATE
      `)
      if (held.rows.length !== items.length) throw new SubmitAbort(fail(409, 'cart_changed'))

      const legalTextVersions = await activeLegalVersions(req, now)
      const data = {
        customer: { email: value.email },
        shippingAddress: addressData(value.shippingAddress),
        billingAddressDiffers: value.billingAddressDiffers,
        billingAddress: addressData(value.billingAddress),
        carrierEmailConsent: value.carrierEmailConsent,
        deviationAgreements: value.deviationAgreements.map((product) => ({
          product,
          agreedAt: at,
        })),
        legalTextVersions,
        legalSnippetVersions,
        paymentChoice: value.paymentChoice,
        submittedAt: at,
      }

      // Nachweise (R-101, R-048): Einwilligung nur bei Häkchen, Abweichung je Stück – mit Textsnapshot und Fassung.
      const consents = snippets.filter(
        (s) =>
          (s.key === 'checkout.dhlEmailConsent' && value.carrierEmailConsent) ||
          s.key === 'checkout.deviationAgreement',
      )
      for (const s of consents) {
        await preservingReq(req, () =>
          req.payload.create({
            collection: 'consent-log',
            data: {
              purpose:
                s.key === 'checkout.dhlEmailConsent'
                  ? 'carrier_email_forwarding'
                  : 'deviation_agreement',
              granted: true,
              textSnapshot: s.snippet.text,
              textSha256: s.snippet.sha256,
              snippetKey: s.key,
              snippetVersion: s.snippet.version,
              locale,
              email: value.email,
              checkout: checkoutId,
              ...(s.productId ? { product: s.productId } : {}),
              createdAt: at,
            } as never,
            depth: 0,
            overrideAccess: true,
            req,
            context: { ...req.context, system: true, now: at },
          }),
        )
      }

      if (value.paymentChoice === 'prepayment') {
        const placed = await placePrepaymentOrder(req, checkoutId, {
          now,
          checkoutData: data,
          payments,
        })
        afterCommit = placed.afterCommit
        return {
          ok: true as const,
          paymentChoice: 'prepayment' as const,
          checkoutId,
          orderId: placed.order.id as number,
          redirectTo: localizedPath('R08', locale, { token: input.token as string }),
        }
      }
      await transitionCheckout(req, checkoutId, 'confirming', { now, data })
      return {
        ok: true as const,
        paymentChoice: 'stripe' as const,
        checkoutId,
        returnUrl: checkoutReturnUrl(getEnv().NEXT_PUBLIC_SITE_URL, locale, input.token as string),
      }
    })
  } catch (err) {
    if (err instanceof SubmitAbort) {
      log.info('checkout.submit_rejected', { checkoutId, code: err.result.code })
      return err.result
    }
    if (err instanceof PrepaymentError) {
      log.info('checkout.submit_rejected', { checkoutId, code: err.code })
      return err.code === 'prepayment_disabled'
        ? fail(409, 'prepayment_disabled')
        : err.code === 'reservation_lost'
          ? fail(409, 'cart_changed')
          : fail(409, 'not_open')
    }
    throw err
  }

  if (afterCommit) await (afterCommit as () => Promise<void>)()
  if (result.ok && result.paymentChoice === 'stripe') {
    try {
      await jobAlarm.bump(new Date(now.getTime() + CONFIRMING_RECONCILE_MS))
    } catch (err) {
      log.error('checkout.job_alarm_failed', { checkoutId, error: (err as Error)?.message })
    }
  }
  log.info('checkout.submitted', { checkoutId, paymentChoice: value.paymentChoice })
  return result
}
