import type { CollectionConfig, Field, FieldHook, Validate, Where } from 'payload'

import { adminField, adminWhere, isAdmin, publicRead } from '@/access'
import { moneyField, seedField } from '@/fields'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import {
  ATTENTION_REASONS,
  COUNTRY_CODES,
  DEVIATION_DECISIONS,
  EN_TRANSLATION_STATUSES,
  FIBER_COMPONENTS,
  FOOD_CONTACT,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  SHIPPING_CLASSES,
  SOLD_CHANNELS,
  TEXTILE_CONDITIONS,
  TEXTILE_FIBERS,
  VAT_CATEGORIES,
} from '@/lib/enums'
import { registerMediaReference } from '@/lib/media/references'
import { getAppContext } from '@/lib/payload/context'
import { showFor } from '@/lib/products/categoryRules'
import { buildCharacteristics } from '@/lib/products/characteristics'
import {
  ITEM_NUMBER_MAX,
  ITEM_NUMBER_MIN,
  isValidItemNumber,
  padItemNumber,
  PRODUCT_SLUG_RE,
} from '@/lib/products/itemNumber'
import { registerUploadReference } from '@/lib/uploads/references'
import { productTransitionEndpoints } from '@/endpoints/products/actions'
import { adoptEndpoint } from '@/endpoints/products/adopt'
import {
  computeNextItemNumber,
  itemNumberStatusEndpoint,
  nextItemNumberEndpoint,
} from '@/endpoints/products/nextItemNumber'
import { translateEndpoint } from '@/endpoints/products/translate'

import {
  afterProductChange,
  afterProductDelete,
  guardProduct,
  guardProductDelete,
  prepareProduct,
  PRODUCTS_SLUG,
  requestLocale,
} from './hooks/products'

// DATENMODELL §6.6 – Stücke (Unikate, E-10). Formular in Tabs „Basis“, „Pflichtangaben“, „Bilder“, „Verkauf“,
// „Intern“; kategoriebezogene Felder per `admin.condition`. Keine Versionen (§1.6). Pflichtangaben für die
// Veröffentlichung prüft `validateForPublish` (§6.6.6); hier gelten nur die Regeln fürs Speichern.

/** Öffentlich sichtbar: frei/reserviert oder verkauft mit Archiv-Anzeige (§6.6.9, E-14). */
export const PUBLIC_PRODUCT_WHERE: Where = {
  or: [
    { status: { in: ['available', 'reserved'] } },
    {
      and: [{ status: { equals: 'sold' } }, { showInArchiveAfterSale: { equals: true } }],
    },
  ],
}

// Bilder eines veröffentlichten Stücks dürfen nicht gelöscht werden (DM-MEDIA-05); Nickel-Nachweise nie, solange ein
// Stück auf sie zeigt (§6.4).
registerMediaReference({
  collection: PRODUCTS_SLUG,
  path: 'images',
  where: { status: { not_equals: 'draft' } },
  label: 'Stück',
  titleField: 'adminTitle',
})
registerUploadReference({
  target: 'private-uploads',
  collection: PRODUCTS_SLUG,
  path: 'nickelEvidence',
  label: 'Stück',
  titleField: 'adminTitle',
})

type V = true | string

/** Textlänge; `required` nur in der Grundsprache DE (Pflicht „R (de)“). */
const textLength =
  (min: number, max: number, requiredDe = false): Validate =>
  (value: unknown, { req }: { req: { locale?: string | null } }): V => {
    const s = typeof value === 'string' ? value.trim() : ''
    if (!s) return requiredDe && req.locale !== 'en' ? 'Pflichtfeld.' : true
    return s.length >= min && s.length <= max ? true : `Bitte ${min}–${max} Zeichen eingeben.`
  }

const maxLength =
  (max: number): Validate =>
  (value: unknown): V =>
    typeof value !== 'string' || value.trim().length <= max ? true : `Höchstens ${max} Zeichen.`

