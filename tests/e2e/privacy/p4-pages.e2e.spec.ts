import { localizedPath } from '../../../src/lib/routes/paths'
import { LOCALES } from '../../../src/lib/routes/registry'
import { serverURL } from '../../helpers/adminEnv'
import { holdShippingRates, type ReleaseLock } from '../../helpers/adminSessionLock'
import { cleanupCheckouts } from '../checkout/checkoutHelpers'
import { watchCsp } from '../csp'
import { expect, test, testPayload } from '../fixtures'
import { cleanup, fixtureOrder, submittedCheckout } from '../order/orderFixtures'
import {
  buyer,
  chooseMock,
  choosePayment,
  fillShipping,
  goToCheckout,
  orderAndThank,
} from '../purchase/purchaseHelpers'
import { openProduct, pathOf, PUBLISHED } from '../shop/productPage'
import { deviceStorage, expectPrivate, ORIGIN } from './privacyHelpers'

// P4.25 T-03/T-04 `@privacy` für die Seiten der Phase P4 (KONZEPT EK-04/EK-05, RECHT R-130/R-131, ARCHITEKTUR §8.7):
// - Kaufweg: vor „In den Korb“ kein Endgeräte-Speicher, danach nur `pc_cart`; nach „Zur Kasse“ genau `pc_cart` +
//   `pc_checkout` (HttpOnly), kein Web-Storage, keine IndexedDB; mit `PAYMENTS_DRIVER=mock` keine Anfrage an Stripe und
//   kein Stripe-Host in der CSP von R06/R07/R08 (Stripe-Hosts nur auf R07 und nur mit `stripe` – Unit-Test
//   `tests/unit/security/csp.unit.spec.ts`); nach der bezahlten Bestellung löscht die Danke-Seite beide Cookies.
// - Token-Seiten R08 (Danke) und R09 (Bestellstatus) ohne Beispiel-Adresse in der Registry: mit Fixture-Bestellung je
//   Sprache in frischem Kontext wie alle anderen Routen (`privacy.e2e.spec.ts`), dazu „Vertrag widerrufen“ im Fuß
//   (R-090). R06, R07 (ohne Kasse → Korb) und R25 prüft `privacy.e2e.spec.ts` über die Registry.

const STRIPE = /(^|\.)stripe\.(com|network)$/

