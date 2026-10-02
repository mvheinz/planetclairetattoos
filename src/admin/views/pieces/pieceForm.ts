import type {
  DeviationDecision,
  FiberComponent,
  FoodContact,
  ProductCategory,
  ProductStatus,
  ShippingClass,
  TextileCondition,
  TextileFiber,
  VatCategory,
} from '@/lib/enums'
import { DEFAULT_SHIPPING_CLASS, fieldAppliesTo, isTextile } from '@/lib/products/categoryRules'

// Formular „Neues Stück“ / „Stück bearbeiten“ (PLAN P5.6, KONZEPT §7.4): Formularzustand und Umrechnung in die Felder
// von DATENMODELL §6.6.1. Dieselben Felder und dieselbe Validierung wie das Standardformular – geprüft wird auf dem
// Server (Collection-Hooks, `validateForPublish`). Reines Modul (auch im Browser), unit-getestet.

/** Deutsche und englische Fassung der lokalisierten Textfelder. */
export const PIECE_TEXT_FIELDS = [
  'title',
  'description',
  'juttaSays',
  'materials',
  'dimensionsNote',
  'sizeLabel',
  'conditionNote',
  'fiberFreeText',
  'careInstructions',
  'metalPartsMaterial',
  'safetyWarnings',
  'deviationDescription',
] as const
export type PieceTextField = (typeof PIECE_TEXT_FIELDS)[number]

export type PieceTexts = Record<PieceTextField, string>

export interface FiberRowForm {
  component: FiberComponent
  fiber: TextileFiber | ''
  percent: string
}

export interface PieceForm {
  itemNumber: string
  category: ProductCategory | ''
  de: PieceTexts
  en: PieceTexts
  /** Preis als Eingabetext („45“, „45,50“). */
  price: string
  vatCategory: VatCategory
  vatReducedReason: string
  widthCm: string
  heightCm: string
  depthCm: string
  diameterCm: string
  weightGrams: string
  shippingClass: ShippingClass | ''
  isSecondHand: boolean
  condition: TextileCondition | ''
  fiberComposition: FiberRowForm[]
  labelMissing: boolean
  blankBrandVisible: boolean
  foodContact: FoodContact | ''
  conformityDeclarations: number[]
  nickelFreeConfirmed: boolean
  nickelEvidence: number | null
  leadFreeGlazeConfirmed: boolean
  smallPartsWarning: boolean
  framed: boolean
  frameHasGlass: boolean
  deviationDecision: DeviationDecision | ''
  hasDeviation: boolean
  ownDesignConfirmed: boolean
  showInArchiveAfterSale: boolean
  storageLocation: string
  internalNote: string
}

export const emptyTexts = (): PieceTexts =>
  Object.fromEntries(PIECE_TEXT_FIELDS.map((f) => [f, ''])) as PieceTexts

export function emptyPieceForm(itemNumber: number | null = null): PieceForm {
  return {
    itemNumber: itemNumber === null ? '' : String(itemNumber),
    category: '',
    de: emptyTexts(),
    en: emptyTexts(),
    price: '',
    vatCategory: 'standard',
    vatReducedReason: '',
    widthCm: '',
    heightCm: '',
    depthCm: '',
    diameterCm: '',
    weightGrams: '',
    shippingClass: '',
    isSecondHand: false,
    condition: '',
    fiberComposition: [],
    labelMissing: false,
    blankBrandVisible: false,
    foodContact: '',
    conformityDeclarations: [],
    nickelFreeConfirmed: false,
    nickelEvidence: null,
    leadFreeGlazeConfirmed: false,
    smallPartsWarning: false,
    framed: false,
    frameHasGlass: false,
    deviationDecision: '',
    hasDeviation: false,
    ownDesignConfirmed: false,
    showInArchiveAfterSale: true,
    storageLocation: '',
    internalNote: '',
  }
}

export interface CategoryTemplateTexts {
  /** `settings.safetyTemplates` je Kategorie (DE). */
  safety: Partial<Record<ProductCategory, string>>
  /** `settings.careTemplates` (textil/cap, DE). */
  care: Partial<Record<ProductCategory, string>>
}

/**
 * Kategorie wählen (nur im Entwurf): Voreinstellungen laut DATENMODELL §6.6.3 wie der Server-Hook – Versandklasse,
 * `foodContact = deko`, Second-Hand, Pflege- und Warnhinweis-Vorlage (nur wenn leer oder noch die Vorlage der vorigen
 * Kategorie), Kleinteile-Hinweis; kategoriefremde Pflichtangaben werden geleert.
 */
