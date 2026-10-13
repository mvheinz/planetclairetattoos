// Fundort eines Textes in Juttas Worten (V-36, U-93): „Startseite – Text unter Koko“ statt „Seite „Startseite“ ›
// Block 2 (Bild mit Text) › Text“, „Kasse – Fehlermeldungen › E-Mail“ statt „Kasse › errors.email“. Reine Funktionen;
// unbekannte Teile bleiben als Schlüssel stehen (die Kennung steht ohnehin in der letzten Spalte).

/** Bereich je Namensraum der festen Texte. */
export const AREA: Record<string, string> = {
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
  email: 'E-Mails an Kund:innen',
  common: 'Überall',
  header: 'Kopfzeile',
  menu: 'Menü',
  footer: 'Fußzeile',
  errors: 'Fehlerseiten',
  seo: 'Suchmaschinen (Google)',
  contact: 'Kontakt',
  about: 'Jutta & Coco',
  share: 'Teilen-Knopf',
  a11y: 'Vorlesehilfe (unsichtbar)',
  ui: 'Bedienung',
}

/** Häufige Teile der Schlüssel in Juttas Worten. */
const WORDS: Record<string, string> = {
  title: 'Überschrift',
  titleShort: 'kurze Überschrift',
  heading: 'Überschrift',
  subheading: 'Unterzeile',
  lead: 'Einleitung',
  intro: 'Einleitung',
  introMore: 'Einleitung (mehr)',
  text: 'Text',
  content: 'Text',
  label: 'Beschriftung',
  button: 'Knopf',
  hint: 'Hinweis',
  note: 'Hinweis',
  notes: 'Hinweise',
  errors: 'Fehlermeldungen',
  error: 'Fehlermeldung',
  fields: 'Felder',
  form: 'Formular',
  steps: 'Schritte',
  stepsHeading: 'Überschrift der Schritte',
  emptyTitle: 'Überschrift, wenn noch nichts da ist',
  emptyText: 'Text, wenn noch nichts da ist',
  emptyAction: 'Knopf, wenn noch nichts da ist',
  empty: 'wenn noch nichts da ist',
  subject: 'Betreff',
  greeting: 'Anrede',
  closing: 'Gruß',
  product: 'Stückseite',
  list: 'Liste',
  card: 'Karte',
  gallery: 'Bildergalerie',
  badges: 'Schildchen',
  category: 'Kategorie',
  mail: 'Mail',
  overview: 'Übersicht',
  prices: 'Preise',
  process: 'Ablauf',
  aftercare: 'Aftercare',
  flash: 'Flash',
  faq: 'Fragen',
  contact: 'Kontakt',
  tour: 'Tour-Tafel (Markttermine)',
  bank: 'Bankdaten',
  method: 'Zahlart',
  countdown: 'Reservierungs-Uhr',
  mock: 'Test-Zahlung',
  sections: 'Abschnitte',
  order: 'Bestellung',
  stripe: 'Kartenzahlung',
  overviewHeading: 'Überschrift der Übersicht',
  dialogs: 'Rückfragen',
  legalLinks: 'Links zu den Rechtstexten',
  routes: 'Seitennamen',
  shopFacts: 'Shop-Fakten',
  descriptions: 'Beschreibungen',
  og: 'Vorschaubild beim Teilen',
  upload: 'Foto hochladen',
  objectTypes: 'Gegenstände',
  booking: 'Anfragen offen / ausgebucht',
  state: 'Zustand',
  blocked: 'gesperrt',
  info: 'Info',
  email: 'E-Mail',
  name: 'Name',
  address: 'Adresse',
  phone: 'Telefon',
  message: 'Nachricht',
  submit: 'Absende-Knopf',
  success: 'nach dem Absenden',
  copied: 'kopiert',
  copy: 'kopieren',
  shipping: 'Versand',
  pickup: 'Abholung',
  delivery: 'Lieferung',
  total: 'Summe',
  subtotal: 'Zwischensumme',
  gift: 'Geschenk',
  privacy: 'Datenschutz',
  checkout: 'Kasse',
  close: 'Schließen',
  language: 'Sprache',
  claim: 'Unterzeile',
  siteName: 'Name der Seite',
  soldStamp: 'Stempel „verkauft“',
  orderNumber: 'Bestellnummer',
  itemNumber: 'Stück-Nummer',
  itemsHeading: 'Überschrift der Stücke',
  paymentMethod: 'Zahlart',
  orderShipped: 'Mail „versendet“',
  orderConfirmation: 'Mail „Bestellung bestätigt“',
  refundConfirmation: 'Mail „Erstattung“',
  pickupReady: 'Mail „abholbereit“',
  oversoldApology: 'Mail „Stück schon weg“',
  prepaymentInstructions: 'Mail „Vorkasse: so zahlst du“',
  prepaymentReminder: 'Mail „Vorkasse: Erinnerung“',
  prepaymentReceived: 'Mail „Vorkasse: Geld ist da“',
  prepaymentCancelled: 'Mail „Vorkasse: storniert“',
  inquiryReceipt: 'Mail „Anfrage angekommen“',
  stationKicker: 'Stationen: kleine Zeile oben',
  stationMore: 'Stationen: Link „mehr“',
  stationAll: 'Stationen: Link „alle“',
  stationEmpty: 'Stationen: wenn leer',
  stationProducts: 'Stationen: Stücke',
  stationArchive: 'Stationen: Archiv',
  chairwomanAlt: 'Bildbeschreibung Koko',
  chairwomanAltAsleep: 'Bildbeschreibung Koko (schlafend)',
  instagramLabel: 'Instagram-Link',
}

