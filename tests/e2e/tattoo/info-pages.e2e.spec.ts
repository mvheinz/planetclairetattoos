import { expect, test, testPayload } from '../fixtures'
import { refreshTattoo } from './tattooFixtures'

// P7.4 – R14 Preise, R16 Ablauf, R17 Aftercare, R18 FAQ (KONZEPT §9.2, §9.6): Gesamtpreise mit Sternchen und
// Kleinunternehmer-Hinweis (R-034), keine Verfall-/Nicht-Erstattungs-Klausel bei der Anzahlung (V-24), Druckansicht
// von R17 ohne Navigation bei vollständigem Text, FAQ als `<details>` per Tastatur auf- und zuklappbar. FAQ-Einträge
// sind Fixtures (`seed = true`, Kategorie `tattoo`); Preise kommen aus dem Grund-Seed der Einstellungen.

const QUESTIONS = [
  'Ab wie vielen Jahren tätowierst du? (Test)',
  'Ist Coco beim Tätowieren dabei? (Test)',
]

test.describe.configure({ mode: 'serial' })

const lexical = (text: string) => ({
  root: {
    type: 'root',
    format: '',
    indent: 0,
    version: 1,
    direction: 'ltr',
    children: [
      {
        type: 'paragraph',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        textFormat: 0,
        children: [
          { type: 'text', text, format: 0, detail: 0, mode: 'normal', style: '', version: 1 },
        ],
      },
    ],
  },
})

async function removeFaqs() {
  const payload = await testPayload()
  await payload.delete({
    collection: 'faqs',
    where: { question: { in: QUESTIONS } },
    overrideAccess: true,
    context: { seed: true },
  })
}

test.beforeAll(async ({ request }) => {
  await removeFaqs()
  const payload = await testPayload()
  await payload.create({
    collection: 'faqs',
    data: {
      question: QUESTIONS[0],
      answer: lexical('Erst ab 18 – bitte bring deinen Ausweis mit.'),
      category: 'tattoo',
      sortOrder: 10,
      published: true,
      seed: true,
    } as never,
    overrideAccess: true,
    context: { seed: true },
  })
  await payload.create({
    collection: 'faqs',
    data: {
      question: QUESTIONS[1],
      answer: lexical('Meistens schläft Coco nebenan. Sag Bescheid, wenn dich ein Hund stört.'),
      category: 'tattoo',
      sortOrder: 20,
      published: true,
      seed: true,
    } as never,
    overrideAccess: true,
    context: { seed: true },
  })
  await refreshTattoo(request)
})

test.afterAll(async ({ request }) => {
  await removeFaqs()
  await refreshTattoo(request)
})

test('R-034 V-24 alle Tattoo-Preise als Gesamtpreise mit Sternchen und KU-Hinweis; Anzahlung ohne Verfallsklausel', async ({
  page,
}) => {
  const payload = await testPayload()
  const settings = (await payload.findGlobal({ slug: 'settings', overrideAccess: true })) as {
    tattoo?: { minPriceCents?: number | null }
  }
  for (const url of ['/de/tattoo/preise', '/en/tattoo/prices']) {
    await page.goto(url)
    const main = page.locator('main')
    if (settings.tattoo?.minPriceCents) {
      await expect(page.locator('[data-price-min]')).toHaveText(/(\d+\s€|€\d+)\*$/)
    }
    await expect(page.locator('[data-price-custom]')).toBeVisible()
    const note = page.locator('#tattoo-price-footnote')
    await expect(note).toHaveCount(1)
    await expect(note).toContainText(url.startsWith('/de') ? 'Gesamtpreis' : 'Total price')
    await expect(note).toContainText(/§ 19|Section 19/)
    // Jeder Preis im Text trägt das Sternchen (Betrag „80 €“ ohne „*“ wäre ein Fehler).
    const text = (await main.innerText()).replace(/\s+/g, ' ')
    // DE „80 €*“, EN „€80*“; im Preisrahmen trägt der letzte Betrag das Sternchen („150 €–400 €*“).
    const amounts = [...text.matchAll(/(?:€\d+(?:[.,]\d{2})?|\d+(?:[.,]\d{2})?\s€)(\*|–)?/g)]
    expect(amounts.length, `Preise auf ${url}`).toBeGreaterThan(0)
    expect(
      amounts.filter((m) => !m[1]).map((m) => m[0]),
      `Preise ohne Sternchen auf ${url}`,
    ).toEqual([])
    expect(text).not.toMatch(/nicht erstattbar|verfällt|verfallen|non-refundable|forfeit/i)
    await expect(page.locator('[data-price-deposit]')).toContainText(
      url.startsWith('/de') ? 'persönlich' : 'personally',
    )
    await expect(main.locator('form, input, [data-add-to-cart]')).toHaveCount(0)
    // Kontakt-Block mit Betreff „eigene Idee“.
    await expect(page.locator('[data-tattoo-contact] [data-tattoo-mail]')).toHaveAttribute(
      'href',
      url.startsWith('/de')
        ? /subject=Tattoo-Anfrage%20%E2%80%93%20eigene%20Idee&/
        : /subject=Tattoo%20request%20%E2%80%93%20custom%20idea&/,
    )
  }
})