export function applyCategory(
  form: PieceForm,
  category: ProductCategory,
  templates: CategoryTemplateTexts,
): PieceForm {
  const prev = form.category || null
  const next: PieceForm = { ...form, category, de: { ...form.de } }
  const untouched = (value: string, prevTemplate: string | undefined) =>
    value.trim() === '' || (prevTemplate !== undefined && value === prevTemplate)
  const prevShipping = prev ? DEFAULT_SHIPPING_CLASS[prev] : ''
  if (!form.shippingClass || form.shippingClass === prevShipping)
    next.shippingClass = DEFAULT_SHIPPING_CLASS[category]
  if (untouched(form.de.safetyWarnings, prev ? templates.safety[prev] : undefined))
    next.de.safetyWarnings = templates.safety[category] ?? ''
  if (!fieldAppliesTo('foodContact', category)) {
    next.foodContact = ''
    next.conformityDeclarations = []
  } else if (!form.foodContact) next.foodContact = 'deko'
  if (isTextile(category)) {
    next.isSecondHand = true
    if (untouched(form.de.careInstructions, prev ? templates.care[prev] : undefined))
      next.de.careInstructions = templates.care[category] ?? ''
  } else {
    next.isSecondHand = false
    next.condition = ''
    next.fiberComposition = []
    next.labelMissing = false
    next.blankBrandVisible = false
    next.de.sizeLabel = ''
    next.de.conditionNote = ''
    next.de.fiberFreeText = ''
    next.de.careInstructions = ''
  }
  if (category === 'schmuck') next.smallPartsWarning = true
  else {
    next.smallPartsWarning = false
    next.nickelFreeConfirmed = false
    next.nickelEvidence = null
    next.leadFreeGlazeConfirmed = false
    next.de.metalPartsMaterial = ''
  }
  if (category !== 'zeichnung') {
    next.framed = false
    next.frameHasGlass = false
    if (next.vatCategory === 'reduced_art') next.vatCategory = 'standard'
  }
  return next
}

type Doc = Record<string, unknown>

const str = (v: unknown): string =>
  typeof v === 'string' ? v : typeof v === 'number' ? String(v) : ''
const num = (v: unknown): string =>
  typeof v === 'number' && Number.isFinite(v) ? String(v).replace('.', ',') : ''
const idOf = (v: unknown): number | null => {
  const raw = v && typeof v === 'object' ? (v as { id?: unknown }).id : v
  const n = Number(raw)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

function textsOf(doc: Doc | null | undefined): PieceTexts {
  const t = emptyTexts()
  if (!doc) return t
  for (const f of PIECE_TEXT_FIELDS) {
    t[f] =
      f === 'dimensionsNote' ? str((doc.dimensions as Doc | undefined)?.note) : str((doc as Doc)[f])
  }
  return t
}

/** Formularzustand aus dem gespeicherten Stück (DE- und EN-Fassung, `depth: 0`). */
export function formFromDoc(de: Doc, en: Doc | null): PieceForm {
  const dims = (de.dimensions ?? {}) as Doc
  return {
    itemNumber: str(de.itemNumber),
    category: (str(de.category) as ProductCategory) || '',
    de: textsOf(de),
    en: textsOf(en),
    price: typeof de.priceCents === 'number' ? formatCentsInput(de.priceCents) : '',
    vatCategory: (str(de.vatCategory) as VatCategory) || 'standard',
    vatReducedReason: str(de.vatReducedReason),
    widthCm: num(dims.widthCm),
    heightCm: num(dims.heightCm),
    depthCm: num(dims.depthCm),
    diameterCm: num(dims.diameterCm),
    weightGrams: num(de.weightGrams),
    shippingClass: (str(de.shippingClass) as ShippingClass) || '',
    isSecondHand: de.isSecondHand === true,
    condition: (str(de.condition) as TextileCondition) || '',
    fiberComposition: ((de.fiberComposition as Doc[] | null) ?? []).map((r) => ({
      component: (str(r.component) as FiberComponent) || 'main',
      fiber: (str(r.fiber) as TextileFiber) || '',
      percent: num(r.percent),
    })),
    labelMissing: de.labelMissing === true,
    blankBrandVisible: de.blankBrandVisible === true,
    foodContact: (str(de.foodContact) as FoodContact) || '',
    conformityDeclarations: ((de.conformityDeclarations as unknown[] | null) ?? [])
      .map(idOf)
      .filter((n): n is number => n !== null),
    nickelFreeConfirmed: de.nickelFreeConfirmed === true,
    nickelEvidence: idOf(de.nickelEvidence),
    leadFreeGlazeConfirmed: de.leadFreeGlazeConfirmed === true,
    smallPartsWarning: de.smallPartsWarning === true,
    framed: de.framed === true,
    frameHasGlass: de.frameHasGlass === true,
    deviationDecision: (str(de.deviationDecision) as DeviationDecision) || '',
    hasDeviation: de.hasDeviation === true,
    ownDesignConfirmed: de.ownDesignConfirmed === true,
    showInArchiveAfterSale: de.showInArchiveAfterSale !== false,
    storageLocation: str(de.storageLocation),
    internalNote: str(de.internalNote),
  }
}

/** Cent → Eingabetext („4550“ → „45,50“, „4500“ → „45“). */
export function formatCentsInput(cents: number): string {
  const euros = Math.trunc(cents / 100)
  const rest = cents % 100
  return rest === 0 ? String(euros) : `${euros},${String(rest).padStart(2, '0')}`
}

/** Dezimalzahl mit Komma oder Punkt („14,5“ → 14.5); leer → `null`, ungültig → `NaN` (Server lehnt ab). */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(',', '.')
  if (s === '') return null
  return /^\d+(\.\d+)?$/.test(s) ? Number(s) : Number.NaN
}

