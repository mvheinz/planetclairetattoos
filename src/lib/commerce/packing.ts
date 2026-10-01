import 'server-only'

import type { PackagingMaterial, ShippingClass } from '@/lib/enums'
import { PACKAGING_MATERIALS, SHIPPING_CLASS_RANK } from '@/lib/enums'
import { formatMoney } from '@/lib/money'

import { carrierEmailConsentActive, type AddressOrderLike } from './address'

// Packen (PLAN P5.10/P5.11, KONZEPT §7.6, DATENMODELL §6.8.8): Hinweise der Karte „Zu packen“, Verpackungs-Checkliste
// je Versandklasse und Vorbelegung der Verpackungsmengen. Reines Modul – Bestellung und Einstellungen kommen vom
// Aufrufer.

// --- Hinweise ------------------------------------------------------------------------------------------------------

export type PackingHintKey = 'withdrawal' | 'ceramic' | 'insurance' | 'letter' | 'carrierEmail'

export interface PackingHint {
  key: PackingHintKey
  text: string
  tone: 'error' | 'warning' | 'info'
}

/** Einschreiben haftet nur bis 25 € (KONZEPT §7.6). */
export const LETTER_LIABILITY_CENTS = 2_500
/** Standard von `settings.shipping.insuranceHintThresholdCents` (DHL haftet bis 500 €). */
export const DEFAULT_INSURANCE_THRESHOLD_CENTS = 50_000

export interface PackingOrderLike extends AddressOrderLike {
  status: string
  statusBeforeWithdrawal?: string | null
  shippingClass?: ShippingClass | null
  subtotalCents: number
  items?: { shippingClass?: ShippingClass | null }[] | null
}

/** „500 €“ bei ganzen Euro, sonst „500,50 €“ (Text der Hinweise wie in KONZEPT §7.6). */
export function euroLabel(cents: number): string {
  return cents % 100 === 0 ? `${cents / 100} €` : formatMoney(cents, 'de').replace(/ /g, ' ')
}

/** Versandklassen der Positionen (höchste zuerst, ohne `nur_abholung`). */
export function shippingClassesOf(order: Pick<PackingOrderLike, 'shippingClass' | 'items'>) {
  const set = new Set<ShippingClass>()
  if (order.shippingClass && order.shippingClass !== 'nur_abholung') set.add(order.shippingClass)
  for (const item of order.items ?? []) {
    if (item.shippingClass && item.shippingClass !== 'nur_abholung') set.add(item.shippingClass)
  }
  return [...set].sort((a, b) => SHIPPING_CLASS_RANK[b] - SHIPPING_CLASS_RANK[a])
}

/** Bestellung mit Widerruf vor dem Versand (O11 aus `paid`/`packed`): nicht mehr versenden. */
export function withdrawnBeforeShipping(order: PackingOrderLike): boolean {
  return (
    order.status === 'withdrawal_received' &&
    (order.statusBeforeWithdrawal === 'paid' || order.statusBeforeWithdrawal === 'packed')
  )
}

/** Hinweise der Karte (wörtlich KONZEPT §7.6, R-100, R-101). */
export function packingHints(
  order: PackingOrderLike,
  options: { insuranceThresholdCents?: number | null } = {},
): PackingHint[] {
  const threshold = options.insuranceThresholdCents ?? DEFAULT_INSURANCE_THRESHOLD_CENTS
  const classes = shippingClassesOf(order)
  const hints: PackingHint[] = []
  if (withdrawnBeforeShipping(order)) {
    hints.push({ key: 'withdrawal', text: 'Nicht mehr versenden – Widerruf!', tone: 'error' })
  }
  if (classes.includes('keramik')) {
    hints.push({ key: 'ceramic', text: 'Keramik – Karton in Karton', tone: 'warning' })
  }
  if (order.subtotalCents > threshold) {
    hints.push({
      key: 'insurance',
      text: `Warenwert > ${euroLabel(threshold)} – Transportversicherung buchen`,
      tone: 'warning',
    })
  }
  if (order.shippingClass === 'brief' && order.subtotalCents > LETTER_LIABILITY_CENTS) {
    hints.push({
      key: 'letter',
      text: `Brief über ${euroLabel(LETTER_LIABILITY_CENTS)} – Einschreiben haftet nur bis ${euroLabel(LETTER_LIABILITY_CENTS)}`,
      tone: 'warning',
    })
  }
  hints.push({
    key: 'carrierEmail',
    text: `E-Mail an DHL: ${carrierEmailConsentActive(order) ? 'ja' : 'nein'}`,
    tone: 'info',
  })
  return hints
}

// --- Verpackungs-Checkliste ------------------------------------------------------------------------------------------

/** Punkte für alle Sendungen (KONZEPT §7.6 „alle – zwei Fotos vor dem Zukleben“; Beileger je Stück, R-203). */
export const PACKING_COMMON_ITEMS: readonly string[] = [
  'Packzettel mit Beileger je Stück einlegen',
  'zwei Fotos vor dem Zukleben',
]

