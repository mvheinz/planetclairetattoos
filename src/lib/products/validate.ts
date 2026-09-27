import { lintProductText } from '@/lib/legal/forbidden'
import type { Locale, ProductCategory } from '@/lib/enums'

import { isTextile } from './categoryRules'
import { checkFibers, type FiberRow } from './fibers'
import { isValidItemNumber } from './itemNumber'
import { pickLocale, type LocalizedValue } from './localized'
import { containsWarning, MANDATORY_WARNING_TEXTS } from './warnings'

// Veröffentlichungsprüfung (DATENMODELL §6.6.6, R-042–R-048): reine Funktion ohne Datenbank. Die Collection lädt
// Bilder, Erklärungen und Einstellungen und ruft sie bei `draft → available`, `sold → available` und bei jedem
// Speichern mit `status ∈ {available, reserved}` auf. Fehler werden gesammelt, deutsch und mit Feldname.

export interface PublishIssue {
  /** Feldpfad im Stück, z. B. `title`, `dimensions`, `images`. */
  field: string
  /** Deutsche Meldung mit dem Feldnamen, z. B. „Titel (Deutsch) fehlt.“ */
  message: string
}

export interface PublishImage {
  id: number | string
  alt?: LocalizedValue
  restricted?: boolean | null
}

export interface PublishDeclaration {
  id: number | string
  status?: string | null
  validFrom?: string | Date | null
}

export interface PublishBusiness {
  legalName?: string | null
  street?: string | null
  postalCode?: string | null
  city?: string | null
  email?: string | null
}

export interface PublishContext {
  /** `settings.legal.allowVisibleBlankBrands` (R-047). */
  allowVisibleBlankBrands: boolean
  /** `settings.business` (GPSR-Herstellerangaben, R-040). */
  business: PublishBusiness | null | undefined
  /** Aufgelöste Bilder aus `images` (fehlende = gelöscht). */
  images: readonly PublishImage[]
  /** Aufgelöste Einträge aus `conformityDeclarations`. */
  declarations: readonly PublishDeclaration[]
  now: Date
}

/** Stück wie gespeichert; lokalisierte Felder als `{ de, en }` oder als String (= Deutsch). */
export interface ProductForValidation {
  itemNumber?: number | null
  category?: ProductCategory | string | null
  title?: LocalizedValue
  description?: LocalizedValue
  juttaSays?: LocalizedValue
  priceCents?: number | null
  vatCategory?: string | null
  vatReducedReason?: string | null
  materials?: LocalizedValue
  dimensions?: {
    widthCm?: number | null
    heightCm?: number | null
    depthCm?: number | null
    diameterCm?: number | null
  } | null
  weightGrams?: number | null
  shippingClass?: string | null
  sizeLabel?: LocalizedValue
  condition?: string | null
  conditionNote?: LocalizedValue
  fiberComposition?: readonly FiberRow[] | null
  labelMissing?: boolean | null
  fiberFreeText?: LocalizedValue
  blankBrandVisible?: boolean | null
  foodContact?: string | null
  conformityDeclarations?: readonly unknown[] | null
  metalPartsMaterial?: LocalizedValue
  nickelFreeConfirmed?: boolean | null
  nickelEvidence?: unknown
  leadFreeGlazeConfirmed?: boolean | null
  smallPartsWarning?: boolean | null
  framed?: boolean | null
  frameHasGlass?: boolean | null
  safetyWarnings?: LocalizedValue
  deviationDecision?: string | null
  hasDeviation?: boolean | null
  deviationDescription?: LocalizedValue
  ownDesignConfirmed?: boolean | null
  images?: readonly unknown[] | null
}

/** ID aus einer Relation (ID oder befülltes Objekt). */
export function relationId(value: unknown): number | string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    return typeof id === 'number' || typeof id === 'string' ? id : null
  }
  return typeof value === 'number' || typeof value === 'string' ? value : null
}

const de = (v: LocalizedValue) => pickLocale(v, 'de', false)
const hasDimension = (d: ProductForValidation['dimensions']) =>
  !!d &&
  [d.widthCm, d.heightCm, d.depthCm, d.diameterCm].some((v) => typeof v === 'number' && v > 0)

/** Freitexte für den Lint (V-13, V-16) in beiden Sprachen. */
const LINT_FIELDS = [
  ['title', 'Titel'],
  ['description', 'Beschreibung'],
  ['juttaSays', '„Jutta sagt“'],
  ['materials', 'Material'],
  ['conditionNote', 'Zustand – Anmerkung'],
  ['deviationDescription', 'Abweichung – Beschreibung'],
] as const