export function parseInteger(input: string): number | null {
  const s = input.trim()
  if (s === '') return null
  return /^\d+$/.test(s) ? Number(s) : Number.NaN
}

const orNull = (s: string): string | null => (s.trim() === '' ? null : s)

/** Felder, die nach Status gesperrt sind (DATENMODELL §6.6.8 Nr. 1–2). */
export interface PieceLocks {
  itemNumber: boolean
  category: boolean
  price: boolean
}

export function pieceLocks(status: ProductStatus | null, firstPublishedAt: unknown): PieceLocks {
  const saleLock = status === 'reserved' || status === 'sold'
  return {
    itemNumber: !!firstPublishedAt,
    category: status !== null && status !== 'draft',
    price: saleLock,
  }
}

/**
 * Daten fürs Speichern in DE (nicht lokalisierte Felder + DE-Texte). Kategoriefremde Felder bleiben weg (der Server
 * leert sie beim Kategoriewechsel); gesperrte Felder werden nicht mitgeschickt. `priceCents` kommt vom Aufrufer
 * (`parseEuroInput` mit `PRICE_CENTS_RANGE`; ungültig → `-1`, damit der Server ablehnt statt still zu übernehmen).
 */
export function toSaveData(
  form: PieceForm,
  opts: { priceCents: number | null; images: number[]; locks: PieceLocks },
): Doc {
  const { de } = form
  const category = form.category || null
  const data: Doc = {
    title: orNull(de.title),
    description: orNull(de.description),
    juttaSays: orNull(de.juttaSays),
    vatCategory: form.vatCategory,
    vatReducedReason: form.vatCategory === 'reduced_art' ? orNull(form.vatReducedReason) : null,
    materials: orNull(de.materials),
    dimensions: {
      widthCm: parseDecimal(form.widthCm),
      heightCm: parseDecimal(form.heightCm),
      depthCm: parseDecimal(form.depthCm),
      diameterCm: parseDecimal(form.diameterCm),
      note: orNull(de.dimensionsNote),
    },
    weightGrams: parseInteger(form.weightGrams),
    safetyWarnings: orNull(de.safetyWarnings),
    deviationDecision: form.deviationDecision || null,
    hasDeviation:
      form.deviationDecision === '' ? form.hasDeviation : form.deviationDecision === 'described',
    deviationDescription: orNull(de.deviationDescription),
    ownDesignConfirmed: form.ownDesignConfirmed,
    showInArchiveAfterSale: form.showInArchiveAfterSale,
    storageLocation: orNull(form.storageLocation),
    internalNote: orNull(form.internalNote),
    images: opts.images,
  }
  if (!opts.locks.itemNumber) data.itemNumber = parseInteger(form.itemNumber)
  if (!opts.locks.category && category) data.category = category
  if (!opts.locks.price) {
    data.priceCents = opts.priceCents
    if (form.shippingClass) data.shippingClass = form.shippingClass
  }
  if (!category) return data
  if (isTextile(category)) {
    Object.assign(data, {
      sizeLabel: orNull(de.sizeLabel),
      isSecondHand: form.isSecondHand,
      condition: form.condition || null,
      conditionNote: orNull(de.conditionNote),
      fiberComposition: form.fiberComposition.map((r) => ({
        component: r.component,
        fiber: r.fiber || null,
        percent: parseInteger(r.percent),
      })),
      labelMissing: form.labelMissing,
      fiberFreeText: orNull(de.fiberFreeText),
      careInstructions: orNull(de.careInstructions),
      blankBrandVisible: form.blankBrandVisible,
    })
  }
  if (category === 'keramik') {
    Object.assign(data, {
      foodContact: form.foodContact || null,
      conformityDeclarations:
        form.foodContact === 'lebensmittelecht' ? form.conformityDeclarations : [],
    })
  }
  if (category === 'schmuck') {
    Object.assign(data, {
      metalPartsMaterial: orNull(de.metalPartsMaterial),
      nickelFreeConfirmed: form.nickelFreeConfirmed,
      nickelEvidence: form.nickelEvidence,
      leadFreeGlazeConfirmed: form.leadFreeGlazeConfirmed,
      smallPartsWarning: true,
    })
  }
  if (category === 'zeichnung') {
    Object.assign(data, { framed: form.framed, frameHasGlass: form.framed && form.frameHasGlass })
  }
  return data
}

