import { artTags, test } from './helpers/fixtures'

// SC-11 (KUNST-QA §4.3): weiche Navigation R01 → R02 → R04 → R06 per Klick; Seitenübergang (View Transition, MI-04)
// als Sequenz alle 50 ms.

test(
  'SC-11 Weiche Navigation',
  { tag: artTags(['art-pixel7', 'art-desktop']) },
  async ({ art }) => {
    const { page } = art
    await art.goto('/de')
    const hops: [string, string, RegExp][] = [
      ['r01-r02', 'header a[href="/de/shop"]', /\/de\/shop$/],
      ['r02-r04', 'main a[data-product-card]', /\/de\/shop\/\d+/],
      ['r04-r06', 'header [data-header-cart]', /\/de\/warenkorb$/],
    ]
    for (const [name, selector, url] of hops) {
      const link = page.locator(selector).first()
      await link.evaluate((a) =>
        a.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior }),
      )
      await art.sequence({
        stepMs: art.step(50, 500),
        untilMs: 500,
        prefix: name,
        start: async () => {
          await link.evaluate((a) => (a as HTMLElement).click())
          // Uhr steht: Router-Übergang (Timer/rAF) in kleinen Schritten vorspulen, bis die neue Adresse steht.
          for (let i = 0; i < 300 && !url.test(page.url()); i++) await page.clock.runFor(16)
        },
      })
      await page.waitForURL(url, { timeout: 15_000 })
      await art.waitLeash()
      await art.settledFrame(`${name}-done`)
    }
  },
)
