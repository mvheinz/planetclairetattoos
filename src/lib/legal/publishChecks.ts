import 'server-only'

import type { LegalTextType, Locale, TaxMode } from '@/lib/enums'

// Prüfungen vor dem Veröffentlichen einer Rechtstext- bzw. Baustein-Fassung (KONZEPT §7.13, R-012, R-095, RECHT V-01,
// V-02). Geprüft wird der gerenderte Text (Tokens ersetzt) und – für Links – der gespeicherte Inhalt als JSON.
// Ein Treffer sperrt das Veröffentlichen; der Renderer selbst prüft vorher die Tokens (`LegalRenderError`).

/** V-01: Verweis auf die abgeschaltete EU-OS-Plattform (VO (EU) 2024/3228). */
export const ODR_LINK_RE = /ec\.europa\.eu\/consumers\/odr/i

/** V-02 (gerendert): Steuerhinweise, solange der Kleinunternehmer-Modus gilt (§ 19 UStG). */
export const KU_TAX_NOTE_RE =
  /inkl\.?\s*(MwSt|USt|Mehrwertsteuer|Umsatzsteuer)|zzgl\.?\s*(MwSt|USt)|\bMwSt\b|incl\.?\s*VAT|VAT included/iu

export interface PublishCheckInput {
  /** Rechtstext-Typ; `null` bei Bausteinen. */
  type: LegalTextType | null
  /** Gerenderter Klartext je vorhandener Sprache. */
  rendered: Partial<Record<Locale, string>>
  /** Gespeicherter Inhalt (Lexical bzw. Text) als JSON – enthält auch Link-Ziele. */
  rawJson: string
  /** Aufgelöste Widerrufs-URL (R26) je Sprache (`{{withdrawalUrl}}`). */
  withdrawalUrl: Partial<Record<Locale, string>>
  /** Steuermodus am `validFrom` der Fassung. */
  taxMode: TaxMode
}

export interface PublishProblem {
  code: 'withdrawal_url_missing' | 'odr_link' | 'ku_tax_note'
  locale?: Locale
  message: string
}

/** Alle Gründe, die das Veröffentlichen sperren (leer = in Ordnung). */
export function publishProblems(input: PublishCheckInput): PublishProblem[] {
  const out: PublishProblem[] = []
  const locales = Object.keys(input.rendered) as Locale[]
  if (input.type === 'widerrufsbelehrung') {
    for (const locale of locales) {
      const url = input.withdrawalUrl[locale]
      if (!url || !input.rendered[locale]!.includes(url)) {
        out.push({
          code: 'withdrawal_url_missing',
          locale,
          message: `${locale.toUpperCase()}: Die Widerrufsbelehrung muss {{withdrawalUrl}} bzw. die Adresse der Widerrufsfunktion enthalten (R-095).`,
        })
      }
    }
  }
  const odr =
    ODR_LINK_RE.test(input.rawJson) || locales.some((l) => ODR_LINK_RE.test(input.rendered[l]!))
  if (odr) {
    out.push({
      code: 'odr_link',
      message: 'Der Text verweist auf die abgeschaltete EU-OS-Plattform – bitte entfernen (V-01).',
    })
  }
  if (input.taxMode === 'kleinunternehmer') {
    for (const locale of locales) {
      if (KU_TAX_NOTE_RE.test(input.rendered[locale]!)) {
        out.push({
          code: 'ku_tax_note',
          locale,
          message: `${locale.toUpperCase()}: Im Kleinunternehmer-Modus kein Hinweis auf Mehrwertsteuer (V-02).`,
        })
      }
    }
  }
  return out
}
