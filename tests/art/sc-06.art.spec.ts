import { localizedPath } from '../../src/lib/routes/paths'
import { encodeCartCookie } from '../../src/lib/commerce/cartCookie'
import { serverURL } from '../helpers/adminEnv'
import { fillShipping, ownClientIp, R06 } from '../e2e/checkout/checkoutHelpers'
import {
  chooseMock,
  choosePayment,
  goToCheckout,
  orderAndThank,
  orderButton,
} from '../e2e/purchase/purchaseHelpers'
import { animationLog, liveRegionTexts } from './helpers/capture'
import { artPieces } from './helpers/commerce'
import { artTags, test, type ArtSession } from './helpers/fixtures'

// SC-06 (KUNST-QA §4.3): R06 Korb, R07 Kasse (Mock-Zahlung), R09 Bestellstatus, R26 Widerruf – Felder ausfüllen,
// Fehler auslösen, „Ändern“-Links; Frames vor/nach jeder Interaktion und ein `getAnimations()`-Protokoll je Schritt.
// Eigenes Fixture-Stück (990–999), Zahlung mit `PAYMENTS_DRIVER=mock` ohne Netz.

async function step(art: ArtSession, label: string): Promise<void> {
  await art.page.waitForTimeout(350)
  await art.settledFrame(label)
  art.json(`animations-${label}`, {
    animations: await animationLog(art.page),
    live: await liveRegionTexts(art.page),
  })
}

test('SC-06 Korb, Kasse, Status, Widerruf', { tag: artTags('all') }, async ({ art }) => {
  const { page, context } = art
  const pieces = await artPieces()
  try {
    await ownClientIp(context)
    const p = await pieces.create({ priceCents: 4500 })
    // Korb wie nach „In den Korb“ (SC-05 nimmt die Produktseite selbst auf): Korb-Cookie, dann R06.
    await context.addCookies([
      {
        name: 'pc_cart',
        value: encodeCartCookie({ v: 1, items: [{ id: p.id, p: 4500 }], delivery: 'shipping' }),
        url: serverURL,
        sameSite: 'Lax',
      },
    ])
    await art.goto(R06.de)
    await step(art, 'r06-cart')

    const token = await goToCheckout(context, page)
    await step(art, 'r07-before')
    // Fehler auslösen: bestellen ohne Angaben
    await orderButton(page).click()
    await step(art, 'r07-errors')
    await fillShipping(page)
    await step(art, 'r07-filled')
    const change = page.locator('a[data-change]').first()
    if ((await change.count()) > 0) {
      await change.click()
      await step(art, 'r07-change')
    }
    await choosePayment(page, 'stripe')
    await chooseMock(page, 'success', 'card')
    await step(art, 'r07-mock-success')
    await orderAndThank(page, token)
    await step(art, 'r08-paid')

    const status = page.getByRole('link', { name: 'Bestellstatus ansehen' })
    await status.click()
    await page.waitForURL(/\/de\/bestellung\//)
    await step(art, 'r09-status')

    await page.goto(localizedPath('R26', 'de'))
    await step(art, 'r26-before')
    const submit = page.locator('main form button[type="submit"]').first()
    if ((await submit.count()) > 0) {
      await submit.click()
      await step(art, 'r26-errors')
      for (const input of await page
        .locator('main form input[type="text"], main form input[type="email"]')
        .all())
        if (await input.isVisible())
          await input.fill(
            (await input.getAttribute('type')) === 'email'
              ? 'erika@planetclaire.local'
              : 'Erika Beispiel',
          )
      await step(art, 'r26-filled')
    }
  } finally {
    await pieces.cleanup()
  }
})
