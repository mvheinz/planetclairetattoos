import 'server-only'

import type { Locale, TaxMode } from '@/lib/enums'

// Rechtlich fixierte Texte (DATENMODELL §7.2 „Nicht editierbar“). Nicht in `site-texts`, nicht übersetzbar per Knopf,
// nicht per Verwaltung änderbar. Änderungen nur nach Rücksprache mit der Kanzlei.

type Localized = Readonly<Record<Locale, string>>

/** Bestell-Button (§ 312j Abs. 3 BGB, E-21) – exakt dieser Text. */
export const ORDER_BUTTON_LABEL: Localized = Object.freeze({
  de: 'Zahlungspflichtig bestellen',
  en: 'Order with obligation to pay',
})

/** Link der Widerrufsfunktion auf jeder Seite (§ 356a BGB, R-090). */
export const WITHDRAWAL_LINK_LABEL: Localized = Object.freeze({
  de: 'Vertrag widerrufen',
  en: 'Withdraw from contract here',
})

/** Zweiter Schritt der Widerrufsfunktion (§ 356a BGB, R-092). */
export const WITHDRAWAL_CONFIRM_LABEL: Localized = Object.freeze({
  de: 'Widerruf bestätigen',
  en: 'Confirm withdrawal',
})

/** Kleinunternehmer-Hinweis (§ 19 UStG, E-02); in diesem Modus nie ein Hinweis auf enthaltene Steuer (RECHT V-02). */
export const SMALL_BUSINESS_VAT_NOTE: Localized = Object.freeze({
  de: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
  en: 'No VAT is charged in accordance with Section 19 of the German VAT Act (UStG).',
})

/** Steuerhinweis je Modus: Kleinunternehmer-Satz bzw. „inkl. {rate} % USt.“ bei Regelbesteuerung (R-030, R-032). */
export function vatNote(mode: TaxMode, locale: Locale, ratePercent = 19): string {
  if (mode === 'kleinunternehmer') return SMALL_BUSINESS_VAT_NOTE[locale]
  if (!Number.isInteger(ratePercent) || ratePercent <= 0) {
    throw new Error(`Ungültiger Steuersatz: ${ratePercent}`)
  }
  return locale === 'en' ? `incl. ${ratePercent}% VAT` : `inkl. ${ratePercent} % USt.`
}

export const LEGAL_CONSTANTS = Object.freeze({
  orderButton: ORDER_BUTTON_LABEL,
  withdrawalLink: WITHDRAWAL_LINK_LABEL,
  withdrawalConfirm: WITHDRAWAL_CONFIRM_LABEL,
  smallBusinessVatNote: SMALL_BUSINESS_VAT_NOTE,
})
