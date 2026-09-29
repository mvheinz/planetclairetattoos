'use server'

import { cookies, headers } from 'next/headers'
import { redirect, RedirectType } from 'next/navigation'
import { z } from 'zod'

import {
  cartFromCookie,
  readCart,
  removeFromCart as removeFromCartService,
  setDeliveryMethod as setDeliveryMethodService,
  type CartActionCode,
  type CartActionOutcome,
  type CartCookieChange,
} from '@/lib/commerce/cart'
import { CART_COOKIE, cartCookieAttributes } from '@/lib/commerce/cartCookie'
import {
  CHECKOUT_COOKIE,
  cartNoticeSearch,
  checkoutCookieAttributes,
  checkoutStartAllowed,
  startCheckout,
} from '@/lib/commerce/checkout'
import { localizedPath } from '@/lib/routes/paths'
import { clientIp } from '@/lib/security/rateLimit'

// Server-Action „Zur Kasse“ (KONZEPT §4.2/§4.6, DATENMODELL §8.1, PLAN P4.6): nur per POST (Server-Actions sind nie
// per Seitenaufruf oder Prefetch erreichbar), Rate-Limit `checkout_start`, alle Prüfungen im Dienst
// `src/lib/commerce/checkout.ts`. Erfolg → Cookie `pc_checkout` (HttpOnly, 1 h; nur bei neuer Kasse) und 303 auf die
// Kasse R07; Ablehnung → 303 zurück auf den Korb R06 mit Hinweis (z. B. „Nr. 017 ist gerade reserviert …“, S1).

export async function startCheckoutAction(formData: FormData): Promise<void> {
  const locale = formData.get('locale') === 'en' ? 'en' : 'de'
  const cartPath = localizedPath('R06', locale)
  const [requestHeaders, jar] = await Promise.all([headers(), cookies()])
  const now = new Date()

  if (!(await checkoutStartAllowed(clientIp(requestHeaders), now))) {
    redirect(`${cartPath}${cartNoticeSearch('rate_limited')}`, RedirectType.push)
  }
  const result = await startCheckout(
    {
      cart: cartFromCookie(jar.get(CART_COOKIE)?.value),
      locale,
      existingToken: jar.get(CHECKOUT_COOKIE)?.value ?? null,
      now,
    },
    { inServerAction: true },
  )
  if (!result.ok) {
    redirect(
      `${cartPath}${cartNoticeSearch(result.code, { itemNumbers: result.itemNumbers, max: result.max })}`,
      RedirectType.push,
    )
  }
  if (!result.reused) {
    jar.set(CHECKOUT_COOKIE, result.token, checkoutCookieAttributes(requestHeaders.get('host')))
  }
  redirect(localizedPath('R07', locale), RedirectType.push)
}

// Warenkorb-Aktionen (KONZEPT §4.2, PLAN P4.7). Aufruf per Formular (ohne JavaScript: 303 zurück auf den Korb, ggf. mit
// Hinweis) oder durch ein Verhaltensmodul (`via=script`: Antwort ohne Seitenwechsel). Das Cookie ist nur Merkliste;
// geprüft wird im Dienst `src/lib/commerce/cart.ts`.

const ProductId = z.coerce.number().int().min(1).max(2_147_483_647)

export type CartActionResponse =
  | { ok: true; count: number; delivery: 'shipping' | 'pickup' }
  | { ok: false; code: CartActionCode; itemNumbers?: number[] }

async function applyCookie(change: CartCookieChange): Promise<void> {
  if (!change) return
  const [requestHeaders, jar] = await Promise.all([headers(), cookies()])
  if ('delete' in change) jar.delete(CART_COOKIE)
  else jar.set(CART_COOKIE, change.set, cartCookieAttributes(requestHeaders.get('host')))
}

function respond(formData: FormData, outcome: CartActionOutcome): CartActionResponse {
  const response: CartActionResponse = outcome.ok
    ? { ok: true, count: outcome.cart.items.length, delivery: outcome.cart.delivery }
    : {
        ok: false,
        code: outcome.code,
        ...(outcome.itemNumbers ? { itemNumbers: outcome.itemNumbers } : {}),
      }
  if (formData.get('via') === 'script') return response
  const locale = formData.get('locale') === 'en' ? 'en' : 'de'
  const search = response.ok
    ? ''
    : cartNoticeSearch(response.code, { itemNumbers: response.itemNumbers })
  redirect(`${localizedPath('R06', locale)}${search}`, RedirectType.push)
}

/** „Entfernen“: Stück aus dem Korb; eine offene Kasse wird abgebrochen (S6), während einer Zahlung abgelehnt. */
export async function removeFromCart(formData: FormData): Promise<CartActionResponse> {
  const jar = await cookies()
  const id = ProductId.safeParse(formData.get('productId'))
  const outcome: CartActionOutcome = id.success
    ? await removeFromCartService(
        {
          productId: id.data,
          cookie: jar.get(CART_COOKIE)?.value,
          checkoutToken: jar.get(CHECKOUT_COOKIE)?.value,
          now: new Date(),
        },
        { inServerAction: true },
      )
    : { ok: false, code: 'invalid', cart: readCart(jar.get(CART_COOKIE)?.value), cookie: null }
  await applyCookie(outcome.cookie)
  return respond(formData, outcome)
}

/** Lieferart wählen (`shipping` | `pickup`); `nur_abholung` erzwingt Abholung (AK-4-02). Reservierung bleibt. */
export async function setDeliveryMethod(formData: FormData): Promise<CartActionResponse> {
  const jar = await cookies()
  const method = formData.get('method')
  const outcome = await setDeliveryMethodService({
    method: method === 'shipping' || method === 'pickup' ? method : ('invalid' as never),
    cookie: jar.get(CART_COOKIE)?.value,
  })
  await applyCookie(outcome.cookie)
  return respond(formData, outcome)
}
