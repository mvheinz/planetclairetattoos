import type { ProductCategory, ShippingClass } from '@/lib/enums'

// Kategorie-Regeln eines Stücks (DATENMODELL §6.6.1, §6.6.3): welche Felder zu welcher Kategorie gehören (Admin-
// Bedingungen, Leeren beim Kategoriewechsel) und welche Voreinstellungen gelten. Reines Modul.

const TEXTILE = ['textil', 'cap'] as const

/** Felder, die nur bei bestimmten Kategorien erscheinen; alle anderen Felder gelten für jede Kategorie. */
export const CATEGORY_FIELDS = {
  sizeLabel: TEXTILE,
  isSecondHand: TEXTILE,
  condition: TEXTILE,
  conditionNote: TEXTILE,
  fiberComposition: TEXTILE,
  labelMissing: TEXTILE,
  fiberFreeText: TEXTILE,
  careInstructions: TEXTILE,
  blankBrandVisible: TEXTILE,
  foodContact: ['keramik'],
  conformityDeclarations: ['keramik'],
  metalPartsMaterial: ['schmuck'],
  nickelFreeConfirmed: ['schmuck'],
  nickelEvidence: ['schmuck'],
  leadFreeGlazeConfirmed: ['schmuck'],
  smallPartsWarning: ['schmuck'],
  framed: ['zeichnung'],
  frameHasGlass: ['zeichnung'],
} as const satisfies Record<string, readonly ProductCategory[]>

export type CategoryField = keyof typeof CATEGORY_FIELDS

/** Leerer Wert je Feld beim Kategoriewechsel (Checkboxen `false`, Listen leer, sonst `null`). */
const EMPTY: Record<CategoryField, unknown> = {
  sizeLabel: null,
  isSecondHand: false,
  condition: null,
  conditionNote: null,
  fiberComposition: [],
  labelMissing: false,
  fiberFreeText: null,
  careInstructions: null,
  blankBrandVisible: false,
  foodContact: null,
  conformityDeclarations: [],
  metalPartsMaterial: null,
  nickelFreeConfirmed: false,
  nickelEvidence: null,
  leadFreeGlazeConfirmed: false,
  smallPartsWarning: false,
  framed: false,
  frameHasGlass: false,
}

export function fieldAppliesTo(field: CategoryField, category: unknown): boolean {
  return (CATEGORY_FIELDS[field] as readonly string[]).includes(String(category))
}

/** Admin-Bedingung: Feld nur bei den passenden Kategorien zeigen. */
export function showFor(field: CategoryField) {
  return (data: Record<string, unknown> | undefined): boolean =>
    fieldAppliesTo(field, data?.category)
}

export const isTextile = (category: unknown): boolean =>
  (TEXTILE as readonly string[]).includes(String(category))

/** Versandklasse je Kategorie (§6.6.3, E-25). */
export const DEFAULT_SHIPPING_CLASS: Record<ProductCategory, ShippingClass> = {
  keramik: 'keramik',
  textil: 'paket_klein',
  cap: 'paket_klein',
  zeichnung: 'brief',
  schmuck: 'brief',
  sonstiges: 'paket_klein',
}

type Data = Record<string, unknown>
const isEmpty = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '')

export interface CategoryTemplates {
  /** `settings.safetyTemplates[category]` in der Sprache des Requests. */
  safety?: string | null
  /** `settings.careTemplates[category]` (textil/cap) in der Sprache des Requests. */
  care?: string | null
}

/**
 * Voreinstellungen der Kategorie (§6.6.3) – nur für leere Felder. `current` ist der zusammengeführte Stand (alt +
 * neu), geschrieben wird in `data`.
 */
export function applyCategoryDefaults(
  data: Data,
  current: Data,
  category: ProductCategory,
  templates: CategoryTemplates,
): void {
  const set = (name: string, value: unknown) => {
    if (isEmpty(current[name]) && !isEmpty(value)) data[name] = value
  }
  set('shippingClass', DEFAULT_SHIPPING_CLASS[category])
  if (category === 'keramik') set('foodContact', 'deko')
  if (isTextile(category)) {
    // Textil und Cap sind immer Second-Hand (E-16, R-043); der Formular-Standard `false` zählt nicht als gesetzt.
    data.isSecondHand = true
    set('careInstructions', templates.care)
  }
  // Kleinteile-Hinweis bei Schmuck immer an (R-045).
  if (category === 'schmuck') data.smallPartsWarning = true
  set('safetyWarnings', templates.safety)
}

/** Beim Kategoriewechsel (nur im Entwurf): kategoriefremde Pflichtangaben leeren. */
export function clearForeignFields(data: Data, category: ProductCategory): void {
  for (const field of Object.keys(CATEGORY_FIELDS) as CategoryField[]) {
    if (!fieldAppliesTo(field, category)) data[field] = EMPTY[field]
  }
}