const intRange =
  (min: number, max: number, required = false): Validate =>
  (value: unknown): V => {
    if (value === null || value === undefined) return required ? 'Pflichtfeld.' : true
    return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
      ? true
      : `Bitte eine ganze Zahl von ${min} bis ${max} eingeben.`
  }

/** Maß in cm: > 0, ≤ 300, höchstens eine Nachkommastelle. */
const validateCm: Validate = (value: unknown): V => {
  if (value === null || value === undefined) return true
  if (typeof value !== 'number' || !(value > 0) || value > 300) return 'Bitte 0,1 bis 300 cm.'
  return Math.abs(value * 10 - Math.round(value * 10)) < 1e-9
    ? true
    : 'Höchstens eine Nachkommastelle.'
}

const validatePrice: Validate = (value: unknown): V =>
  typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 1_000_000
    ? true
    : 'Preis zwischen 1,00 € und 10.000,00 € (ganze Cent).'

const validateVatCategory: Validate = (
  value: unknown,
  { data }: { data: Record<string, unknown> },
) =>
  value === 'reduced_art' && data?.category !== 'zeichnung'
    ? 'Der ermäßigte Satz gilt nur für Originalzeichnungen (Kategorie Zeichnung).'
    : true

const onlyWithFrame: Validate = (
  value: unknown,
  { siblingData }: { siblingData: Record<string, unknown> },
) => (value === true && !siblingData?.framed ? 'Glas nur bei gerahmten Stücken.' : true)

const mustBeFalse: Validate = (value: unknown): V =>
  value === true ? 'Auftragsarbeiten sind Anfragen, keine Stücke.' : true

const validateImages: Validate = (value: unknown): V =>
  Array.isArray(value) && value.length > 12 ? 'Höchstens 12 Bilder.' : true

const validateHsCode: Validate = (value: unknown): V =>
  value === null || value === undefined || value === '' || /^\d{6,10}$/.test(String(value))
    ? true
    : 'Zolltarifnummer: 6 bis 10 Ziffern.'

const validateAttentionReason: Validate = (
  value: unknown,
  { siblingData }: { siblingData: Record<string, unknown> },
) => {
  if (siblingData?.flag && !value) return 'Bitte einen Grund angeben.'
  if (value && value !== 'conformity_revoked' && value !== 'manual') {
    return 'Hier nur „Konformitätserklärung widerrufen“ oder „manuell“.'
  }
  return true
}

// Virtuelle Felder (§6.6.2)
const displayNumberHook: FieldHook = ({ siblingData }) =>
  isValidItemNumber(siblingData?.itemNumber) ? padItemNumber(siblingData.itemNumber) : undefined

const isPublicHook: FieldHook = ({ siblingData }) => {
  const status = siblingData?.status
  return (
    status === 'available' ||
    status === 'reserved' ||
    (status === 'sold' && siblingData?.showInArchiveAfterSale === true)
  )
}

const characteristicsHook: FieldHook = ({ siblingData, req }) =>
  siblingData ? buildCharacteristics(siblingData, requestLocale(req)) || undefined : undefined

const readOnlySystem = { readOnly: true } as const

