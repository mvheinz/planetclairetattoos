// Verwaltungs-Ansichten für die Bildschirmfotos der Vorschau-Datei (ARCHITEKTUR §14.7, KONZEPT §12.5 Nr. 9): je Ansicht
// aus KONZEPT §7.3–§7.15 Schlüssel, Pfad relativ zu `ADMIN_ROUTE`, Bildunterschrift DE/EN und die Phase, ab der sie
// existiert. In P2 gibt es nur Anmeldung, Liste und Formular der Standard-Verwaltung (P1); die eigenen Handy-Ansichten
// kommen aus der Ansichten-Registry (`src/admin/views/registry.ts`, P5.1: Pfad, Titel, Phase), „Tattoo“ P7. Noch nicht
// gebaute Ansichten erscheinen als „kommt in P<n>“. Detailansichten (`/bestellungen/:id` …) brauchen eine ID und
// werden nicht einzeln aufgenommen; Unterseiten ohne ID (Einstellungen → Versand …) schon.

import {
  ADMIN_DETAIL_VIEWS,
  ADMIN_HOME_VIEW,
  ADMIN_VIEWS as REGISTRY_VIEWS,
} from '../../src/admin/views/registry'

export interface AdminView {
  key: string
  /** Pfad relativ zu `ADMIN_ROUTE` (`''` = Startseite der Verwaltung). */
  path: string
  caption: { de: string; en: string }
  /** Phase, ab der die Ansicht existiert. */
  phase: number
  /** Nur ohne Anmeldung aufnehmen (Anmeldeseite). */
  anonymous?: boolean
  /** Quelle in KONZEPT. */
  ref: string
}

/** Englische Bildunterschriften der Registry-Ansichten (die Verwaltung selbst ist nur Deutsch). */
const CAPTION_EN: Record<(typeof REGISTRY_VIEWS)[number]['key'], string> = {
  heute: 'Today',
  'neues-stueck': 'New piece',
  stuecke: 'My pieces',
  packen: 'To pack',
  vorkasse: 'Awaiting bank transfer',
  versendet: 'Shipped',
  abholung: 'Pick-up',
  widerrufe: 'Withdrawals',
  anfragen: 'Requests (commissions)',
  tattoo: 'Tattoo',
  texte: 'Texts',
  einstellungen: 'Settings',
  export: 'Export and privacy tools',
}

/** Unterseiten ohne ID (Einstellungen → …) werden wie Hauptansichten aufgenommen; Detailansichten mit `:id` nicht. */
const SUBPAGES = ADMIN_DETAIL_VIEWS.filter((v) => !v.path.includes(':'))

const SUBPAGE_CAPTION_EN: Record<string, string> = {
  produktsicherheit: 'Settings: product safety',
  versand: 'Settings: shipping',
  'umsatz-waechter': 'Settings: revenue guard',
  system: 'Settings: system',
}

export const ADMIN_VIEWS: readonly AdminView[] = [
  {
    key: 'login',
    path: '/login',
    caption: { de: 'Anmeldung', en: 'Sign-in' },
    phase: 1,
    anonymous: true,
    ref: 'KONZEPT §7.1',
  },
  {
    key: 'products-list',
    path: '/collections/products',
    caption: { de: 'Alle Daten: Stücke (Liste)', en: 'All data: pieces (list)' },
    phase: 1,
    ref: 'KONZEPT §7.16',
  },
  {
    key: 'products-form',
    path: '/collections/products/create',
    caption: { de: 'Alle Daten: neues Stück (Formular)', en: 'All data: new piece (form)' },
    phase: 1,
    ref: 'KONZEPT §7.16',
  },
  // „Heute“ als Startseite der Verwaltung (`ADMIN_ROUTE` selbst), alle übrigen unter ihrem Registry-Pfad.
  ...REGISTRY_VIEWS.map((v) => ({
    key: v.key,
    path: v.key === ADMIN_HOME_VIEW ? '' : v.path,
    caption: { de: v.title, en: CAPTION_EN[v.key] },
    phase: v.phase,
    ref: v.ref,
  })),
  ...SUBPAGES.map((v) => ({
    key: v.key,
    path: v.path,
    caption: { de: `Einstellungen: ${v.title}`, en: SUBPAGE_CAPTION_EN[v.key] ?? v.title },
    phase: v.phase,
    ref: v.ref,
  })),
]