function localesOf(value: LocalizedValue): [Locale, string][] {
  if (typeof value === 'string') return [['de', value]]
  if (!value || typeof value !== 'object') return []
  return (['de', 'en'] as const)
    .map((l) => [l, value[l]] as [Locale, string | null | undefined])
    .filter((e): e is [Locale, string] => typeof e[1] === 'string' && e[1].trim() !== '')
}

/**
 * `lebensmittelecht` nur mit ≥ 1 verknüpften Erklärung, jede `active` und `validFrom ≤ heute` (E-15, R-044).
 * Gilt schon beim Speichern eines Entwurfs (AK-7-01).
 */
export function checkFoodContact(
  product: Pick<ProductForValidation, 'foodContact' | 'conformityDeclarations'>,
  ctx: Pick<PublishContext, 'declarations' | 'now'>,
): PublishIssue[] {
  if (product.foodContact !== 'lebensmittelecht') return []
  const ids = (product.conformityDeclarations ?? []).map(relationId).filter((id) => id !== null)
  if (ids.length === 0) {
    return [
      {
        field: 'conformityDeclarations',
        message:
          'Konformitätserklärungen: „lebensmittelecht“ nur mit mindestens einer gültigen Konformitätserklärung.',
      },
    ]
  }
  const byId = new Map(ctx.declarations.map((d) => [String(d.id), d]))
  const invalid = ids.filter((id) => {
    const d = byId.get(String(id))
    if (!d || d.status !== 'active') return true
    const from = d.validFrom ? new Date(d.validFrom) : null
    return !from || Number.isNaN(from.getTime()) || from.getTime() > ctx.now.getTime()
  })
  return invalid.length > 0
    ? [
        {
          field: 'conformityDeclarations',
          message:
            'Konformitätserklärungen: jede verknüpfte Erklärung muss aktiv und schon gültig sein – sonst „Deko“ wählen.',
        },
      ]
    : []
}

