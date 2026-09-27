import {
  ValidationError,
  type Field,
  type GlobalAfterChangeHook,
  type GlobalBeforeChangeHook,
  type GlobalConfig,
} from 'payload'

import { isAdmin } from '@/access'
import { moneyField } from '@/fields'
import { writeAudit } from '@/lib/audit'
import { revalidateContent } from '@/lib/cache/revalidate'
import { TAGS } from '@/lib/cache/tags'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import {
  CARRIERS,
  COUNTRY_CODES,
  INVOICE_RETENTION_YEARS,
  LEGAL_TEXT_TYPES,
  PACKAGING_MATERIALS,
  PRODUCT_CATEGORIES,
  SHIPPING_CLASSES,
  SHIPPING_ZONES,
  TAX_MODES,
} from '@/lib/enums'
import { getEnv } from '@/lib/env'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { isSensitiveKey, REDACTED } from '@/lib/security/redact'
import {
  POSTBOX_RE,
  PACKAGING_KEY_RE,
  SHIPPABLE_CLASSES,
  checkExactlyOnePer,
  checkPackaging,
  checkRevenueGuard,
  checkShipping,
  checkTaxModes,
  isValidIban,
  isValidPhone,
  normalizeIban,
  parseInvoiceYears,
  sortTaxModes,
  type FieldIssue,
  type TaxModeEntry,
} from '@/lib/settings/rules'
import { formatBerlin } from '@/lib/time'

import {
  CARE_TEMPLATE_TEXTS,
  DEFAULT_IBAN,
  DEFAULT_LEGAL_REVIEWS,
  DEFAULT_PACKAGING_BY_CLASS,
  DEFAULT_PACKAGING_TEMPLATES,
  DEFAULT_PACKING_CHECKLISTS,
  DEFAULT_SHIPPING_RATES,
  DEFAULT_TAX_MODES,
  DEFAULT_TRACKING_TEMPLATES,
  SAFETY_TEMPLATE_TEXTS,
  TEXT_DEFAULTS,
  localized,
} from './settingsDefaults'

// DATENMODELL §7.1 – Einstellungen. Nur Admin; das Frontend liest ausschließlich `getPublicSettings()` (Whitelist).

type V = true | string
const pattern =
  (re: RegExp, message: string, required = false) =>
  (value: unknown): V => {
    if (value === null || value === undefined || value === '')
      return required ? 'Pflichtfeld.' : true
    return typeof value === 'string' && re.test(value) ? true : message
  }
const intRange =
  (min: number, max: number, required = true) =>
  (value: unknown): V => {
    if (value === null || value === undefined) return required ? 'Pflichtfeld.' : true
    return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
      ? true
      : `Ganzzahl von ${min} bis ${max}.`
  }
const httpsUrl =
  (required = false) =>
  (value: unknown): V => {
    if (value === null || value === undefined || value === '')
      return required ? 'Pflichtfeld.' : true
    try {
      return new URL(String(value)).protocol === 'https:'
        ? true
        : 'Bitte eine https-Adresse angeben.'
    } catch {
      return 'Bitte eine gültige Adresse angeben.'
    }
  }
const shippableOptions = enumOptions(SHIPPABLE_CLASSES, ENUM_LABELS.SHIPPING_CLASSES)

