'use server'

import { cookies, headers } from 'next/headers'
import { redirect, RedirectType } from 'next/navigation'

import { cartFromCookie } from '@/lib/commerce/cart'
import { CART_COOKIE } from '@/lib/commerce/cartCookie'
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
