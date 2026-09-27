import { DEFAULT_TAX_MODES } from '@/globals/settingsDefaults'
import type { TaxMode, VatCategory } from '@/lib/enums'
import { taxModeAt, type TaxModeEntry } from '@/lib/settings/rules'

// Steuermodus und Steuerberechnung (E-02, R-032, ARCHITEKTUR §2.1) – einzige Stelle. Reine Funktionen ohne DB.
// Namen laut DATENMODELL: `settings.tax.modes`, `kleinunternehmer`/`regelbesteuert`, `vatCategory`.
// Die Aufteilung der Versandkosten auf die Sätze (KA-10) ergänzt P4.2.

export interface TaxSettings {
  tax?: { modes?: readonly TaxModeEntry[] | null } | null
}

/** Sätze in Prozent (DATENMODELL §7.1 `tax.standardRate`/`reducedRate`, fest). */
export const VAT_RATES: Readonly<Record<VatCategory, 19 | 7>> = { standard: 19, reduced_art: 7 }

export type VatRate = 0 | 7 | 19

/**
 * Geltender Steuermodus zum Zeitpunkt `date`: letzter Eintrag mit `validFrom ≤ date` (R-032). Ohne Einträge gilt
 * der Grund-Seed (Kleinunternehmer ab 01.01.2026, E-02). Vor dem ersten Eintrag gilt der früheste Modus.
 */
export function getTaxModeAt(settings: TaxSettings | null | undefined, date: Date): TaxMode {
  const modes = settings?.tax?.modes?.length ? settings.tax.modes : DEFAULT_TAX_MODES
  const current = taxModeAt(modes as readonly TaxModeEntry[], date)
  if (current) return current
  const first = [...modes]
    .filter((m) => m.mode && m.validFrom)
    .sort(
      (a, b) => new Date(String(a.validFrom)).getTime() - new Date(String(b.validFrom)).getTime(),
    )
  return (first[0]?.mode as TaxMode | undefined) ?? 'kleinunternehmer'
}

export interface TaxLineInput {
  /** Bruttobetrag der Zeile (Endpreis, Integer-Cent). */
  grossCents: number
  vatCategory: VatCategory
}

export interface TaxLine {
  rate: VatRate
  netCents: number
  taxCents: number
  grossCents: number
}

export interface TaxResult {
  mode: TaxMode
  /** Leer im Kleinunternehmer-Modus (keine Steuerzeilen auf Belegen, § 19 UStG). */
  taxLines: TaxLine[]
  totalGrossCents: number
  totalNetCents: number
  totalTaxCents: number
}

function assertCentsValue(value: number): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Betrag muss ganzzahlige Cent ≥ 0 sein: ${value}`)
  }
}

/**
 * Steuerzeilen aus Endpreisen (R-032): Kleinunternehmer → keine Steuer (net = gross, tax = 0); Regelbesteuerung →
 * je Satz Netto = round(Brutto / (1 + Satz)), Steuer = Brutto − Netto (DATENMODELL §6.9). Eingegebene Preise
 * bleiben Endpreise.
 */
export function computeTax(lines: readonly TaxLineInput[], mode: TaxMode): TaxResult {
  for (const l of lines) assertCentsValue(l.grossCents)
  const totalGrossCents = lines.reduce((n, l) => n + l.grossCents, 0)
  if (mode === 'kleinunternehmer') {
    return { mode, taxLines: [], totalGrossCents, totalNetCents: totalGrossCents, totalTaxCents: 0 }
  }
  const byRate = new Map<VatRate, number>()
  for (const l of lines) {
    const rate = VAT_RATES[l.vatCategory]
    byRate.set(rate, (byRate.get(rate) ?? 0) + l.grossCents)
  }
  const taxLines = [...byRate.entries()]
    .sort(([a], [b]) => b - a)
    .map(([rate, grossCents]) => {
      const netCents = Math.round((grossCents * 100) / (100 + rate))
      return { rate, netCents, taxCents: grossCents - netCents, grossCents }
    })
  const totalNetCents = taxLines.reduce((n, t) => n + t.netCents, 0)
  return {
    mode,
    taxLines,
    totalGrossCents,
    totalNetCents,
    totalTaxCents: totalGrossCents - totalNetCents,
  }
}
