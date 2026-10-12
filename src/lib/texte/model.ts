// Webseitentexte als Liste (U-87, U-89, PLAN P18.2): alle Texte DE/EN, die Besucher:innen lesen – feste Texte der Seite
// (`src/i18n/messages`), Standardtexte der Verwaltung (`src/globals/siteTexts.defaults.json`), Seiten, Fragen,
// Kategorien und einige Einstellungen aus dem Seed (`content/seed/data`). Reine Funktionen auf den geladenen Daten:
// Einträge mit fester Kennung bilden und Änderungen per Kennung zurückschreiben.
//
// Nicht in der Liste (bleibt bei der Kanzlei bzw. ist Technik): Rechtstexte und rechtliche Seiten (`legal`, `withdraw`,
// `privacyExport`, „Versand & Zahlung“, Seiten „Widerruf“ und „Konformität“, Pflicht-Warnhinweise), die amtliche
// Gewährleistungs-Mitteilung, Mails zu Widerruf, Reklamation, Schlichtung, Datenschutz und Einwilligung, interne Texte
// (`qa`, `previewExport`), Adressen von Seiten (`slug`) und Texte, die die Seite nicht zeigt (von den Standardtexten der
// Verwaltung nutzt die Seite nur Grußformel und Antwortzeit der Mails). Rechtlich vorgegebene Wörter („Vertrag
// widerrufen“), Pflicht-Hinweise am Stück und die Namen der Rechtsseiten stehen in der Liste, sind aber nur zum Lesen.

import { AREA, faqWhere, messageWhere, pageWhere } from './where'

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
  /** Höchstlänge (aus dem Schema der Verwaltung). */
  maxLength?: number
  /** Weitere Prüfung aus dem Schema (z. B. Lieferzeit ohne „ca.“, R-035). */
  validate?: (value: unknown) => true | string
}

/** Regeln eines Feldes aus dem Schema der Verwaltung. */
export interface FieldRule {
  maxLength?: number
  validate?: (value: unknown) => true | string
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
  /** Regeln je Kennung (Seiten, Fragen, Kategorien, Einstellungen); ohne = keine. */
  fieldRule?: (id: string) => FieldRule
}

const EXCLUDED_NAMESPACES = new Set(['qa', 'previewExport', 'privacyExport', 'legal', 'withdraw'])
/** Rechtlich vorgegebene oder geprüfte Texte (Kanzlei, amtlicher Wortlaut) – nicht in der Liste. */
const EXCLUDED_PREFIXES = [
  'shop.warranty.', // amtliche Gewährleistungs-Mitteilung (DVO (EU) 2025/1960, R-049)
  'shippingPayment.', // Inhalt der Rechtsseite „Versand & Zahlung“ (R25)
  'email.withdrawalReceipt.',
  'email.complaintRepairChoice.',
  'email.disputeVsbg.',
  'email.privacyAccessResponse.',
  'email.privacyErasureResponse.',
  'email.consentWithdrawalConfirmation.',
  'email.common.warranty',
  'email.common.withdrawalInfo',
  'email.common.dhlConsent',
  'email.common.attAgb',
  'email.common.privacyLink',
  // Ersatztext; die Mail nimmt den Standardtext der Verwaltung („Antwortzeit“, in der Liste unter E-Mails)
  'email.inquiryReceipt.responseTime',
]
/** Feste Bezeichnungen mit rechtlicher Bedeutung – sichtbar, aber nur zum Lesen. */
const LOCKED_PREFIXES = [
  'shop.badges.decorative',
  'shop.badges.foodSafe',
  'shop.badges.smallParts',
  'shop.product.shipping.withdrawal',
  'checkout.legalLinks.',
  'checkout.dialogs.',
  'email.footer.',
  'orderStatus.docAgb',
  'orderStatus.docWithdrawal',
]
/** Von den Standardtexten der Verwaltung zeigt die Seite nur diese (Mails); die übrigen nutzt sie nicht. */
const USED_SITE_TEXTS = new Set(['emails.signature', 'emails.inquiryResponseTime'])
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

