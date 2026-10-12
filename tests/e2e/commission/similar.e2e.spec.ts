import { localizedPath } from '../../../src/lib/routes/paths'
import { adminPath, expect, test } from '../fixtures'
import { ANCHORS, openProduct } from '../shop/productPage'
import {
  COMMISSION_DE,
  COMMISSION_EN,
  fillRequired,
  inquiryByReference,
  openForm,
  removeInquiries,
  SUBMIT_TIMEOUT,
  submitAfterMinTime,
  TEST_EMAIL_DOMAIN,
  useFreshIp,
} from './commissionHelpers'

// P20.3 (V-20, V-11 a; U-93) – „Etwas Ähnliches anfragen“ bei einem verkauften Stück führt auf das Anfrageformular mit
// `?nach=<Nr.>`: Das Formular zeigt „So etwas wie Nr. 906 …“ mit Bild, wählt die Art des Stücks vor (S06 „Fliese …“ →
// Fliese) und schickt die öffentliche Nummer mit; die Verwaltung zeigt das Anlass-Stück. Unbekannte/ungültige Nummern
// werden still ignoriert; `?art=zeichnung` wählt „Zeichnung“ vor. Grundlage: Mini-Beispielbestand (S06 verkauft, Archiv).

let email = ''
test.beforeEach(async ({}, testInfo) => {
  email = `aehnlich-${testInfo.project.name}-${testInfo.workerIndex}@${TEST_EMAIL_DOMAIN}`
  await removeInquiries(email)
})
test.afterEach(async () => {
  await removeInquiries(email)
})

test('V-20 verkauftes Stück → „So etwas wie Nr. 906“ mit Bild und Vorauswahl → Anfrage mit Bezug, in der Verwaltung sichtbar', async ({
  page,
  request,
  adminPage,
}, testInfo) => {
  test.setTimeout(90_000)
  await useFreshIp(page)
  await openProduct(page, request, ANCHORS.S06.de)
  await page.locator('[data-buy-area] [data-ask-similar]').click()
  await expect(page).toHaveURL(new RegExp(`${COMMISSION_DE}\\?nach=906$`))
  const loadedAt = Date.now()
  const similar = page.locator('[data-commission-similar="906"]')
  await expect(similar).toContainText('So etwas wie Nr. 906: Fliese „Auftritt“')
  await expect(similar).toContainText('ich mache dir gern ein neues in der Art')
  await expect(similar.locator('img')).toHaveCount(1)
  await expect(page.locator('#anfrage-objectType')).toHaveValue('fliese')
  // der Bezug liegt im Formular (nur die öffentliche Nummer)
  await expect(page.locator('[data-commission-form] input[name="nach"]')).toHaveValue('906')

  await fillRequired(page, { email, objectType: 'fliese' })
  await submitAfterMinTime(page, loadedAt)
  const success = page.locator('[data-commission-success]')
  await expect(success).toBeVisible({ timeout: SUBMIT_TIMEOUT })
  const reference = (await success.getAttribute('data-reference'))!
  const inquiry = (await inquiryByReference(reference))!
  expect(inquiry.similarTo).toBe(906)
  expect(inquiry.objectType).toBe('fliese')

  if (testInfo.project.name !== 'desktop') return
  await adminPage.goto(adminPath(`/anfragen/${inquiry.id}`))
  const anlass = adminPage.getByTestId('inquiry-similar')
  await expect(anlass).toHaveText('Nr. 906 – Fliese „Auftritt“')
  await expect(anlass.locator('a')).toHaveAttribute('href', /\/stuecke\/\d+$/)
})

test('V-20 unbekannte oder ungültige Nummer → Formular wie ohne Parameter; EN-Text; ?art=zeichnung wählt vor', async ({
  page,
}) => {
  await useFreshIp(page)
  for (const query of ['?nach=99999', '?nach=abc', '?nach=0', '?art=gibts-nicht']) {
    await openForm(page, `${COMMISSION_DE}${query}`)
    await expect(page.locator('[data-commission-similar]'), query).toHaveCount(0)
    await expect(page.locator('[data-commission-form] input[name="nach"]'), query).toHaveCount(0)
    await expect(page.locator('#anfrage-objectType'), query).toHaveValue('')
  }
  await openForm(page, `${COMMISSION_EN}?nach=906`)
  await expect(page.locator('[data-commission-similar="906"]')).toContainText(
    'Something like No. 906:',
  )
  await expect(page.locator('#anfrage-objectType')).toHaveValue('fliese')
  await openForm(page, `${localizedPath('R10', 'de')}?art=zeichnung`)
  await expect(page.locator('#anfrage-objectType')).toHaveValue('zeichnung')
  await expect(page.locator('[data-commission-similar]')).toHaveCount(0)
})