/** Schlüsselteil lesbar machen: Wörterbuch, Zahlen als „Nr. 2“, sonst unverändert. */
export function word(segment: string): string {
  if (WORDS[segment]) return WORDS[segment]
  if (/^\d+$/.test(segment)) return `Nr. ${segment}`
  return segment
}

/** Fester Text `ns.a.b.c` → „Bereich – a › b › c“ (Teile übersetzt, soweit bekannt). */
export function messageWhere(path: readonly string[]): string {
  const [ns, ...rest] = path
  const area = AREA[ns!] ?? ns!
  if (rest.length === 0) return area
  return `${area} – ${rest.map(word).join(' › ')}`
}

/** Seiten in Juttas Worten (Seitenschlüssel → Name). */
export const PAGE_NAME: Record<string, string> = {
  home: 'Startseite',
  about: 'Jutta & Coco',
  contact: 'Kontakt',
  commissions: 'Auftragsarbeiten',
  tattoo: 'Tattoo',
  tattoo_aftercare: 'Aftercare-Seite',
  shop: 'Shop',
  archive: 'Archiv',
  order_status: 'Bestellstatus',
  thanks: 'Danke-Seite',
  not_found: 'Seite nicht gefunden',
}

/** Blöcke in Juttas Worten (je Seite, wo es eindeutiger geht). */
const BLOCK_PLACE: Record<string, string> = {
  hero: 'große Überschrift oben',
  imageText: 'Text mit Bild',
  station: 'Station',
  richText: 'Text',
  text: 'Text',
  processSteps: 'Schritte',
  aftercareSteps: 'Pflege-Phasen',
  imageGallery: 'Bilder',
  callout: 'Hinweis-Kasten',
  commissionForm: 'Formular',
  faqList: 'Fragen',
  contactLinks: 'Kontakt-Kasten',
  flashGrid: 'Flash-Motive',
  tattooGallery: 'Tattoo-Galerie',
  priceInfo: 'Preise',
  categoryTeaser: 'Kategorien',
}
const HOME_PLACE: Record<string, string> = {
  hero: 'oben bei Koko',
  imageText: 'Text unter Koko',
}
const ROW_NAME: Record<string, string> = { steps: 'Schritt', phases: 'Phase', images: 'Bild' }
const FIELD: Record<string, string> = {
  title: 'Titel',
  heading: 'Überschrift',
  subheading: 'Unterzeile',
  content: 'Text',
  text: 'Text',
  label: 'Link-Text',
  caption: 'Bildunterschrift',
  emailSubject: 'Betreff der Mail',
  successText: 'Text nach dem Absenden',
  intro: 'Einleitung',
  question: 'Frage',
  answer: 'Antwort',
  name: 'Name',
  metaTitle: 'Titel bei Google',
  metaDescription: 'Beschreibung bei Google',
}

