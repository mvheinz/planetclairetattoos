'use server'

import { cookies, headers } from 'next/headers'
import { redirect, RedirectType } from 'next/navigation'
import { z } from 'zod'

import { addToCart as addToCartService } from '@/lib/commerce/cart'
import {
  CART_COOKIE,
  cartCookieAttributes,
  type AddToCartResponse,
} from '@/lib/commerce/cartCookie'
import { LOCALES } from '@/lib/enums'
import { localizedPath } from '@/lib/routes/paths'
import { clientIp } from '@/lib/security/rateLimit'
import { buyFragment } from '@/lib/shop/buyArea'
import { productPath } from '@/lib/shop/format'

// Server-Action „In den Korb“ (ARCHITEKTUR §2.4, §15.3; KONZEPT §4.2; PLAN P3.11): zod, Rate-Limit `cart_add` und alle
// Prüfungen im Dienst `src/lib/commerce/cart.ts`; setzt bzw. aktualisiert **erst jetzt** `pc_cart` (Attribute §8.7).
// - Aufruf durch das Modul `add-to-cart` (`via=script`): Antwort `AddToCartResponse`, kein Seitenwechsel.
// - Formular ohne JavaScript: 303 zurück auf die Produktseite mit Fragment (`#in-cart` bzw. Meldung, `buyArea.ts`);
//   nicht öffentliche Stücke über `/{sprache}/shop/{nummer}` (404 bzw. „Zuhause“-Variante), ohne DB-Angaben zu verraten.

const Input = z.object({
  productId: z.coerce.number().int().min(1).max(2_147_483_647),
  itemNumber: z.coerce.number().int().min(1).max(99_999),
  locale: z.enum(LOCALES),
})

export async function addToCart(formData: FormData): Promise<AddToCartResponse> {
  const viaScript = formData.get('via') === 'script'
  const rawLocale = formData.get('locale')
  const locale = rawLocale === 'en' ? 'en' : 'de'
  const input = Input.safeParse({
    productId: formData.get('productId'),
    itemNumber: formData.get('itemNumber'),
    locale: rawLocale,
  })

  let response: AddToCartResponse
  let target: string
  if (!input.success) {
    response = { ok: false, code: 'invalid', state: null, message: null }
    target = localizedPath('R02', locale)
  } else {
    const [requestHeaders, jar] = await Promise.all([headers(), cookies()])
    const outcome = await addToCartService({
      productId: input.data.productId,
      locale: input.data.locale,
      cookie: jar.get(CART_COOKIE)?.value,
      ip: clientIp(requestHeaders),
      now: new Date(),
    })
    if (outcome.cookie) {
      jar.set(CART_COOKIE, outcome.cookie, cartCookieAttributes(requestHeaders.get('host')))
    }
    response = outcome.response
    target = productPath(outcome.product ?? { itemNumber: input.data.itemNumber }, locale)
  }

  if (viaScript) return response
  redirect(`${target}#${buyFragment(response)}`, RedirectType.push)
}
