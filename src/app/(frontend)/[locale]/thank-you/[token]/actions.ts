'use server'

import { cookies, headers } from 'next/headers'

import { CART_COOKIE, cartCookieAttributes } from '@/lib/commerce/cartCookie'
import { CHECKOUT_COOKIE, checkoutCookieAttributes } from '@/lib/commerce/checkout'
import { thanksTokenHasOrder } from '@/lib/commerce/thanksState'

// Danke-Seite R08 (KONZEPT §4.12, PLAN P4.17): Beim ersten Aufruf mit Bestellung werden `pc_cart` und `pc_checkout`
// gelöscht (Server-Komponenten dürfen keine Cookies setzen, deshalb diese Server-Action, ausgelöst von
// `ClearOrderCookies`). Nur wenn der Token wirklich zu einer Bestellung gehört; sonst bleibt alles, wie es ist.
export async function clearOrderCookies(token: string): Promise<boolean> {
  if (typeof token !== 'string' || !(await thanksTokenHasOrder(token))) return false
  const [requestHeaders, jar] = await Promise.all([headers(), cookies()])
  const host = requestHeaders.get('host')
  if (jar.has(CART_COOKIE)) jar.set(CART_COOKIE, '', { ...cartCookieAttributes(host), maxAge: 0 })
  if (jar.has(CHECKOUT_COOKIE))
    jar.set(CHECKOUT_COOKIE, '', { ...checkoutCookieAttributes(host), maxAge: 0 })
  return true
}