type Json = unknown
type Block = { blockType?: string; heading?: unknown }

const de = (v: Json): string =>
  v && typeof v === 'object' && typeof (v as { de?: unknown }).de === 'string'
    ? (v as { de: string }).de
    : typeof v === 'string'
      ? v
      : ''

const short = (s: string, n = 40) => {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > n ? `${one.slice(0, n - 1)}…` : one
}

/**
 * Seiten-Pfad in Juttas Worten: `home` + `layout.1.content` → „Startseite – Text unter Koko“; `layout.2.link.label` →
 * „Startseite – Station „Keramik“ › Link-Text“; `layout.0.steps.1.text` → „Auftragsarbeiten – Schritte › Schritt 2 ›
 * Text“; `seo.metaTitle` → „Startseite – Titel bei Google“; `title` → „Startseite – Name der Seite (oben im Browser)“.
 */
export function pageWhere(page: Record<string, Json>, path: readonly string[]): string {
  const key = String(page.key)
  const name = PAGE_NAME[key] ?? (de(page.title) || key)
  if (path.length === 1 && path[0] === 'title') return `${name} – Name der Seite (oben im Browser)`
  const parts: string[] = []
  const layout = Array.isArray(page.layout) ? (page.layout as Block[]) : []
  for (let i = 0; i < path.length; i++) {
    const k = path[i]!
    if (k === 'layout' && /^\d+$/.test(path[i + 1] ?? '')) {
      const n = Number(path[++i])
      const block = layout[n] ?? {}
      const type = block.blockType ?? ''
      const sameType = layout.filter((b) => b.blockType === type)
      const place = (key === 'home' ? HOME_PLACE[type] : undefined) ?? BLOCK_PLACE[type] ?? type
      if (type === 'station' && de(block.heading))
        parts.push(`Station „${short(de(block.heading))}“`)
      else if (sameType.length > 1) parts.push(`${place} ${sameType.indexOf(block) + 1}`)
      else parts.push(place)
    } else if (ROW_NAME[k] && /^\d+$/.test(path[i + 1] ?? '')) {
      parts.push(`${ROW_NAME[k]} ${Number(path[++i]) + 1}`)
    } else if (/^\d+$/.test(k)) parts.push(`Nr. ${Number(k) + 1}`)
    else if (k === 'link' || k === 'seo') continue
    else parts.push(FIELD[k] ?? k)
  }
  // Ein Block mit genau einem Text braucht keinen Feldnamen („Text unter Koko“ statt „Text unter Koko › Text“)
  if (
    parts.length === 2 &&
    (parts[1] === 'Text' || parts[1] === 'Überschrift') &&
    path[0] === 'layout'
  ) {
    const block = layout[Number(path[1])] ?? {}
    const texts = Object.keys(block).filter((f) =>
      ['heading', 'subheading', 'content', 'text', 'caption', 'intro'].includes(f),
    )
    if (texts.length === 1) return `${name} – ${parts[0]}`
  }
  return `${name} – ${parts.join(' › ')}`
}

/** Frage (FAQ) in Juttas Worten: „Fragen – „Ab wie vielen Jahren …?“ › Antwort“. */
export function faqWhere(faq: Record<string, Json>, field: string): string {
  const q = de(faq.question)
  const label = q ? `„${short(q, 50)}“` : String(faq.key)
  return `Fragen – ${label} › ${FIELD[field] ?? field}`
}
