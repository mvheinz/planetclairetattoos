import 'server-only'

import type { Payload } from 'payload'

import { cleanComponents } from '@/lib/commerce/packing'
import { ENUM_LABELS } from '@/lib/enumLabels'
import { PACKAGING_MATERIALS, type PackagingMaterial } from '@/lib/enums'
import { berlinMonthRange } from '@/lib/time'

import { csvLine, UTF8_BOM } from './format'

// Jahres-Export der Verpackungsmengen (PLAN P5.11, DATENMODELL §6.8.8, E-47, R-201): je Material Summe Gramm, kg (3
// Nachkommastellen, Dezimalkomma) und Anzahl Sendungen aller Bestellungen mit `timestamps.shippedAt` im Berliner
// Kalenderjahr und `seed = false` – Beispieldaten nie, auch nicht bei wirksamem `SEED_PREVIEW_MODE` (R-124).
// Abholungen zählen nicht; keine Kundendaten. Grundlage für LUCID und die Meldung an das duale System; wird bei Bedarf
// erzeugt und nicht gespeichert.

export const PACKAGING_YEAR_RE = /^\d{4}$/

export class InvalidYearError extends Error {
  readonly status = 400
  constructor(value: unknown) {
    super(`Bitte ein Jahr im Format JJJJ angeben (erhalten: ${String(value).slice(0, 20)}).`)
    this.name = 'InvalidYearError'
  }
}

export interface MaterialTotal {
  material: PackagingMaterial
  grams: number
  shipments: number
}

export interface PackagingTotals {
  year: number
  /** Versendete Bestellungen im Jahr (ohne Beispieldaten, ohne Abholungen). */
  shipments: number
  /** Davon ohne erfasste Verpackung (Altfälle; sollte 0 sein, O7 verlangt sie). */
  withoutPackaging: number
  materials: MaterialTotal[]
}

export function parseYear(value: unknown): number {
  const s = String(value ?? '')
  if (!PACKAGING_YEAR_RE.test(s)) throw new InvalidYearError(value)
  const year = Number(s)
  if (year < 2020 || year > 2100) throw new InvalidYearError(value)
  return year
}

export function berlinYearRange(year: number): { start: Date; end: Date } {
  return {
    start: berlinMonthRange(`${year}-01`).start,
    end: berlinMonthRange(`${year + 1}-01`).start,
  }
}

/** Summen je Material für ein Berliner Kalenderjahr. */
export async function packagingTotals(payload: Payload, year: number): Promise<PackagingTotals> {
  const { start, end } = berlinYearRange(year)
  const res = await payload.find({
    collection: 'orders',
    where: {
      and: [
        { 'timestamps.shippedAt': { greater_than_equal: start.toISOString() } },
        { 'timestamps.shippedAt': { less_than: end.toISOString() } },
        { fulfillmentMethod: { equals: 'shipping' } },
        { seed: { not_equals: true } },
      ],
    },
    pagination: false,
    depth: 0,
    select: { packaging: true, seed: true, fulfillmentMethod: true },
    overrideAccess: true,
  })
  const totals = new Map<PackagingMaterial, MaterialTotal>(
    PACKAGING_MATERIALS.map((m) => [m, { material: m, grams: 0, shipments: 0 }]),
  )
  let shipments = 0
  let withoutPackaging = 0
  for (const order of res.docs) {
    if (order.seed === true || order.fulfillmentMethod !== 'shipping') continue
    shipments++
    const components = cleanComponents(order.packaging?.components)
    if (components.length === 0) withoutPackaging++
    const seen = new Set<PackagingMaterial>()
    for (const c of components) {
      const t = totals.get(c.material)!
      t.grams += c.grams
      if (!seen.has(c.material)) {
        t.shipments++
        seen.add(c.material)
      }
    }
  }
  return { year, shipments, withoutPackaging, materials: [...totals.values()] }
}

/** Gramm → kg mit 3 Nachkommastellen und Dezimalkomma (Integer-Rechnung): 1234 → „1,234“. */
export function kgComma(grams: number): string {
  if (!Number.isSafeInteger(grams) || grams < 0) throw new Error(`Gramm erwartet: ${String(grams)}`)
  return `${Math.trunc(grams / 1000)},${String(grams % 1000).padStart(3, '0')}`
}

export const packagingReportFilename = (year: number) => `planetclaire-verpackung-${year}.csv`

export const PACKAGING_REPORT_HEADER = [
  'Material',
  'Schlüssel',
  'Gramm',
  'kg',
  'Sendungen',
] as const

export function renderPackagingCsv(totals: PackagingTotals): string {
  let out = UTF8_BOM + csvLine(PACKAGING_REPORT_HEADER)
  let grams = 0
  for (const m of totals.materials) {
    grams += m.grams
    out += csvLine([
      ENUM_LABELS.PACKAGING_MATERIALS[m.material].de,
      m.material,
      String(m.grams),
      kgComma(m.grams),
      String(m.shipments),
    ])
  }
  out += csvLine(['Gesamt', '', String(grams), kgComma(grams), String(totals.shipments)])
  return out
}

export async function buildPackagingReport(
  payload: Payload,
  year: number,
): Promise<{ bytes: Buffer; filename: string; totals: PackagingTotals }> {
  const totals = await packagingTotals(payload, year)
  return {
    bytes: Buffer.from(renderPackagingCsv(totals), 'utf8'),
    filename: packagingReportFilename(year),
    totals,
  }
}
