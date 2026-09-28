import { DEFAULT_TAX_MODES } from '@/globals/settingsDefaults'
import type { TaxMode, VatCategory } from '@/lib/enums'
import { taxModeAt, type TaxModeEntry } from '@/lib/settings/rules'

// Steuermodus und Steuerberechnung (E-02, R-032, ARCHITEKTUR §2.1) – einzige Stelle. Reine Funktionen ohne DB.
// Namen laut DATENMODELL: `settings.tax.modes`, `kleinunternehmer`/`regelbesteuert`, `vatCategory`.
// Versandkosten werden bei Regelbesteuerung anteilig nach Warenwert auf die Sätze verteilt (KONZEPT §4.14, KA-10 –
// Frage an die Steuerberatung, docs/OFFENE-PUNKTE.md P4.2).

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

export interface ShippingTaxShare {
  rate: VatRate
  /** Anteil der Versandkosten (brutto, Integer-Cent) an diesem Satz. */
  grossCents: number
}

export interface TaxOptions {
  /** Versandkosten brutto (Integer-Cent); Standard 0. */
  shippingCents?: number
}

export interface TaxResult {
  mode: TaxMode
  /** Leer im Kleinunternehmer-Modus (keine Steuerzeilen auf Belegen, § 19 UStG). Enthält den Versandanteil. */
  taxLines: TaxLine[]
  /** Aufteilung der Versandkosten auf die Sätze (KA-10); leer im Kleinunternehmer-Modus oder ohne Versand. */
  shippingShares: ShippingTaxShare[]
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
 * Versandkosten anteilig nach Warenwert auf die Sätze verteilen (KA-10): Anteil = ⌊Versand × Warenwert_Satz /
 * Warenwert⌋, die Rest-Cents gehen nach dem größten Divisionsrest (bei Gleichstand an den höheren Satz), sodass die
 * Summe centgenau den Versandkosten entspricht. Ohne Warenwert trägt der Regelsatz den ganzen Versand.
 */
export function splitShippingByRate(
  goodsByRate: ReadonlyMap<VatRate, number>,
  shippingCents: number,
): ShippingTaxShare[] {
  assertCentsValue(shippingCents)
  if (shippingCents === 0) return []
  const rates = [...goodsByRate.entries()].filter(([, g]) => g > 0).sort(([a], [b]) => b - a)
  const goods = rates.reduce((n, [, g]) => n + g, 0)
  if (goods === 0) return [{ rate: VAT_RATES.standard, grossCents: shippingCents }]
  const shares = rates.map(([rate, g]) => ({
    rate,
    grossCents: Math.floor((shippingCents * g) / goods),
    remainder: (shippingCents * g) % goods,
  }))
  let rest = shippingCents - shares.reduce((n, s) => n + s.grossCents, 0)
  for (const s of [...shares].sort((a, b) => b.remainder - a.remainder || b.rate - a.rate)) {
    if (rest === 0) break
    s.grossCents += 1
    rest -= 1
  }
  return shares.map(({ rate, grossCents }) => ({ rate, grossCents }))
}

/**
 * Steuerzeilen aus Endpreisen (R-032, KONZEPT §4.14): Kleinunternehmer → keine Steuer (net = gross, tax = 0, keine
 * Steuerzeilen); Regelbesteuerung → Versand anteilig nach Warenwert auf die Sätze (KA-10), dann je Satz
 * Netto = round(Brutto / (1 + Satz)), Steuer = Brutto − Netto (DATENMODELL §6.9). Eingegebene Preise bleiben Endpreise;
 * Netto + Steuer = Brutto centgenau.
 */
export function computeTax(
  lines: readonly TaxLineInput[],
  mode: TaxMode,
  options: TaxOptions = {},
): TaxResult {
  for (const l of lines) assertCentsValue(l.grossCents)
  const shippingCents = options.shippingCents ?? 0
  assertCentsValue(shippingCents)
  const totalGrossCents = lines.reduce((n, l) => n + l.grossCents, 0) + shippingCents
  if (mode === 'kleinunternehmer') {
    return {
      mode,
      taxLines: [],
      shippingShares: [],
      totalGrossCents,
      totalNetCents: totalGrossCents,
      totalTaxCents: 0,
    }
  }
  const byRate = new Map<VatRate, number>()
  for (const l of lines) {
    const rate = VAT_RATES[l.vatCategory]
    byRate.set(rate, (byRate.get(rate) ?? 0) + l.grossCents)
  }
  const shippingShares = splitShippingByRate(byRate, shippingCents)
  const grossByRate = new Map(byRate)
  for (const s of shippingShares)
    grossByRate.set(s.rate, (grossByRate.get(s.rate) ?? 0) + s.grossCents)
  const taxLines = [...grossByRate.entries()]
    .sort(([a], [b]) => b - a)
    .map(([rate, grossCents]) => {
      const netCents = Math.round((grossCents * 100) / (100 + rate))
      return { rate, netCents, taxCents: grossCents - netCents, grossCents }
    })
  const totalNetCents = taxLines.reduce((n, t) => n + t.netCents, 0)
  return {
    mode,
    taxLines,
    shippingShares,
    totalGrossCents,
    totalNetCents,
    totalTaxCents: totalGrossCents - totalNetCents,
  }
}
