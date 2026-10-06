import type { Locale } from '../../../src/lib/enums'
import { expect, test, testPayload } from '../fixtures'
import { PUBLISHED, openProduct, pathOf } from '../shop/productPage'

// P3.9 Block „Herstellerin & Sicherheit“ (RECHT ANFORDERUNGEN R-040, KONZEPT §3.4 Nr. 9, AK-3-06): je Kategorie ein
// Seed-Stück (P1.30; `sonstiges` als Fixture analog S30), DE und EN – der Block ist ohne Interaktion sichtbar (kein
// `<details>`, kein Tab) und enthält Name, Straße, E-Mail, „Nr. …“ („No. …“) und den Warntext; auf `/en/…` steht der deutsche
// Warntext zusätzlich zum englischen.

const SEED_BY_CATEGORY = [
  { category: 'keramik', nr: 901 },
  { category: 'textil', nr: 911 },
  { category: 'cap', nr: 915 },
  { category: 'zeichnung', nr: 920 },
  { category: 'schmuck', nr: 926 },
] as const

interface Business {
  legalName: string
  street: string
  email: string
}

async function business(): Promise<Business> {
  const payload = await testPayload()
  const s = (await payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true })) as {
    business: Business
  }
  return s.business
}

/** Erster Absatz von `safetyWarnings` in beiden Sprachen (ohne Rückfall). */
async function firstWarning(itemNumber: number): Promise<Record<Locale, string>> {
  const payload = await testPayload()
  const out = {} as Record<Locale, string>
  for (const locale of ['de', 'en'] as const) {
    const doc = (
      await payload.find({
        collection: 'products',
        where: { itemNumber: { equals: itemNumber } },
        locale,
        fallbackLocale: false,
        overrideAccess: true,
        limit: 1,
      })
    ).docs[0]!
    out[locale] = String(doc.safetyWarnings ?? '')
      .split(/\n\s*\n/)[0]!
      .trim()
  }
  return out
}

async function expectSafetyBlock(
  page: import('@playwright/test').Page,
  locale: Locale,
  nr: number,
  warning: Record<Locale, string>,
) {
  const b = await business()
  const block = page.locator('[data-product-safety]')
  await expect(block).toBeVisible()
  // Ohne Interaktion: nicht in `<details>`, nicht verborgen, keine Tab-Rolle.
  expect(await block.evaluate((el) => !!el.closest('details, [role="tabpanel"], [hidden]'))).toBe(
    false,
  )
  await expect(block.locator('h2')).toHaveText(
    locale === 'de' ? 'Herstellerin & Sicherheit' : 'Maker & safety',
  )
  await expect(block.locator('[data-safety="maker"] dd')).toContainText(b.legalName)
  await expect(block.locator('[data-safety="address"] dd')).toContainText(b.street)
  await expect(block.locator('[data-safety="email"] dd')).toHaveText(b.email)
  await expect(block.locator('[data-safety="id"] dd')).toHaveText(
    `${locale === 'de' ? 'Nr.' : 'No.'} ${nr}`,
  )
  await expect(block.locator('[data-safety="type"] dd')).not.toBeEmpty()
  const de = block.locator('[data-warnings-lang="de"]')
  await expect(de).toBeVisible()
  await expect(de).toContainText(warning.de)
  if (locale === 'en') {
    await expect(de).toHaveAttribute('lang', 'de')
    // Ohne eigene EN-Fassung steht nur der deutsche Text (kein doppelter Rückfall).
    if (warning.en)
      await expect(block.locator('[data-warnings-lang="en"]')).toContainText(warning.en)
    else await expect(block.locator('[data-warnings-lang="en"]')).toHaveCount(0)
  } else {
    await expect(block.locator('[data-warnings-lang="en"]')).toHaveCount(0)
  }
}

test.describe('R-040 AK-3-06 Herstellerin & Sicherheit (GPSR)', () => {
  for (const { category, nr } of SEED_BY_CATEGORY) {
    for (const locale of ['de', 'en'] as const) {
      test(`R-040 ${category} (Nr. ${nr}) /${locale}: Block ohne Interaktion mit Name, Straße, E-Mail, Nr. und Warntext`, async ({
        page,
        request,
      }) => {
        const warning = await firstWarning(nr)
        expect(warning.de).not.toBe('')
        expect(warning.en).not.toBe('')
        await openProduct(page, request, await pathOf(nr, locale))
        await expectSafetyBlock(page, locale, nr, warning)
      })
    }
  }

  test('R-040 schmuck: Kleinteile-Warntext im Block (DE und EN)', async ({ page, request }) => {
    await openProduct(page, request, await pathOf(926, 'en'))
    const block = page.locator('[data-product-safety]')
    await expect(block.locator('[data-warnings-lang="de"]')).toContainText(
      'Nicht für Kinder unter 3 Jahren',
    )
    await expect(block.locator('[data-warnings-lang="en"]')).toContainText('children under 3')
  })

  test('R-040 sonstiges (Fixture analog S30, nur Abholung) /de und /en', async ({
    page,
    request,
    fixtureProducts,
  }) => {
    const { itemNumber } = await fixtureProducts.create('sonstiges', {
      ...PUBLISHED,
      shippingClass: 'nur_abholung',
    })
    const warning = await firstWarning(itemNumber)
    for (const locale of ['de', 'en'] as const) {
      await openProduct(page, request, await pathOf(itemNumber, locale))
      await expectSafetyBlock(page, locale, itemNumber, warning)
    }
  })
})
