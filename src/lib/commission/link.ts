import {
  INQUIRY_OBJECT_TYPES,
  type InquiryObjectType,
  type Locale,
  type ProductCategory,
} from '@/lib/enums'
import { isValidItemNumber } from '@/lib/products/itemNumber'
import { localizedPath } from '@/lib/routes/paths'

// Links auf das Anfrageformular (R10) mit Vorauswahl (V-11 a, V-20; U-93). Reines Modul ohne Datenbank.
// - `?art=<Gegenstand>` wählt „Was soll es werden?“ vor, z. B. „Zeichnung auf Anfrage“ von der Startseite.
// - `?nach=<Nr.>` – „Etwas Ähnliches anfragen“ bei einem verkauften Stück: Das Formular zeigt „So etwas wie Nr. 115 …“
//   mit Bild, wählt die Art des Stücks vor und schickt die öffentliche Nummer mit (Feld `similarTo` der Anfrage).
// Beide Werte sind keine Eingaben der Besucherin (R-137: Eingaben nie in der URL), nur öffentliche Angaben. Unbekannte
// oder ungültige Werte werden stillschweigend ignoriert.

export const COMMISSION_TYPE_PARAM = 'art'
export const COMMISSION_SIMILAR_PARAM = 'nach'
/** Name des versteckten Formularfelds mit der Nummer des Anlass-Stücks (wie der Parameter). */
export const COMMISSION_SIMILAR_FIELD = COMMISSION_SIMILAR_PARAM

export interface CommissionPrefill {
  objectType?: InquiryObjectType
  /** Öffentliche Objektnummer des Stücks, das die Anfrage auslöst (V-20). */
  similarTo?: number
}

const isObjectType = (v: unknown): v is InquiryObjectType =>
  typeof v === 'string' && (INQUIRY_OBJECT_TYPES as readonly string[]).includes(v)

/** Objektnummer aus einem Parameter- oder Formularwert („115“, „0115“); alles andere → `undefined`. */
export function parseSimilarTo(value: unknown): number | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string' || !/^\d{1,6}$/.test(raw.trim())) return undefined
  const nr = Number.parseInt(raw.trim(), 10)
  return isValidItemNumber(nr) ? nr : undefined
}

/** Parameter der Seite R10 → Vorauswahl (erster Wert zählt, Ungültiges entfällt). */
export function parseCommissionParams(
  params: Record<string, string | string[] | undefined> | null | undefined,
): CommissionPrefill {
  const out: CommissionPrefill = {}
  const type = params?.[COMMISSION_TYPE_PARAM]
  const first = Array.isArray(type) ? type[0] : type
  if (isObjectType(first)) out.objectType = first
  const similar = parseSimilarTo(params?.[COMMISSION_SIMILAR_PARAM])
  if (similar !== undefined) out.similarTo = similar
  return out
}

/** Adresse des Anfrageformulars mit Vorauswahl (`/de/auftragsarbeiten?art=zeichnung`, `…?nach=115`). */
export function commissionHref(locale: Locale, prefill: CommissionPrefill = {}): string {
  const sp = new URLSearchParams()
  if (prefill.similarTo !== undefined && isValidItemNumber(prefill.similarTo))
    sp.set(COMMISSION_SIMILAR_PARAM, String(prefill.similarTo))
  else if (prefill.objectType) sp.set(COMMISSION_TYPE_PARAM, prefill.objectType)
  const query = sp.toString()
  return `${localizedPath('R10', locale)}${query ? `?${query}` : ''}`
}

/** Gegenstand je Kategorie, wo es genau einen gibt (Keramik und Textil hängen vom Stück ab, Sonstiges bleibt offen). */
const BY_CATEGORY: Partial<Record<ProductCategory, InquiryObjectType>> = {
  cap: 'cap',
  zeichnung: 'zeichnung',
  schmuck: 'schmuck',
}

/** Keramik/Textil: Art aus dem Namen des Stücks (Deutsch oder Englisch), sonst keine Vorauswahl. */
const BY_TITLE: readonly { category: ProductCategory; re: RegExp; type: InquiryObjectType }[] = [
  { category: 'keramik', re: /teller|\bplates?\b/i, type: 'teller' },
  { category: 'keramik', re: /sch(a|ä)l(e|chen)|\bbowls?\b/i, type: 'schale' },
  { category: 'keramik', re: /tasse|becher|\bcups?\b|\bmugs?\b/i, type: 'tasse' },
  { category: 'keramik', re: /fliese|kachel|\btiles?\b/i, type: 'fliese' },
  { category: 'textil', re: /shirt|\btop\b|tanktop|\btank top\b/i, type: 'shirt' },
  { category: 'textil', re: /.*/, type: 'textil_sonstiges' },
]

/**
 * Vorauswahl „Was soll es werden?“ für ein Stück (V-20): Kategorie mit eindeutigem Gegenstand, sonst der Name (eine
 * Schale → „Schale“). Passt nichts (z. B. eine Keramikfigur), bleibt die Auswahl leer – die Besucherin wählt selbst.
 */
export function objectTypeForProduct(
  category: ProductCategory,
  title?: string | null,
): InquiryObjectType | undefined {
  const direct = BY_CATEGORY[category]
  if (direct) return direct
  // ohne Namen (z. B. leere Station „Textil“ auf der Startseite) keine Vermutung – sonst stünde „anderes Textil“ da
  const name = title?.trim()
  if (!name) return undefined
  return BY_TITLE.find((r) => r.category === category && r.re.test(name))?.type
}
