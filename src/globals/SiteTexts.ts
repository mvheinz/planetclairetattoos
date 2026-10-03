import type { Field, GlobalConfig } from 'payload'

import { isAdmin } from '@/access'
import { internalLinkFields } from '@/fields'
import { revalidateContent } from '@/lib/cache/revalidate'
import { TAGS } from '@/lib/cache/tags'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { EMAIL_TEMPLATES } from '@/lib/enums'
import { getAppContext } from '@/lib/payload/context'

// DATENMODELL §7.2 – kurze UI-Texte DE/EN in Juttas Ton (E-62) und Navigation. Öffentlich lesbar. Rechtlich fixierte
// Texte (Bestell-Button, „Vertrag widerrufen“, „Widerruf bestätigen“, Steuerhinweis) stehen NICHT hier, sondern in
// `src/lib/legal/constants.ts`; die Pflichtlinks im Footer rendert der Code immer (E-44).

type L10n = { de: string; en: string }

interface TextOptions {
  multiline?: boolean
  maxLength?: number
  description?: string
}

/** Lokalisiertes Textfeld mit DE/EN-Standard aus dem Code. */
function text(name: string, label: string, defaults: L10n | null, opts: TextOptions = {}): Field {
  return {
    name,
    type: opts.multiline ? 'textarea' : 'text',
    label,
    localized: true,
    maxLength: opts.maxLength ?? (opts.multiline ? 600 : 160),
    ...(defaults
      ? {
          defaultValue: ({ locale }: { locale?: string }) =>
            locale === 'en' ? defaults.en : defaults.de,
        }
      : {}),
    ...(opts.description ? { admin: { description: opts.description } } : {}),
  } as Field
}

function textGroup(name: string, label: string, fields: Field[]): Field {
  return { name, type: 'group', label, fields }
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
  text('menuTagline', 'Satz im Menü', {
    de: 'Tattoos, Keramik und bemalte Einzelstücke aus Berlin.',
    en: 'Tattoos, ceramics and hand-painted one-offs from Berlin.',
  }),
])

const footer = textGroup('footer', 'Fußzeile', [
  text('tagline', 'Satz in der Fußzeile', {
    de: 'Handgemacht in Berlin – jedes Stück gibt es nur einmal.',
    en: 'Handmade in Berlin – every piece exists only once.',
  }),
  text('instagramLabel', 'Instagram-Link', {
    de: 'Folge mir auf Instagram',
    en: 'Follow me on Instagram',
  }),
])

const shop = textGroup('shop', 'Shop', [
  text('filterAll', 'Filter „Alle“', { de: 'Alle', en: 'All' }),
  text('filterAvailableOnly', 'Filter „Nur verfügbare“', {
    de: 'Nur verfügbare',
    en: 'Available only',
  }),
  text('soldStamp', 'Stempel „verkauft“', { de: 'sold', en: 'sold' }),
  text('reservedLabel', 'Hinweis „reserviert“', {
    de: 'gerade reserviert – schau in 30 Minuten nochmal',
    en: 'reserved right now – check back in 30 minutes',
  }),
  text('reservedPrepaymentLabel', 'Hinweis „reserviert (Vorkasse)“', {
    de: 'reserviert – wartet auf Überweisung',
    en: 'reserved – waiting for a bank transfer',
  }),
  text('uniqueHint', 'Hinweis „Unikat“', { de: 'Unikat', en: 'One of a kind' }),
  text('emptyCategory', 'Leere Kategorie', {
    de: 'Hier ist gerade alles weg. Neue Stücke kommen bald!',
    en: 'Everything here is gone for now. New pieces are coming soon!',
  }),
  text(
    'archiveIntro',
    'Einleitung Archiv',
    {
      de: 'Schon verkauft, aber zu schön zum Vergessen.',
      en: 'Already sold, but too lovely to forget.',
    },
    { multiline: true },
  ),
])

const product = textGroup('product', 'Stück', [
  text('addToCart', 'Knopf „In den Korb“', { de: 'In den Korb', en: 'Add to basket' }),
  text('shippingLinkLabel', 'Link Versandkosten', { de: 'zzgl. Versand', en: 'plus shipping' }),
  text('manufacturerHeading', 'Überschrift Herstellerin', {
    de: 'Herstellerin & Sicherheit',
    en: 'Maker & safety',
  }),
  text('deviationHeading', 'Überschrift Abweichungen', {
    de: 'Gut zu wissen',
    en: 'Good to know',
  }),
  text('fiberHeading', 'Überschrift Material', { de: 'Material', en: 'Fabric' }),
  text('labelMissingHint', 'Hinweis fehlendes Etikett', {
    de: 'Das Originaletikett fehlt – die Angaben stammen von mir.',
    en: 'The original label is missing – the details come from me.',
  }),
])