const basisFields: Field[] = [
  {
    name: 'itemNumber',
    type: 'number',
    label: 'Objektnummer',
    required: true,
    unique: true,
    min: ITEM_NUMBER_MIN,
    max: ITEM_NUMBER_MAX,
    validate: intRange(ITEM_NUMBER_MIN, ITEM_NUMBER_MAX, true),
    // Vorschlag beim Anlegen (§6.6.4); jede freie Zahl ist erlaubt.
    defaultValue: ({ req }) => computeNextItemNumber(req),
    // Nach der ersten Veröffentlichung schreibgeschützt (Formular, REST); die Local API prüft der Hook.
    access: { update: ({ doc }) => !doc?.firstPublishedAt },
    admin: {
      step: 1,
      description:
        'Deine Objektnummer. Anzeige: Nr. 017. Nach der ersten Veröffentlichung nicht mehr änderbar.',
    },
  },
  {
    name: 'title',
    type: 'text',
    label: 'Titel',
    localized: true,
    validate: textLength(2, 80, true),
    admin: { description: 'Englisch optional – sonst erscheint der deutsche Titel.' },
  },
  {
    name: 'slug',
    type: 'text',
    label: 'Adresse (Slug)',
    localized: true,
    unique: true,
    index: true,
    validate: (value: unknown): V =>
      value === null || value === undefined || PRODUCT_SLUG_RE.test(String(value))
        ? true
        : 'Slug: Nummer, Bindestrich, Kleinbuchstaben/Ziffern.',
    admin: {
      readOnly: true,
      description: 'Entsteht automatisch aus Nummer und Titel.',
    },
  },
  {
    name: 'category',
    type: 'select',
    label: 'Kategorie',
    required: true,
    options: enumOptions(PRODUCT_CATEGORIES, ENUM_LABELS.PRODUCT_CATEGORIES),
    admin: { description: 'Nur im Entwurf änderbar.' },
  },
  {
    name: 'description',
    type: 'textarea',
    label: 'Beschreibung',
    localized: true,
    validate: textLength(20, 4000),
    admin: { description: 'Absätze per Leerzeile.' },
  },
  {
    name: 'juttaSays',
    type: 'textarea',
    label: '„Jutta sagt“',
    localized: true,
    validate: maxLength(280),
    admin: { description: 'Optionale kurze Notiz von dir (höchstens 280 Zeichen).' },
  },
  {
    ...moneyField('priceCents', { label: 'Preis', required: true }),
    validate: validatePrice,
  } as Field,
  {
    name: 'vatCategory',
    type: 'select',
    label: 'Steuersatz',
    required: true,
    defaultValue: 'standard',
    options: enumOptions(VAT_CATEGORIES, ENUM_LABELS.VAT_CATEGORIES),
    validate: validateVatCategory,
    admin: { description: 'Nur bei Regelbesteuerung relevant.' },
  },
  {
    name: 'vatReducedReason',
    type: 'text',
    label: 'Begründung ermäßigter Satz',
    defaultValue: 'Originalzeichnung, vollständig von Hand (Anlage 2 Nr. 53 UStG)',
    validate: (value: unknown): V =>
      value === null || value === undefined || value === '' || String(value).trim().length >= 10
        ? true
        : 'Mindestens 10 Zeichen.',
    admin: { condition: (data) => data?.vatCategory === 'reduced_art' },
  },
]

const dimensionField = (name: string, label: string): Field => ({
  name,
  type: 'number',
  label,
  validate: validateCm,
  admin: { step: 0.1, width: '25%' },
})

