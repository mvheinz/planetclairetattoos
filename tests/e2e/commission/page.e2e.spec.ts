import { expectNoSeriousViolations } from '../axe'
import { localizedPath } from '../../../src/lib/routes/paths'
import { expect, test, testPayload } from '../fixtures'
import { removeMedia, uploadImage } from '../tattoo/tattooFixtures'

// P7.10 – R10 Auftragsarbeiten (KONZEPT §3.10, DATENMODELL §6.19, DESIGN §9.7 `frame`): mit einer Fixture-Seite
// `commissions` (gleichartig zu SEED-SPEC §13.4: Ablauf, 3 Beispielbilder mit Bildunterschrift, Hinweis, Formular-Block,
// FAQ) DE/EN → 200, genau eine `h1`, ohne JavaScript lesbar, axe ohne `serious`/`critical`; ohne Seite → 200 mit
// Leerzustand (Hinweis, Formular, Kontaktalternative, DM-PAGE-01). Kein Kauf-Knopf, kein Preisschild (E-11). Mit dem
// echten Anker (Seed P8.7) prüft P8.21.

test.describe.configure({ mode: 'serial' })

const DE = localizedPath('R10', 'de')
const EN = localizedPath('R10', 'en')
let images: { id: number; filename: string }[] = []
let created: number[] = []
let existing: number[] = []

