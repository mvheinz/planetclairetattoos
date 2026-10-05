import { hasSamplePath, pageRoutes, samplePath } from '../../../src/lib/routes/paths'
import { LOCALES } from '../../../src/lib/routes/registry'
import { expect, test } from '../fixtures'

// P10.6 R-162 (Keine weiteren Datenerhebungen), R-137 (Formulare senden per POST, nichts in der URL):
// Crawl aller Seitentypen (Registry, DE/EN, inkl. 404/Fehlerseite) – ein `<form>` mit Text-/E-Mail-/Telefon-/Such-/
// Passwort-Eingabe oder Textfeld gibt es nur auf Kasse (R07), Auftragsarbeiten (R10) und Widerruf (R26).

const ALLOWED = new Set(['R07', 'R10', 'R26'])
/**
 * Einziges erlaubtes Eingabefeld außerhalb der drei Seiten: die Stücknummern-Suche der 404-Seite (`<form method="get">`,
 * Feld `nummer`, Ziel `/nr/<Nummer>`, R31). Sie erhebt keine Personendaten – eine Zahl, die schon der Katalog kennt.
 */
const NON_PERSONAL_FIELDS = ['nummer']
const TEXT_TYPES = ['text', 'email', 'tel', 'url', 'search', 'password', 'number', 'date']

/** Alle Formulare einer Seite mit Texteingaben: Beschreibung je Formular. */
async function textForms(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(
    ({ types, allowed }) => {
      const out: string[] = []
      for (const form of Array.from(document.querySelectorAll('form'))) {
        const fields = Array.from(form.querySelectorAll('input, textarea'))
        const text = fields.filter((el) => {
          if (el.tagName === 'TEXTAREA') return true
          const t = (el.getAttribute('type') ?? 'text').toLowerCase()
          return types.includes(t) && !el.hasAttribute('hidden') && !el.closest('[hidden]')
        })
        // Honeypot-Felder sind für Menschen unsichtbar (R-134) – sie sammeln nichts.
        const real = text.filter(
          (el) =>
            !/honey|website|hp_/i.test(el.getAttribute('name') ?? '') &&
            !allowed.includes(el.getAttribute('name') ?? ''),
        )
        if (real.length)
          out.push(
            `${form.getAttribute('method') ?? 'post'}: ${real.map((e) => e.getAttribute('name') ?? e.tagName).join(',')}`,
          )
      }
      return out
    },
    { types: TEXT_TYPES, allowed: NON_PERSONAL_FIELDS },
  )
}

test.describe('R-162 Formulare mit personenbezogenen Eingaben @privacy', () => {
  test('R-162 Crawl: Texteingaben in <form> nur auf Kasse, Widerruf und Auftragsarbeiten', async ({
    page,
  }) => {
    test.slow()
    const seen = new Map<string, string[]>()
    const routes = pageRoutes().filter((r) => r.status === 'live' && hasSamplePath(r))
    for (const route of routes) {
      for (const locale of LOCALES) {
        const path = samplePath(route.id, locale)
        await page.goto(path)
        await page.waitForLoadState('domcontentloaded')
        const forms = await textForms(page)
        seen.set(`${route.id} ${path}`, forms)
        if (!ALLOWED.has(route.id)) expect(forms, `${route.id} ${path}`).toEqual([])
        // R-137: Formulare mit Texteingaben senden nie per GET (sonst stünden Eingaben in der URL).
        for (const f of forms) expect(f.startsWith('get:'), `${path}: ${f}`).toBe(false)
      }
    }
    for (const path of ['/de/gibt-es-nicht', '/en/does-not-exist']) {
      await page.goto(path)
      expect(await textForms(page), path).toEqual([])
    }
    // Die beiden erlaubten, ohne Warenkorb erreichbaren Seiten zeigen ihr Formular tatsächlich (Crawl ist wirksam).
    for (const id of ['R10', 'R26']) {
      const hit = [...seen].find(([k]) => k.startsWith(`${id} `))
      expect(hit?.[1].length, id).toBeGreaterThan(0)
    }
  })

  test('R-162 keine Kontaktformulare, Newsletter, Kommentare, Bewertungen: Kontaktseite (R20) und Fußbereich ohne Texteingabe', async ({
    page,
  }) => {
    for (const path of ['/de/kontakt', '/en/contact', '/de', '/en']) {
      await page.goto(path)
      expect(
        await page.locator('footer input[type=text], footer input[type=email]').count(),
        path,
      ).toBe(0)
      expect(await page.locator('input[type=email]:visible').count(), path).toBe(0)
    }
  })
})
