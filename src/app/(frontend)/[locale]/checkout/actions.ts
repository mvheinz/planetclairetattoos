'use server'

import { cookies, headers } from 'next/headers'
import { redirect, RedirectType } from 'next/navigation'

import { readCart } from '@/lib/commerce/cart'
import { CART_COOKIE, cartCookieAttributes, encodeCartCookie } from '@/lib/commerce/cartCookie'
import {
  changeCheckoutDelivery as changeCheckoutDeliveryService,
  reopenCheckout as reopenCheckoutService,
} from '@/lib/commerce/changeDelivery'
import { CHECKOUT_COOKIE, cartNoticeSearch } from '@/lib/commerce/checkout'
import { checkoutRawFromFormData, type CheckoutFieldErrors } from '@/lib/commerce/checkoutSchema'
import {
  MOCK_TEST_METHODS,
  mockConfirmOutcome,
  mockPaymentMethodOf,
} from '@/lib/commerce/mockConfirm'
import {
  checkoutSubmitAllowed,
  submitCheckout as submitCheckoutService,
} from '@/lib/commerce/submitCheckout'
import { getEnv } from '@/lib/env'
import { MOCK_OUTCOMES, type MockOutcome } from '@/lib/payments/mock/state'
import { localizedPath } from '@/lib/routes/paths'

// Server-Actions der Kasse R07 (KONZEPT §4.4–§4.7, PLAN P4.10a/P4.10b). Aufruf aus dem Formular ohne JavaScript
// (Antwort: 303 zurück auf die Kasse mit `?hinweis=<code>` bzw. weiter zur Danke-Seite) oder aus der Kassen-Komponente
// (`via=script`: Antwort als Objekt). Die URL nach dem Absenden enthält nie Eingaben (R-137). Alle Prüfungen liegen in
// den Diensten unter `src/lib/commerce/`; der Kassen-Token kommt nur aus dem Cookie `pc_checkout`.

export type CheckoutActionResponse =
  | { ok: true; next: 'confirm'; returnUrl: string }
  | { ok: true; next: 'done' }
  | { ok: false; code: string; errors?: CheckoutFieldErrors }

async function context(formData?: FormData) {
  const jar = await cookies()
  const locale = formData?.get('locale') === 'en' ? 'en' : 'de'
  return {
    jar,
    locale: locale as 'de' | 'en',
    token: jar.get(CHECKOUT_COOKIE)?.value ?? null,
    viaScript: formData?.get('via') === 'script',
  }
}

const checkoutPath = (locale: 'de' | 'en', code?: string) =>
  `${localizedPath('R07', locale)}${code ? `?hinweis=${encodeURIComponent(code)}` : ''}`

/** „Zahlungspflichtig bestellen“ (Rate-Limit `checkout_submit` je Kassen-Token, 10 / 30 min). */
export async function submitCheckout(formData: FormData): Promise<CheckoutActionResponse> {
  const { jar, locale, token, viaScript } = await context(formData)
  const now = new Date()
  const back = (code: string, errors?: CheckoutFieldErrors): CheckoutActionResponse => {
    if (viaScript) return { ok: false, code, ...(errors ? { errors } : {}) }
    redirect(checkoutPath(locale, code), RedirectType.push)
  }
  if (!token) redirect(`${localizedPath('R06', locale)}${cartNoticeSearch('no_checkout')}`)
  if (!(await checkoutSubmitAllowed(token, now))) return back('rate_limited')

  const cart = readCart(jar.get(CART_COOKIE)?.value)
  const result = await submitCheckoutService({
    token,
    raw: checkoutRawFromFormData(formData),
    cartItemIds: cart.items.map((i) => i.id),
    now,
  })
  if (!result.ok) return back(result.code, result.errors)
  if (result.paymentChoice === 'prepayment') redirect(result.redirectTo, RedirectType.push)
  if (viaScript) return { ok: true, next: 'confirm', returnUrl: result.returnUrl }

  // Ohne JavaScript: Mock bestätigt direkt mit der Auswahl im Testfeld; Stripe braucht das Zahlungsfeld (JavaScript).
  if (getEnv().PAYMENTS_DRIVER === 'mock') {
    const outcome = await confirmWithMock(
      token,
      String(formData.get('mockOutcome') ?? 'success'),
      String(formData.get('mockMethod') ?? 'card'),
    )
    if (outcome.ok) redirect(outcome.redirectTo, RedirectType.push)
    return back(outcome.code)
  }
  await reopenCheckoutService({ token, now: new Date() })
  return back('failed')
}

async function confirmWithMock(token: string, outcome: string, method: string) {
  const o = (
    (MOCK_OUTCOMES as readonly string[]).includes(outcome) ? outcome : 'success'
  ) as MockOutcome
  const m = (MOCK_TEST_METHODS as readonly string[]).includes(method) ? method : 'card'
  const result = await mockConfirmOutcome({
    token,
    outcome: o,
    method: mockPaymentMethodOf(m),
    now: new Date(),
  })
  return result.ok
    ? { ok: true as const, redirectTo: result.redirectTo }
    : { ok: false as const, code: result.code }
}

/**
 * Mock-Zahlungsfeld (KONZEPT §4.7, P4.10b): Erfolg/Abbruch/Verzögert → 303 auf die Danke-Seite; Abgelehnt → Fehler im
 * Feld, die Kasse ist wieder `open` (S8). Nie bei `APP_ENV=production` (dort gibt es keinen Mock-Treiber).
 */
export async function mockConfirm(
  outcome: string,
  method: string,
): Promise<{ ok: false; code: string }> {
  const { token } = await context()
  if (!token || getEnv().APP_ENV === 'production') return { ok: false, code: 'failed' }
  const result = await confirmWithMock(token, outcome, method)
  if (result.ok) redirect(result.redirectTo, RedirectType.push)
  return { ok: false, code: result.code }
}

/** Zahlungsversuch gescheitert (Stripe meldet einen Fehler im Zahlungsfeld): Kasse `confirming → open` (S8). */
export async function reopenCheckout(): Promise<{ ok: boolean }> {
  const { token } = await context()
  if (!token) return { ok: false }
  const result = await reopenCheckoutService({ token, now: new Date() })
  return { ok: result.ok }
}

export type ChangeDeliveryResponse =
  { ok: true; changed: boolean; session: string } | { ok: false; code: string }

/** Lieferart der Kasse wechseln; die Reservierung bleibt, Versand und Summen werden neu berechnet (P4.10b). */
export async function changeCheckoutDelivery(formData: FormData): Promise<ChangeDeliveryResponse> {
  const { jar, locale, token, viaScript } = await context(formData)
  const method = String(formData.get('fulfillmentMethod') ?? '')
  const result = await changeCheckoutDeliveryService({ token, method, now: new Date() })
  if (result.ok && result.changed) {
    // Der Korb merkt sich dieselbe Lieferart (nur Merkliste, ARCHITEKTUR §8.7).
    const cart = readCart(jar.get(CART_COOKIE)?.value)
    if (cart.items.length > 0) {
      const requestHeaders = await headers()
      jar.set(
        CART_COOKIE,
        encodeCartCookie({ ...cart, delivery: result.fulfillmentMethod }),
        cartCookieAttributes(requestHeaders.get('host')),
      )
    }
  }
  if (viaScript) {
    return result.ok
      ? { ok: true, changed: result.changed, session: result.session }
      : { ok: false, code: result.code }
  }
  redirect(checkoutPath(locale, result.ok ? undefined : result.code), RedirectType.push)
}