const requiredInfoFields: Field[] = [
  {
    name: 'materials',
    type: 'text',
    label: 'Material',
    localized: true,
    validate: textLength(3, 200),
    admin: {
      description:
        'z. B. „Steinzeug, Unterglasurfarbe, Transparentglasur“ oder „Aquarell auf Papier 300 g“',
    },
  },
  {
    name: 'dimensions',
    type: 'group',
    label: 'Maße (cm)',
    fields: [
      {
        type: 'row',
        fields: [
          dimensionField('widthCm', 'Breite'),
          dimensionField('heightCm', 'Höhe'),
          dimensionField('depthCm', 'Tiefe'),
          dimensionField('diameterCm', 'Durchmesser'),
        ],
      },
      {
        name: 'note',
        type: 'text',
        label: 'Hinweis zu den Maßen',
        localized: true,
        validate: maxLength(120),
        admin: { description: 'z. B. „Brustweite 52 cm, Länge 70 cm“' },
      },
    ],
  },
  {
    name: 'weightGrams',
    type: 'number',
    label: 'Gewicht (g)',
    validate: intRange(1, 31_500),
    admin: { step: 1, description: 'Ohne Verpackung.' },
  },
  {
    name: 'shippingClass',
    type: 'select',
    label: 'Versandklasse',
    required: true,
    options: enumOptions(SHIPPING_CLASSES, ENUM_LABELS.SHIPPING_CLASSES),
    admin: { description: 'Wird aus der Kategorie vorbelegt.' },
  },
  {
    name: 'sizeLabel',
    type: 'text',
    label: 'Größe',
    localized: true,
    validate: textLength(1, 60),
    admin: {
      condition: showFor('sizeLabel'),
      description: '„M“, „EU 38“, „Einheitsgröße, verstellbar 54–60 cm“',
    },
  },
  {
    name: 'isSecondHand',
    type: 'checkbox',
    label: 'Second-Hand/Vintage',
    defaultValue: false,
    admin: { condition: showFor('isSecondHand') },
  },
  {
    name: 'condition',
    type: 'select',
    label: 'Zustand',
    options: enumOptions(TEXTILE_CONDITIONS, ENUM_LABELS.TEXTILE_CONDITIONS),
    admin: { condition: showFor('condition') },
  },
  {
    name: 'conditionNote',
    type: 'textarea',
    label: 'Zustand – Anmerkung',
    localized: true,
    validate: maxLength(300),
    admin: { condition: showFor('conditionNote'), description: 'z. B. „winziger Fleck am Saum“' },
  },
  {
    name: 'fiberComposition',
    type: 'array',
    label: 'Faserzusammensetzung',
    defaultValue: [],
    admin: {
      condition: showFor('fiberComposition'),
      description:
        'Laut Etikett – fehlt das Etikett: nach bestem Wissen. Je Teil (Hauptstoff, Futter …) genau 100 %.',
    },
    fields: [
      {
        type: 'row',
        fields: [
          {
            name: 'component',
            type: 'select',
            label: 'Teil',
            required: true,
            defaultValue: 'main',
            options: enumOptions(FIBER_COMPONENTS, ENUM_LABELS.FIBER_COMPONENTS),
          },
          {
            name: 'fiber',
            type: 'select',
            label: 'Faser',
            required: true,
            options: enumOptions(TEXTILE_FIBERS, ENUM_LABELS.TEXTILE_FIBERS),
          },
          {
            name: 'percent',
            type: 'number',
            label: 'Anteil (%)',
            required: true,
            validate: intRange(1, 100, true),
            admin: { step: 1 },
          },
        ],
      },
    ],
  },
  {
    name: 'labelMissing',
    type: 'checkbox',
    label: 'Etikett fehlt',
    defaultValue: false,
    admin: { condition: showFor('labelMissing') },
  },
  {
    name: 'fiberFreeText',
    type: 'text',
    label: 'Material nach bestem Wissen',
    localized: true,
    validate: textLength(3, 200),
    admin: {
      condition: (data) => showFor('fiberFreeText')(data) && data?.labelMissing === true,
      description: 'Ergänzt die Faserangabe und wird mit dem Hinweis „Etikett fehlt“ angezeigt.',
    },
  },
  {
    name: 'careInstructions',
    type: 'textarea',
    label: 'Pflegehinweise',
    localized: true,
    validate: maxLength(500),
    admin: { condition: showFor('careInstructions'), description: 'Als Text, ohne Symbole.' },
  },
  {
    name: 'blankBrandVisible',
    type: 'checkbox',
    label: 'Auf dem Rohling ist ein fremdes Hersteller-Logo sichtbar',
    defaultValue: false,
    access: adminField,
    admin: {
      condition: showFor('blankBrandVisible'),
      description:
        'Angehakt: Veröffentlichung gesperrt, solange sichtbare Marken nicht erlaubt sind.',
    },
  },
  {
    name: 'foodContact',
    type: 'select',
    label: 'Lebensmittelkontakt',
    options: enumOptions(FOOD_CONTACT, ENUM_LABELS.FOOD_CONTACT),
    admin: {
      condition: showFor('foodContact'),
      description: '„lebensmittelecht“ nur mit gültiger Konformitätserklärung.',
    },
  },
  {
    name: 'conformityDeclarations',
    type: 'relationship',
    label: 'Konformitätserklärungen',
    relationTo: 'conformity-declarations',
    hasMany: true,
    // Auswahl nur aktiver Erklärungen; Systemschreibvorgänge (z. B. Offline-Nehmen beim Widerruf, R-044) und Seed
    // speichern ein Stück auch mit einer inzwischen widerrufenen Erklärung.
    filterOptions: ({ req }) => {
      const ctx = getAppContext(req)
      return ctx.system || ctx.seed ? true : { status: { equals: 'active' } }
    },
    admin: {
      condition: (data) =>
        showFor('conformityDeclarations')(data) && data?.foodContact === 'lebensmittelecht',
      description: 'Alle verwendeten Glasuren.',
    },
  },
  {
    name: 'metalPartsMaterial',
    type: 'text',
    label: 'Material der Metallteile',
    localized: true,
    validate: textLength(3, 120),
    admin: { condition: showFor('metalPartsMaterial'), description: 'z. B. „Edelstahl 316L“' },
  },
  {
    name: 'nickelFreeConfirmed',
    type: 'checkbox',
    label: 'Metallteile nickelfrei, Nachweis liegt vor',
    defaultValue: false,
    admin: { condition: showFor('nickelFreeConfirmed') },
  },
  {
    name: 'nickelEvidence',
    type: 'upload',
    label: 'Nickel-Nachweis (privat)',
    relationTo: 'private-uploads',
    access: adminField,
    filterOptions: { purpose: { equals: 'nickel_evidence' } },
    admin: {
      condition: showFor('nickelEvidence'),
      description: 'Foto oder PDF der Lieferantenerklärung.',
    },
  },
  {
    name: 'leadFreeGlazeConfirmed',
    type: 'checkbox',
    label: 'Glasur bleifrei laut Hersteller-Datenblatt',
    defaultValue: false,
    admin: {
      condition: showFor('leadFreeGlazeConfirmed'),
      description: 'Datenblatt als „Lieferantenunterlage“ ablegen.',
    },
  },
  {
    name: 'smallPartsWarning',
    type: 'checkbox',
    label: 'Kleinteile-Warnhinweis',
    defaultValue: false,
    admin: {
      condition: showFor('smallPartsWarning'),
      description: 'Bei Schmuck immer an; der Hinweis wird automatisch angefügt.',
    },
  },
  {
    name: 'framed',
    type: 'checkbox',
    label: 'Gerahmt',
    defaultValue: false,
    admin: {
      condition: showFor('framed'),
      description: 'Technik und Papier/Träger stehen im Feld „Material“.',
    },
  },
  {
    name: 'frameHasGlass',
    type: 'checkbox',
    label: 'Rahmen mit Glas',
    defaultValue: false,
    validate: onlyWithFrame,
    admin: {
      condition: (data) => showFor('frameHasGlass')(data) && data?.framed === true,
      description: 'Der Glas-Hinweis wird automatisch an die Warnhinweise angefügt.',
    },
  },
  {
    name: 'safetyWarnings',
    type: 'textarea',
    label: 'Warn- und Sicherheitshinweise',
    localized: true,
    validate: textLength(3, 600),
    admin: { description: 'Aus der Vorlage der Kategorie vorbelegt.' },
  },
  {
    name: 'deviationDecision',
    type: 'select',
    label: 'Abweichung geprüft',
    options: enumOptions(DEVIATION_DECISIONS, ENUM_LABELS.DEVIATION_DECISIONS),
    admin: {
      description:
        'Bei Textil und Caps Pflicht: keine Abweichung oder Abweichung beschreiben (z. B. Fleck, Glasurfehler).',
    },
  },
  {
    name: 'hasDeviation',
    type: 'checkbox',
    label: 'Abweichende Beschaffenheit',
    defaultValue: false,
    admin: { description: 'Wird in der Kasse gesondert bestätigt.' },
  },
  {
    name: 'deviationDescription',
    type: 'textarea',
    label: 'Abweichung – Beschreibung',
    localized: true,
    validate: textLength(10, 300),
    admin: { condition: (data) => data?.hasDeviation === true },
  },
  {
    name: 'ownDesignConfirmed',
    type: 'checkbox',
    label:
      'Das Motiv zeigt nur eigene Figuren – keine geschützten fremden Figuren, Marken, Logos oder Schriftzüge Dritter',
    defaultValue: false,
  },
  {
    name: 'isCustomCommission',
    type: 'checkbox',
    label: 'Auftragsarbeit',
    defaultValue: false,
    validate: mustBeFalse,
    admin: { hidden: true },
  },
  {
    name: 'customs',
    type: 'group',
    label: 'Zoll (vorbereitet, derzeit aus)',
    access: adminField,
    fields: [
      {
        name: 'hsCode',
        type: 'text',
        label: 'Zolltarifnummer',
        validate: validateHsCode,
      },
      {
        name: 'countryOfOrigin',
        type: 'select',
        label: 'Ursprungsland',
        defaultValue: 'DE',
        options: enumOptions(COUNTRY_CODES, ENUM_LABELS.COUNTRY_CODES),
      },
      {
        name: 'descriptionEn',
        type: 'text',
        label: 'Inhaltsbeschreibung (EN)',
        validate: maxLength(80),
      },
    ],
  },
]

