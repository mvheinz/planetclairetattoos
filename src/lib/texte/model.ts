// Webseitentexte als Liste (U-87, U-89, PLAN P18.2): alle Texte DE/EN, die Besucher:innen lesen – feste Texte der Seite
// (`src/i18n/messages`), Standardtexte der Verwaltung (`src/globals/siteTexts.defaults.json`), Seiten, Fragen,
// Kategorien und einige Einstellungen aus dem Seed (`content/seed/data`). Reine Funktionen auf den geladenen Daten:
// Einträge mit fester Kennung bilden und Änderungen per Kennung zurückschreiben.
//
// Nicht in der Liste (bleibt bei der Kanzlei bzw. ist Technik): Rechtstexte und rechtliche Seiten (`legal`, `withdraw`,
// `privacyExport`, Seiten „Widerruf“ und „Konformität“, Pflicht-Warnhinweise), interne Texte (`qa`, `previewExport`)
// und Adressen von Seiten (`slug`). Rechtlich vorgegebene Wörter („Vertrag widerrufen“) und die Namen der Rechtsseiten
// stehen in der Liste, sind aber nur zum Lesen.

export type L10n = { de: string; en: string }
type Json = unknown

export const TEXT_SHEETS = [
  'Startseite',
  'Shop',
  'Tattoo',
  'Seiten',
  'Fragen (FAQ)',
  'Kasse & Bestellung',
  'E-Mails',
  'Allgemein',
] as const
export type TextSheet = (typeof TEXT_SHEETS)[number]

export interface TextEntry {
  /** Feste Kennung, z. B. `m:home.tour.heading`, `seite:home:layout.0.heading`. */
  id: string
  sheet: TextSheet
  /** Wo der Text steht (für Jutta). */
  where: string
  de: string
  en: string
  /** Nur zum Lesen – Grund. */
  locked?: string
  /** Höchstlänge (Verwaltungsfelder). */
  maxLength?: number
}

export interface TextData {
  messages: { de: Record<string, Json>; en: Record<string, Json> }
  siteTexts: Record<string, Record<string, L10n>>
  /** Beschriftung und Höchstlänge der Verwaltungsfelder (`footer.tagline` → …). */
  siteTextFields: ReadonlyMap<string, { label: string; maxLength?: number }>
  pages: Record<string, Json>[]
  faqs: Record<string, Json>[]
  base: { categories: Record<string, Json>[]; settings: Record<string, Json> } & Record<
    string,
    Json
  >
}

const EXCLUDED_NAMESPACES = new Set(['qa', 'previewExport', 'privacyExport', 'legal', 'withdraw'])
const EXCLUDED_PAGES = new Set(['withdrawal', 'conformity'])
const SETTINGS_TEXTS: readonly [string, string, TextSheet][] = [
  ['shipping.deliveryTimeText', 'Lieferzeit', 'Kasse & Bestellung'],
  ['pickup.instructions', 'Abholung in Berlin', 'Kasse & Bestellung'],
  ['tattoo.priceNote', 'Hinweis zu Tattoo-Preisen', 'Tattoo'],
]
/** Namen der Rechtsseiten (Navigation, Footer) – rechtlich vorgegeben. */
const LOCKED_ROUTES = new Set(['R21', 'R22', 'R23', 'R24', 'R25', 'R26', 'R27'])
const LOCKED_WORDING =
  /Vertrag widerrufen|Zahlungspflichtig bestellen|Withdraw from contract|Order with obligation to pay/i
const LOCK_REASON = 'rechtlich vorgegeben – nur zum Lesen'

