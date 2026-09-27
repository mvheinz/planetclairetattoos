import type {
  CountryCode,
  InvoiceRetentionYears,
  ShippingClass,
  ShippingZone,
  TaxMode,
} from '@/lib/enums'
import { LEGAL_TEXT_TYPES, PRODUCT_CATEGORIES, SHIPPING_CLASSES } from '@/lib/enums'
import { berlinDateKey, berlinDayStart } from '@/lib/time'

// Regeln des Globals `settings` (DATENMODELL §7.1) als reine Funktionen (ohne Payload, unit-testbar).

/** Versandklassen mit Tarif/Verpackung (ohne `nur_abholung`). */
export const SHIPPABLE_CLASSES = SHIPPING_CLASSES.filter(
  (c): c is Exclude<ShippingClass, 'nur_abholung'> => c !== 'nur_abholung',
)

/** Versandzone eines Lieferlands (E-24): DE, CH, sonst EU. */
export function zoneForCountry(country: CountryCode): ShippingZone {
  if (country === 'DE') return 'DE'
  if (country === 'CH') return 'CH'
  return 'EU'
}

export function normalizeIban(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase()
}

/** IBAN-Prüfsumme (ISO 13616, mod 97 = 1); Leerzeichen erlaubt. */
export function isValidIban(value: string): boolean {
  const iban = normalizeIban(value)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  if (iban.startsWith('DE') && iban.length !== 22) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let rest = 0
  for (const ch of rearranged) {
    const code = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch
    for (const digit of code) rest = (rest * 10 + Number(digit)) % 97
  }
  return rest === 1
}

/** Platzhalter der Telefonnummer bis zum Go-live (§13.7 Nr. 3). */
export const PHONE_PLACEHOLDER = '[Telefon folgt]'
const PHONE_RE = /^(\+[1-9]\d{6,14}|\+?[0-9][0-9 /()-]{5,24})$/

/** Nummer im E.164- oder deutschen Format oder genau der Platzhalter (§7.1 `business.phone`). */
export function isValidPhone(value: string): boolean {
  if (value === PHONE_PLACEHOLDER) return true
  const digits = value.replace(/\D/g, '')
  return PHONE_RE.test(value.trim()) && digits.length >= 6 && digits.length <= 15
}

/** Kein Postfach als Geschäftsadresse (R-020). */
export const POSTBOX_RE = /postfach|\bpf\.?\s?\d/i

export interface TaxModeEntry {
  mode?: TaxMode | null
  validFrom?: string | Date | null
  reason?: string | null
  confirmedWithTaxAdvisor?: boolean | null
}

export interface FieldIssue {
  path: string
  message: string
}

const toDate = (v: unknown): Date | null => {
  if (v === null || v === undefined || v === '') return null
  const d = v instanceof Date ? v : new Date(String(v))
  return Number.isNaN(d.getTime()) ? null : d
}
const dayKey = (v: unknown) => {
  const d = toDate(v)
  return d ? berlinDateKey(d) : null
}
const entryKey = (e: TaxModeEntry) => `${e.mode ?? ''}@${dayKey(e.validFrom) ?? ''}`

/** Geltender Steuermodus zum Zeitpunkt: letzter Eintrag mit `validFrom ≤ at` (E-02, R-032). */
export function taxModeAt(modes: readonly TaxModeEntry[], at: Date): TaxMode | null {
  const current = modes
    .filter((m) => m.mode && toDate(m.validFrom) && toDate(m.validFrom)!.getTime() <= at.getTime())
    .sort((a, b) => toDate(a.validFrom)!.getTime() - toDate(b.validFrom)!.getTime())
    .at(-1)
  return current?.mode ?? null
}

/**
 * Prüft `tax.modes` (R-032): ≥ 1 Eintrag, `validFrom` eindeutig (Berliner Kalendertag); neue Einträge nur mit
 * Begründung (10–300) und Bestätigung „mit Steuerberatung abgestimmt“, frühestens ab heute; bereits geltende Einträge
 * bleiben unverändert. Liefert die neuen Einträge (für das Audit) und die Fehler.
 */
