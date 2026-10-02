import { sql } from '@payloadcms/db-postgres'
import type { Browser, Page } from '@playwright/test'

import { localizedPath } from '../../../src/lib/routes/paths'
import { createOrder, dbOf, orderData } from '../../int/helpers/commerce'
import { expectNoSeriousViolations } from '../axe'
import { cleanupCheckouts } from '../checkout/checkoutHelpers'
import { expect, test, testPayload } from '../fixtures'
import { PUBLISHED } from '../shop/productPage'

// P6.8 – Widerrufsfunktion R26 (KONZEPT §3.16, R-091 bis R-093, R-137, R-138, § 356a BGB): Schritt 1, Auswahl der
// Stücke, Schritt 2 mit „Widerruf bestätigen“, Bestätigungsseite. Mit und ohne JavaScript, per Tastatur, axe.
// Jede Prüfung nutzt eine eigene E-Mail-Adresse und räumt ihre Widerrufe danach weg.

const R26 = localizedPath('R26', 'de')
const CONFIRM = 'Widerruf bestätigen'

const used: string[] = []
const emailFor = (tag: string) => {
  const e = `e2e-widerruf-${tag}-${Date.now()}-${Math.round(Math.random() * 1e6)}@example.com`
  used.push(e)
  return e
}

async function withdrawalsOf(email: string) {
  const payload = await testPayload()
  const res = await payload.find({
    collection: 'withdrawals',
    where: { email: { equals: email } },
    overrideAccess: true,
    depth: 0,
  })
  return res.docs
}

test.afterEach(async () => {
  const db = dbOf(await testPayload())
  for (const email of used.splice(0)) {
    const ids = sql`(SELECT id FROM withdrawals WHERE email = ${email})`
    await db.execute(sql`DELETE FROM email_log WHERE withdrawal_id IN ${ids}`)
    await db.execute(sql`DELETE FROM withdrawals WHERE email = ${email}`)
  }
})

async function fillStep1(page: Page, values: { name: string; contract: string; email: string }) {
  await page.locator('[name="name"]').fill(values.name)
  await page.locator('[name="contractIdentification"]').fill(values.contract)
  await page.locator('[name="email"]').fill(values.email)
}

const next = (page: Page) => page.getByRole('button', { name: 'Weiter', exact: true })
const confirmButton = (page: Page) => page.getByRole('button', { name: CONFIRM, exact: true })