function defaultAdminEmail(): string {
  try {
    return getEnv().ADMIN_NOTIFY_EMAIL
  } catch {
    return 'jutta@planetclairetattoos.com'
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Felder

const shopGroup: Field = {
  name: 'shop',
  type: 'group',
  label: 'Shop',
  fields: [
    {
      name: 'isOpen',
      type: 'checkbox',
      label: 'Shop geöffnet',
      defaultValue: true,
      admin: {
        description:
          'Aus: „In den Korb“ und „Zur Kasse“ sind gesperrt; laufende Kassen und Zahlungen werden normal abgeschlossen.',
      },
    },
    {
      name: 'closedMessage',
      type: 'textarea',
      label: 'Text bei Pause',
      localized: true,
      maxLength: 300,
      defaultValue: ({ locale }) => localized(TEXT_DEFAULTS.closedMessage)(locale),
    },
    {
      name: 'maxItemsPerCheckout',
      type: 'number',
      label: 'Höchstens Stücke je Bestellung',
      defaultValue: 10,
      validate: intRange(1, 10),
    },
  ],
}

const businessGroup: Field = {
  name: 'business',
  type: 'group',
  label: 'Anbieterin',
  fields: [
    {
      name: 'legalName',
      type: 'text',
      label: 'Name (Impressum)',
      required: true,
      defaultValue: '[Name folgt]',
    },
    {
      name: 'tradeName',
      type: 'text',
      label: 'Geschäftsbezeichnung',
      defaultValue: 'Planet Claire',
    },
    {
      name: 'street',
      type: 'text',
      label: 'Straße und Hausnummer',
      required: true,
      defaultValue: '[Adresse folgt]',
      validate: (value: unknown): V =>
        !value
          ? 'Pflichtfeld.'
          : POSTBOX_RE.test(String(value))
            ? 'Bitte eine ladungsfähige Anschrift angeben, kein Postfach.'
            : true,
    },
    {
      name: 'postalCode',
      type: 'text',
      label: 'PLZ',
      defaultValue: '00000',
      validate: pattern(/^\d{5}$/, 'Deutsche Postleitzahl: genau 5 Ziffern.', true),
    },
    { name: 'city', type: 'text', label: 'Ort', required: true, defaultValue: 'Berlin' },
    {
      name: 'country',
      type: 'select',
      label: 'Land',
      defaultValue: 'DE',
      options: enumOptions(COUNTRY_CODES, ENUM_LABELS.COUNTRY_CODES),
    },
    {
      name: 'email',
      type: 'email',
      label: 'E-Mail',
      required: true,
      defaultValue: 'jutta@planetclairetattoos.com',
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Telefon',
      defaultValue: '[Telefon folgt]',
      validate: (value: unknown): V =>
        !value || isValidPhone(String(value))
          ? true
          : 'Bitte eine Telefonnummer (z. B. +49 30 1234567) oder „[Telefon folgt]“ eingeben.',
      admin: {
        description: 'Pflicht zum Start (Impressum, Widerrufsbelehrung, Bestellbestätigung).',
      },
    },
    {
      name: 'vatId',
      type: 'text',
      label: 'USt-IdNr.',
      validate: pattern(/^DE\d{9}$/, 'Format DE + 9 Ziffern.'),
    },
    { name: 'economicId', type: 'text', label: 'Wirtschafts-IdNr.', maxLength: 40 },
    {
      name: 'taxNumber',
      type: 'text',
      label: 'Steuernummer',
      maxLength: 40,
      admin: { description: 'Nur für Rechnungen – nie öffentlich.' },
    },
    {
      name: 'returnAddress',
      type: 'textarea',
      label: 'Rücksendeadresse',
      maxLength: 300,
      admin: { description: 'Leer = Geschäftsadresse.' },
    },
    { name: 'lucidNumber', type: 'text', label: 'LUCID-Registrierungsnummer', maxLength: 40 },
    {
      name: 'packagingScheme',
      type: 'group',
      label: 'Duales System (Verpackung)',
      fields: [
        { name: 'name', type: 'text', label: 'Anbieter', maxLength: 80 },
        { name: 'contractFrom', type: 'date', label: 'Vertrag seit' },
      ],
    },
  ],
}

const taxGroup: Field = {
  name: 'tax',
  type: 'group',
  label: 'Steuer',
  fields: [
    {
      name: 'modes',
      type: 'array',
      label: 'Steuermodus',
      labels: { singular: 'Steuermodus', plural: 'Steuermodi' },
      minRows: 1,
      defaultValue: DEFAULT_TAX_MODES,
      admin: {
        description:
          'Geltend ist der letzte Eintrag mit „gültig ab“ ≤ heute. Neue Einträge nur mit Begründung und nach Rücksprache mit der Steuerberatung.',
      },
      fields: [
        {
          name: 'mode',
          type: 'select',
          label: 'Modus',
          required: true,
          options: enumOptions(TAX_MODES, ENUM_LABELS.TAX_MODES),
        },
        { name: 'validFrom', type: 'date', label: 'Gültig ab', required: true },
        { name: 'reason', type: 'text', label: 'Begründung', maxLength: 300 },
        {
          name: 'confirmedWithTaxAdvisor',
          type: 'checkbox',
          label: 'mit Steuerberatung abgestimmt',
          defaultValue: false,
        },
      ],
    },
    {
      name: 'confirmedAt',
      type: 'date',
      label: 'Steuerangaben bestätigt am',
      admin: { readOnly: true },
    },
    {
      name: 'standardRate',
      type: 'number',
      label: 'Regelsatz (%)',
      defaultValue: 19,
      admin: { readOnly: true },
    },
    {
      name: 'reducedRate',
      type: 'number',
      label: 'Ermäßigter Satz (%)',
      defaultValue: 7,
      admin: { readOnly: true },
    },
  ],
}

const revenueGuardGroup: Field = {
  name: 'revenueGuard',
  type: 'group',
  label: 'Umsatzwächter',
  fields: [
    moneyField('previousYearLimitCents', { label: 'Grenze Vorjahr', defaultValue: 2_500_000 }),
    moneyField('currentYearLimitCents', {
      label: 'Grenze laufendes Jahr',
      defaultValue: 10_000_000,
    }),
    {
      name: 'stageThresholdsCents',
      type: 'group',
      label: 'Stufen',
      fields: [
        moneyField('u1', { label: 'U1', defaultValue: 2_000_000 }),
        moneyField('u3', { label: 'U3', defaultValue: 8_000_000 }),
        moneyField('u3a', { label: 'U3a', defaultValue: 9_000_000 }),
        moneyField('u4', { label: 'U4', defaultValue: 9_500_000 }),
      ],
    },
    {
      name: 'manualYearTotals',
      type: 'array',
      label: 'Umsätze vor dem Shop',
      defaultValue: [],
      fields: [
        {
          name: 'year',
          type: 'number',
          label: 'Jahr',
          required: true,
          validate: intRange(2000, 2100),
        },
        moneyField('amountCents', { label: 'Umsatz', required: true }),
        { name: 'note', type: 'text', label: 'Notiz', maxLength: 200 },
      ],
    },
    {
      name: 'lastNotified',
      type: 'json',
      label: 'Bereits gemeldete Stufen',
      defaultValue: {},
      admin: { readOnly: true },
    },
  ],
}

const shippingGroup: Field = {
  name: 'shipping',
  type: 'group',
  label: 'Versand',
  fields: [
    {
      name: 'enabledCountries',
      type: 'select',
      label: 'Lieferländer',
      hasMany: true,
      defaultValue: ['DE'],
      options: enumOptions(COUNTRY_CODES, ENUM_LABELS.COUNTRY_CODES),
      admin: {
        description:
          'Start nur Deutschland. Andere Länder erst nach der EU-Checkliste und dem Häkchen „EU-Versand geprüft“.',
      },
    },
    {
      name: 'euShippingAcknowledged',
      type: 'checkbox',
      label: 'EU-Versand geprüft',
      defaultValue: false,
    },
    {
      name: 'euShippingAcknowledgedAt',
      type: 'date',
      label: 'EU-Versand geprüft am',
      admin: { readOnly: true },
    },
    {
      name: 'euChecklist',
      type: 'group',
      label: 'EU-Checkliste',
      fields: [
        {
          name: 'authorisedRepresentativeNamed',
          type: 'checkbox',
          label: 'Bevollmächtigte:r nach Art. 45 PPWR benannt',
          defaultValue: false,
        },
        {
          name: 'ossThresholdChecked',
          type: 'checkbox',
          label: '10.000-€-Schwelle/OSS mit Steuerberatung geprüft',
          defaultValue: false,
        },
        {
          name: 'textileLanguageChecked',
          type: 'checkbox',
          label: 'Textilangaben in Landessprache geklärt',
          defaultValue: false,
        },
        {
          name: 'ratesMaintained',
          type: 'checkbox',
          label: 'Versandpreise gepflegt',
          defaultValue: false,
        },
        {
          name: 'legalTextsAdapted',
          type: 'checkbox',
          label: 'Rechtstexte angepasst',
          defaultValue: false,
        },
      ],
    },
    { name: 'pickupEnabled', type: 'checkbox', label: 'Abholung möglich', defaultValue: true },
    { name: 'pickupCity', type: 'text', label: 'Abholort', defaultValue: 'Berlin', maxLength: 60 },
    {
      name: 'rates',
      type: 'array',
      label: 'Versandpreise',
      defaultValue: DEFAULT_SHIPPING_RATES,
      fields: [
        {
          name: 'zone',
          type: 'select',
          label: 'Zone',
          required: true,
          options: enumOptions(SHIPPING_ZONES, ENUM_LABELS.SHIPPING_ZONES),
        },
        {
          name: 'shippingClass',
          type: 'select',
          label: 'Versandklasse',
          required: true,
          options: shippableOptions,
          enumName: 'enum_settings_rates_class',
        },
        moneyField('priceCents', { label: 'Preis', required: true }),
      ],
    },
    {
      name: 'deliveryTimeText',
      type: 'text',
      label: 'Lieferzeit',
      localized: true,
      maxLength: 60,
      defaultValue: ({ locale }) => localized(TEXT_DEFAULTS.deliveryTimeText)(locale),
    },
    moneyField('insuranceHintThresholdCents', {
      label: 'Versicherungs-Hinweis ab',
      defaultValue: 50_000,
    }),
    {
      name: 'trackingUrlTemplates',
      type: 'array',
      dbName: 'settings_tracking',
      label: 'Sendungsverfolgung',
      defaultValue: DEFAULT_TRACKING_TEMPLATES,
      fields: [
        {
          name: 'carrier',
          type: 'select',
          enumName: 'enum_settings_tracking_carrier',
          label: 'Versanddienst',
          required: true,
          options: enumOptions(CARRIERS, ENUM_LABELS.CARRIERS),
        },
        {
          name: 'urlTemplate',
          type: 'text',
          label: 'Adresse',
          required: true,
          validate: (value: unknown): V => {
            const https = httpsUrl(true)(value)
            if (https !== true) return https
            return String(value).includes('{trackingNumber}')
              ? true
              : 'Die Adresse muss {trackingNumber} enthalten.'
          },
        },
      ],
    },
  ],
}

const pickupGroup: Field = {
  name: 'pickup',
  type: 'group',
  label: 'Abholung',
  fields: [
    {
      name: 'instructions',
      type: 'textarea',
      label: 'Text in der Abholmail',
      localized: true,
      maxLength: 600,
      defaultValue: ({ locale }) => localized(TEXT_DEFAULTS.pickupInstructions)(locale),
    },
  ],
}

const packagingGroup: Field = {
  name: 'packaging',
  type: 'group',
  label: 'Verpackung',
  admin: {
    description: 'Gewichte sind Schätzwerte – bitte einmal nachwiegen (Verpackungsmeldung).',
  },
  fields: [
    {
      name: 'templates',
      type: 'array',
      dbName: 'settings_pkg_templates',
      label: 'Verpackungsvorlagen',
      defaultValue: DEFAULT_PACKAGING_TEMPLATES,
      fields: [
        {
          name: 'key',
          type: 'text',
          label: 'Schlüssel',
          required: true,
          validate: pattern(PACKAGING_KEY_RE, 'Nur a–z, 0–9 und -.', true),
        },
        { name: 'name', type: 'text', label: 'Name', required: true, maxLength: 80 },
        {
          name: 'components',
          type: 'array',
          dbName: 'settings_pkg_components',
          label: 'Materialien',
          minRows: 1,
          fields: [
            {
              name: 'material',
              type: 'select',
              enumName: 'enum_settings_pkg_material',
              label: 'Material',
              required: true,
              options: enumOptions(PACKAGING_MATERIALS, ENUM_LABELS.PACKAGING_MATERIALS),
            },
            {
              name: 'grams',
              type: 'number',
              label: 'Gramm',
              required: true,
              validate: intRange(1, 10_000),
            },
          ],
        },
      ],
    },
    {
      name: 'defaultsByShippingClass',
      type: 'array',
      dbName: 'settings_pkg_defaults',
      label: 'Vorbelegung je Versandklasse',
      defaultValue: DEFAULT_PACKAGING_BY_CLASS,
      fields: [
        {
          name: 'shippingClass',
          type: 'select',
          label: 'Versandklasse',
          required: true,
          options: shippableOptions,
          enumName: 'enum_settings_pkg_class',
        },
        { name: 'templateKey', type: 'text', label: 'Vorlage (Schlüssel)', required: true },
      ],
    },
  ],
}

const paymentGroup: Field = {
  name: 'payment',
  type: 'group',
  label: 'Zahlung',
  fields: [
    { name: 'prepaymentEnabled', type: 'checkbox', label: 'Vorkasse anbieten', defaultValue: true },
    {
      name: 'accountHolder',
      type: 'text',
      label: 'Kontoinhaberin',
      defaultValue: '[Kontoinhaberin folgt]',
      maxLength: 70,
    },
    {
      name: 'iban',
      type: 'text',
      label: 'IBAN',
      defaultValue: DEFAULT_IBAN,
      validate: (value: unknown): V =>
        !value || isValidIban(String(value)) ? true : 'Die IBAN ist ungültig (Prüfsumme).',
      admin: { description: 'Beispiel-IBAN bis zum Start – die Startprüfung meldet sie.' },
    },
    { name: 'bic', type: 'text', label: 'BIC', maxLength: 11 },
    { name: 'bankName', type: 'text', label: 'Bank', maxLength: 80 },
    {
      name: 'reservationMinutes',
      type: 'number',
      label: 'Reservierung (Minuten)',
      defaultValue: 30,
      validate: intRange(30, 60),
    },
    {
      name: 'prepaymentDays',
      type: 'number',
      label: 'Zahlungsfrist Vorkasse (Kalendertage)',
      defaultValue: 5,
      validate: intRange(2, 14),
    },
    {
      name: 'prepaymentReminderHours',
      type: 'number',
      label: 'Zahlungserinnerung nach (Stunden)',
      defaultValue: 72,
      validate: intRange(24, 335),
    },
    {
      name: 'stripePaymentMethodConfigurationId',
      type: 'text',
      label: 'Stripe: Zahlarten-Konfiguration',
      maxLength: 80,
    },
  ],
}

const tattooGroup: Field = {
  name: 'tattoo',
  type: 'group',
  label: 'Tattoo',
  fields: [
    {
      name: 'studioDistrict',
      type: 'text',
      label: 'Bezirk',
      defaultValue: '[Bezirk folgt]',
      maxLength: 60,
      admin: { description: 'Nur der Bezirk, keine Adresse.' },
    },
    moneyField('minPriceCents', { label: 'Mindestpreis' }),
    moneyField('customPriceFromCents', { label: 'Eigene Idee ab' }),
    moneyField('customPriceToCents', { label: 'Eigene Idee bis' }),
    { name: 'priceNote', type: 'textarea', label: 'Preishinweis', localized: true, maxLength: 400 },
  ],
}

const socialGroup: Field = {
  name: 'social',
  type: 'group',
  label: 'Kontakt & Instagram',
  fields: [
    {
      name: 'instagramHandle',
      type: 'text',
      label: 'Instagram-Name',
      defaultValue: 'planet.claire.tattoos',
      validate: pattern(/^[a-z0-9._]{1,30}$/, 'Nur a–z, 0–9, Punkt und Unterstrich (ohne @).'),
    },
    {
      name: 'contactEmail',
      type: 'email',
      label: 'Kontakt-E-Mail',
      defaultValue: 'jutta@planetclairetattoos.com',
    },
  ],
}

const legalGroup: Field = {
  name: 'legal',
  type: 'group',
  label: 'Rechtstexte',
  fields: [
    {
      name: 'reviewIntervalDays',
      type: 'number',
      label: 'Prüf-Erinnerung nach (Tagen)',
      defaultValue: 365,
      validate: intRange(30, 730),
    },
    {
      name: 'reviews',
      type: 'array',
      label: 'Letzte Prüfung je Rechtstext',
      defaultValue: DEFAULT_LEGAL_REVIEWS,
      fields: [
        {
          name: 'type',
          type: 'select',
          label: 'Rechtstext',
          required: true,
          options: enumOptions(LEGAL_TEXT_TYPES, ENUM_LABELS.LEGAL_TEXT_TYPES),
        },
        { name: 'reviewedAt', type: 'date', label: 'Geprüft am' },
        {
          name: 'lastReminderSentAt',
          type: 'date',
          label: 'Letzte Erinnerung',
          admin: { readOnly: true },
        },
      ],
    },
    {
      name: 'allowVisibleBlankBrands',
      type: 'checkbox',
      label: 'Sichtbare Marken auf Textil/Caps erlauben',
      defaultValue: false,
      admin: {
        description:
          'Achtung: nur nach Antwort der Kanzlei (K-13) einschalten. Aus = Stücke mit sichtbarer Fremdmarke lassen sich nicht veröffentlichen.',
      },
    },
  ],
}

const processorAgreementsField: Field = {
  name: 'processorAgreements',
  type: 'array',
  label: 'Auftragsverarbeitungsverträge',
  defaultValue: [],
  fields: [
    { name: 'serviceId', type: 'text', label: 'Dienst (ID)', required: true, maxLength: 60 },
    { name: 'signedAt', type: 'date', label: 'Abgeschlossen am' },
    { name: 'documentVersion', type: 'text', label: 'Fassung', maxLength: 40 },
    { name: 'url', type: 'text', label: 'Adresse', validate: httpsUrl() },
    {
      name: 'file',
      type: 'upload',
      label: 'Datei',
      relationTo: 'private-uploads',
      filterOptions: { purpose: { equals: 'processor_agreement' } },
    },
  ],
}

const analyticsGroup: Field = {
  name: 'analytics',
  type: 'group',
  label: 'Statistik',
  fields: [
    { name: 'enabled', type: 'checkbox', label: 'Statistik an', defaultValue: false },
    { name: 'confirmedAt', type: 'date', label: 'Entscheidung dokumentiert am' },
    { name: 'note', type: 'text', label: 'Notiz zur Entscheidung', maxLength: 300 },
  ],
}

const retentionGroup: Field = {
  name: 'retention',
  type: 'group',
  label: 'Aufbewahrung',
  fields: [
    {
      name: 'invoiceYears',
      type: 'select',
      label: 'Rechnungen aufbewahren (Jahre)',
      defaultValue: '10',
      options: INVOICE_RETENTION_YEARS.map((y) => ({ label: `${y} Jahre`, value: String(y) })),
      admin: {
        description:
          'Achtung: nur nach Antwort von Kanzlei/Steuerberatung (K-33) umstellen. Wirkt nur auf neue Belege.',
      },
    },
  ],
}

const exportGroup: Field = {
  name: 'export',
  type: 'group',
  label: 'Export',
  fields: [
    {
      name: 'datev',
      type: 'group',
      label: 'DATEV',
      fields: [
        {
          name: 'consultantNumber',
          type: 'text',
          label: 'Beraternummer',
          validate: pattern(/^\d{4,7}$/, '4–7 Ziffern.'),
        },
        {
          name: 'clientNumber',
          type: 'text',
          label: 'Mandantennummer',
          validate: pattern(/^\d{1,5}$/, '1–5 Ziffern.'),
        },
        {
          name: 'fiscalYearStart',
          type: 'text',
          label: 'Beginn Wirtschaftsjahr (MM-TT)',
          defaultValue: '01-01',
          validate: pattern(
            /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/,
            'Format MM-TT, z. B. 01-01.',
          ),
        },
        ...(['revenueAccount', 'stripeTransitAccount', 'bankAccount', 'feeAccount'] as const).map(
          (name): Field => ({
            name,
            type: 'text',
            label: {
              revenueAccount: 'Erlöskonto',
              stripeTransitAccount: 'Stripe-Verrechnungskonto',
              bankAccount: 'Bankkonto',
              feeAccount: 'Gebührenkonto',
            }[name],
            validate: pattern(/^\d{4,9}$/, '4–9 Ziffern.'),
          }),
        ),
      ],
    },
  ],
}

const costsGroup: Field = {
  name: 'costs',
  type: 'group',
  label: 'Kosten',
  fields: [
    moneyField('budgetCents', { label: 'Budget je Monat', defaultValue: 2_500 }),
    moneyField('warningThresholdCents', { label: 'Warnung ab', defaultValue: 3_000 }),
    {
      name: 'monthlyEntries',
      type: 'array',
      label: 'Monatskosten',
      defaultValue: [],
      fields: [
        {
          name: 'month',
          type: 'text',
          label: 'Monat (JJJJ-MM)',
          required: true,
          validate: pattern(/^\d{4}-(0[1-9]|1[0-2])$/, 'Format JJJJ-MM.', true),
        },
        moneyField('amountCents', { label: 'Betrag', required: true }),
        { name: 'note', type: 'text', label: 'Notiz', maxLength: 200 },
      ],
    },
  ],
}

const templatesFields: Field[] = [
  {
    name: 'safetyTemplates',
    type: 'array',
    label: 'Warn- und Sicherheitshinweise je Kategorie',
    defaultValue: ({ locale }) =>
      PRODUCT_CATEGORIES.map((category) => ({
        category,
        text: localized(SAFETY_TEMPLATE_TEXTS[category])(locale),
      })),
    fields: [
      {
        name: 'category',
        type: 'select',
        label: 'Kategorie',
        required: true,
        options: enumOptions(PRODUCT_CATEGORIES, ENUM_LABELS.PRODUCT_CATEGORIES),
      },
      { name: 'text', type: 'textarea', label: 'Text', localized: true, required: true },
    ],
  },
  {
    name: 'careTemplates',
    type: 'array',
    label: 'Pflegehinweise',
    defaultValue: ({ locale }) =>
      (['textil', 'cap'] as const).map((category) => ({
        category,
        text: localized(CARE_TEMPLATE_TEXTS[category])(locale),
      })),
    fields: [
      {
        name: 'category',
        type: 'select',
        label: 'Kategorie',
        required: true,
        options: enumOptions(['textil', 'cap'] as const, {
          textil: ENUM_LABELS.PRODUCT_CATEGORIES.textil,
          cap: ENUM_LABELS.PRODUCT_CATEGORIES.cap,
        }),
      },
      { name: 'text', type: 'textarea', label: 'Text', localized: true, required: true },
    ],
  },
  {
    name: 'packingChecklists',
    type: 'array',
    label: 'Verpackungs-Checklisten',
    defaultValue: DEFAULT_PACKING_CHECKLISTS,
    fields: [
      {
        name: 'shippingClass',
        type: 'select',
        label: 'Versandklasse',
        required: true,
        options: enumOptions(SHIPPING_CLASSES, ENUM_LABELS.SHIPPING_CLASSES),
      },
      {
        name: 'items',
        type: 'array',
        label: 'Punkte',
        fields: [{ name: 'text', type: 'text', label: 'Punkt', required: true, maxLength: 200 }],
      },
    ],
  },
]

const seedGroup: Field = {
  name: 'seed',
  type: 'group',
  label: 'Beispieldaten',
  admin: { readOnly: true },
  fields: [
    { name: 'exampleDataPresent', type: 'checkbox', label: 'Beispieldaten vorhanden' },
    { name: 'importedAt', type: 'date', label: 'Importiert am' },
    { name: 'removedAt', type: 'date', label: 'Entfernt am' },
  ],
}

// ---------------------------------------------------------------------------------------------------------------------
// Hooks

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const group = (doc: unknown, name: string): Obj => (isObj(doc) && isObj(doc[name]) ? doc[name] : {})

/** Querschnittsregeln und abgeleitete Felder (DATENMODELL §7.1 Spalte „Validierung / Regel“). */
const validateSettings: GlobalBeforeChangeHook = ({ data, originalDoc, req }) => {
  const ctx = getAppContext(req)
  const privileged = Boolean(ctx.system || ctx.seed)
  const now = requestNow(req)
  const issues: FieldIssue[] = []

  // Steuermodus (R-032)
  const tax = group(data, 'tax')
  const modes = (Array.isArray(tax.modes) ? tax.modes : []) as TaxModeEntry[]
  const prevTax = group(originalDoc, 'tax')
  const prevModes = (
    Array.isArray(prevTax.modes) ? prevTax.modes : DEFAULT_TAX_MODES
  ) as TaxModeEntry[]
  issues.push(...checkTaxModes(modes, prevModes, now, privileged).issues)
  tax.modes = sortTaxModes(modes)
  // Steuersätze sind fest
  tax.standardRate = 19
  tax.reducedRate = 7

  // Versand
  const shipping = group(data, 'shipping')
  issues.push(...checkShipping(shipping))
  const prevShipping = group(originalDoc, 'shipping')
  if (shipping.euShippingAcknowledged === true) {
    shipping.euShippingAcknowledgedAt =
      prevShipping.euShippingAcknowledged === true && prevShipping.euShippingAcknowledgedAt
        ? prevShipping.euShippingAcknowledgedAt
        : now.toISOString()
  } else {
    shipping.euShippingAcknowledgedAt = null
  }

  // Verpackung (E-47, R-201)
  issues.push(...checkPackaging(group(data, 'packaging')))

  // Zahlung
  const payment = group(data, 'payment')
  if (payment.prepaymentEnabled === true && !String(payment.accountHolder ?? '').trim()) {
    issues.push({
      path: 'payment.accountHolder',
      message: 'Pflichtfeld, solange Vorkasse aktiv ist.',
    })
  }
  if (typeof payment.iban === 'string' && payment.iban) payment.iban = normalizeIban(payment.iban)
  const days = Number(payment.prepaymentDays)
  const hours = Number(payment.prepaymentReminderHours)
  if (Number.isInteger(days) && Number.isInteger(hours) && !(hours >= 24 && hours < 24 * days)) {
    issues.push({
      path: 'payment.prepaymentReminderHours',
      message: `Erinnerung zwischen 24 und ${24 * days - 1} Stunden (vor Ablauf der Zahlungsfrist).`,
    })
  }

  // Tattoo-Preisrahmen
  const tattoo = group(data, 'tattoo')
  if (
    typeof tattoo.customPriceFromCents === 'number' &&
    typeof tattoo.customPriceToCents === 'number' &&
    tattoo.customPriceToCents < tattoo.customPriceFromCents
  ) {
    issues.push({ path: 'tattoo.customPriceToCents', message: '„Bis“ muss ≥ „ab“ sein.' })
  }

  // Umsatzwächter
  issues.push(...checkRevenueGuard(group(data, 'revenueGuard')))

  // Rechtstexte, Vorlagen
  const legal = group(data, 'legal')
  issues.push(
    ...checkExactlyOnePer(legal.reviews as Obj[], 'type', LEGAL_TEXT_TYPES, 'legal.reviews'),
    ...checkExactlyOnePer(
      data.safetyTemplates as Obj[],
      'category',
      PRODUCT_CATEGORIES,
      'safetyTemplates',
    ),
  )
  const care = (data.careTemplates ?? []) as Obj[]
  if (new Set(care.map((c) => c.category)).size !== care.length) {
    issues.push({ path: 'careTemplates', message: 'Je Kategorie nur ein Pflegehinweis.' })
  }
  const checklists = (data.packingChecklists ?? []) as Obj[]
  if (new Set(checklists.map((c) => c.shippingClass)).size !== checklists.length) {
    issues.push({ path: 'packingChecklists', message: 'Je Versandklasse nur eine Checkliste.' })
  }

  // Statistik nur mit dokumentierter Entscheidung (R-132)
  const analytics = group(data, 'analytics')
  if (
    analytics.enabled === true &&
    (!analytics.confirmedAt || !String(analytics.note ?? '').trim())
  ) {
    issues.push({
      path: 'analytics.enabled',
      message: 'Statistik nur mit Datum und Notiz zur Entscheidung einschalten.',
    })
  }

  // Aufbewahrung (L-06)
  const retention = group(data, 'retention')
  if (retention.invoiceYears !== undefined && parseInvoiceYears(retention.invoiceYears) === null) {
    issues.push({ path: 'retention.invoiceYears', message: 'Nur 8 oder 10 Jahre.' })
  }

  if (issues.length > 0) {
    throw new ValidationError({ global: 'settings', errors: issues, req })
  }
  return data
}

/** Werte, die im Audit nie im Klartext stehen (zusätzlich zu `redact`). */
const MASKED_PATHS = [
  /^business\./,
  /^payment\.(accountHolder|iban|bic|bankName)$/,
  /^adminNotificationEmail$/,
  /^social\.contactEmail$/,
]
const IGNORED_KEYS = new Set(['id', 'updatedAt', 'createdAt', 'globalType'])

function stripIds(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(stripIds)
  if (isObj(v)) {
    const out: Obj = {}
    for (const [k, x] of Object.entries(v)) if (!IGNORED_KEYS.has(k)) out[k] = stripIds(x)
    return out
  }
  return v
}

/** Geänderte Pfade `{ 'gruppe.feld': [alt, neu] }` (Arrays als Ganzes). */
export function diffSettings(
  prev: unknown,
  next: unknown,
  prefix = '',
): Record<string, [unknown, unknown]> {
  const out: Record<string, [unknown, unknown]> = {}
  const a = isObj(prev) ? prev : {}
  const b = isObj(next) ? next : {}
  for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (IGNORED_KEYS.has(key)) continue
    const path = prefix ? `${prefix}.${key}` : key
    const x = a[key]
    const y = b[key]
    if (isObj(x) || isObj(y)) {
      Object.assign(out, diffSettings(x, y, path))
    } else if (JSON.stringify(stripIds(x) ?? null) !== JSON.stringify(stripIds(y) ?? null)) {
      out[path] = [stripIds(x) ?? null, stripIds(y) ?? null]
    }
  }
  return out
}

export function maskSettingsDiff(
  diff: Record<string, [unknown, unknown]>,
): Record<string, readonly [unknown, unknown]> {
  const out: Record<string, readonly [unknown, unknown]> = {}
  for (const [path, [a, b]] of Object.entries(diff)) {
    const last = path.split('.').at(-1) ?? path
    const masked = MASKED_PATHS.some((re) => re.test(path)) || isSensitiveKey(last)
    out[path] = masked ? [a == null ? null : REDACTED, b == null ? null : REDACTED] : [a, b]
  }
  return out
}

const auditSettings: GlobalAfterChangeHook = async ({ doc, previousDoc, req }) => {
  const ctx = getAppContext(req)
  revalidateContent(TAGS.settings, { context: ctx })
  if (ctx.seed) return doc
  const diff = diffSettings(previousDoc, doc)
  const paths = Object.keys(diff)
  if (paths.length === 0) return doc
  const changes = maskSettingsDiff(diff)
  const taxPaths = paths.filter((p) => p.startsWith('tax.modes'))
  if (taxPaths.length > 0) {
    const { added } = checkTaxModes(
      (group(doc, 'tax').modes ?? []) as TaxModeEntry[],
      (group(previousDoc, 'tax').modes ?? []) as TaxModeEntry[],
      requestNow(req),
      true,
    )
    const text = added
      .map(
        (e) =>
          `${e.mode} ab ${e.validFrom ? formatBerlin(new Date(String(e.validFrom)), 'dd.MM.yyyy') : '?'}`,
      )
      .join(', ')
    await writeAudit(req, {
      action: 'tax_mode_changed',
      entityCollection: 'settings',
      entityId: 'settings',
      summary: `Steuermodus geändert${text ? `: ${text}` : ''} (mit Steuerberatung abgestimmt).`,
      changes: { 'tax.modes': changes['tax.modes']! },
    })
  }
  if (paths.includes('retention.invoiceYears')) {
    const [a, b] = diff['retention.invoiceYears']!
    await writeAudit(req, {
      action: 'retention_setting_changed',
      entityCollection: 'settings',
      entityId: 'settings',
      summary: `Aufbewahrung Rechnungen: ${String(a ?? '–')} → ${String(b)} Jahre.`,
      changes: { 'retention.invoiceYears': [a, b] },
    })
  }
  const rest = paths.filter((p) => !p.startsWith('tax.modes') && p !== 'retention.invoiceYears')
  if (rest.length > 0) {
    await writeAudit(req, {
      action: 'settings_changed',
      entityCollection: 'settings',
      entityId: 'settings',
      summary: `Einstellungen geändert: ${rest.slice(0, 8).join(', ')}${rest.length > 8 ? ' …' : ''}`,
      changes: Object.fromEntries(rest.map((p) => [p, changes[p]!])),
    })
  }
  return doc
}

export const Settings: GlobalConfig = {
  slug: 'settings',
  label: 'Einstellungen',
  admin: { group: 'System' },
  access: {
    read: isAdmin,
    update: isAdmin,
    readVersions: isAdmin,
  },
  versions: { max: 50 },
  fields: [
    {
      type: 'tabs',
      tabs: [
        { label: 'Shop & Anbieterin', fields: [shopGroup, businessGroup, socialGroup] },
        {
          label: 'Steuer & Umsatz',
          fields: [taxGroup, revenueGuardGroup, retentionGroup, exportGroup, costsGroup],
        },
        {
          label: 'Versand & Zahlung',
          fields: [shippingGroup, pickupGroup, packagingGroup, paymentGroup],
        },
        { label: 'Tattoo', fields: [tattooGroup] },
        {
          label: 'Recht & Vorlagen',
          fields: [
            legalGroup,
            ...templatesFields,
            processorAgreementsField,
            analyticsGroup,
            {
              name: 'adminNotificationEmail',
              type: 'email',
              label: 'Empfänger für Hinweise an dich',
              defaultValue: defaultAdminEmail,
            },
          ],
        },
        { label: 'System', fields: [seedGroup] },
      ],
    },
  ],
  hooks: {
    beforeChange: [validateSettings],
    afterChange: [auditSettings],
  },
}