/**
 * Zeilen, die auf der Seite nirgends erscheinen (V-36, U-93) – nicht in der Liste. Feste Ersatztexte, die nur gelten,
 * wenn der Seite der passende Block fehlt (die Seite zeigt den Block aus der Verwaltung: Schritte und Formular der
 * Auftragsarbeiten, Ablauf-Schritte der Tattoo-Seite, Einleitung/Warnzeichen/Link der Aftercare-Seite). Der Test
 * `texte-cleanup` prüft, dass die Seiten diese Blöcke wirklich haben; die Schlüssel bleiben als Rückfall im Code.
 */
export const FALLBACK_ONLY_PREFIXES = [
  'tattoo.process.steps.',
  'tattoo.process.stepsHeading',
  'commission.steps.',
  'commission.stepsHeading',
  'commission.formHeading',
  'commission.formIntro',
  'tattoo.aftercare.intro',
  'tattoo.aftercare.warnHeading',
  'tattoo.aftercare.warnText',
  'tattoo.aftercare.saferHint',
  'tattoo.aftercare.saferLink',
] as const

/** Rang innerhalb eines Blatts (V-36: das Wichtigste vorne): Seitentexte, Kategorien, Fragen, Einstellungen, feste Texte. */
function rank(e: { id: string }): number {
  if (e.id.startsWith('seite:')) return /:(seo\.|title$)/.test(e.id) ? 1 : 0
  if (e.id.startsWith('kat:')) return 2
  if (e.id.startsWith('faq:')) return 3
  if (e.id.startsWith('einst:') || e.id.startsWith('st:')) return 4
  return 5
}

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
    if (EXCLUDED_PREFIXES.some((x) => key.startsWith(x))) continue
    if (FALLBACK_ONLY_PREFIXES.some((x) => key.startsWith(x))) continue
    const locked =
      (ns === 'common' && path[1] === 'routes' && LOCKED_ROUTES.has(path[2] ?? '')) ||
      LOCKED_PREFIXES.some((x) => key.startsWith(x)) ||
      LOCKED_WORDING.test(value) ||
      LOCKED_WORDING.test(enValue)
    out.push({
      id: `m:${key}`,
      sheet: NS_SHEET[ns] ?? 'Allgemein',
      where: messageWhere(path),
      de: value,
      en: enValue,
      ...(locked ? { locked: LOCK_REASON } : {}),
    })
  }
  // Standardtexte der Verwaltung
  for (const [group, fields] of Object.entries(d.siteTexts)) {
    const [sheet, label] = SITE_GROUP[group] ?? ['Allgemein', group]
    for (const [field, value] of Object.entries(fields)) {
      if (!USED_SITE_TEXTS.has(`${group}.${field}`)) continue
      const meta = d.siteTextFields.get(`${group}.${field}`)
      out.push({
        id: `st:${group}.${field}`,
        sheet,
        where: `${label} – ${meta?.label ?? field}`,
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
        where: faqWhere(faq, path.join('.')),
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
        where: `Shop – Kategorie „${name}“ › ${FIELD_LABEL[path.join('.')] ?? path.join('.')}`,
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
      where: `${AREA[sheet === 'Tattoo' ? 'tattoo' : 'checkout']} – ${label}`,
      de: value.de,
      en: value.en,
    })
  }
  if (d.fieldRule)
    for (const e of out) {
      if (e.id.startsWith('m:') || e.id.startsWith('st:')) continue
      const r = d.fieldRule(e.id)
      if (r.maxLength) e.maxLength = r.maxLength
      if (r.validate) e.validate = r.validate
    }
  const order = new Map(TEXT_SHEETS.map((s, i) => [s, i]))
  return out
    .map((e, i) => ({ e, i }))
    .sort(
      (a, b) => order.get(a.e.sheet)! - order.get(b.e.sheet)! || rank(a.e) - rank(b.e) || a.i - b.i,
    )
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
