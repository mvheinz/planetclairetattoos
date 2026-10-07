import * as cheerio from 'cheerio'

import { formatMoney } from '../../../src/lib/money'
import { localizedPath } from '../../../src/lib/routes/paths'
import { LOCALES } from '../../../src/lib/routes/registry'
import { holdShippingRates, type ReleaseLock } from '../../helpers/adminSessionLock'
import { FORBIDDEN_CONTENT_PATTERNS } from '../../helpers/forbiddenPatterns'
import { adminCall, adminLogin, currentShippingRates } from '../adminApi'
import { expectNoSeriousViolations } from '../axe'
import { expect, test } from '../fixtures'
import { freshPage } from '../shop/fresh'
import { expectWarrantyNotice } from './warranty'

// P4.3 Seite „Versand & Zahlung“ (R25, KONZEPT §3.15; RECHT R-031, R-035, R-049; AK-3-10): Versandtabelle aus
// `settings.shipping.rates` (Zone DE, über `computeShipping` – dieselbe Quelle wie Korb und Kasse), Regel „höchste
// Versandklasse“, Lieferzeit, Liefergebiet, Zahlarten, Belastungszeitpunkt, Transportschaden-Hinweis mit „unberührt“,
// Rücksendekosten, Link R24, harmonisierte Mitteilung. Die Grund-Seed-Preise (E-25) lesen die Tests geteilt
// (`holdShippingRates`); der Test mit geändertem Klassenpreis hält den Lock exklusiv.

const R25 = { de: localizedPath('R25', 'de'), en: localizedPath('R25', 'en') }
const EDIT_MS = 60_000

/** V-11 (RECHT §5): Rügefristen, die Rechte verkürzen. */
const V11 =
  /(innerhalb|binnen)\s+(von\s+)?\d+\s+Tag(en)?.{0,60}(sonst|andernfalls|ausgeschlossen|erlischt|verfällt)/iu
const PATTERNS = [
  ...FORBIDDEN_CONTENT_PATTERNS.filter((p) => ['V-10', 'V-12', 'V-19', 'V-21'].includes(p.id)),
  { id: 'V-11', re: V11 },
]

const money = (cents: number, locale: 'de' | 'en') => formatMoney(cents, locale)
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