test('R-034 R16 Ablauf: fünf Schritte, „Tattoos erst ab 18“, Ort nur als Bezirk', async ({
  page,
}) => {
  await page.goto('/de/tattoo/ablauf')
  await expect(page.locator('[data-tattoo-step]')).toHaveCount(5)
  await expect(page.locator('[data-tattoo-age]')).toHaveText('Tattoos erst ab 18.')
  await expect(page.locator('[data-tattoo-place]')).toContainText('Privatstudio in Berlin')
  const payload = await testPayload()
  const street = (
    (await payload.findGlobal({ slug: 'settings', overrideAccess: true })) as {
      business?: { street?: string }
    }
  ).business?.street
  if (street) await expect(page.locator('body')).not.toContainText(street)
})

test('R-034 R17 Druckansicht ohne Navigation, Text vollständig', async ({ page }) => {
  await page.goto('/de/tattoo/aftercare')
  const content = page.locator('[data-tattoo-aftercare]')
  await expect(content).toBeVisible()
  const screenText = (await content.innerText()).replace(/\s+/g, ' ').trim()
  // Warnzeichen: Callout der Seite (Beispielbestand „Wann zur Ärztin oder zum Arzt?“) bzw. Rückfall „Warnzeichen – …“
  expect(screenText).toMatch(/Warnzeichen|Wann zur Ärztin/)
  const safer = content.locator('a[href^="https://"]').first()
  await expect(safer).toHaveAttribute('rel', 'noopener noreferrer')

  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('[data-site-header]')).toBeHidden()
  await expect(page.locator('[data-site-footer]')).toBeHidden()
  await expect(page.locator('[data-tattoo-subnav]')).toBeHidden()
  await expect(page.locator('[data-tattoo-contact]')).toBeHidden()
  for (const el of await page.locator('[data-leash-layer], .coco').all())
    await expect(el).toBeHidden()
  await expect(page.locator('h1')).toBeVisible()
  await expect(content).toBeVisible()
  const printText = (await content.innerText()).replace(/\s+/g, ' ').trim()
  // Vollständig: jeder Satz der Bildschirmansicht steht auch im Druck (dort ggf. mit ausgeschriebener Link-Adresse).
  for (const sentence of screenText.split(/(?<=[.!?])\s+/)) expect(printText).toContain(sentence)
})

test('R-034 R18 FAQ per Tastatur auf- und zuklappbar (ohne JavaScript bedienbar)', async ({
  page,
  browser,
}) => {
  await page.goto('/de/tattoo/faq')
  const first = page.locator('[data-tattoo-faq] details').filter({ hasText: QUESTIONS[0]! })
  await expect(first).toHaveCount(1)
  const summary = first.locator('summary')
  await summary.focus()
  await expect(first).not.toHaveAttribute('open', '')
  await page.keyboard.press('Enter')
  await expect(first).toHaveAttribute('open', '')
  await expect(first).toContainText('Erst ab 18')
  await page.keyboard.press('Enter')
  await expect(first).not.toHaveAttribute('open', '')
  await page.keyboard.press('Space')
  await expect(first).toHaveAttribute('open', '')
  // Reihenfolge nach `sortOrder`.
  const questions = await page.locator('[data-tattoo-faq] summary').allInnerTexts()
  expect(questions.indexOf(QUESTIONS[0]!)).toBeLessThan(questions.indexOf(QUESTIONS[1]!))

  const context = await browser.newContext({ javaScriptEnabled: false })
  try {
    const noJs = await context.newPage()
    await noJs.goto('/de/tattoo/faq')
    const d = noJs.locator('[data-tattoo-faq] details').filter({ hasText: QUESTIONS[1]! })
    await d.locator('summary').focus()
    await noJs.keyboard.press('Enter')
    await expect(d).toHaveAttribute('open', '')
  } finally {
    await context.close()
  }
})
