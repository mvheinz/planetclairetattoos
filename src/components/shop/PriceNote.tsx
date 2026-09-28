import React from 'react'

import type { Locale, VatCategory } from '@/lib/enums'
import { vatNote } from '@/lib/legal/constants'
import { getSnippet } from '@/lib/legal/snippets'
import { formatMoney } from '@/lib/money'
import { VAT_RATES, getTaxModeAt, type TaxSettings } from '@/lib/tax'

import styles from './PriceNote.module.css'

// Steuerhinweis am Preis (R-030, R-032, E-02): Der geltende Modus kommt aus `settings.tax.modes` zum Zeitpunkt `at`
// (`getTaxModeAt`). Kleinunternehmerin → Baustein `price.kleinunternehmerNote` („Endpreis · gemäß § 19 UStG …“), nie ein
// Hinweis auf enthaltene Steuer (V-02, R-126). Regelbesteuerung ab `validFrom` → „inkl. 19 % USt.“ bzw. „inkl. 7 % USt.“
// je `vatCategory` (Sätze aus `settings.tax.standardRate`/`reducedRate`). Optional mit Betrag (`formatMoney`, `full`).
// Keine Vergleichs- oder Streichpreise (V-20).

export interface PriceTaxSettings extends TaxSettings {
  tax?:
    | (NonNullable<TaxSettings['tax']> & {
        standardRate?: number | null
        reducedRate?: number | null
      })
    | null
}

export interface PriceNoteInput {
  locale: Locale
  /** Global `settings` (mindestens `tax.modes`; Sätze optional). */
  settings: PriceTaxSettings | null | undefined
  /** Zeitpunkt, für den der Steuermodus gilt (Anzeige: jetzt; Bestellung: Bestellzeitpunkt). */
  at: Date
  vatCategory?: VatCategory | null
}

/** Satz in Prozent je Kategorie (Einstellungen, sonst die festen Sätze 19/7). */
export function vatRateFor(
  settings: PriceTaxSettings | null | undefined,
  vatCategory: VatCategory | null | undefined,
): number {
  const tax = settings?.tax
  if (vatCategory === 'reduced_art') return tax?.reducedRate || VAT_RATES.reduced_art
  return tax?.standardRate || VAT_RATES.standard
}

/** Text des Steuerhinweises (ohne Betrag). */
export function priceNoteText({ locale, settings, at, vatCategory }: PriceNoteInput): string {
  const mode = getTaxModeAt(settings, at)
  if (mode === 'kleinunternehmer') return getSnippet('price.kleinunternehmerNote', locale).text
  return vatNote(mode, locale, vatRateFor(settings, vatCategory))
}

export function PriceNote({
  amountCents,
  className,
  ...input
}: PriceNoteInput & { amountCents?: number; className?: string }) {
  const mode = getTaxModeAt(input.settings, input.at)
  const text = priceNoteText(input)
  return (
    <span
      className={className ? `${styles.note} ${className}` : styles.note}
      data-price-note={mode}
    >
      {amountCents !== undefined ? (
        <span className={styles.amount} data-money="">
          {formatMoney(amountCents, input.locale, { style: 'full' })}
        </span>
      ) : null}
      {amountCents !== undefined ? ' ' : null}
      <span className={styles.text}>{text}</span>
    </span>
  )
}