const NS_SHEET: Record<string, TextSheet> = {
  home: 'Startseite',
  shop: 'Shop',
  cart: 'Shop',
  archive: 'Shop',
  tattoo: 'Tattoo',
  commission: 'Tattoo',
  checkout: 'Kasse & Bestellung',
  order: 'Kasse & Bestellung',
  orderStatus: 'Kasse & Bestellung',
  thanks: 'Kasse & Bestellung',
  shippingPayment: 'Kasse & Bestellung',
  email: 'E-Mails',
}
const NS_LABEL: Record<string, string> = {
  home: 'Startseite',
  shop: 'Shop',
  cart: 'Warenkorb',
  archive: 'Archiv',
  tattoo: 'Tattoo',
  commission: 'Auftragsarbeiten',
  checkout: 'Kasse',
  order: 'Bestellung',
  orderStatus: 'Bestellstatus',
  thanks: 'Danke-Seite',
  shippingPayment: 'Versand & Zahlung',
  email: 'E-Mail',
  common: 'Allgemein',
  header: 'Kopfzeile',
  menu: 'Menü',
  footer: 'Fußzeile',
  errors: 'Fehler',
  seo: 'Suchmaschinen',
  contact: 'Kontakt',
  about: 'Über mich',
  share: 'Teilen',
  a11y: 'Vorlesehilfe',
  ui: 'Bedienung',
}
const SITE_GROUP: Record<string, [TextSheet, string]> = {
  navigation: ['Allgemein', 'Menü'],
  footer: ['Allgemein', 'Fußzeile'],
  shop: ['Shop', 'Shop'],
  product: ['Shop', 'Stück'],
  cart: ['Shop', 'Warenkorb'],
  checkout: ['Kasse & Bestellung', 'Kasse'],
  thanks: ['Kasse & Bestellung', 'Danke-Seite'],
  orderStatus: ['Kasse & Bestellung', 'Bestellstatus'],
  withdrawal: ['Kasse & Bestellung', 'Widerruf (Formular)'],
  notFound: ['Allgemein', 'Seite nicht gefunden'],
  errors: ['Allgemein', 'Fehler'],
  emails: ['E-Mails', 'E-Mails'],
}
const PAGE_SHEET: Record<string, TextSheet> = {
  home: 'Startseite',
  shop: 'Shop',
  archive: 'Shop',
  tattoo: 'Tattoo',
  tattoo_aftercare: 'Tattoo',
  commissions: 'Tattoo',
  order_status: 'Kasse & Bestellung',
  thanks: 'Kasse & Bestellung',
}
const BLOCK_LABEL: Record<string, string> = {
  hero: 'Kopf',
  imageText: 'Bild mit Text',
  station: 'Station',
  richText: 'Text',
  text: 'Text',
  steps: 'Schritte',
  faq: 'Fragen',
  cta: 'Aufruf',
  contactForm: 'Kontaktformular',
  gallery: 'Galerie',
}
const FIELD_LABEL: Record<string, string> = {
  title: 'Titel',
  heading: 'Überschrift',
  subheading: 'Unterzeile',
  content: 'Text',
  text: 'Text',
  label: 'Link-Text',
  caption: 'Bildunterschrift',
  emailSubject: 'Betreff der Mail',
  question: 'Frage',
  answer: 'Antwort',
  name: 'Name',
  intro: 'Einleitung',
}

const isL10n = (v: Json): v is L10n =>
  !!v &&
  typeof v === 'object' &&
  !Array.isArray(v) &&
  Object.keys(v).length === 2 &&
  typeof (v as L10n).de === 'string' &&
  typeof (v as L10n).en === 'string'

/** Alle `{de, en}`-Paare unter `node` mit Pfad (ohne `slug`). */
function pairs(node: Json, path: string[] = []): { path: string[]; value: L10n }[] {
  if (isL10n(node)) return [{ path, value: node }]
  if (Array.isArray(node)) return node.flatMap((v, i) => pairs(v, [...path, String(i)]))
  if (node && typeof node === 'object')
    return Object.entries(node).flatMap(([k, v]) => (k === 'slug' ? [] : pairs(v, [...path, k])))
  return []
}

function leaves(node: Json, path: string[] = []): { path: string[]; value: string }[] {
  if (typeof node === 'string') return [{ path, value: node }]
  if (node && typeof node === 'object' && !Array.isArray(node))
    return Object.entries(node).flatMap(([k, v]) => leaves(v, [...path, k]))
  return []
}

function getAt(node: Json, path: readonly string[]): Json {
  return path.reduce<Json>(
    (n, k) => (n && typeof n === 'object' ? (n as Record<string, Json>)[k] : undefined),
    node,
  )
}

/** Seiten-Pfad lesbar: `layout.2.link.label` → „Block 3 (Station) › Link-Text“. */
function pageWhere(page: Record<string, Json>, path: readonly string[]): string {
  const title = isL10n(page.title) ? page.title.de : String(page.key)
  const parts: string[] = [`Seite „${title}“`]
  for (let i = 0; i < path.length; i++) {
    const k = path[i]!
    if (k === 'layout' && /^\d+$/.test(path[i + 1] ?? '')) {
      const n = Number(path[++i])
      const block = getAt(page, ['layout', String(n)]) as { blockType?: string } | undefined
      const type = block?.blockType ?? ''
      parts.push(`Block ${n + 1}${type ? ` (${BLOCK_LABEL[type] ?? type})` : ''}`)
    } else if (/^\d+$/.test(k)) parts.push(`Nr. ${Number(k) + 1}`)
    else if (k !== 'link') parts.push(FIELD_LABEL[k] ?? k)
  }
  if (path.length === 1 && path[0] === 'title') return `${parts[0]} › Titel`
  return parts.join(' › ')
}

