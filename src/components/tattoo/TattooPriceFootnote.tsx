import { getTranslations } from 'next-intl/server'
import React from 'react'

import type { Locale, TaxMode } from '@/lib/enums'
import { vatNote } from '@/lib/legal/constants'
import { getSnippet } from '@/lib/legal/snippets'

import styles from './Tattoo.module.css'

// Auflösung des Sternchens an Tattoo-Preisen (R-034, KONZEPT §9.1): Gesamtpreise mit Kleinunternehmer-Hinweis aus dem
// Baustein `price.tattooNote` („Gesamtpreis · gemäß § 19 UStG …“) – ohne Versandteil. Bei Regelbesteuerung
// „Gesamtpreis · inkl. 19 % USt.“ (im Kleinunternehmer-Modus nie ein Steuer-Hinweis, V-02). Genau einmal je Seite; Preise
// verweisen per `aria-describedby` darauf.
export const TATTOO_PRICE_FOOTNOTE_ID = 'tattoo-price-footnote'

export function tattooPriceNoteText(locale: Locale, taxMode: TaxMode, totalLabel: string): string {
  if (taxMode === 'kleinunternehmer') return getSnippet('price.tattooNote', locale).text
  return `${totalLabel} · ${vatNote(taxMode, locale)}`
}

export async function TattooPriceFootnote({
  locale,
  taxMode,
}: {
  locale: Locale
  taxMode: TaxMode
}) {
  const t = await getTranslations({ locale, namespace: 'tattoo.prices' })
  return (
    <p
      id={TATTOO_PRICE_FOOTNOTE_ID}
      className={styles.footnote}
      data-price-footnote=""
      data-tattoo-price-note={taxMode}
    >
      <span aria-hidden="true">* </span>
      {tattooPriceNoteText(locale, taxMode, t('totalPrice'))}
    </p>
  )
}
