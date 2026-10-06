import 'server-only'

import type {
  CheckoutStatus,
  InvoiceType,
  ProductCategory,
  ProductStatus,
  SoldChannel,
} from '@/lib/enums'

// Soll-Mengen des Beispielbestands (SEED-SPEC §0.1, §0.3, §5.1, §7.3, §9) – einzige Quelle für Tests (PLAN P8.1).
// Kein Test und keine Aufgabe hartkodiert Mengen an anderer Stelle. `tests/unit/seed/expected.unit.spec.ts` liest die
// Tabelle §0.1 aus SEED-SPEC und vergleicht sie mit `SEED_EXPECTED_COUNTS` (Doku und Code laufen nicht auseinander).

/** Spanne „0–1“ (z. B. Admin-Konto). */
export interface CountRange {
  min: number
  max: number
}

/**
 * Je Zeile aus SEED-SPEC §0.1 die Menge nach `pnpm seed:reset` mit kanonischem `SEED_NOW`. `private-uploads` zählt
 * die Dateien aus §4.4 **und** die Beleg-PDFs (§9); die Aufteilung steht in `SEED_EXPECTED_DETAIL`.
 */
export const SEED_EXPECTED_COUNTS = {
  users: { min: 0, max: 1 },
  categories: 6,
  settings: 1,
  'site-texts': 1,
  'legal-texts': 6,
  media: 47,
  'private-uploads': 22,
  products: 30,
  checkouts: 14,
  orders: 14,
  reservations: 10,
  invoices: 15,
  'invoice-counters': 2,
  withdrawals: 7,
  complaints: 4,
  inquiries: 7,
  'privacy-requests': 5,
  flash: 10,
  'tattoo-gallery': 6,
  'tour-dates': 8,
  pages: 13,
  faqs: 12,
  'revenue-entries': 18,
  'email-log': 78,
  'consent-log': 14,
  'audit-log': 8,
  'webhook-events': 0,
  documents: 0,
  'conformity-declarations': 0,
} as const satisfies Record<string, number | CountRange>

export type SeedExpectedCollection = keyof typeof SEED_EXPECTED_COUNTS

/** Aufteilungen, die §0.1 in Klammern nennt. */
export const SEED_EXPECTED_DETAIL = {
  media: { instagram: 17, placeholders: 30 },
  'private-uploads': { files: 7, invoicePdfs: 15 },
  checkouts: { completed: 12, expired: 1, open: 1 } satisfies Partial<
    Record<CheckoutStatus, number>
  >,
  invoices: { invoice: 12, credit_note: 3 } satisfies Record<InvoiceType, number>,
  /** Zählerstände nach dem Seed (§9, AK-SEED-08). */
  invoiceCounters: { 'BSP-RE': 12, 'BSP-GS': 3 },
} as const

/** Stücke je Kategorie (SEED-SPEC §0.3). */
export const SEED_EXPECTED_PRODUCTS_BY_CATEGORY = {
  keramik: 9,
  textil: 5,
  cap: 4,
  zeichnung: 7,
  schmuck: 4,
  sonstiges: 1,
} as const satisfies Record<ProductCategory, number>

/** Stücke je Status (SEED-SPEC §0.3, §5.1). */
export const SEED_EXPECTED_PRODUCTS_BY_STATUS = {
  available: 14,
  reserved: 2,
  sold: 11,
  archived: 1,
  draft: 2,
} as const satisfies Record<ProductStatus, number>

/** Verkaufte Stücke je Kanal und davon im Archiv sichtbar (SEED-SPEC §5.1). */
export const SEED_EXPECTED_SOLD = {
  byChannel: { online: 8, pickup: 2, offline: 1 } satisfies Record<SoldChannel, number>,
  visibleInArchive: 10,
} as const

/** Seed-Nummernbereich der Stücke (SEED-SPEC §0.3, §2.5); Test-Fixtures nutzen 975–999. */
export const SEED_ITEM_NUMBER_RANGE = { min: 901, max: 930 } as const

/** Nur die Zahl einer Zeile (Spannen → Maximum). */
export function expectedCount(collection: SeedExpectedCollection): number {
  const v = SEED_EXPECTED_COUNTS[collection] as number | CountRange
  return typeof v === 'number' ? v : v.max
}

/**
 * Anker der Verwaltung „Heute“ bei kanonischem `N` (SEED-SPEC §17, PLAN P8.5/P8.5a) – Soll-Werte für Tests von
 * `getTodaySummary()`; „Versendet“ zählt die Bestellungen im Status `shipped`.
 */
export const SEED_TODAY_ANCHORS = {
  packen: 2,
  vorkasse: 1,
  abholung: 1,
  versendet: 1,
  /** Offene Widerrufe (W3, W4, W5); W6/W7 sind abgeschlossen. Nächste Frist: W3 (Erstattung `D+5`). */
  widerrufe: 3,
  nextWithdrawalReference: 'WR-2026-90003',
  nextWithdrawalDue: 'D+5@19:30',
  anfragen: 1,
  /** Rote Hinweise an Bestellungen im Status `disputed`. */
  disputedOrders: ['PC-2026-90003'],
  /** Offene Datenschutz-Anfragen (DS3, DS4, DS5); nächste Frist DS3 `D+26`. */
  privacyOpen: 3,
  nextPrivacyReference: 'DS-2026-9003',
  /** Hinweis „Beispieldaten vorhanden“. */
  seedHint: true,
} as const