const imageFields: Field[] = [
  {
    name: 'images',
    type: 'upload',
    label: 'Bilder',
    relationTo: 'media',
    hasMany: true,
    maxRows: 12,
    validate: validateImages,
    admin: {
      description:
        'Erstes Bild = Titelbild; Reihenfolge per Ziehen. Empfohlen 2–12 Fotos im Hochformat 4:5.',
    },
  },
]

const saleFields: Field[] = [
  {
    name: 'status',
    type: 'select',
    label: 'Status',
    required: true,
    defaultValue: 'draft',
    index: true,
    options: enumOptions(PRODUCT_STATUSES, ENUM_LABELS.PRODUCT_STATUSES),
    admin: readOnlySystem,
  },
  {
    name: 'showInArchiveAfterSale',
    type: 'checkbox',
    label: 'Nach Verkauf mit sold-Stempel im Archiv zeigen',
    defaultValue: true,
  },
  {
    name: 'firstPublishedAt',
    type: 'date',
    label: 'Erstmals veröffentlicht',
    index: true,
    admin: readOnlySystem,
  },
  { name: 'soldAt', type: 'date', label: 'Verkauft am', admin: readOnlySystem },
  {
    name: 'soldChannel',
    type: 'select',
    label: 'Verkaufsweg',
    options: enumOptions(SOLD_CHANNELS, ENUM_LABELS.SOLD_CHANNELS),
    admin: readOnlySystem,
  },
  {
    name: 'offlineSaleNote',
    type: 'text',
    label: 'Notiz zum Offline-Verkauf',
    access: adminField,
    validate: maxLength(120),
    admin: { description: 'z. B. „Flohmarkt Mauerpark“ (ohne Preis).' },
  },
  { name: 'archivedAt', type: 'date', label: 'Ausgeblendet am', admin: readOnlySystem },
  {
    name: 'reservedUntil',
    type: 'date',
    label: 'Reserviert bis',
    admin: { ...readOnlySystem, date: { pickerAppearance: 'dayAndTime' } },
  },
  {
    name: 'reservationRef',
    type: 'text',
    label: 'Reservierung',
    access: adminField,
    admin: readOnlySystem,
  },
  {
    name: 'currentOrder',
    type: 'relationship',
    label: 'Bestellung',
    relationTo: 'orders',
    access: adminField,
    admin: readOnlySystem,
  },
]