test.describe('Kaufweg: Speicher erst nach „In den Korb“, nach „Zur Kasse“ nur pc_cart + pc_checkout @privacy', () => {
  let used: number[] = []
  let release: ReleaseLock | undefined
  test.beforeEach(async () => {
    release = await holdShippingRates('shared')
  })
  test.afterEach(async () => {
    await cleanupCheckouts(used)
    used = []
    await release?.()
    release = undefined
  })

  test('T-03/T-04 R-130 R-131 EK-04 EK-05 R04 → R06 → R07 → R08 mit Mock: Cookies genau laut §8.7, kein Web-Storage, kein Stripe-Host @privacy', async ({
    page,
    context,
    request,
    fixtureProducts,
    foreignRequests,
  }) => {
    const p = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 4500 })
    used.push(p.id)
    const b = await buyer(context, page)
    const csp = await watchCsp(page)
    const requests: string[] = []
    const cspHeaders = new Map<string, string>()
    context.on('request', (r) => requests.push(r.url()))
    context.on('response', (r) => {
      if (r.request().resourceType() === 'document')
        cspHeaders.set(new URL(r.url()).pathname, r.headers()['content-security-policy'] ?? '')
    })
    const names = async () => (await context.cookies()).map((c) => c.name).sort()
    const emptyStorage = async () => {
      const s = await deviceStorage(page)
      expect(s.local, 'localStorage').toEqual([])
      expect(s.session, 'sessionStorage').toEqual([])
      if (s.indexedDB !== null) expect(s.indexedDB, 'IndexedDB').toEqual([])
      expect(s.serviceWorkers).toEqual([])
    }

    // Produktseite: vor „In den Korb“ nichts gespeichert – auch nicht durch die Live-Abfrage.
    await openProduct(page, request, await pathOf(p.itemNumber, 'de'))
    await expect(page.locator('[data-product-page]')).toHaveAttribute('data-status-live', '')
    expect(await names(), 'Cookies vor „In den Korb“').toEqual([])
    await emptyStorage()
    await page.locator('[data-add-to-cart] button').click()
    const inCart = page.locator('[data-buy-area] [data-in-cart]')
    await expect(inCart).toBeVisible()
    expect(await names(), 'Cookies nach „In den Korb“').toEqual(['pc_cart'])
    await inCart.getByRole('link', { name: 'Zum Korb' }).click()
    await page.waitForURL(new RegExp(`${localizedPath('R06', 'de')}$`))
    expect(await names(), 'Cookies im Korb').toEqual(['pc_cart'])
    await emptyStorage()

    await goToCheckout(context, page)
    expect(await names(), 'Cookies in der Kasse').toEqual(['pc_cart', 'pc_checkout'])
    const checkoutCookie = (await context.cookies()).find((c) => c.name === 'pc_checkout')!
    expect(checkoutCookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' })
    await emptyStorage()
    const r07 = await context.request.get(localizedPath('R07', 'de'), { maxRedirects: 0 })
    expect(r07.status(), 'R07 mit Kasse').toBe(200)
    cspHeaders.set(localizedPath('R07', 'de'), r07.headers()['content-security-policy'] ?? '')

    await fillShipping(page, b.email)
    await choosePayment(page, 'stripe')
    await chooseMock(page, 'success', 'card')
    const token = checkoutCookie.value
    await expect(await orderAndThank(page, token)).toHaveAttribute('data-thanks-state', 'paid')
    await expect.poll(names, { message: 'Danke-Seite löscht beide Cookies' }).toEqual([])
    await emptyStorage()

    // Mit Mock: keine Anfrage an Stripe, kein fremder Host in den Dokument-CSPs (Kasse eingeschlossen).
    expect(requests.filter((u) => /^https?:/.test(u) && STRIPE.test(new URL(u).hostname))).toEqual(
      [],
    )
    expect(
      requests.filter(
        (u) => /^https?:/.test(u) && !u.startsWith('data:') && new URL(u).origin !== ORIGIN,
      ),
    ).toEqual([])
    expect(foreignRequests).toEqual([])
    // Kasse und Danke-Seite erreicht der Browser per Client-Navigation (Server-Action) – ihre Dokument-Header direkt.
    for (const path of [localizedPath('R08', 'de', { token })]) {
      const res = await context.request.get(path, { maxRedirects: 0 })
      expect(res.status(), path).toBeLessThan(400)
      cspHeaders.set(path, res.headers()['content-security-policy'] ?? '')
    }
    expect(cspHeaders.get(localizedPath('R06', 'de')), 'R06').toBeDefined()
    for (const [path, value] of cspHeaders) expect(value, path).not.toMatch(/stripe|https?:\/\//)
    expect(await csp(), 'CSP-Verstöße').toEqual([])
  })
})

test.describe('Token-Seiten R08/R09 ohne Speicher und Fremd-Requests @privacy', () => {
  const checkouts: number[] = []
  test.afterEach(async () => {
    await cleanup(await testPayload(), checkouts.splice(0))
  })

  for (const locale of LOCALES) {
    for (const id of ['R08', 'R09'] as const) {
      test(`T-03/T-04 R-130 R-131 R-090 ${id} ${locale} (Fixture analog O14/O10) @privacy`, async ({
        page,
        context,
        foreignRequests,
        fixtureProducts,
      }) => {
        const payload = await testPayload()
        const piece = await fixtureProducts.create('keramik', {
          status: 'available',
          firstPublishedAt: new Date(Date.now() - 86_400_000).toISOString(),
        })
        const c = await submittedCheckout(payload, [piece.id], { seed: true, locale })
        checkouts.push(c.checkoutId)
        const { statusToken } = await fixtureOrder(payload, c.checkoutId, 'O1')
        const path = localizedPath(id, locale, { token: id === 'R08' ? c.token : statusToken })
        expect(new URL(path, serverURL).pathname).toBe(path)
        await expectPrivate(page, context, foreignRequests, path, 200)
        await expect(page.locator('[data-site-footer] [data-withdraw-link]')).toBeVisible()
      })
    }
  }
})