const p = (text: string) => ({
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

async function commissionPages(): Promise<number[]> {
  const payload = await testPayload()
  const res = await payload.find({
    collection: 'pages',
    where: { key: { equals: 'commissions' } },
    overrideAccess: true,
    depth: 0,
  })
  return res.docs.map((d) => d.id as number)
}

async function removeCreated() {
  const payload = await testPayload()
  for (const id of created) {
    await payload.delete({ collection: 'pages', id, overrideAccess: true }).catch(() => null)
  }
  created = []
}

test.beforeAll(async () => {
  existing = await commissionPages()
})

test.afterAll(async () => {
  await removeCreated()
  await removeMedia(images.map((i) => i.id))
})

async function expectBase(page: import('@playwright/test').Page, locale: 'de' | 'en') {
  await expect(page.locator('h1')).toHaveCount(1)
  await expect(page.locator('h1')).toHaveText(locale === 'de' ? 'Auftragsarbeiten' : 'Commissions')
  await expect(page.locator('[data-commission-notice]')).toContainText(
    locale === 'de' ? 'bezahlt wird nicht hier im Shop' : "payment doesn't go through this shop",
  )
  await expect(page.locator('[data-commission-notice]')).toContainText(
    locale === 'de' ? 'kein Online-Vertrag' : 'no online contract',
  )
  await expect(page.locator('[data-commission-form-block]')).toBeVisible()
  await expect(page.locator('[data-commission-contact]')).toBeVisible()
  // kein Kauf-Knopf, kein Preisschild
  await expect(page.locator('[data-price-tag], [data-behavior~="add-to-cart"]')).toHaveCount(0)
  await expect(page.getByRole('button', { name: /In den Korb|Add to (cart|basket)/i })).toHaveCount(
    0,
  )
}

test('DM-PAGE-01 ohne Seite `commissions`: 200 mit Leerzustand (H1, Hinweis, Formular, Kontaktalternative)', async ({
  page,
}) => {
  // Liegt schon eine Seite in der Test-DB (ab Seed P8.7), wird sie für diesen Test vorübergehend unveröffentlicht.
  const payload = await testPayload()
  const setStatus = (status: 'draft' | 'published') =>
    Promise.all(
      existing.map((id) =>
        payload.update({
          collection: 'pages',
          id,
          data: { _status: status } as never,
          overrideAccess: true,
          context: { seed: true },
        }),
      ),
    )
  await setStatus('draft')
  try {
    await checkEmptyState(page)
  } finally {
    await setStatus('published')
  }
})

async function checkEmptyState(page: import('@playwright/test').Page) {
  for (const [url, locale] of [
    [DE, 'de'],
    [EN, 'en'],
  ] as const) {
    const res = await page.goto(url)
    expect(res?.status()).toBe(200)
    await expectBase(page, locale)
    // Ablauf aus den Rückfalltexten, keine Beispiele ohne Seite
    await expect(page.locator('[data-commission-steps] li')).toHaveCount(4)
    await expect(page.locator('[data-commission-examples]')).toHaveCount(0)
  }
}

test('@a11y R10 mit Fixture-Seite DE/EN: 200, eine h1, Ablauf, Beispiele mit Bildunterschrift, FAQ-Block, axe', async ({
  page,
}) => {
  const payload = await testPayload()
  images = []
  for (const alt of ['Cap mit Dackel', 'Teller mit Hase', 'Fliese mit Sternen']) {
    images.push(await uploadImage(alt))
  }
  // vorhandene Seed-Seite vorübergehend nicht anfassen: Fixture nur, wenn keine Seite existiert
  if (existing.length === 0) {
    const doc = await payload.create({
      collection: 'pages',
      data: {
        key: 'commissions',
        title: 'Auftragsarbeiten',
        _status: 'published',
        seed: true,
        layout: [
          { blockType: 'richText', content: p('Ich male auf fast alles, was stillhält.') },
          {
            blockType: 'processSteps',
            heading: 'So läuft’s',
            steps: [
              { title: 'Anfrage', text: 'Schick mir über das Formular, was du dir wünschst.' },
              { title: 'Angebot', text: 'Ich antworte per Mail mit Preis und Dauer.' },
              { title: 'Bezahlung', text: 'Passt alles, überweist du außerhalb des Shops.' },
              { title: 'Anfertigung', text: 'Ich male, schicke dir ein Foto, dann geht’s los.' },
            ],
          },
          {
            blockType: 'imageGallery',
            images: images.map((i) => i.id),
            caption: 'Solche Sachen mache ich – deins wird anders.',
          },
          {
            blockType: 'callout',
            text: 'Fremde Figuren aus Comics, Filmen oder von Marken male ich nicht.',
          },
          {
            blockType: 'commissionForm',
            heading: 'Deine Idee',
            intro: 'Erzähl mir, was du dir vorstellst.',
            successText: 'Danke! Ich melde mich per Mail.',
          },
          { blockType: 'faqList', category: 'commissions' },
        ],
      } as never,
      overrideAccess: true,
      context: { seed: true },
    })
    created.push(doc.id as number)
  }

  for (const [url, locale] of [
    [DE, 'de'],
    [EN, 'en'],
  ] as const) {
    const res = await page.goto(url)
    expect(res?.status()).toBe(200)
    await expectBase(page, locale)
    await expect(page.locator('[data-commission-steps] li')).toHaveCount(4)
    if (existing.length === 0) {
      await expect(page.locator('[data-commission-examples] img')).toHaveCount(3)
      await expect(page.locator('[data-commission-examples] figcaption')).toContainText(
        'Solche Sachen mache ich',
      )
      await expect(page.locator('#commission-form-title')).toHaveText('Deine Idee')
    }
    // Preset `frame`: Coco-Anker an der Formular-Überschrift, Kontur um das Formular
    await expect(page.locator('body')).toHaveAttribute('data-preset', 'frame')
    await expect(page.locator('[data-leash-station="commission-form"]')).toHaveAttribute(
      'data-leash-loop',
      'contour',
    )
    await expectNoSeriousViolations(page, `R10 ${locale}`)
  }
})

test('R10 ohne JavaScript lesbar: H1, Ablauf, Formular mit Hinweis „Bilder nur mit JavaScript“', async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false })
  const page = await context.newPage()
  try {
    const res = await page.goto(DE)
    expect(res?.status()).toBe(200)
    await expect(page.locator('h1')).toHaveText('Auftragsarbeiten')
    await expect(page.locator('[data-commission-steps]')).toBeVisible()
    await expect(page.locator('[data-commission-form]')).toBeVisible()
    await expect(page.locator('[data-commission-nojs]')).toContainText('Bilder nur mit JavaScript')
    await expect(page.locator('input[type="file"]')).toHaveCount(0)
  } finally {
    await context.close()
  }
})
