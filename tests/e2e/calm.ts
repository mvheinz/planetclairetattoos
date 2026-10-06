import { expect, type Page } from '@playwright/test'

// Ruhe-Modus-Prüfung (DESIGN AK-DS-11) für Rechtsseiten, R26 und später Warenkorb/Kasse.

/** AK-DS-11: 1000 ms nach `load` keine Animation; jede berechnete `transition-duration` in `<main>` ist `0s`. */
export async function expectCalm(page: Page, label: string) {
  await page.waitForLoadState('load')
  await page.waitForTimeout(1000)
  const result = await page.evaluate(() => {
    const main = document.querySelector('main')
    const els = main ? [main, ...Array.from(main.querySelectorAll('*'))] : []
    const moving = els
      .flatMap((el) =>
        [null, '::before', '::after'].map((pseudo) => ({
          el,
          d: getComputedStyle(el, pseudo).transitionDuration,
        })),
      )
      .filter(({ d }) => d.split(',').some((part) => part.trim() !== '0s'))
      .map(({ el, d }) => `${el.tagName.toLowerCase()}.${el.className}: ${d}`)
    // Scroll-gebundene Animationen (Seitenverlauf Olivgrün → Petrol, U-11) laufen nicht über die Zeit, sondern nur beim Scrollen:
    // sie zählen nicht als Bewegung; zeitgesteuerte Animationen bleiben verboten.
    const timed = document
      .getAnimations()
      .filter(
        (a) => !(typeof ScrollTimeline !== 'undefined' && a.timeline instanceof ScrollTimeline),
      )
    return { animations: timed.length, moving, count: els.length }
  })
  expect(result.count, `${label} <main> vorhanden`).toBeGreaterThan(1)
  expect(result.animations, `${label} getAnimations()`).toBe(0)
  expect(result.moving, `${label} transition-duration`).toEqual([])
}
