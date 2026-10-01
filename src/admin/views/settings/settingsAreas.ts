import { formatEuroInput } from '@/lib/money'

// Einstellungen, Teil 2 und 3 (PLAN P5.22/P5.22a, KONZEPT §7.14): Bereiche, Beschriftungen und Startwerte der
// Handy-Formulare über `POST /api/globals/settings/area`. Eine Quelle für Ansicht (Server), Formulare (Client) und
// Endpunkt (Whitelist der Bereiche). Rein, ohne Server-Abhängigkeiten.

export const SETTINGS_AREAS = [
  'shop',
  'shipping',
  'packing',
  'costs',
  'templates',
  'taxConfirm',
  'yearTotals',
  'analytics',
  'legal',
] as const
export type SettingsArea = (typeof SETTINGS_AREAS)[number]

export type Obj = Record<string, unknown>
export interface Localized {
  de: string
  en: string
}

/** EU-Checkliste (R-202, DATENMODELL §7.1 `shipping.euChecklist`). */
export const EU_CHECKLIST_LABELS = {
  authorisedRepresentativeNamed: 'Bevollmächtigte:r nach Art. 45 PPWR benannt',
  ossThresholdChecked: '10.000-€-Schwelle/OSS mit Steuerberatung geprüft',
  textileLanguageChecked: 'Textilangaben in Landessprache geklärt',
  ratesMaintained: 'Versandpreise gepflegt',
  legalTextsAdapted: 'Rechtstexte angepasst',
} as const
export type EuChecklistKey = keyof typeof EU_CHECKLIST_LABELS

export const CLOSED_MESSAGE_MAX = 300

const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {})
const list = (v: unknown): Obj[] =>
  Array.isArray(v) ? v.filter((x): x is Obj => !!x && typeof x === 'object') : []
const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v))
const euro = (v: unknown): string => (typeof v === 'number' ? formatEuroInput(v) : '')
const pair = (de: unknown, en: unknown): Localized => ({ de: s(de), en: s(en) })
const dateKey = (v: unknown): string => {
  if (typeof v !== 'string' || !v) return ''
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) return ''
  // Kalendertag in Berlin (ohne Zeitzonen-Bibliothek: Intl reicht, auch im Browser)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(d)
}

export interface ShopValues {
  isOpen: boolean
  closedMessage: Localized
  maxItemsPerCheckout: string
}
export interface RateRow {
  id?: string
  zone: string
  shippingClass: string
  price: string
}
export interface TrackingRow {
  id?: string
  carrier: string
  urlTemplate: string
}
export interface ShippingValues {
  enabledCountries: string[]
  euChecklist: Record<EuChecklistKey, boolean>
  euShippingAcknowledged: boolean
  euShippingAcknowledgedAt: string
  pickupEnabled: boolean
  pickupCity: string
  deliveryTimeText: Localized
  rates: RateRow[]
  trackingUrlTemplates: TrackingRow[]
}
export interface ComponentRow {
  id?: string
  material: string
  grams: string
}
export interface PackagingTemplateRow {
  id?: string
  key: string
  name: string
  components: ComponentRow[]
}
export interface PackingValues {
  packingChecklists: { id?: string; shippingClass: string; items: string }[]
  templates: PackagingTemplateRow[]
  defaultsByShippingClass: { id?: string; shippingClass: string; templateKey: string }[]
}
export interface MonthRow {
  id?: string
  month: string
  amount: string
  note: string
}
export interface CostsValues {
  budget: string
  warningThreshold: string
  monthlyEntries: MonthRow[]
}
export interface TemplateRow {
  id?: string
  category: string
  text: Localized
}
export interface TemplatesValues {
  safetyTemplates: TemplateRow[]
  careTemplates: TemplateRow[]
}
export interface YearRow {
  id?: string
  year: string
  amount: string
  note: string
}
export interface AnalyticsValues {
  enabled: boolean
  confirmedAt: string
  note: string
}
export interface LegalValues {
  reviewIntervalDays: string
  allowVisibleBlankBrands: boolean
}

const id = (r: Obj) => (typeof r.id === 'string' ? { id: r.id } : {})

