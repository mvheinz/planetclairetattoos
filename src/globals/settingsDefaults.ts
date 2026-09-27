import type { Locale, PackagingMaterial, ProductCategory, ShippingClass } from '@/lib/enums'
import { LEGAL_TEXT_TYPES } from '@/lib/enums'

// Standardwerte des Globals `settings` (DATENMODELL §7.1, Texte laut SEED-SPEC §3.1/§3.2). Der Grund-Seed (P1.29)
// füllt damit nur leere Felder; Payload zeigt sie, solange das Global noch nie gespeichert wurde.

export const DEFAULT_IBAN = 'DE36000000000000000000'
export const DEFAULT_TAX_MODES = [
  { mode: 'kleinunternehmer', validFrom: '2026-01-01T00:00:00.000Z' },
]

export const DEFAULT_SHIPPING_RATES: {
  zone: 'DE'
  shippingClass: Exclude<ShippingClass, 'nur_abholung'>
  priceCents: number
}[] = [
  { zone: 'DE', shippingClass: 'brief', priceCents: 450 },
  { zone: 'DE', shippingClass: 'paket_klein', priceCents: 650 },
  { zone: 'DE', shippingClass: 'keramik', priceCents: 890 },
]

const DHL_TRACKING =
  'https://www.dhl.de/de/privatkunden/pakete-empfangen/verfolgen.html?piececode={trackingNumber}'
export const DEFAULT_TRACKING_TEMPLATES = [
  { carrier: 'dhl', urlTemplate: DHL_TRACKING },
  { carrier: 'deutsche_post', urlTemplate: DHL_TRACKING },
]

/** Schätzwerte (KA-29, DM-08) – Jutta wiegt nach. */
export const DEFAULT_PACKAGING_TEMPLATES: {
  key: string
  name: string
  components: { material: PackagingMaterial; grams: number }[]
}[] = [
  {
    key: 'brief-karton',
    name: 'Kartonumschlag',
    components: [{ material: 'paper_cardboard', grams: 60 }],
  },
  {
    key: 'tasche-papier',
    name: 'Papier-Versandtasche',
    components: [{ material: 'paper_cardboard', grams: 90 }],
  },
  {
    key: 'keramik-doppelkarton',
    name: 'Karton in Karton mit Papierpolster',
    components: [{ material: 'paper_cardboard', grams: 900 }],
  },
]
export const DEFAULT_PACKAGING_BY_CLASS = [
  { shippingClass: 'brief', templateKey: 'brief-karton' },
  { shippingClass: 'paket_klein', templateKey: 'tasche-papier' },
  { shippingClass: 'keramik', templateKey: 'keramik-doppelkarton' },
]

export const DEFAULT_LEGAL_REVIEWS = LEGAL_TEXT_TYPES.map((type) => ({ type }))

type L10n = Record<Locale, string>
export const localized = (texts: L10n) => (locale: string | undefined) =>
  locale === 'en' ? texts.en : texts.de

export const TEXT_DEFAULTS = {
  closedMessage: {
    de: 'Der Shop macht gerade Pause. Schau bald wieder vorbei!',
    en: 'The shop is taking a short break. Please check back soon!',
  },
  deliveryTimeText: { de: '2–5 Werktage', en: '2–5 working days' },
  pickupInstructions: {
    de: 'Abholung in Berlin nach Absprache: Wir machen per Mail einen Termin aus, die Adresse bekommst du mit der Terminbestätigung. Bring bitte deine Bestellnummer mit.',
    en: "Pickup in Berlin by arrangement: we'll set a time by email, and you'll get the address with the confirmation. Please bring your order number.",
  },
} satisfies Record<string, L10n>

/** Warn- und Sicherheitshinweise je Kategorie (SEED-SPEC §3.2, KA-11). */
export const SAFETY_TEMPLATE_TEXTS: Record<ProductCategory, L10n> = {
  keramik: {
    de: 'Handgemacht: Kanten und Glasur können unregelmäßig sein. Zerbrechlich – Scherben bei Bruch vorsichtig entfernen.',
    en: 'Handmade: edges and glaze may be irregular. Fragile – remove shards carefully if it breaks.',
  },
  textil: {
    de: 'Gebrauchtes Kleidungsstück, von Hand bemalt. Farbe kann bei der ersten Wäsche leicht ausbluten – separat waschen.',
    en: 'Pre-owned garment, painted by hand. Colour may bleed slightly in the first wash – wash separately.',
  },
  cap: {
    de: 'Gebrauchte Cap, von Hand bemalt. Farbe kann bei Nässe abfärben.',
    en: 'Pre-owned cap, painted by hand. Colour may transfer when wet.',
  },
  zeichnung: {
    de: 'Original auf Papier. Vor direktem Sonnenlicht und Feuchtigkeit schützen.',
    en: 'Original on paper. Keep away from direct sunlight and moisture.',
  },
  schmuck: {
    de: 'Keramik kann bei Stößen brechen. Nicht beim Schlafen oder beim Sport tragen.',
    en: 'Ceramic can break if knocked. Do not wear while sleeping or doing sport.',
  },
  sonstiges: {
    de: 'Handgemachtes Einzelstück – bitte die Hinweise in der Beschreibung beachten.',
    en: 'Handmade one-off – please note the details in the description.',
  },
}

export const CARE_TEMPLATE_TEXTS: Record<'textil' | 'cap', L10n> = {
  textil: {
    de: 'Links gewendet bei 30 °C waschen, nicht in den Trockner, Motiv nicht bügeln.',
    en: 'Wash inside out at 30 °C, do not tumble dry, do not iron over the design.',
  },
  cap: {
    de: 'Nicht in die Waschmaschine. Flecken mit einem feuchten Tuch vorsichtig abtupfen, an der Luft trocknen.',
    en: 'Do not machine wash. Gently dab stains with a damp cloth and let it air dry.',
  },
}

/** Verpackungs-Checklisten (nur DE, SEED-SPEC §3.2, KONZEPT §7.6). */
export const DEFAULT_PACKING_CHECKLISTS: {
  shippingClass: ShippingClass
  items: { text: string }[]
}[] = [
  {
    shippingClass: 'keramik',
    items: [
      'Hohlräume mit Papier füllen',
      'jedes Teil einzeln einwickeln',
      'Innenkarton',
      'Außenkarton mit mind. 6 cm Polster rundum',
      'Schütteltest',
      'zwei Fotos vor dem Zukleben',
    ].map((text) => ({ text })),
  },
  {
    shippingClass: 'paket_klein',
    items: [
      'Papier- oder Kartonversandtasche, niemals Plastik',
      'Zeichnungen zwischen zwei feste Kartonplatten',
      'zwei Fotos vor dem Zukleben',
    ].map((text) => ({ text })),
  },
  {
    shippingClass: 'brief',
    items: [
      'Zeichnung zwischen zwei Kartonplatten, „Bitte nicht knicken“',
      'Anhänger in Seidenpapier und kleine Schachtel',
      'zwei Fotos vor dem Zukleben',
    ].map((text) => ({ text })),
  },
]
