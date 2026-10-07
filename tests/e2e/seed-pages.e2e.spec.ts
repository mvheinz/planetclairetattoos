import { expect, test } from './fixtures'

// P8.7 – Seiten des Beispielbestands (SEED-SPEC §13): jede gebaute Route mit Seiteninhalt zeigt die Texte aus
// `pages.json` auf Deutsch und Englisch (`/en/…` zeigt die EN-Texte). „Über mich“ (R19, P8.18) und die Textblöcke von
// Danke-, Status-, Widerrufs- und 404-Seite binden spätere Aufgaben ein. Voraussetzung: `db:reset --test --seed=all`.

const PAGES: { de: string; en: string; textDe: string; textEn: string }[] = [
  {
    de: '/de',
    en: '/en',
    textDe: 'Ein kleiner Planet, auf dem alles nur einmal vorkommt',
    textEn: 'A small planet where everything happens only once',
  },
  { de: '/de/kontakt', en: '/en/contact', textDe: 'Schreib mir', textEn: 'Write to me' },
  {
    de: '/de/auftragsarbeiten',
    en: '/en/commissions',
    textDe: 'Ich antworte per Mail mit Preis und ungefährer Dauer.',
    textEn: 'I answer by email with a price and a rough timeframe.',
  },
  {
    de: '/de/tattoo',
    en: '/en/tattoo',
    textDe: 'Eine feine Linie, die zittern darf.',
    textEn: 'A fine line that is allowed to tremble.',
  },
  {
    de: '/de/tattoo/aftercare',
    en: '/en/tattoo/aftercare',
    textDe: 'Pflege in Phasen',
    textEn: 'Care, phase by phase',
  },
  {
    de: '/de/konformitaetserklaerungen',
    en: '/en/declarations-of-conformity',
    textDe: 'ein Deko-Stück – nicht für Lebensmittel',
    textEn: 'decorative – not for food',
  },
]

for (const p of PAGES) {
  test(`Seed-Seite ${p.de} und ${p.en} zeigen die Texte der jeweiligen Sprache`, async ({
    page,
  }) => {
    const de = await page.goto(p.de)
    expect(de?.status()).toBe(200)
    await expect(page.locator('main')).toContainText(p.textDe)
    const en = await page.goto(p.en)
    expect(en?.status()).toBe(200)
    await expect(page.locator('main')).toContainText(p.textEn)
    await expect(page.locator('main')).not.toContainText(p.textDe)
  })
}