/** Startwerte aller Bereiche aus dem Global in beiden Sprachen (`fallbackLocale: false`). */
export function initialAreaValues(de: Obj, en: Obj) {
  const shopDe = obj(de.shop)
  const shopEn = obj(en.shop)
  const ship = obj(de.shipping)
  const shipEn = obj(en.shipping)
  const checklist = obj(ship.euChecklist)
  const pack = obj(de.packaging)
  const costs = obj(de.costs)
  const analytics = obj(de.analytics)
  const legal = obj(de.legal)
  const enRows = (key: string) => list(en[key])
  const templateRows = (key: 'safetyTemplates' | 'careTemplates'): TemplateRow[] =>
    list(de[key]).map((r, i) => ({
      ...id(r),
      category: s(r.category),
      text: pair(r.text, (enRows(key).find((x) => x.id === r.id) ?? enRows(key)[i])?.text),
    }))

  return {
    shop: {
      isOpen: shopDe.isOpen !== false,
      closedMessage: pair(shopDe.closedMessage, shopEn.closedMessage),
      maxItemsPerCheckout: s(shopDe.maxItemsPerCheckout ?? 10),
    } satisfies ShopValues,
    shipping: {
      enabledCountries: Array.isArray(ship.enabledCountries)
        ? ship.enabledCountries.map(String)
        : ['DE'],
      euChecklist: Object.fromEntries(
        Object.keys(EU_CHECKLIST_LABELS).map((k) => [k, checklist[k] === true]),
      ) as Record<EuChecklistKey, boolean>,
      euShippingAcknowledged: ship.euShippingAcknowledged === true,
      euShippingAcknowledgedAt: dateKey(ship.euShippingAcknowledgedAt),
      pickupEnabled: ship.pickupEnabled !== false,
      pickupCity: s(ship.pickupCity),
      deliveryTimeText: pair(ship.deliveryTimeText, shipEn.deliveryTimeText),
      rates: list(ship.rates).map((r) => ({
        ...id(r),
        zone: s(r.zone),
        shippingClass: s(r.shippingClass),
        price: euro(r.priceCents),
      })),
      trackingUrlTemplates: list(ship.trackingUrlTemplates).map((r) => ({
        ...id(r),
        carrier: s(r.carrier),
        urlTemplate: s(r.urlTemplate),
      })),
    } satisfies ShippingValues,
    packing: {
      packingChecklists: list(de.packingChecklists).map((r) => ({
        ...id(r),
        shippingClass: s(r.shippingClass),
        items: list(r.items)
          .map((i) => s(i.text))
          .join('\n'),
      })),
      templates: list(pack.templates).map((t) => ({
        ...id(t),
        key: s(t.key),
        name: s(t.name),
        components: list(t.components).map((c) => ({
          ...id(c),
          material: s(c.material),
          grams: s(c.grams),
        })),
      })),
      defaultsByShippingClass: list(pack.defaultsByShippingClass).map((d) => ({
        ...id(d),
        shippingClass: s(d.shippingClass),
        templateKey: s(d.templateKey),
      })),
    } satisfies PackingValues,
    costs: {
      budget: euro(costs.budgetCents),
      warningThreshold: euro(costs.warningThresholdCents),
      monthlyEntries: list(costs.monthlyEntries).map((r) => ({
        ...id(r),
        month: s(r.month),
        amount: euro(r.amountCents),
        note: s(r.note),
      })),
    } satisfies CostsValues,
    templates: {
      safetyTemplates: templateRows('safetyTemplates'),
      careTemplates: templateRows('careTemplates'),
    } satisfies TemplatesValues,
    yearTotals: list(obj(de.revenueGuard).manualYearTotals).map((r) => ({
      ...id(r),
      year: s(r.year),
      amount: euro(r.amountCents),
      note: s(r.note),
    })) satisfies YearRow[],
    analytics: {
      enabled: analytics.enabled === true,
      confirmedAt: dateKey(analytics.confirmedAt),
      note: s(analytics.note),
    } satisfies AnalyticsValues,
    legal: {
      reviewIntervalDays: s(legal.reviewIntervalDays ?? 365),
      allowVisibleBlankBrands: legal.allowVisibleBlankBrands === true,
    } satisfies LegalValues,
  }
}

export type InitialAreaValues = ReturnType<typeof initialAreaValues>

