import type { Field, GlobalConfig } from 'payload'

import { isAdmin } from '@/access'
import { internalLinkFields } from '@/fields'
import { revalidateContent } from '@/lib/cache/revalidate'
import { TAGS } from '@/lib/cache/tags'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { EMAIL_TEMPLATES } from '@/lib/enums'
import { getAppContext } from '@/lib/payload/context'

import defaultsFile from './siteTexts.defaults.json'

// DATENMODELL §7.2 – kurze UI-Texte DE/EN in Juttas Ton (E-62) und Navigation. Öffentlich lesbar. Rechtlich fixierte
// Texte (Bestell-Button, „Vertrag widerrufen“, „Widerruf bestätigen“, Steuerhinweis) stehen NICHT hier, sondern in
// `src/lib/legal/constants.ts`; die Pflichtlinks im Footer rendert der Code immer (E-44).
// Die Standardtexte DE/EN stehen in `siteTexts.defaults.json` (Gruppe → Feld), damit die Texte-Liste für Jutta sie
// lesen und zurückschreiben kann (U-87, U-89); ein Textfeld ohne Eintrag dort hat keinen Standard (leer = Vorlage).

type L10n = { de: string; en: string }

/** Standardtexte je Gruppe und Feld (`footer.tagline` → `{ de, en }`). */
export const SITE_TEXT_DEFAULTS = defaultsFile as Readonly<
  Record<string, Readonly<Record<string, L10n>>>
>

interface TextOptions {
  multiline?: boolean
  maxLength?: number
  description?: string
}

/** Lokalisiertes Textfeld; den DE/EN-Standard setzt `textGroup` aus `siteTexts.defaults.json`. */
function text(name: string, label: string, opts: TextOptions = {}): Field {
  return {
    name,
    type: opts.multiline ? 'textarea' : 'text',
    label,
    localized: true,
    maxLength: opts.maxLength ?? (opts.multiline ? 600 : 160),
    ...(opts.description ? { admin: { description: opts.description } } : {}),
  } as Field
}

/** Gruppe; Textfelder mit Eintrag in `siteTexts.defaults.json` bekommen dort ihren Standard je Sprache. */
function textGroup(name: string, label: string, fields: Field[]): Field {
  const own = SITE_TEXT_DEFAULTS[name] ?? {}
  return {
    name,
    type: 'group',
    label,
    fields: fields.map((f) => {
      const d =
        'name' in f && (f.type === 'text' || f.type === 'textarea') ? own[f.name] : undefined
      if (!d) return f
      return {
        ...f,
        defaultValue: ({ locale }: { locale?: string }) => (locale === 'en' ? d.en : d.de),
      } as Field
    }),
  }
}

/** Standard-Links der Navigation (Beschriftung je Sprache). */
const link = (target: string, de: string, en: string, category?: string) => ({
  target,
  ...(category ? { category } : {}),
  de,
  en,
})
const MAIN_LINKS = [
  link('shop', 'Shop', 'Shop'),
  link('tattoo', 'Tattoo', 'Tattoo'),
  link('commissions', 'Auftragsarbeiten', 'Commissions'),
  link('about', 'Über mich', 'About'),
]
const MENU_LINKS = [
  ...MAIN_LINKS,
  link('archive', 'Archiv', 'Archive'),
  link('tattoo_aftercare', 'Tattoo-Pflege', 'Tattoo aftercare'),
  link('contact', 'Kontakt', 'Contact'),
  link('instagram', 'Instagram', 'Instagram'),
]
const linkDefaults =
  (links: ReturnType<typeof link>[]) =>
  ({ locale }: { locale?: string }) =>
    links.map(({ de, en, ...rest }) => ({ ...rest, label: locale === 'en' ? en : de }))

const navigation = textGroup('navigation', 'Navigation', [
  {
    name: 'mainLinks',
    type: 'array',
    label: 'Hauptlinks',
    maxRows: 5,
    defaultValue: linkDefaults(MAIN_LINKS),
    fields: internalLinkFields(),
  },
  {
    name: 'menuLinks',
    type: 'array',
    label: 'Links im Menü',
    maxRows: 12,
    defaultValue: linkDefaults(MENU_LINKS),
    fields: internalLinkFields(),
  },
  text('menuTagline', 'Satz im Menü'),
])

const footer = textGroup('footer', 'Fußzeile', [
  text('tagline', 'Satz in der Fußzeile'),
  text('instagramLabel', 'Instagram-Link'),
])

const shop = textGroup('shop', 'Shop', [
  text('filterAll', 'Filter „Alle“'),
  text('filterAvailableOnly', 'Filter „Nur verfügbare“'),
  text('soldStamp', 'Stempel „verkauft“'),
  text('reservedLabel', 'Hinweis „reserviert“'),
  text('reservedPrepaymentLabel', 'Hinweis „reserviert (Vorkasse)“'),
  text('uniqueHint', 'Hinweis „Unikat“'),
  text('emptyCategory', 'Leere Kategorie'),
  text('archiveIntro', 'Einleitung Archiv', { multiline: true }),
])

