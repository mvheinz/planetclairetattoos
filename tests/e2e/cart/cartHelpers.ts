import { expect, type BrowserContext, type Page } from '@playwright/test'

import { encodeCartCookie, type CartCookie } from '../../../src/lib/commerce/cartCookie'
import { formatMoney } from '../../../src/lib/money'
import { localizedPath } from '../../../src/lib/routes/paths'
import { serverURL } from '../../helpers/adminEnv'
import { testPayload } from '../fixtures'

// Helfer der Korb-Tests (P4.8): Korb-Cookie `pc_cart` direkt setzen (ARCHITEKTUR §8.7 – nur Merkliste, der Server prüft
// jede Position neu), IDs der Seed-Anker, Beträge wie `formatMoney`.

export const R06 = { de: localizedPath('R06', 'de'), en: localizedPath('R06', 'en') } as const

export const euro = (cents: number, locale: 'de' | 'en' = 'de') => formatMoney(cents, locale)

/** Produkt-ID und Preis eines Stücks aus der Test-DB. */
export async function productByNumber(
  itemNumber: number,
): Promise<{ id: number; priceCents: number; status: string }> {
  const payload = await testPayload()
  const doc = (
    await payload.find({
      collection: 'products',
      where: { itemNumber: { equals: itemNumber } },
      overrideAccess: true,
      limit: 1,
      depth: 0,
    })
  ).docs[0]
  if (!doc) throw new Error(`Stück ${itemNumber} fehlt in der Test-DB.`)
  return { id: doc.id as number, priceCents: doc.priceCents, status: doc.status }
}

/** Setzt `pc_cart` im Browser-Kontext (wie nach „In den Korb“). */
export async function setCart(
  context: BrowserContext,
  items: { id: number; p: number }[],
  delivery: CartCookie['delivery'] = 'shipping',
): Promise<void> {
  await context.addCookies([
    {
      name: 'pc_cart',
      value: encodeCartCookie({ v: 1, items, delivery }),
      url: serverURL,
      sameSite: 'Lax',
      httpOnly: false,
    },
  ])
}

/** Text eines Betrags in der Summenliste (ohne Leerraum-Unterschiede). */
export async function amount(page: Page, selector: string): Promise<string> {
  return (await page.locator(`${selector} [data-money]`).innerText()).replace(/\s+/g, ' ')
}

/** Wartet, bis der Betrag stimmt (nach einer Formular-Aktion lädt die Seite neu). */
export async function expectAmount(page: Page, selector: string, cents: number): Promise<void> {
  await expect.poll(() => amount(page, selector)).toBe(norm(euro(cents)))
}

export const norm = (s: string) => s.replace(/\s+/g, ' ')
