import { pathOf } from '../e2e/shop/productPage'
import { seedPiece } from './helpers/commerce'
import { artTags, test } from './helpers/fixtures'

// SC-10 (KUNST-QA §4.3): Fehlerseiten – R28 404 („Coco hat sich losgerissen“, MI-11), 404-Variante „Zuhause“
// (verkauftes, ausgeblendetes Stück) und R29 500 (`/de/qa/error`); laden und 6 s warten, Sequenz alle 200 ms.

test('SC-10 Fehlerseiten', { tag: artTags('all') }, async ({ art }) => {
  const { page } = art
  const gone = await seedPiece('gone')
  const pages: [string, string][] = [
    ['r28-lost', '/de/gibt-es-nicht'],
    ...(gone !== null
      ? ([['r28-home', await pathOf(gone, 'de').catch(() => `/de/shop/${gone}`)]] as [
          string,
          string,
        ][])
      : []),
    ['r29-error', '/de/qa/error'],
  ]
  for (const [name, url] of pages) {
    await art.pauseClock()
    await page.goto(url, { waitUntil: 'load' })
    // Reduzierte Bewegung: der Fehler-Rahmen (R29) rendert erst nach der Hydrierung – auf den Inhalt warten und oben beginnen,
    // sonst zeigte t0000 den Fußbereich der Vorseite und die Linie „erschien“ erst später (R3-09-01, Aufnahme-Artefakt)
    if (art.reduced) {
      await art.runUntilLeash(true)
      await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }))
    }
    await art.sequence({ stepMs: art.step(200, 6000), untilMs: 6000, prefix: name })
    await art.axe(name)
  }
})