export interface ChecklistSettings {
  packingChecklists?:
    { shippingClass?: string | null; items?: { text?: string | null }[] | null }[] | null
}

export interface ChecklistItem {
  /** Schlüssel in `packingChecklistState` (der Text selbst – bleibt gültig, wenn sich die Reihenfolge ändert). */
  key: string
  text: string
  done: boolean
}

/** Checkliste der Bestellung: Punkte je Versandklasse der Stücke plus Punkte für alle Sendungen, ohne Doppelungen. */
export function packingChecklist(
  order: Pick<PackingOrderLike, 'shippingClass' | 'items'> & { packingChecklistState?: unknown },
  settings: ChecklistSettings,
): ChecklistItem[] {
  const state = checklistState(order.packingChecklistState)
  const texts: string[] = []
  for (const cls of shippingClassesOf(order)) {
    const list = (settings.packingChecklists ?? []).find((c) => c.shippingClass === cls)
    for (const item of list?.items ?? []) if (item.text?.trim()) texts.push(item.text.trim())
  }
  texts.push(...PACKING_COMMON_ITEMS)
  const seen = new Set<string>()
  return texts
    .filter((t) => {
      const k = t.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .map((text) => ({ key: text, text, done: state[text] === true }))
}

/** `packingChecklistState` als `{ [Punkt]: boolean }` (unbekannte Formen → leer). */
export function checklistState(value: unknown): Record<string, boolean> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([k, v]) => typeof v === 'boolean' && k.length > 0 && k.length <= 200)
      .map(([k, v]) => [k, v as boolean]),
  )
}

// --- Verpackungsmengen (E-47, R-201) ----------------------------------------------------------------------------------

export interface PackagingComponent {
  material: PackagingMaterial
  grams: number
}

export interface PackagingValue {
  templateKey: string | null
  templateName: string | null
  components: PackagingComponent[]
}

export interface PackagingSettings {
  packaging?: {
    templates?:
      | {
          key?: string | null
          name?: string | null
          components?: { material?: string | null; grams?: number | null }[] | null
        }[]
      | null
    defaultsByShippingClass?:
      { shippingClass?: string | null; templateKey?: string | null }[] | null
  } | null
}

export interface PackagingTemplate {
  key: string
  name: string
  components: PackagingComponent[]
}

const isMaterial = (v: unknown): v is PackagingMaterial =>
  (PACKAGING_MATERIALS as readonly string[]).includes(String(v))

export function cleanComponents(value: unknown): PackagingComponent[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((row) => {
    const r = row as { material?: unknown; grams?: unknown } | null
    const grams = Number(r?.grams)
    return r && isMaterial(r.material) && Number.isInteger(grams) && grams >= 1 && grams <= 10_000
      ? [{ material: r.material, grams }]
      : []
  })
}

/** Vorlagen aus `settings.packaging.templates`. */
export function packagingTemplates(settings: PackagingSettings): PackagingTemplate[] {
  return (settings.packaging?.templates ?? []).flatMap((t) =>
    t.key && t.name
      ? [{ key: t.key, name: t.name, components: cleanComponents(t.components) }]
      : [],
  )
}

/** Standard-Vorlage der Versandklasse (`settings.packaging.defaultsByShippingClass`). */
export function defaultTemplateFor(
  shippingClass: ShippingClass | null | undefined,
  settings: PackagingSettings,
): PackagingTemplate | null {
  const key = (settings.packaging?.defaultsByShippingClass ?? []).find(
    (d) => d.shippingClass === shippingClass,
  )?.templateKey
  return packagingTemplates(settings).find((t) => t.key === key) ?? null
}

/** Erfasste Verpackung der Bestellung oder – noch nicht erfasst – die Vorbelegung aus der Standard-Vorlage. */
export function packagingForOrder(
  order: {
    shippingClass?: ShippingClass | null
    packaging?: {
      templateKey?: string | null
      templateName?: string | null
      components?: unknown
      recordedAt?: string | null
    } | null
  },
  settings: PackagingSettings,
): PackagingValue & { recorded: boolean } {
  const stored = cleanComponents(order.packaging?.components)
  if (order.packaging?.recordedAt && stored.length > 0) {
    return {
      templateKey: order.packaging.templateKey ?? null,
      templateName: order.packaging.templateName ?? null,
      components: stored,
      recorded: true,
    }
  }
  const t = defaultTemplateFor(order.shippingClass, settings)
  return {
    templateKey: t?.key ?? null,
    templateName: t?.name ?? null,
    components: t?.components ?? [],
    recorded: false,
  }
}

/** Verpackung erfasst (Pflicht vor O7, DM-ORD-07): Vorlage gewählt und mindestens ein Bestandteil. */
export function packagingRecorded(
  packaging:
    | {
        templateKey?: string | null
        components?: unknown
        recordedAt?: string | null
      }
    | null
    | undefined,
): boolean {
  return (
    !!packaging?.recordedAt &&
    !!packaging.templateKey &&
    cleanComponents(packaging.components).length > 0
  )
}
