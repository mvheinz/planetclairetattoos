import type { PublishIssue } from './validate'

// „Was fehlt noch?“ je Entwurf (V-32, U-93): dieselben Regeln wie beim Online-Stellen (`validateForPublish`, R-042 ff.),
// hier nur als kurze Stichworte für die Karte in „Meine Stücke“ und das Formular („fehlt: Faserangabe, Nickel-
// Nachweis“). Dazu freiwillige Tipps, die nie sperren (V-15: Schmuck → Foto an der Hand). Reines Modul.

/** Kurze Stichworte je Feld der Veröffentlichungsprüfung (Verwaltung nur Deutsch). */
export const READINESS_LABELS: Readonly<Record<string, string>> = {
  category: 'Kategorie',
  itemNumber: 'Nummer',
  title: 'Titel',
  description: 'Beschreibung',
  juttaSays: '„Jutta sagt“',
  priceCents: 'Preis',
  materials: 'Material',
  weightGrams: 'Gewicht',
  shippingClass: 'Versandklasse',
  safetyWarnings: 'Warnhinweise',
  ownDesignConfirmed: 'Häkchen „eigene Figuren“',
  images: 'Fotos',
  dimensions: 'Maße',
  sizeLabel: 'Größe',
  condition: 'Zustand',
  conditionNote: 'Zustand – Anmerkung',
  fiberComposition: 'Faserangabe',
  fiberFreeText: 'Faserangabe',
  deviationDecision: 'Abweichung geprüft',
  deviationDescription: 'Abweichung beschreiben',
  blankBrandVisible: 'fremdes Logo',
  foodContact: 'Lebensmittelkontakt',
  conformityDeclarations: 'Konformitätserklärung',
  framed: 'Angabe „gerahmt“',
  metalPartsMaterial: 'Metallteile',
  nickelFreeConfirmed: 'Häkchen „nickelfrei“',
  nickelEvidence: 'Nickel-Nachweis',
  leadFreeGlazeConfirmed: 'Häkchen „bleifrei“',
  smallPartsWarning: 'Kleinteile-Hinweis',
  vatCategory: 'Steuersatz',
  vatReducedReason: 'Begründung Steuersatz',
  business: 'Anbieterin (Einstellungen)',
}

/** Stichwort für eine Meldung von `validateForPublish`. */
export function readinessLabel(issue: PublishIssue): string {
  if (issue.message.startsWith('Bitte erst nachmessen')) return 'nachmessen'
  const head = issue.field.split('.')[0] ?? issue.field
  const label = READINESS_LABELS[head] ?? READINESS_LABELS[issue.field] ?? head
  if (head === 'images' && issue.message.includes('Alt-Text')) return 'Bildbeschreibung'
  // Wortwahl-Prüfung (V-13/V-16): fremde Namen oder Aussagen nur über Bausteine.
  if (/nicht erlaubt|nur über den Baustein/.test(issue.message)) return `${label} (Wortwahl)`
  return label
}

export interface ReadinessHint {
  id: 'scalePhotoHand'
  label: string
}

/** Freiwillige Tipps (sperren nie): Schmuck ohne Foto zum Größenvergleich → „Foto an der Hand“ (V-15). */
export function readinessHints(product: {
  category?: string | null
  scalePhoto?: unknown
}): ReadinessHint[] {
  const hints: ReadinessHint[] = []
  const scale = product.scalePhoto
  const hasScale = scale !== null && scale !== undefined && scale !== ''
  if (product.category === 'schmuck' && !hasScale) {
    hints.push({ id: 'scalePhotoHand', label: 'Foto an der Hand' })
  }
  return hints
}

export interface Readiness {
  /** Keine sperrende Meldung: „fertig“ (Tipps dürfen offen sein). */
  ready: boolean
  /** Stichworte der sperrenden Meldungen, ohne Doppel, in Reihenfolge der Prüfung. */
  missing: string[]
  /** Die vollständigen Meldungen (Formular „Was fehlt noch?“). */
  issues: PublishIssue[]
  /** Freiwillige Tipps. */
  hints: ReadinessHint[]
}

export function readinessOf(issues: readonly PublishIssue[], hints: ReadinessHint[]): Readiness {
  const missing: string[] = []
  for (const issue of issues) {
    const label = readinessLabel(issue)
    if (!missing.includes(label)) missing.push(label)
  }
  return { ready: issues.length === 0, missing, issues: [...issues], hints }
}

/** Höchstens so viele Stichworte auf der Karte, der Rest als „+N“. */
export const READINESS_SHOWN = 3

/** „Titel, Fotos, Gewicht +2“ – kurze Zeile für die Karte. */
export function missingLine(missing: readonly string[], shown = READINESS_SHOWN): string {
  const head = missing.slice(0, shown).join(', ')
  const rest = missing.length - shown
  return rest > 0 ? `${head} +${rest}` : head
}