/** Beschriftungen und Hinweise der Bereiche (Verwaltung nur Deutsch). */
export const AREA_TEXT = {
  de: 'Deutsch',
  en: 'Englisch',
  save: 'Speichern',
  addRow: 'Zeile hinzufügen',
  removeRow: 'Zeile entfernen',
  rowLabel: 'Zeile {{n}}',
  errorSummary: 'Bitte prüfen:',
  // Shop
  shopIsOpen: 'Shop geöffnet',
  shopIsOpenHint:
    'Aus: „In den Korb“ und „Zur Kasse“ sind gesperrt, die Produktseiten zeigen den Pausen-Text. Laufende Kassen werden normal abgeschlossen.',
  shopClosedMessage: 'Text bei Pause',
  shopClosedMessageHint: 'Höchstens 300 Zeichen.',
  shopMaxItems: 'Höchstens Stücke je Bestellung',
  shopMaxItemsHint: 'Zahl von 1 bis 10.',
  shopProdBlocked:
    'In Produktion lässt sich der Shop erst öffnen, wenn die Startklar-Prüfung grün ist. Offen:',
  // Versand
  shipCountries: 'Lieferländer',
  shipCountriesHint:
    'Start nur Deutschland. Ein EU-Land lässt sich erst aktivieren, wenn alle Punkte der EU-Checkliste abgehakt sind und „EU-Versand geprüft“ gesetzt ist. Großbritannien und USA gibt es nicht.',
  shipEuChecklist: 'EU-Checkliste (vor dem ersten EU-Land)',
  shipEuAck: 'EU-Versand geprüft',
  shipEuAckAt: 'Geprüft am {{date}}',
  shipEuAckHint: 'Lässt sich erst setzen, wenn alle fünf Punkte abgehakt sind.',
  shipFoodNote:
    'Lebensmittelechte Keramik ist für die Niederlande und Luxemburg automatisch gesperrt.',
  shipPickup: 'Abholung möglich',
  shipPickupCity: 'Abholort',
  shipDeliveryTime: 'Lieferzeit',
  shipDeliveryTimeHint: 'Konkret, z. B. „2–4 Werktage“ – keine Angaben wie „ca.“.',
  shipRates: 'Versandpreise je Zone und Versandklasse',
  shipZone: 'Zone',
  shipClass: 'Versandklasse',
  shipPrice: 'Preis (Euro)',
  shipTracking: 'Sendungsverfolgung (Adresse mit {trackingNumber})',
  shipCarrier: 'Versanddienst',
  shipUrl: 'Adresse',
  // Verpackung
  packChecklists: 'Checklisten zum Packen',
  packChecklistItems: 'Punkte (einer je Zeile)',
  packTemplates: 'Verpackungsvorlagen',
  packTemplatesHint:
    'Gewichte sind Schätzwerte – bitte einmal nachwiegen. Sie zählen für die Verpackungsmeldung.',
  packKey: 'Schlüssel (a–z, 0–9, -)',
  packName: 'Name',
  packMaterial: 'Material',
  packGrams: 'Gramm',
  packAddComponent: 'Bestandteil hinzufügen',
  packRemoveComponent: 'Bestandteil entfernen',
  packAddTemplate: 'Vorlage hinzufügen',
  packRemoveTemplate: 'Vorlage entfernen',
  packDefaults: 'Standard-Vorlage je Versandklasse',
  packYearTotal: 'Verpackung im laufenden Jahr',
  // Kosten
  costsBudget: 'Budget je Monat (Euro)',
  costsWarning: 'Warnung ab (Euro)',
  costsWarningHint: 'Liegen die Kosten eines Monats darüber, erscheint unter „Heute“ ein Hinweis.',
  costsMonthly: 'Monatskosten',
  costsMonth: 'Monat',
  costsAmount: 'Betrag (Euro)',
  costsNote: 'Notiz',
  // Vorlagen
  tplSafety: 'Warn- und Sicherheitshinweise (genau einer je Kategorie)',
  tplCare: 'Pflegehinweise',
  tplHint:
    'Änderungen gelten nur für neue Stücke (Vorbelegung). Bestehende Stücke bleiben unverändert.',
  tplCategory: 'Kategorie',
  // Steuer-Bestätigung
  taxConfirmTitle: 'Steuerangaben bestätigt',
  taxConfirmHint:
    'Wenn du Steuermodus und Jahressummen mit der Steuerberatung geprüft hast, hier bestätigen.',
  taxConfirmButton: 'Steuerangaben bestätigt',
  taxConfirmedAt: 'Zuletzt bestätigt am {{date}}',
  taxConfirmNever: 'Noch nicht bestätigt.',
  taxConfirmDialog: 'Steuerangaben bestätigen?',
  taxConfirmConsequence:
    'Es wird das heutige Datum gespeichert. Das gehört zur Startklar-Prüfung vor dem Shop-Start.',
  yearTotals: 'Jahressummen vor dem Shop',
  revenueSource: 'Quelle',
  revenueAmount: 'Summe des Monats (Euro)',
  revenueAmountHint: 'Ein neuer Wert ersetzt die bisherige Summe dieses Monats und dieser Quelle.',
  yearTotalsHint:
    'Umsätze der Jahre vor dem Shop (alle Verkäufe, Tattoos, Aufträge). Vorjahr auch mit 0 € eintragen.',
  yearYear: 'Jahr',
  yearAmount: 'Umsatz (Euro)',
  yearNote: 'Notiz',
  // Statistik
  analyticsEnabled: 'Statistik an',
  analyticsHint:
    'Wirkt nur, wenn zusätzlich NEXT_PUBLIC_ANALYTICS_ENABLED=true gesetzt ist. Einschalten nur mit Datum und Notiz zur Entscheidung (R-132).',
  analyticsConfirmedAt: 'Entscheidung dokumentiert am',
  analyticsNote: 'Notiz zur Entscheidung',
  analyticsLater: 'Auftragsverarbeitung (Verträge je Dienst) folgt in P6.',
  // Rechtstexte
  legalInterval: 'Prüf-Erinnerung nach (Tagen)',
  legalIntervalHint: 'Standard 365, erlaubt 30 bis 730.',
  legalBrands: 'Sichtbare Marken auf Textil/Caps erlauben',
  legalBrandsHint:
    'Achtung: erst nach Antwort auf Kanzleifrage K-13 umstellen (R-047). Aus = Stücke mit sichtbarer Fremdmarke lassen sich nicht veröffentlichen.',
} as const
export type AreaTextKey = keyof typeof AREA_TEXT

export function areaText(key: AreaTextKey, vars: Record<string, string | number> = {}): string {
  return AREA_TEXT[key].replace(/\{\{(\w+)\}\}/g, (_, k: string) => String(vars[k] ?? ''))
}