test.describe('Widerrufsfunktion R26', () => {
  test('R-091 unbekannte Bestellnummer, leerer Grund: Absenden funktioniert; kein CAPTCHA; Datenschutz-Link (R-138) @a11y', async ({
    page,
  }) => {
    const email = emailFor('unbekannt')
    await page.goto(R26)
    const html = (await page.content()).toLowerCase()
    for (const word of ['captcha', 'recaptcha', 'hcaptcha', 'turnstile']) {
      expect(html, word).not.toContain(word)
    }
    await expect(page.locator('main input[type="checkbox"]:checked')).toHaveCount(0)
    await expect(page.locator('[data-withdraw-privacy] a')).toHaveAttribute(
      'href',
      `${localizedPath('R22', 'de')}#widerruf`,
    )
    await expectNoSeriousViolations(page, 'R26 Schritt 1')

    // Pflichtfelder leer → Fehler am Feld und in der Zusammenfassung, kein Datensatz
    await next(page).click()
    await expect(page.locator('[data-error-summary]')).toBeVisible()
    await expect(page.locator('#widerruf-name')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.locator('#widerruf-reason')).not.toHaveAttribute('aria-invalid', 'true')

    await fillStep1(page, { name: 'Erika Beispiel', contract: 'PC-2026-99999, Schale', email })
    await next(page).click()
    await expect(confirmButton(page)).toBeVisible()
    await expectNoSeriousViolations(page, 'R26 Schritt 2')
    expect(await withdrawalsOf(email)).toHaveLength(0)
    await confirmButton(page).click()
    await expect(page.locator('[data-withdraw-reference]')).toHaveText(/^WR-\d{4}-\d{5}$/)
    const docs = await withdrawalsOf(email)
    expect(docs).toHaveLength(1)
    expect(docs[0]!.matchStatus).toBe('needs_manual_match')
    expect(docs[0]!.reason ?? null).toBeNull()
  })

  test('R-092 vor Schritt 2 kein Datensatz, nach dem Klick genau einer; „Ändern“ behält die Eingaben', async ({
    page,
  }) => {
    const email = emailFor('zwei')
    await page.goto(R26)
    await fillStep1(page, {
      name: 'Erika Beispiel',
      contract: 'Bestellung vom 12.10., Schale',
      email,
    })
    await page.locator('[name="reason"]').fill('Gefällt mir doch nicht.')
    await next(page).click()
    await expect(page.locator('[data-withdraw-summary]')).toContainText('Gefällt mir doch nicht.')
    expect(await withdrawalsOf(email)).toHaveLength(0)

    await page.getByRole('button', { name: 'Ändern', exact: true }).click()
    await expect(page.locator('[name="name"]')).toHaveValue('Erika Beispiel')
    await expect(page.locator('[name="email"]')).toHaveValue(email)
    await expect(page.locator('[name="reason"]')).toHaveValue('Gefällt mir doch nicht.')
    expect(await withdrawalsOf(email)).toHaveLength(0)

    await next(page).click()
    await confirmButton(page).click()
    await expect(page.locator('[data-withdraw-reference]')).toBeVisible()
    expect(await withdrawalsOf(email)).toHaveLength(1)
  })

  test('R-093 Bestätigungsseite zeigt alle Angaben, Eingang, Vorgangsnummer und Mail-Hinweis; Auswahl der Stücke ohne Haken', async ({
    page,
    fixtureProducts,
  }) => {
    const payload = await testPayload()
    const email = emailFor('auswahl')
    const a = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 4500 })
    const b = await fixtureProducts.create('keramik', { ...PUBLISHED, priceCents: 3200 })
    try {
      const order = await createOrder(
        payload,
        orderData(
          a.itemNumber,
          [
            { id: a.id, itemNumber: a.itemNumber, priceCents: 4500 },
            { id: b.id, itemNumber: b.itemNumber, priceCents: 3200 },
          ],
          { customer: { name: 'Erika Beispiel', email }, seed: true },
        ),
      )
      // Vorbelegung nur der Bestellnummer über ?order=
      await page.goto(`${R26}?order=${order.orderNumber}`)
      await expect(page.locator('[name="contractIdentification"]')).toHaveValue(
        String(order.orderNumber),
      )
      await page.locator('[name="name"]').fill('Erika Beispiel')
      await page.locator('[name="email"]').fill(email.toUpperCase())
      await next(page).click()

      const boxes = page.locator('main input[type="checkbox"]')
      await expect(boxes).toHaveCount(2)
      await expect(page.locator('main input[type="checkbox"]:checked')).toHaveCount(0)
      await expect(page.locator('[data-withdraw-whole]')).toBeVisible()
      await expectNoSeriousViolations(page, 'R26 Auswahl')
      await page.locator('main label', { hasText: String(b.itemNumber) }).click()
      await next(page).click()

      await expect(page.locator('[data-withdraw-summary]')).toContainText(String(b.itemNumber))
      await confirmButton(page).click()

      const receipt = page.locator('[data-withdraw-receipt]')
      await expect(page.locator('[data-withdraw-reference]')).toHaveText(/^WR-\d{4}-\d{5}$/)
      await expect(page.locator('[data-withdraw-received-at]')).toHaveText(
        /^\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2} Uhr \((MEZ|MESZ)\)$/,
      )
      await expect(receipt).toContainText('Erika Beispiel')
      await expect(receipt).toContainText(String(order.orderNumber))
      await expect(receipt).toContainText(email.toUpperCase())
      await expect(receipt).toContainText(String(b.itemNumber))
      await expect(page.locator('[data-withdraw-mail-note]')).toHaveText(
        'Eine Bestätigung ist per E-Mail unterwegs.',
      )
      await expectNoSeriousViolations(page, 'R26 Bestätigung')
      const docs = await withdrawalsOf(email.toUpperCase())
      expect(docs).toHaveLength(1)
      expect(docs[0]!.matchStatus).toBe('auto_matched')
    } finally {
      await cleanupCheckouts([a.id, b.id])
    }
  })

  test('R-137 Widerruf: nach dem Absenden enthält die URL keine Eingaben', async ({ page }) => {
    const email = emailFor('url')
    await page.goto(`${R26}?order=PC-2026-99998`)
    await page.locator('[name="name"]').fill('Erika Urlprobe')
    await page.locator('[name="email"]').fill(email)
    await next(page).click()
    await confirmButton(page).click()
    await expect(page.locator('[data-withdraw-reference]')).toBeVisible()
    const url = decodeURIComponent(page.url())
    expect(url).not.toContain('Urlprobe')
    expect(url).not.toContain(email)
    expect(url).not.toContain('PC-2026-99998')
    expect(new URL(page.url()).pathname).toBe(R26)
  })

  test('R-138 Widerruf: Datenschutz-Link am Formular führt auf den Abschnitt', async ({ page }) => {
    await page.goto(R26)
    const link = page.locator('[data-withdraw-privacy] a')
    await expect(link).toBeVisible()
    await link.click()
    await expect(page).toHaveURL(new RegExp(`${localizedPath('R22', 'de')}#widerruf$`))
  })

  test('R-091 R-092 Ablauf komplett per Tastatur', async ({ page }) => {
    const email = emailFor('tastatur')
    await page.goto(R26)
    await page.locator('[name="name"]').focus()
    await page.keyboard.type('Erika Tastatur')
    await page.keyboard.press('Tab')
    await page.keyboard.type('Bestellung vom 1.10., Becher')
    await page.keyboard.press('Tab')
    await page.keyboard.type(email)
    // weiter bis „Weiter“ (Honeypot ist nicht per Tab erreichbar)
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press('Tab')
      const active = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '')
      expect(
        await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.name),
      ).not.toBe('website')
      if (active === 'Weiter') break
    }
    await page.keyboard.press('Enter')
    await expect(confirmButton(page)).toBeVisible()
    await confirmButton(page).focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('[data-withdraw-reference]')).toBeVisible()
    expect(await withdrawalsOf(email)).toHaveLength(1)
  })
})

test.describe('Widerrufsfunktion R26 ohne JavaScript', () => {
  async function noJs(browser: Browser) {
    const context = await browser.newContext({ javaScriptEnabled: false })
    return { context, page: await context.newPage() }
  }

  test('R-091 R-092 R-093 Ablauf mit javaScriptEnabled: false', async ({ browser }) => {
    const email = emailFor('nojs')
    const { context, page } = await noJs(browser)
    try {
      await page.goto(R26)
      await fillStep1(page, { name: 'Erika OhneJS', contract: 'Bestellung vom 2.10.', email })
      await next(page).click()
      await expect(confirmButton(page)).toBeVisible()
      await expect(page.locator('[data-withdraw-summary]')).toContainText('Erika OhneJS')
      expect(await withdrawalsOf(email)).toHaveLength(0)
      await confirmButton(page).click()
      await expect(page.locator('[data-withdraw-reference]')).toHaveText(/^WR-\d{4}-\d{5}$/)
      expect(await withdrawalsOf(email)).toHaveLength(1)
      expect(decodeURIComponent(page.url())).not.toContain(email)
    } finally {
      await context.close()
    }
  })
})