export function checkTaxModes(
  next: readonly TaxModeEntry[],
  previous: readonly TaxModeEntry[],
  now: Date,
  privileged = false,
): { issues: FieldIssue[]; added: TaxModeEntry[]; removed: TaxModeEntry[] } {
  const issues: FieldIssue[] = []
  if (next.length === 0) {
    issues.push({ path: 'tax.modes', message: 'Mindestens ein Steuermodus ist nötig.' })
  }
  const seen = new Set<string>()
  next.forEach((e, i) => {
    const key = dayKey(e.validFrom)
    if (!e.mode) issues.push({ path: `tax.modes.${i}.mode`, message: 'Bitte den Modus wählen.' })
    if (!key) {
      issues.push({ path: `tax.modes.${i}.validFrom`, message: 'Bitte „gültig ab“ angeben.' })
      return
    }
    if (seen.has(key)) {
      issues.push({
        path: `tax.modes.${i}.validFrom`,
        message: 'Jedes „gültig ab“-Datum darf nur einmal vorkommen.',
      })
    }
    seen.add(key)
  })
  const prevKeys = new Set(previous.map(entryKey))
  const nextKeys = new Set(next.map(entryKey))
  const added = next.filter((e) => !prevKeys.has(entryKey(e)))
  const removed = previous.filter((e) => !nextKeys.has(entryKey(e)))
  if (!privileged) {
    const today = berlinDayStart(now).getTime()
    for (const e of added) {
      const i = next.indexOf(e)
      const reason = (e.reason ?? '').trim()
      if (reason.length < 10 || reason.length > 300) {
        issues.push({
          path: `tax.modes.${i}.reason`,
          message: 'Bitte begründen, warum der Steuermodus wechselt (10–300 Zeichen).',
        })
      }
      if (e.confirmedWithTaxAdvisor !== true) {
        issues.push({
          path: `tax.modes.${i}.confirmedWithTaxAdvisor`,
          message: 'Bitte bestätigen: mit Steuerberatung abgestimmt.',
        })
      }
      const from = toDate(e.validFrom)
      if (from && from.getTime() < today) {
        issues.push({
          path: `tax.modes.${i}.validFrom`,
          message: 'Ein neuer Steuermodus gilt frühestens ab heute.',
        })
      }
    }
    for (const e of removed) {
      const from = toDate(e.validFrom)
      if (from && from.getTime() <= now.getTime()) {
        issues.push({
          path: 'tax.modes',
          message: 'Bereits geltende Steuermodi können nicht geändert oder entfernt werden.',
        })
        break
      }
    }
  }
  return { issues, added, removed }
}

/** Einträge nach `validFrom` sortieren (Anzeige und Auswertung). */
export function sortTaxModes<T extends TaxModeEntry>(modes: readonly T[]): T[] {
  return [...modes].sort(
    (a, b) => (toDate(a.validFrom)?.getTime() ?? 0) - (toDate(b.validFrom)?.getTime() ?? 0),
  )
}

export interface ShippingInput {
  enabledCountries?: CountryCode[] | null
  euShippingAcknowledged?: boolean | null
  euChecklist?: Record<string, boolean | null | undefined> | null
  rates?:
    | { zone?: ShippingZone | null; shippingClass?: string | null; priceCents?: number | null }[]
    | null
}

export const EU_CHECKLIST_KEYS = [
  'authorisedRepresentativeNamed',
  'ossThresholdChecked',
  'textileLanguageChecked',
  'ratesMaintained',
  'legalTextsAdapted',
] as const

/** Lieferländer, EU-Sperre und Tarife (R-060, R-202, E-24, E-25). */
export function checkShipping(s: ShippingInput): FieldIssue[] {
  const issues: FieldIssue[] = []
  const countries = s.enabledCountries ?? []
  if (!countries.includes('DE')) {
    issues.push({
      path: 'shipping.enabledCountries',
      message: 'Deutschland muss als Lieferland aktiv bleiben.',
    })
  }
  const foreign = countries.filter((c) => c !== 'DE')
  if (foreign.length > 0 && s.euShippingAcknowledged !== true) {
    issues.push({
      path: 'shipping.enabledCountries',
      message:
        'Versand außerhalb Deutschlands erst nach der EU-Checkliste und dem Häkchen „EU-Versand geprüft“.',
    })
  }
  if (s.euShippingAcknowledged === true) {
    const missing = EU_CHECKLIST_KEYS.filter((k) => s.euChecklist?.[k] !== true)
    if (missing.length > 0) {
      issues.push({
        path: 'shipping.euShippingAcknowledged',
        message: 'Erst alle Punkte der EU-Checkliste abhaken.',
      })
    }
  }
  const seen = new Set<string>()
  const rates = s.rates ?? []
  rates.forEach((r, i) => {
    const key = `${r.zone}:${r.shippingClass}`
    if (seen.has(key)) {
      issues.push({
        path: `shipping.rates.${i}.shippingClass`,
        message: 'Je Zone und Versandklasse nur ein Tarif.',
      })
    }
    seen.add(key)
  })
  const zones = new Set(countries.map(zoneForCountry))
  for (const zone of zones) {
    const missing = SHIPPABLE_CLASSES.filter((c) => !seen.has(`${zone}:${c}`))
    if (missing.length > 0) {
      issues.push({
        path: 'shipping.rates',
        message: `Für die Zone ${zone} fehlen Tarife: ${missing.join(', ')}.`,
      })
    }
  }
  return issues
}