const internalFields: Field[] = [
  {
    name: 'storageLocation',
    type: 'text',
    label: 'Lagerort',
    access: adminField,
    validate: maxLength(60),
    admin: { description: 'Steht auf dem Packzettel.' },
  },
  {
    name: 'internalNote',
    type: 'textarea',
    label: 'Interne Notiz',
    access: adminField,
    validate: maxLength(1000),
  },
  {
    name: 'seo',
    type: 'group',
    label: 'Suchmaschinen',
    fields: [
      {
        name: 'metaTitle',
        type: 'text',
        label: 'Titel',
        localized: true,
        validate: maxLength(60),
      },
      {
        name: 'metaDescription',
        type: 'text',
        label: 'Beschreibung',
        localized: true,
        validate: maxLength(160),
      },
    ],
    admin: { description: 'Leer = aus Titel und Beschreibung.' },
  },
  {
    name: 'i18n',
    type: 'group',
    label: 'Übersetzung',
    access: adminField,
    fields: [
      {
        name: 'enStatus',
        type: 'select',
        label: 'Englisch',
        defaultValue: 'missing',
        options: enumOptions(EN_TRANSLATION_STATUSES, ENUM_LABELS.EN_TRANSLATION_STATUSES),
        admin: readOnlySystem,
      },
      { name: 'translatedAt', type: 'date', label: 'Übersetzt am', admin: readOnlySystem },
    ],
  },
  {
    name: 'adminAttention',
    type: 'group',
    label: 'Hinweis für dich',
    access: adminField,
    fields: [
      { name: 'flag', type: 'checkbox', label: 'Rot markieren', defaultValue: false },
      {
        name: 'reason',
        type: 'select',
        label: 'Grund',
        options: enumOptions(ATTENTION_REASONS, ENUM_LABELS.ATTENTION_REASONS),
        validate: validateAttentionReason,
      },
      { name: 'note', type: 'textarea', label: 'Notiz', validate: maxLength(500) },
    ],
  },
]