const product = textGroup('product', 'Stück', [
  text('addToCart', 'Knopf „In den Korb“'),
  text('shippingLinkLabel', 'Link Versandkosten'),
  text('manufacturerHeading', 'Überschrift Herstellerin'),
  text('deviationHeading', 'Überschrift Abweichungen'),
  text('fiberHeading', 'Überschrift Material'),
  text('labelMissingHint', 'Hinweis fehlendes Etikett'),
])

const cart = textGroup('cart', 'Warenkorb', [
  text('empty', 'Leerer Warenkorb'),
  text('countdown', 'Countdown'),
  text('reservationExpired', 'Reservierung abgelaufen'),
  text('pickupOption', 'Option Abholung'),
  text('shippingOption', 'Option Versand'),
])

const checkout = textGroup('checkout', 'Kasse', [
  text('intro', 'Einleitung', { multiline: true }),
  text('changeLink', 'Link „ändern“'),
])

const pageTexts = (name: string, label: string, texts: Record<string, string>): Field =>
  textGroup(
    name,
    label,
    Object.entries(texts).map(([key, fieldLabel]) => text(key, fieldLabel, { multiline: true })),
  )

const thanks = pageTexts('thanks', 'Danke-Seite', {
  heading: 'Überschrift',
  intro: 'Einleitung',
})
const orderStatus = pageTexts('orderStatus', 'Bestellstatus', {
  intro: 'Einleitung',
  linkInvalid: 'Link ungültig',
})
const withdrawal = pageTexts('withdrawal', 'Widerruf', {
  intro: 'Einleitung',
  done: 'Nach dem Absenden',
})
const notFound = pageTexts('notFound', 'Seite nicht gefunden', {
  heading: 'Überschrift',
  intro: 'Text',
})
const errors = pageTexts('errors', 'Fehler', {
  generic: 'Allgemeiner Fehler',
  shopClosed: 'Shop pausiert',
  alreadyReserved: 'Stück schon reserviert',
})

/** Signatur, Antwortzeit und je Mail-Vorlage Betreff, Einleitung, Schluss; Standardtexte der Vorlagen folgen mit den Mails (P5). */
const emails = textGroup('emails', 'E-Mails', [
  text('signature', 'Grußformel und Signatur', {
    multiline: true,
    description: 'Steht unter jeder Mail an Kund:innen.',
  }),
  text('inquiryResponseTime', 'Antwortzeit bei Anfragen', { multiline: true }),
  {
    // Eine Zeile je Vorlage (statt einer Gruppe je Vorlage: Postgres erlaubt höchstens 100 Spalten je Abfrage-Funktion).
    name: 'templates',
    type: 'array',
    label: 'Texte je Mail-Vorlage',
    labels: { singular: 'Mail-Vorlage', plural: 'Mail-Vorlagen' },
    admin: { description: 'Leer bzw. ohne Zeile = Standardtext der Vorlage.' },
    validate: (rows: unknown): true | string => {
      const list = Array.isArray(rows) ? (rows as { template?: string }[]) : []
      return new Set(list.map((r) => r.template)).size === list.length
        ? true
        : 'Jede Mail-Vorlage nur einmal.'
    },
    fields: [
      {
        name: 'template',
        type: 'select',
        label: 'Vorlage',
        required: true,
        options: enumOptions(EMAIL_TEMPLATES, ENUM_LABELS.EMAIL_TEMPLATES),
      },
      text('subject', 'Betreff', { maxLength: 120 }),
      text('intro', 'Einleitung', { multiline: true, maxLength: 1000 }),
      text('outro', 'Schluss', { multiline: true, maxLength: 1000 }),
    ],
  },
])

export const SiteTexts: GlobalConfig = {
  slug: 'site-texts',
  label: 'Texte & Navigation',
  admin: { group: 'Inhalte' },
  access: {
    read: () => true,
    update: isAdmin,
    readVersions: isAdmin,
  },
  versions: { max: 50 },
  fields: [
    {
      type: 'tabs',
      tabs: [
        { label: 'Navigation', fields: [navigation, footer] },
        { label: 'Shop', fields: [shop, product, cart, checkout] },
        { label: 'Seiten', fields: [thanks, orderStatus, withdrawal, notFound, errors] },
        { label: 'E-Mails', fields: [emails] },
      ],
    },
  ],
  hooks: {
    afterChange: [
      ({ doc, req }) => {
        revalidateContent(TAGS.siteTexts, { context: getAppContext(req) })
        return doc
      },
    ],
  },
}