/** Prüft alle Regeln aus §6.6.6; leere Liste = veröffentlichbar. */
export function validateForPublish(
  product: ProductForValidation,
  ctx: PublishContext,
): PublishIssue[] {
  const issues: PublishIssue[] = []
  const add = (field: string, message: string) => issues.push({ field, message })
  const category = product.category as ProductCategory | undefined

  // Allgemein (alle Kategorien, R-042)
  if (!category) add('category', 'Kategorie fehlt.')
  if (!isValidItemNumber(product.itemNumber)) add('itemNumber', 'Objektnummer fehlt.')
  if (!de(product.title)) add('title', 'Titel (Deutsch) fehlt.')
  if (!de(product.description)) add('description', 'Beschreibung (Deutsch) fehlt.')
  if (typeof product.priceCents !== 'number' || product.priceCents < 100) {
    add('priceCents', 'Preis fehlt (mindestens 1,00 €).')
  }
  if (!de(product.materials)) add('materials', 'Material (Deutsch) fehlt.')
  if (typeof product.weightGrams !== 'number' || product.weightGrams < 1) {
    add('weightGrams', 'Gewicht fehlt.')
  }
  if (!product.shippingClass) add('shippingClass', 'Versandklasse fehlt.')
  if (!de(product.safetyWarnings)) {
    add('safetyWarnings', 'Warn- und Sicherheitshinweise (Deutsch) fehlen.')
  }
  if (product.ownDesignConfirmed !== true) {
    add(
      'ownDesignConfirmed',
      'Bestätigung „nur eigene Figuren, keine fremden Marken“ fehlt (R-047).',
    )
  }

  // Bilder (R-042, R-191)
  const imageIds = (product.images ?? []).map(relationId).filter((id) => id !== null)
  if (imageIds.length === 0) add('images', 'Bilder: mindestens ein Foto fehlt.')
  if (imageIds.length > 12) add('images', 'Bilder: höchstens 12 Fotos.')
  const images = new Map(ctx.images.map((i) => [String(i.id), i]))
  imageIds.forEach((id, index) => {
    const image = images.get(String(id))
    const n = index + 1
    if (!image) return add('images', `Bilder: Foto ${n} gibt es nicht mehr.`)
    if (image.restricted)
      add('images', `Bilder: Foto ${n} ist gesperrt und darf nicht öffentlich sein.`)
    if (!pickLocale(image.alt, 'de', false))
      add('images', `Bilder: Foto ${n} braucht einen Alt-Text auf Deutsch.`)
    if (!pickLocale(image.alt, 'en', false))
      add('images', `Bilder: Foto ${n} braucht einen Alt-Text auf Englisch.`)
  })

  // Maße (nicht Textil/Cap)
  if (category && !isTextile(category) && !hasDimension(product.dimensions)) {
    add('dimensions', 'Maße: mindestens ein Maß (Breite, Höhe, Tiefe oder Durchmesser) fehlt.')
  }

  // Textil und Cap (R-043, R-047, R-048)
  if (isTextile(category)) {
    if (!de(product.sizeLabel)) add('sizeLabel', 'Größe (Deutsch) fehlt.')
    if (!product.condition) add('condition', 'Zustand fehlt.')
    for (const issue of checkFibers(product.fiberComposition, {
      labelMissing: product.labelMissing,
      fiberFreeTextDe: de(product.fiberFreeText),
    })) {
      add(issue.field, issue.message)
    }
    if (!product.deviationDecision) {
      add(
        'deviationDecision',
        'Abweichung geprüft: bitte „keine Abweichung“ wählen oder die Abweichung beschreiben (R-048).',
      )
    }
    if (product.blankBrandVisible === true && !ctx.allowVisibleBlankBrands) {
      add(
        'blankBrandVisible',
        'Fremdes Hersteller-Logo sichtbar: So ein Stück kann derzeit nicht veröffentlicht werden (R-047).',
      )
    }
  }

  // Keramik (R-044)
  if (category === 'keramik') {
    if (!product.foodContact) add('foodContact', 'Lebensmittelkontakt fehlt.')
    issues.push(...checkFoodContact(product, ctx))
  }

  // Zeichnung (R-046)
  if (category === 'zeichnung') {
    if (typeof product.framed !== 'boolean') add('framed', 'Angabe „Gerahmt“ fehlt.')
    if (
      product.framed &&
      product.frameHasGlass &&
      !containsWarning(de(product.safetyWarnings), 'product.glassFrame', 'de')
    ) {
      add(
        'safetyWarnings',
        `Warnhinweise: der Glas-Hinweis „${MANDATORY_WARNING_TEXTS['product.glassFrame'].de}“ fehlt.`,
      )
    }
  }

  // Schmuck (R-045)
  if (category === 'schmuck') {
    if (!de(product.metalPartsMaterial)) {
      add('metalPartsMaterial', 'Material der Metallteile (Deutsch) fehlt.')
    }
    if (product.nickelFreeConfirmed !== true) {
      add('nickelFreeConfirmed', 'Bestätigung „Metallteile nickelfrei, Nachweis liegt vor“ fehlt.')
    }
    if (relationId(product.nickelEvidence) === null) {
      add('nickelEvidence', 'Nickel-Nachweis (Lieferantenerklärung) fehlt.')
    }
    if (product.leadFreeGlazeConfirmed !== true) {
      add(
        'leadFreeGlazeConfirmed',
        'Bestätigung „Glasur bleifrei laut Hersteller-Datenblatt“ fehlt.',
      )
    }
    if (product.smallPartsWarning !== true) {
      add('smallPartsWarning', 'Kleinteile-Warnhinweis muss an sein.')
    } else if (!containsWarning(de(product.safetyWarnings), 'product.jewelrySmallParts', 'de')) {
      add('safetyWarnings', 'Warnhinweise: der Kleinteile-Hinweis fehlt.')
    }
  }

  // Abweichung (alle, R-048)
  if (product.hasDeviation && !de(product.deviationDescription)) {
    add('deviationDescription', 'Abweichung – Beschreibung (Deutsch) fehlt.')
  }

  // Freitexte: V-13 (R-044, R-045) und V-16 (R-047)
  for (const [field, label] of LINT_FIELDS) {
    for (const [locale, text] of localesOf(product[field])) {
      for (const hit of lintProductText(text)) {
        const lang = locale === 'de' ? 'Deutsch' : 'Englisch'
        add(
          field,
          hit.id === 'V-16'
            ? `${label} (${lang}): fremder Marken- oder Figurenname „${hit.label}“ ist nicht erlaubt (R-047).`
            : `${label} (${lang}): Aussage „${hit.label}“ nur über den Baustein mit Nachweis, nicht im Text.`,
        )
      }
    }
  }

  // Steuersatz (R-032, R-046)
  if (product.vatCategory === 'reduced_art') {
    if (category !== 'zeichnung') {
      add('vatCategory', 'Steuersatz: „ermäßigt“ gilt nur für Originalzeichnungen.')
    }
    if (!product.vatReducedReason || product.vatReducedReason.trim().length < 10) {
      add('vatReducedReason', 'Begründung für den ermäßigten Satz fehlt.')
    }
  }

  // Herstellerangaben (GPSR, R-040)
  const b = ctx.business
  const missing = (
    [
      ['legalName', 'Name'],
      ['street', 'Straße'],
      ['postalCode', 'PLZ'],
      ['city', 'Ort'],
      ['email', 'E-Mail'],
    ] as const
  ).filter(([key]) => !b?.[key]?.trim())
  if (missing.length > 0) {
    add(
      'business',
      `Einstellungen → Anbieterin unvollständig (${missing.map(([, l]) => l).join(', ')}) – nötig für die Herstellerangaben.`,
    )
  }

  return issues
}