export const Products: CollectionConfig = {
  slug: PRODUCTS_SLUG,
  labels: { singular: 'Stück', plural: 'Stücke' },
  admin: {
    useAsTitle: 'adminTitle',
    defaultColumns: ['images', 'adminTitle', 'category', 'priceCents', 'status', 'updatedAt'],
    // Suche über Titel und Slug („017-…“ enthält die Nummer).
    listSearchableFields: ['title', 'slug'],
    group: 'Shop',
  },
  access: {
    read: publicRead(PUBLIC_PRODUCT_WHERE),
    create: isAdmin,
    update: isAdmin,
    // Kein Lösch-Knopf für veröffentlichte Stücke (KONZEPT §7.16); `guardProductDelete` prüft zusätzlich Bestellungen.
    delete: adminWhere({
      and: [{ status: { equals: 'draft' } }, { firstPublishedAt: { exists: false } }],
    }),
  },
  defaultSort: '-updatedAt',
  endpoints: [
    nextItemNumberEndpoint,
    itemNumberStatusEndpoint,
    ...productTransitionEndpoints,
    translateEndpoint,
    adoptEndpoint,
  ],
  // §6.6.11: Index (category, status); UNIQUE item_number und (slug, _locale) über die Felder.
  indexes: [{ fields: ['category', 'status'] }],
  fields: [
    {
      name: 'adminTitle',
      type: 'text',
      label: 'Titel in Listen',
      localized: true,
      admin: { readOnly: true, position: 'sidebar', description: '„Nr. 017 · Titel“' },
    },
    {
      name: 'displayNumber',
      type: 'text',
      label: 'Nummer (Anzeige)',
      virtual: true,
      hooks: { afterRead: [displayNumberHook] },
      admin: { hidden: true },
    },
    {
      name: 'isPublic',
      type: 'checkbox',
      label: 'Öffentlich sichtbar',
      virtual: true,
      hooks: { afterRead: [isPublicHook] },
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'characteristics',
      type: 'text',
      label: 'Wesentliche Eigenschaften',
      virtual: true,
      hooks: { afterRead: [characteristicsHook] },
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      type: 'tabs',
      tabs: [
        { label: 'Basis', fields: basisFields },
        { label: 'Pflichtangaben', fields: requiredInfoFields },
        { label: 'Bilder', fields: imageFields },
        { label: 'Verkauf', fields: saleFields },
        { label: 'Intern', fields: [...internalFields, ...seedField()] },
      ],
    },
  ],
  hooks: {
    beforeValidate: [prepareProduct],
    beforeChange: [guardProduct],
    afterChange: [afterProductChange],
    beforeDelete: [guardProductDelete],
    afterDelete: [afterProductDelete],
  },
}