test.describe('R25 Versand & Zahlung – Grund-Seed-Preise', () => {
  let release: ReleaseLock | undefined
  test.beforeEach(async () => {
    release = await holdShippingRates('shared')
  })
  test.afterEach(async () => {
    await release?.()
    release = undefined
  })

  for (const locale of LOCALES) {
    test(`R-031 R-035 ${locale}: Versandtabelle (E-25), Regel, Lieferzeit, Liefergebiet, Zahlarten, Belastung, Schaden, Rücksendung, Link R24`, async ({
      page,
    }) => {
      await freshPage(page)
      const res = await page.goto(R25[locale])
      expect(res?.status()).toBe(200)
      await expect(page.locator('body')).toHaveAttribute('data-preset', 'legal')

      // Einleitung: Rechtstext-Fassung mit Platzhalter-Band (R-002), Tokens ersetzt (R-012).
      await expect(page.locator('[data-placeholder-banner]')).toBeVisible()
      const legal = page.locator('[data-legal-text="versand-zahlung"]')
      await expect(legal).toBeVisible()
      expect(await page.content()).not.toContain('{{')

      // Tabelle: Werte aus den Einstellungen (Grund-Seed E-25) + Abholung 0,00 €, Reihenfolge nach Klasse.
      const rates = await currentShippingRates()
      const de = (cls: string) =>
        rates.find((r) => r.zone === 'DE' && r.shippingClass === cls)!.priceCents
      expect([de('brief'), de('paket_klein'), de('keramik')]).toEqual([450, 650, 890])
      const table = page.locator('[data-shipping-table]')
      await expect(table.locator('tbody tr')).toHaveCount(4)
      const rows = await table
        .locator('tbody tr')
        .evaluateAll((trs) => trs.map((tr) => tr.getAttribute('data-shipping-row')))
      expect(rows).toEqual(['brief', 'paket_klein', 'keramik', 'pickup'])
      for (const cls of ['brief', 'paket_klein', 'keramik']) {
        await expect(table.locator(`[data-shipping-row="${cls}"] [data-money]`)).toHaveText(
          money(de(cls), locale),
        )
      }
      await expect(table.locator('[data-shipping-row="pickup"] [data-money]')).toHaveText(
        money(0, locale),
      )
      const texts = {
        de: {
          head: ['Versandklasse', 'Wofür', 'Preis', 'Versanddienst'],
          brief: ['Brief', 'Deutsche Post'],
          keramik: ['Keramik-Paket', 'DHL'],
          pickup: 'Abholung in Berlin',
          rule: 'zählt die höchste Versandklasse',
          time: 'Lieferzeit: 2–5 Werktage (bei Vorkasse ab Zahlungseingang)',
          area: 'Ich liefere nur innerhalb Deutschlands. Abholung in Berlin ist nach Absprache möglich. Ins Ausland liefere ich derzeit nicht.',
          stripe: ['Kredit- oder Debitkarte', 'Apple Pay', 'Google Pay', 'PayPal', 'Stripe'],
          prepayment: ['Vorkasse per Überweisung', 'Ende des 5. Kalendertags'],
          charge: 'Zahlungspflichtig bestellen',
          damage: 'Deine gesetzlichen Rechte bleiben davon unberührt.',
          returns: 'Die unmittelbaren Kosten der Rücksendung der Waren trägst du.',
        },
        en: {
          head: ['Shipping class', 'For', 'Price', 'Carrier'],
          brief: ['Letter', 'Deutsche Post'],
          keramik: ['Ceramics parcel', 'DHL'],
          pickup: 'Pickup in Berlin',
          rule: 'the highest shipping class in your basket applies',
          time: 'Delivery time: 2–5 working days (for payment in advance, from receipt of payment)',
          area: "I only deliver within Germany. Pickup in Berlin is possible by arrangement. I don't ship abroad at the moment.",
          stripe: ['Credit or debit card', 'Apple Pay', 'Google Pay', 'PayPal', 'Stripe'],
          prepayment: ['Payment in advance by bank transfer', 'end of the 5th calendar day'],
          charge: 'Order with obligation to pay',
          damage: 'Your statutory rights remain unaffected.',
          returns: 'You bear the direct costs of returning the goods.',
        },
      }[locale]
      expect(await table.locator('thead th').allInnerTexts()).toEqual(texts.head)
      for (const part of texts.brief)
        await expect(table.locator('[data-shipping-row="brief"]')).toContainText(part)
      for (const part of texts.keramik)
        await expect(table.locator('[data-shipping-row="keramik"]')).toContainText(part)
      await expect(table.locator('[data-shipping-row="pickup"] th')).toHaveText(texts.pickup)
      await expect(page.locator('[data-highest-class-rule]')).toContainText(texts.rule)

      // R-035: Lieferzeit aus den Einstellungen (E-31), Abholung mit eigenem Baustein.
      await expect(
        page.locator('[data-section="delivery-time"] [data-delivery-time="shipping"]'),
      ).toHaveText(texts.time)
      await expect(
        page.locator('[data-section="delivery-time"] [data-delivery-time="pickup"]'),
      ).toBeVisible()
      await expect(page.locator('[data-section="area"] [data-delivery-area]')).toHaveText(
        texts.area,
      )
      const stripe = page.locator('[data-payment-method="stripe"]')
      for (const part of texts.stripe) await expect(stripe).toContainText(part)
      const prepayment = page.locator('[data-payment-method="prepayment"]')
      for (const part of texts.prepayment) await expect(prepayment).toContainText(part)
      await expect(page.locator('[data-charge="stripe"]')).toContainText(texts.charge)
      await expect(page.locator('[data-transport-damage]')).toContainText(texts.damage)
      await expect(page.locator('[data-return-costs]')).toHaveText(texts.returns)
      await expect(page.locator('main [data-withdrawal-policy-link]')).toHaveAttribute(
        'href',
        localizedPath('R24', locale),
      )
      // Kein Zahlungs-Anbieter-Skript, keine Drittanbieter-Grafik.
      expect(await page.content()).not.toMatch(/js\.stripe\.com/)
    })

    test(`R-049 ${locale}: harmonisierte Mitteilung mit Grafik, Alt-Text und Link`, async ({
      page,
    }) => {
      await page.goto(R25[locale])
      await expectWarrantyNotice(page, locale)
    })

    test(`V-10 V-11 V-12 V-19 V-21 ${locale}: keine Verbotsmuster im sichtbaren Text und HTML`, async ({
      request,
    }) => {
      const html = await (await request.get(R25[locale])).text()
      const $ = cheerio.load(html)
      $('script, style, noscript, template').remove()
      const text = norm($('body').text())
      const hits = PATTERNS.flatMap(({ id, re }) =>
        [html, text].flatMap((s) => (re.test(s) ? [`${id}: ${s.match(re)?.[0]}`] : [])),
      )
      expect(hits).toEqual([])
      // Transportschaden-Hinweis nur mit „unberührt“ (V-11-Ausnahme).
      expect(text).toContain(locale === 'de' ? 'unberührt' : 'unaffected')
    })

    test(`T-11 R25 ${locale} axe @a11y`, async ({ page }) => {
      await page.goto(R25[locale])
      await page.waitForLoadState('networkidle')
      await expectNoSeriousViolations(page, R25[locale])
    })
  }
})

test.describe('R25 Versand & Zahlung – Einstellungen ändern', () => {
  test.describe.configure({ timeout: 180_000 })

  test('R-031 AK-3-10: neuer Klassenpreis in den Einstellungen erscheint auf R25 nach ≤ 60 s @slow', async ({
    request,
  }, testInfo) => {
    // Einstellungen sind global – einmal je Lauf (Projekt `desktop`), nicht dreimal parallel.
    test.skip(testInfo.project.name !== 'desktop', 'globale Einstellung – einmal je Lauf')
    const release = await holdShippingRates('exclusive')
    try {
      const original = await currentShippingRates()
      const brief = original.find((r) => r.zone === 'DE' && r.shippingClass === 'brief')
      expect(brief, 'Versandpreis Brief (DE) im Grund-Seed').toBeTruthy()
      const changed = brief!.priceCents + 30
      const priceOn = async (locale: 'de' | 'en') => {
        const html = await (await request.get(R25[locale])).text()
        return norm(cheerio.load(html)('[data-shipping-row="brief"] [data-money]').text())
      }
      const admin = await adminLogin()
      try {
        await adminCall(request, admin, 'post', '/globals/settings', {
          shipping: {
            rates: original.map((r) => (r === brief ? { ...r, priceCents: changed } : r)),
          },
        })
        for (const locale of LOCALES) {
          await expect
            .poll(() => priceOn(locale), { timeout: EDIT_MS, intervals: [250, 500, 1000] })
            .toBe(norm(money(changed, locale)))
        }
      } finally {
        await adminCall(request, admin, 'post', '/globals/settings', {
          shipping: { rates: original },
        })
        await expect
          .poll(() => priceOn('de'), { timeout: EDIT_MS, intervals: [250, 500, 1000] })
          .toBe(norm(money(brief!.priceCents, 'de')))
        await admin.release()
      }
    } finally {
      await release()
    }
  })
})