/** EN-Texte fürs Speichern mit `locale=en` (nur die Felder der Kategorie; leer → `null`). */
export function toEnData(form: PieceForm): Doc {
  const { en } = form
  const category = form.category || null
  const data: Doc = {
    title: orNull(en.title),
    description: orNull(en.description),
    juttaSays: orNull(en.juttaSays),
    materials: orNull(en.materials),
    dimensions: { note: orNull(en.dimensionsNote) },
    safetyWarnings: orNull(en.safetyWarnings),
    deviationDescription: orNull(en.deviationDescription),
  }
  if (category && isTextile(category)) {
    Object.assign(data, {
      sizeLabel: orNull(en.sizeLabel),
      conditionNote: orNull(en.conditionNote),
      fiberFreeText: orNull(en.fiberFreeText),
      careInstructions: orNull(en.careInstructions),
    })
  }
  if (category === 'schmuck') data.metalPartsMaterial = orNull(en.metalPartsMaterial)
  return data
}

/** Textfelder, die zur Kategorie gehören (für die EN-Liste und „Übersetzen“). */
export function textFieldsFor(category: ProductCategory | ''): PieceTextField[] {
  return PIECE_TEXT_FIELDS.filter((f) => {
    if (
      f === 'sizeLabel' ||
      f === 'conditionNote' ||
      f === 'fiberFreeText' ||
      f === 'careInstructions'
    )
      return isTextile(category)
    if (f === 'metalPartsMaterial') return category === 'schmuck'
    return true
  })
}

export interface FieldIssue {
  field: string
  message: string
}

/**
 * Fehler aus einer Payload-Antwort (`{ errors: [{ message, data: { errors: [{ path, message }] } }] }`) bzw. einem
 * Stück-Endpunkt (`{ error, errors: [{ path | field, message }] }`) als Liste „Das fehlt noch:“.
 */
export function issuesFromResponse(json: unknown): FieldIssue[] {
  const out: FieldIssue[] = []
  const push = (field: unknown, message: unknown) => {
    if (typeof message !== 'string' || message.trim() === '') return
    const f = typeof field === 'string' ? field : ''
    if (!out.some((i) => i.field === f && i.message === message)) out.push({ field: f, message })
  }
  const body = (json ?? {}) as {
    error?: unknown
    errors?: { message?: unknown; path?: unknown; field?: unknown; data?: unknown }[]
  }
  for (const e of body.errors ?? []) {
    const nested = (e.data as { errors?: { path?: unknown; field?: unknown; message?: unknown }[] })
      ?.errors
    if (Array.isArray(nested) && nested.length > 0)
      nested.forEach((n) => push(n.path ?? n.field, n.message))
    else push(e.path ?? e.field, e.message)
  }
  if (out.length === 0 && typeof body.error === 'string') push('', body.error)
  return out
}

/** Sprungziel im Formular zu einem Feldpfad (`dimensions.widthCm` → `pf-dimensions`, `images.0` → `pf-images`). */
export function fieldAnchor(path: string): string {
  const head = path.split('.')[0] ?? ''
  if (!head) return ''
  if (head === 'settings' || head === 'business') return ''
  return `pf-${head}`
}