/** Alle Einträge der Texte-Liste in fester Reihenfolge (Blätter, dann Quelle). */
export function textEntries(d: TextData): TextEntry[] {
  const out: TextEntry[] = []
  // feste Texte der Seite
  const en = d.messages.en
  for (const { path, value } of leaves(d.messages.de)) {
    const ns = path[0]!
    if (EXCLUDED_NAMESPACES.has(ns)) continue
    const enValue = getAt(en, path)
    if (typeof enValue !== 'string') continue
    const key = path.join('.')
    const locked =
      (ns === 'common' && path[1] === 'routes' && LOCKED_ROUTES.has(path[2] ?? '')) ||
      LOCKED_WORDING.test(value) ||
      LOCKED_WORDING.test(enValue)
    out.push({
      id: `m:${key}`,
      sheet: NS_SHEET[ns] ?? 'Allgemein',
      where: `${NS_LABEL[ns] ?? ns} › ${path.slice(1).join('.')}`,
      de: value,
      en: enValue,
      ...(locked ? { locked: LOCK_REASON } : {}),
    })
  }
  // Standardtexte der Verwaltung
  for (const [group, fields] of Object.entries(d.siteTexts)) {
    const [sheet, label] = SITE_GROUP[group] ?? ['Allgemein', group]
    for (const [field, value] of Object.entries(fields)) {
      const meta = d.siteTextFields.get(`${group}.${field}`)
      out.push({
        id: `st:${group}.${field}`,
        sheet,
        where: `${label} › ${meta?.label ?? field}`,
        de: value.de,
        en: value.en,
        ...(meta?.maxLength ? { maxLength: meta.maxLength } : {}),
      })
    }
  }
  // Seiten
  for (const page of d.pages) {
    const key = String(page.key)
    if (EXCLUDED_PAGES.has(key)) continue
    for (const { path, value } of pairs(page)) {
      out.push({
        id: `seite:${key}:${path.join('.')}`,
        sheet: PAGE_SHEET[key] ?? 'Seiten',
        where: pageWhere(page, path),
        de: value.de,
        en: value.en,
      })
    }
  }
  // Fragen
  for (const faq of d.faqs) {
    for (const { path, value } of pairs(faq)) {
      out.push({
        id: `faq:${String(faq.key)}:${path.join('.')}`,
        sheet: 'Fragen (FAQ)',
        where: `${String(faq.key)} › ${FIELD_LABEL[path.join('.')] ?? path.join('.')}`,
        de: value.de,
        en: value.en,
      })
    }
  }
  // Kategorien
  for (const cat of d.base.categories) {
    const name = isL10n(cat.name) ? cat.name.de : String(cat.key)
    for (const { path, value } of pairs(cat)) {
      out.push({
        id: `kat:${String(cat.key)}:${path.join('.')}`,
        sheet: 'Shop',
        where: `Kategorie „${name}“ › ${FIELD_LABEL[path.join('.')] ?? path.join('.')}`,
        de: value.de,
        en: value.en,
      })
    }
  }
  // Einstellungen
  for (const [path, label, sheet] of SETTINGS_TEXTS) {
    const value = getAt(d.base.settings, path.split('.'))
    if (!isL10n(value)) continue
    out.push({
      id: `einst:${path}`,
      sheet,
      where: `Einstellung › ${label}`,
      de: value.de,
      en: value.en,
    })
  }
  const order = new Map(TEXT_SHEETS.map((s, i) => [s, i]))
  return out
    .map((e, i) => ({ e, i }))
    .sort((a, b) => order.get(a.e.sheet)! - order.get(b.e.sheet)! || a.i - b.i)
    .map(({ e }) => e)
}

/** Welche Datei eine Kennung ändert (für „nur geänderte Dateien schreiben“). */
export type TextFile = 'messages.de' | 'messages.en' | 'siteTexts' | 'pages' | 'faqs' | 'base'

function setAt(node: Json, path: readonly string[], value: string): boolean {
  const parent = getAt(node, path.slice(0, -1))
  const last = path.at(-1)!
  if (!parent || typeof parent !== 'object') return false
  const obj = parent as Record<string, Json>
  if (typeof obj[last] !== 'string') return false
  obj[last] = value
  return true
}

/**
 * Text per Kennung in `d` setzen (verändert `d`). Gibt die geänderte Datei zurück oder `null`, wenn es die Kennung
 * nicht (mehr) gibt.
 */
export function setText(
  d: TextData,
  id: string,
  lang: 'de' | 'en',
  value: string,
): TextFile | null {
  const [kind, ...rest] = id.split(':')
  const ref = rest.join(':')
  switch (kind) {
    case 'm':
      return setAt(d.messages[lang], ref.split('.'), value) ? `messages.${lang}` : null
    case 'st': {
      const [group, field] = ref.split('.')
      const entry = d.siteTexts[group!]?.[field!]
      if (!entry) return null
      entry[lang] = value
      return 'siteTexts'
    }
    case 'seite':
    case 'faq':
    case 'kat': {
      const [key, path] = [rest[0]!, rest.slice(1).join(':')]
      const list = kind === 'seite' ? d.pages : kind === 'faq' ? d.faqs : d.base.categories
      const doc = list.find((x) => String(x.key) === key)
      if (!doc) return null
      const ok = setAt(doc, [...path.split('.'), lang], value)
      return ok ? (kind === 'seite' ? 'pages' : kind === 'faq' ? 'faqs' : 'base') : null
    }
    case 'einst':
      return setAt(d.base.settings, [...ref.split('.'), lang], value) ? 'base' : null
    default:
      return null
  }
}
