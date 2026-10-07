// Liste der Bildschirmfotos für das Handbuch (PLAN P10.17, docs/owner/HANDBUCH.md): jede Handy-Ansicht der Verwaltung
// aus KONZEPT §7.3–§7.16 (aus `scripts/preview-export/adminViews.ts`, also derselben Ansichtsliste wie die Vorschau-Datei),
// die Detailansichten, die wichtigsten Dialoge und drei öffentliche Seiten. Rein (keine Browser-Abhängigkeit): `shots.ts`
// führt die Schritte aus; die Unit-Tests prüfen Vollständigkeit und eindeutige Namen.
import { ADMIN_VIEWS } from '../preview-export/adminViews'

/** Dokumente aus dem Beispielbestand, die die Aufnahme braucht (per Verwaltungs-Schnittstelle gefunden). */
export interface ShotContext {
  paidOrder: number
  packedOrder: number
  prepaymentOrder: number
  pickupOrder: number
  withdrawal: number
  inquiry: number
  privacyRequest: number
  piece: number
  /** Pfad der ersten Produktseite im Shop (`/de/shop/<slug>`). */
  productPath: string
}

/** Browser-Seite, soweit die Schritte sie brauchen (Teilmenge von Playwright `Page`). */
export interface ShotPage {
  getByTestId(id: string): ShotLocator
  getByRole(role: 'button' | 'link', options: { name: string | RegExp }): ShotLocator
  locator(selector: string): ShotLocator
  waitForTimeout(ms: number): Promise<void>
}
export interface ShotLocator {
  first(): ShotLocator
  click(): Promise<void>
  fill(value: string): Promise<void>
  scrollIntoViewIfNeeded(): Promise<void>
  waitFor(options?: { state?: 'visible'; timeout?: number }): Promise<void>
}

export interface ShotSpec {
  /** Dateiname ohne Endung (`docs/owner/img/handbuch/<id>.webp`). */
  id: string
  kind: 'admin' | 'public'
  /** Bildunterschrift/Alt-Text (Deutsch, für HANDBUCH.md). */
  caption: string
  /** Pfad relativ zu `ADMIN_ROUTE` (admin) bzw. zur Seite (public, mit `/de`); ohne Anmeldung nur `anonymous`. */
  path: (ctx: ShotContext) => string
  anonymous?: boolean
  /** Schritte nach dem Laden (Dialog öffnen, nach unten scrollen …). */
  act?: (page: ShotPage, ctx: ShotContext) => Promise<void>
  /** Schließt einen geöffneten Dialog wieder (nichts wird bestätigt). */
  dialog?: boolean
}

const VIEW_CAPTION_OVERRIDE: Record<string, string> = {
  login: 'Anmeldung',
  heute: 'Heute',
}

/** Ansichten ohne ID aus der Ansichtsliste des Vorschau-Exports (ohne „Alle Daten“-Standardansichten). */
const LIST_VIEWS: ShotSpec[] = ADMIN_VIEWS.filter(
  (v) => v.key !== 'products-list' && v.key !== 'products-form',
).map((v) => ({
  id: v.key,
  kind: 'admin' as const,
  caption: VIEW_CAPTION_OVERRIDE[v.key] ?? v.caption.de,
  path: () => v.path,
  anonymous: v.anonymous,
}))

const openDialog = async (page: ShotPage, testId: string) => {
  const trigger = page.getByTestId(testId).first()
  await trigger.scrollIntoViewIfNeeded()
  await trigger.click()
  await page.locator('dialog[open]').first().waitFor({ state: 'visible', timeout: 15_000 })
}

