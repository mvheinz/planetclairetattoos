import { CART_COOKIE } from '../../src/lib/commerce/cartCookie'
import { CHECKOUT_COOKIE } from '../../src/lib/commerce/checkout'
import { serverURL } from '../helpers/adminEnv'
import { fixtureOrder, mockPayments, submittedCheckout } from '../e2e/order/orderFixtures'
import { artPieces } from './helpers/commerce'
import { artTags, test } from './helpers/fixtures'

// SC-09 (KUNST-QA §4.3): Danke-Seite R08 in allen Zuständen – wartet, bezahlt, Vorkasse, fehlgeschlagen (Zahlung nicht
// geklappt), „leider schon weg“ (O19); Zustände per Mock-Zahlung bzw. Fixture-Bestellung wie die E2E-Suite (P4.17).
// Video je Zustand; MI-09 (bezahlt) als Sequenz alle 100 ms bis 6 s.

type State = 'waiting' | 'paid' | 'prepayment' | 'unpaid' | 'gone'
const STATES: State[] = ['paid', 'waiting', 'prepayment', 'unpaid', 'gone']

test('SC-09 Danke-Seite in allen Zuständen', { tag: artTags('all') }, async ({ art }) => {
  const { page, context } = art
  const pieces = await artPieces()
  try {
    for (const state of STATES) {
      const p = await pieces.create({ priceCents: 4200 })
      const c = await submittedCheckout(pieces.payload, [p.id], {
        confirming: state === 'waiting' || state === 'unpaid',
        seed: true,
      })
      if (state === 'waiting') {
        const mock = mockPayments()
        await mock.setNextOutcome(c.session!, { result: 'delayed' })
        await mock.emit(c.session!, 'checkout.session.completed')
      }
      if (state === 'paid') await fixtureOrder(pieces.payload, c.checkoutId, 'O1')
      if (state === 'prepayment') await fixtureOrder(pieces.payload, c.checkoutId, 'O2')
      if (state === 'gone') await fixtureOrder(pieces.payload, c.checkoutId, 'O19')
      await context.addCookies([
        { name: CART_COOKIE, value: 'eyJ2IjoxLCJpdGVtcyI6W119', url: serverURL },
        { name: CHECKOUT_COOKIE, value: c.token, url: serverURL, httpOnly: true },
      ])
      if (state === 'paid') {
        await art.pauseClock()
        await page.goto(`/de/danke/${c.token}`, { waitUntil: 'load' })
        await page.waitForSelector('[data-thanks-page][data-thanks-state="paid"]')
        await art.sequence({ stepMs: art.step(100, 6000), untilMs: 6000, prefix: 'paid' })
      } else {
        await art.goto(`/de/danke/${c.token}`)
        await page.waitForSelector(`[data-thanks-page][data-thanks-state="${state}"]`)
        await page.waitForTimeout(1500)
        await art.settledFrame(state)
        await art.axe(`r08-${state}`)
      }
    }
  } finally {
    await pieces.cleanup()
  }
})
