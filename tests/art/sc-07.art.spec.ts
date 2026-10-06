import { liveRegionTexts } from './helpers/capture'
import { artPieces } from './helpers/commerce'
import { artTags, test } from './helpers/fixtures'
import { startCheckoutFor } from '../e2e/checkout/checkoutHelpers'

// SC-07 (KUNST-QA §4.3): Countdown der Kasse R07 – Uhr auf `reservedUntil − 10:05`, `−5:00`, `−1:00`, `0` vorspulen;
// Frames je Schwelle und die Texte der Live-Regionen. Der Countdown rechnet mit dem Versatz zur Serverzeit beim Laden
// (KO-15), daher wird relativ zur angezeigten Restzeit vorgespult.

const MARKS = [
  { label: 'minus-10-05', remaining: 10 * 60_000 + 5_000 },
  { label: 'minus-05-00', remaining: 5 * 60_000 },
  { label: 'minus-01-00', remaining: 60_000 },
  { label: 'zero', remaining: 0 },
]

test('SC-07 Countdown der Kasse', { tag: artTags('all') }, async ({ art }) => {
  const { page, context } = art
  const pieces = await artPieces()
  try {
    const p = await pieces.create({ priceCents: 3900 })
    await startCheckoutFor(context, page, [{ id: p.id, priceCents: 3900 }])
    await page.waitForSelector('[data-behavior~="reservation-countdown"]')
    await art.pauseClock()
    const remainingAtLoad = await page.evaluate(() => {
      const el = document.querySelector<HTMLElement>('[data-behavior~="reservation-countdown"]')!
      return Date.parse(el.dataset.expiresAt ?? '') - Date.parse(el.dataset.serverNow ?? '')
    })
    let elapsed = 0
    const log: unknown[] = []
    for (const m of MARKS) {
      const target = Math.max(0, remainingAtLoad - m.remaining)
      if (target > elapsed) {
        await page.clock.fastForward(target - elapsed)
        elapsed = target
      }
      await page.clock.runFor(1100)
      elapsed += 1100
      await art.settledFrame(`countdown-${m.label}`)
      log.push({ mark: m.label, live: await liveRegionTexts(page) })
    }
    art.json('live-regions', log)
    await art.resumeClock()
  } finally {
    await pieces.cleanup()
  }
})