export const SHOT_SPECS: readonly ShotSpec[] = [
  ...LIST_VIEWS,
  // Detailansichten (brauchen eine ID aus dem Beispielbestand)
  {
    id: 'stueck',
    kind: 'admin',
    caption: 'Ein Stück ansehen und bearbeiten',
    path: (c) => `/stuecke/${c.piece}`,
  },
  {
    id: 'bestellung',
    kind: 'admin',
    caption: 'Eine Bestellung ansehen',
    path: (c) => `/bestellungen/${c.paidOrder}`,
  },
  {
    id: 'widerruf',
    kind: 'admin',
    caption: 'Einen Widerruf ansehen',
    path: (c) => `/widerrufe/${c.withdrawal}`,
  },
  {
    id: 'anfrage',
    kind: 'admin',
    caption: 'Eine Anfrage ansehen',
    path: (c) => `/anfragen/${c.inquiry}`,
  },
  {
    id: 'datenschutz-anfrage',
    kind: 'admin',
    caption: 'Eine Datenschutz-Anfrage ansehen',
    path: (c) => `/export/datenschutz/${c.privacyRequest}`,
  },
  // Dialoge und Schlüsselstellen
  {
    id: 'dialog-neues-stueck',
    kind: 'admin',
    caption: 'Neues Stück: Pflichtangaben der Kategorie',
    path: () => '/neues-stueck',
    act: async (page) => {
      await page.locator('label:has-text("Keramik")').first().click()
      await page.getByTestId('piece-form').first().scrollIntoViewIfNeeded()
    },
  },
  {
    id: 'dialog-uebersetzen',
    kind: 'admin',
    caption: 'Übersetzen: Englisch vorschlagen lassen',
    path: (c) => `/stuecke/${c.piece}`,
    act: async (page) => {
      const button = page.getByTestId('translate-button').first()
      await button.scrollIntoViewIfNeeded()
      await button.click()
      await page.waitForTimeout(1500)
    },
  },
  {
    id: 'packen-gepackt',
    kind: 'admin',
    caption: 'Zu packen: Checkliste und „Gepackt“',
    path: () => '/packen',
    act: async (page) => {
      await page.getByTestId('packing-card').first().scrollIntoViewIfNeeded()
    },
  },
  {
    id: 'dialog-versendet',
    kind: 'admin',
    caption: 'Versendet melden (Sendungsnummer)',
    path: (c) => `/bestellungen/${c.packedOrder}`,
    act: async (page) => {
      const form = page.getByTestId('ship-form').first()
      await form.scrollIntoViewIfNeeded()
    },
  },
  {
    id: 'dialog-zahlung-erhalten',
    kind: 'admin',
    caption: 'Zahlung erhalten (Vorkasse)',
    path: () => '/vorkasse',
    act: (page) => openDialog(page, 'prepayment-received'),
    dialog: true,
  },
  {
    id: 'dialog-abholung',
    kind: 'admin',
    caption: 'Abholung: „Abgeholt“ melden',
    path: () => '/abholung',
    act: (page) => openDialog(page, 'mark-picked-up'),
    dialog: true,
  },
  {
    id: 'dialog-offline-verkauft',
    kind: 'admin',
    caption: 'Offline verkauft (Flohmarkt, Instagram)',
    path: () => '/stuecke',
    act: (page) => openDialog(page, 'piece-sell-offline'),
    dialog: true,
  },
  {
    id: 'widerruf-erstatten',
    kind: 'admin',
    caption: 'Widerruf: Erstattung vorschlagen und bestätigen',
    path: (c) => `/widerrufe/${c.withdrawal}`,
    act: async (page) => {
      await page.getByTestId('refund-dialog').first().scrollIntoViewIfNeeded()
    },
  },
  {
    id: 'tattoo-flash',
    kind: 'admin',
    caption: 'Tattoo: Flash-Motive',
    path: () => '/tattoo',
    act: async (page) => {
      await page.getByTestId('flash-list').first().scrollIntoViewIfNeeded()
    },
  },
  {
    id: 'tattoo-galerie',
    kind: 'admin',
    caption: 'Tattoo: Galerie – Foto nur mit Einwilligung',
    path: () => '/tattoo',
    act: async (page) => {
      await page.getByTestId('tattoo-tab-galerie').first().click()
      await page
        .getByTestId('tattoo-gallery')
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 })
      await page.getByTestId('gallery-new').first().click()
      await page
        .getByTestId('gallery-editor')
        .first()
        .waitFor({ state: 'visible', timeout: 15_000 })
      await page.getByTestId('gallery-consent-fields').first().scrollIntoViewIfNeeded()
    },
  },
  {
    id: 'dialog-beispieldaten-entfernen',
    kind: 'admin',
    caption:
      'Beispieldaten entfernen (der Knopf ist gesperrt, solange echte Bestellungen vorhanden sind)',
    path: () => '/einstellungen',
    // Im Beispielbestand ist der Knopf gesperrt (Hinweis sichtbar); der Bestätigungsdialog wird im Handbuch beschrieben.
    act: async (page) => {
      await page.getByTestId('settings-seed-remove').first().scrollIntoViewIfNeeded()
    },
  },
  {
    id: 'startklar',
    kind: 'admin',
    caption: 'Startklar-Prüfung',
    path: () => '/einstellungen/system',
    act: async (page) => {
      await page.getByTestId('startklar').first().scrollIntoViewIfNeeded()
    },
  },
  // Öffentliche Seiten
  { id: 'public-start', kind: 'public', caption: 'Die Startseite', path: () => '/de' },
  { id: 'public-shop', kind: 'public', caption: 'Der Shop', path: () => '/de/shop' },
  {
    id: 'public-produkt',
    kind: 'public',
    caption: 'Eine Produktseite',
    path: (c) => c.productPath,
  },
]

export const SHOT_IDS: readonly string[] = SHOT_SPECS.map((s) => s.id)