const cart = textGroup('cart', 'Warenkorb', [
  text('empty', 'Leerer Warenkorb', {
    de: 'Dein Korb ist noch leer.',
    en: 'Your basket is still empty.',
  }),
  text('countdown', 'Countdown', {
    de: 'Coco hält dein Stück noch {time} fest',
    en: 'Coco is holding your piece for another {time}',
  }),
  text('reservationExpired', 'Reservierung abgelaufen', {
    de: 'Die Reservierung ist abgelaufen – das Stück ist wieder für alle da.',
    en: 'The reservation has expired – the piece is available to everyone again.',
  }),
  text('pickupOption', 'Option Abholung', {
    de: 'Abholung in Berlin',
    en: 'Pickup in Berlin',
  }),
  text('shippingOption', 'Option Versand', { de: 'Versand', en: 'Shipping' }),
])

const checkout = textGroup('checkout', 'Kasse', [
  text(
    'intro',
    'Einleitung',
    {
      de: 'Fast geschafft! Prüf bitte kurz deine Angaben.',
      en: 'Almost there! Please check your details.',
    },
    { multiline: true },
  ),
  text('changeLink', 'Link „ändern“', { de: 'ändern', en: 'change' }),
])

const pageTexts = (name: string, label: string, texts: Record<string, [string, L10n]>): Field =>
  textGroup(
    name,
    label,
    Object.entries(texts).map(([key, [fieldLabel, defaults]]) =>
      text(key, fieldLabel, defaults, { multiline: true }),
    ),
  )

const thanks = pageTexts('thanks', 'Danke-Seite', {
  heading: ['Überschrift', { de: 'Danke dir!', en: 'Thank you!' }],
  intro: [
    'Einleitung',
    {
      de: 'Deine Bestellung ist angekommen. Eine Bestätigung ist per Mail unterwegs.',
      en: 'Your order has arrived. A confirmation is on its way by email.',
    },
  ],
})
const orderStatus = pageTexts('orderStatus', 'Bestellstatus', {
  intro: [
    'Einleitung',
    {
      de: 'Hier siehst du, wo deine Bestellung gerade ist.',
      en: 'Here you can see where your order is right now.',
    },
  ],
  linkInvalid: [
    'Link ungültig',
    {
      de: 'Dieser Link funktioniert nicht mehr. Schreib mir gern eine Mail.',
      en: 'This link no longer works. Feel free to send me an email.',
    },
  ],
})
const withdrawal = pageTexts('withdrawal', 'Widerruf', {
  intro: [
    'Einleitung',
    {
      de: 'Du möchtest einen Kauf widerrufen? Füll bitte die Felder aus – du bekommst sofort eine Eingangsbestätigung per Mail.',
      en: 'Want to withdraw from a purchase? Please fill in the fields – you will get an immediate confirmation of receipt by email.',
    },
  ],
  done: [
    'Nach dem Absenden',
    {
      de: 'Dein Widerruf ist eingegangen. Die Bestätigung ist per Mail unterwegs.',
      en: 'Your withdrawal has been received. The confirmation is on its way by email.',
    },
  ],
})
const notFound = pageTexts('notFound', 'Seite nicht gefunden', {
  heading: ['Überschrift', { de: 'Coco hat sich losgerissen', en: 'Coco slipped her leash' }],
  intro: [
    'Text',
    {
      de: 'Coco hat überall geschnüffelt – diese Seite gibt es nicht (mehr).',
      en: "Coco sniffed everywhere – this page doesn't exist (anymore).",
    },
  ],
})
const errors = pageTexts('errors', 'Fehler', {
  generic: [
    'Allgemeiner Fehler',
    {
      de: 'Da ist etwas schiefgegangen. Versuch es bitte gleich noch einmal.',
      en: 'Something went wrong. Please try again in a moment.',
    },
  ],
  shopClosed: [
    'Shop pausiert',
    {
      de: 'Der Shop macht gerade Pause – bestellen geht im Moment nicht.',
      en: 'The shop is taking a break – ordering is not possible right now.',
    },
  ],
  alreadyReserved: [
    'Stück schon reserviert',
    {
      de: 'Jemand war schneller – das Stück ist gerade reserviert.',
      en: 'Someone was quicker – the piece is reserved right now.',
    },
  ],
})

/** Signatur, Antwortzeit und je Mail-Vorlage Betreff, Einleitung, Schluss; Standardtexte der Vorlagen folgen mit den Mails (P5). */
const emails = textGroup('emails', 'E-Mails', [
  text(
    'signature',
    'Grußformel und Signatur',
    {
      de: 'Liebe Grüße\nJutta von Planet Claire',
      en: 'Best wishes,\nJutta from Planet Claire',
    },
    { multiline: true, description: 'Steht unter jeder Mail an Kund:innen.' },
  ),
  text(
    'inquiryResponseTime',
    'Antwortzeit bei Anfragen',
    {
      de: 'Ich melde mich meist innerhalb einer Woche.',
      en: 'I usually get back to you within a week.',
    },
    { multiline: true },
  ),
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
      text('subject', 'Betreff', null, { maxLength: 120 }),
      text('intro', 'Einleitung', null, { multiline: true, maxLength: 1000 }),
      text('outro', 'Schluss', null, { multiline: true, maxLength: 1000 }),
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
