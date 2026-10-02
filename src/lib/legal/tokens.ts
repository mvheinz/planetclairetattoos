import 'server-only'

import type { Locale } from '@/lib/enums'

// Kanonische Platzhalter-Liste der Rechtstexte (R-012, DATENMODELL §6.12, KANZLEI-BRIEFING §16.3) – geschlossen: keine
// Aliase, keine weiteren Schreibweisen. `{{STEUERNUMMER}}` gibt es bewusst nicht (E-46, R-020); die
// Auftragsverarbeiter-Tabelle ist eine Komponente, kein Token. Eigenes Modul, damit Renderer und Bausteine
// (src/lib/legal/snippets.ts) es ohne Zirkelbezug nutzen.

export const LEGAL_TOKENS = [
  'name',
  'street',
  'postalCode',
  'city',
  'email',
  'phone',
  'wIdNr',
  'ustIdNr',
  'siteUrl',
  'withdrawalUrl',
  'shippingTable',
  'deliveryTime',
  'vorkasseDays',
  'returnCostsNote',
] as const
export type LegalToken = (typeof LEGAL_TOKENS)[number]

/** Die einzigen Tokens, die leer ersetzt werden dürfen (R-012). */
export const LEGAL_TOKENS_MAY_BE_EMPTY: ReadonlySet<LegalToken> = new Set<LegalToken>([
  'wIdNr',
  'ustIdNr',
])

/** Pfad der Widerrufsfunktion R26 je Sprache (KONZEPT §2.2). */
export const WITHDRAWAL_PATHS: Readonly<Record<Locale, string>> = Object.freeze({
  de: '/de/vertrag-widerrufen',
  en: '/en/withdraw-from-contract',
})