export interface PackagingInput {
  templates?: { key?: string | null; components?: { grams?: number | null }[] | null }[] | null
  defaultsByShippingClass?: { shippingClass?: string | null; templateKey?: string | null }[] | null
}

export const PACKAGING_KEY_RE = /^[a-z0-9-]+$/

/** Verpackungsvorlagen (E-47, R-201): Schlüssel eindeutig, ≥ 1 Komponente; genau 1 Vorbelegung je Versandklasse. */
export function checkPackaging(p: PackagingInput): FieldIssue[] {
  const issues: FieldIssue[] = []
  const keys = new Set<string>()
  ;(p.templates ?? []).forEach((t, i) => {
    const key = t.key ?? ''
    if (!PACKAGING_KEY_RE.test(key)) {
      issues.push({
        path: `packaging.templates.${i}.key`,
        message: 'Schlüssel nur aus a–z, 0–9 und -.',
      })
    }
    if (keys.has(key)) {
      issues.push({ path: `packaging.templates.${i}.key`, message: 'Schlüssel doppelt.' })
    }
    keys.add(key)
    if (!t.components || t.components.length === 0) {
      issues.push({
        path: `packaging.templates.${i}.components`,
        message: 'Mindestens ein Material angeben.',
      })
    }
  })
  const defaults = p.defaultsByShippingClass ?? []
  for (const cls of SHIPPABLE_CLASSES) {
    const n = defaults.filter((d) => d.shippingClass === cls).length
    if (n !== 1) {
      issues.push({
        path: 'packaging.defaultsByShippingClass',
        message: `Genau eine Verpackung je Versandklasse nötig (${cls}: ${n}).`,
      })
    }
  }
  defaults.forEach((d, i) => {
    if (d.shippingClass === 'nur_abholung') {
      issues.push({
        path: `packaging.defaultsByShippingClass.${i}.shippingClass`,
        message: 'Abholung braucht keine Verpackung.',
      })
    }
    if (!d.templateKey || !keys.has(d.templateKey)) {
      issues.push({
        path: `packaging.defaultsByShippingClass.${i}.templateKey`,
        message: 'Diese Verpackungsvorlage gibt es nicht.',
      })
    }
  })
  return issues
}

/** Genau ein Eintrag je Wert (z. B. `legal.reviews` je Rechtstext, `safetyTemplates` je Kategorie). */
export function checkExactlyOnePer(
  rows: readonly Record<string, unknown>[] | null | undefined,
  key: string,
  values: readonly string[],
  path: string,
): FieldIssue[] {
  const list = rows ?? []
  const wrong = values.filter((v) => list.filter((r) => r[key] === v).length !== 1)
  const unknown = list.filter((r) => !values.includes(String(r[key])))
  if (wrong.length === 0 && unknown.length === 0) return []
  return [
    { path, message: `Genau ein Eintrag je Wert nötig (${[...wrong].join(', ') || 'unbekannt'}).` },
  ]
}

export const LEGAL_REVIEW_TYPES = LEGAL_TEXT_TYPES
export const SAFETY_TEMPLATE_CATEGORIES = PRODUCT_CATEGORIES

/** Umsatzwächter-Schwellen (KONZEPT §8.4, R-125): u1 < Vorjahresgrenze < u3 < u3a < u4 < Jahresgrenze. */
export function checkRevenueGuard(g: {
  previousYearLimitCents?: number | null
  currentYearLimitCents?: number | null
  stageThresholdsCents?: {
    u1?: number | null
    u3?: number | null
    u3a?: number | null
    u4?: number | null
  } | null
}): FieldIssue[] {
  const t = g.stageThresholdsCents ?? {}
  const chain = [t.u1, g.previousYearLimitCents, t.u3, t.u3a, t.u4, g.currentYearLimitCents]
  if (chain.some((v) => typeof v !== 'number')) {
    return [{ path: 'revenueGuard', message: 'Alle Grenzen und Schwellen angeben.' }]
  }
  const nums = chain as number[]
  for (let i = 1; i < nums.length; i++) {
    if (!(nums[i - 1]! < nums[i]!)) {
      return [
        {
          path: 'revenueGuard.stageThresholdsCents',
          message: 'Reihenfolge: U1 < Grenze Vorjahr < U3 < U3a < U4 < Grenze laufendes Jahr.',
        },
      ]
    }
  }
  return []
}

/** `retention.invoiceYears` als Zahl (Select speichert Text). */
export function parseInvoiceYears(value: unknown): InvoiceRetentionYears | null {
  const n = Number(value)
  return n === 8 || n === 10 ? n : null
}
