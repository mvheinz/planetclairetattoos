import { ValidationError, type Endpoint, type PayloadRequest } from 'payload'

import { isAdminRequest } from '@/access'
import { ADMIN_NO_STORE } from '@/endpoints/adminResponse'
import { readJsonBody } from '@/endpoints/products/actions'
import { EU_CHECKLIST_KEYS } from '@/lib/settings/rules'
import { parseEuroInput } from '@/lib/money'
import { inTransaction } from '@/lib/payload/transaction'
import { requestNow } from '@/lib/payload/context'
import { createLogger } from '@/lib/monitoring/logger'
import { berlinDayStart } from '@/lib/time'

import { SETTINGS_AREAS, type SettingsArea } from '@/admin/views/settings/settingsAreas'

// Speichern der Einstellungen, Teil 2 und 3 (PLAN P5.22/P5.22a, KONZEPT §7.14, DATENMODELL §7.1):
// `POST /api/globals/settings/area` `{ area, values }` – je Bereich eine feste Übersetzung der Formularwerte in Felder des
// Globals (Whitelist, Beträge als Euro-Text → Cent, Zahlen als Text → Ganzzahl). Deutsch und Englisch werden in einer
// Transaktion gespeichert (erst `de`, dann `en` mit denselben Zeilen-IDs). Die fachlichen Regeln (EU-Sperre R-202,
// genau eine Warnhinweis-Vorlage je Kategorie, Statistik nur mit Entscheidung R-132, Grenzen, Go-live-Sperre) prüft
// der `beforeChange`-Hook des Globals; Audit `settings_changed` schreibt sein `afterChange`-Hook.
// Fehler kommen als 400 `{ error, errors: [{ path, message }] }`; Pfade sind Punkt-Pfade im Global, bei
// übersetzbaren Texten mit Sprach-Suffix (`shop.closedMessage.en`).

const log = createLogger()
const META_KEYS = ['id', 'createdAt', 'updatedAt', 'globalType'] as const

type Obj = Record<string, unknown>
type Locale = 'de' | 'en'
interface FieldError {
  path: string
  message: string
}

const json = (status: number, body: Obj) => Response.json(body, { status, headers: ADMIN_NO_STORE })
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const obj = (v: unknown): Obj => (isObj(v) ? v : {})
const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : [])
const str = (v: unknown): string => (typeof v === 'string' ? v : '')
const text = (v: unknown): string | null => {
  const s = str(v).trim()
  return s === '' ? null : s
}
const bool = (v: unknown): boolean => v === true
const rowId = (v: unknown): string | undefined =>
  typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v) ? v : undefined

/** Übersetzbare Texte (Fehlerpfade bekommen das Sprach-Suffix). */
const LOCALIZED_PATH_RE =
  /^(shop\.closedMessage|shipping\.deliveryTimeText|safetyTemplates\.\d+\.text|careTemplates\.\d+\.text|pickup\.instructions|emails\.signature|emails\.inquiryResponseTime)$/

const INT_MESSAGE = 'Bitte eine ganze Zahl eingeben.'
const EURO_MESSAGE = 'Bitte einen Betrag wie 12,50 eingeben.'

class Collector {
  readonly errors: FieldError[] = []
  int(path: string, value: unknown, required = true): number | null {
    if (typeof value === 'number' && Number.isInteger(value)) return value
    const s = str(value).trim()
    if (s === '') {
      if (required) this.errors.push({ path, message: 'Pflichtfeld.' })
      return null
    }
    if (!/^-?\d{1,9}$/.test(s)) {
      this.errors.push({ path, message: INT_MESSAGE })
      return null
    }
    return Number(s)
  }
  cents(path: string, value: unknown, required = true): number | null {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return value
    const s = str(value).trim()
    if (s === '') {
      if (required) this.errors.push({ path, message: 'Pflichtfeld.' })
      return null
    }
    const cents = parseEuroInput(s, { min: 0 })
    if (cents === null) this.errors.push({ path, message: EURO_MESSAGE })
    return cents
  }
}

interface AreaPlan {
  /** Änderungen am Dokument in Sprache `de` (alle nicht übersetzbaren Felder plus deutsche Texte). */
  de: (doc: Obj, now: Date) => void
  /** Englische Texte; `saved` ist das in `de` gespeicherte Dokument (für Zeilen-IDs neuer Zeilen). */
  en?: (doc: Obj, saved: Obj) => void
  /** Zusätzlich im Global `site-texts` (Mail-Bausteine, P5.27): je Sprache. */
  siteTexts?: Record<Locale, (doc: Obj) => void>
}

type AreaBuilder = (values: Obj, c: Collector) => AreaPlan

const loc = (v: unknown, locale: Locale): string | null => text(obj(v)[locale])

/** Zeilen mit übersetzbarem Text (`safetyTemplates`, `careTemplates`): EN nach Position der gespeicherten Zeilen. */
function localizedRows(key: 'safetyTemplates' | 'careTemplates', values: Obj): AreaPlan {
  const rows = list(values[key])
  return {
    de: (doc) => {
      doc[key] = rows.map((r) => ({
        ...(rowId(r.id) ? { id: rowId(r.id) } : {}),
        category: str(r.category),
        text: loc(r.text, 'de'),
      }))
    },
    en: (doc, saved) => {
      const ids = list(saved[key]).map((r) => r.id)
      doc[key] = rows.map((r, i) => ({
        ...(ids[i] ? { id: ids[i] } : {}),
        category: str(r.category),
        text: loc(r.text, 'en'),
      }))
    },
  }
}

const AREAS: Record<SettingsArea, AreaBuilder> = {
  shop: (v, c) => {
    const max = c.int('shop.maxItemsPerCheckout', v.maxItemsPerCheckout)
    return {
      de: (doc) => {
        const shop = obj(doc.shop)
        shop.isOpen = bool(v.isOpen)
        shop.closedMessage = loc(v.closedMessage, 'de')
        shop.maxItemsPerCheckout = max
        doc.shop = shop
      },
      en: (doc) => {
        const shop = obj(doc.shop)
        shop.closedMessage = loc(v.closedMessage, 'en')
        doc.shop = shop
      },
    }
  },

  shipping: (v, c) => {
    const rates = list(v.rates).map((r, i) => ({
      ...(rowId(r.id) ? { id: rowId(r.id) } : {}),
      zone: str(r.zone),
      shippingClass: str(r.shippingClass),
      priceCents: c.cents(`shipping.rates.${i}.priceCents`, r.price),
    }))
    const tracking = list(v.trackingUrlTemplates).map((r) => ({
      ...(rowId(r.id) ? { id: rowId(r.id) } : {}),
      carrier: str(r.carrier),
      urlTemplate: str(r.urlTemplate).trim(),
    }))
    const checklist = obj(v.euChecklist)
    const countries = Array.isArray(v.enabledCountries)
      ? [...new Set(v.enabledCountries.map((x) => String(x).toUpperCase()))]
      : ['DE']
    return {
      de: (doc) => {
        const s = obj(doc.shipping)
        s.enabledCountries = countries
        s.euChecklist = Object.fromEntries(EU_CHECKLIST_KEYS.map((k) => [k, bool(checklist[k])]))
        s.euShippingAcknowledged = bool(v.euShippingAcknowledged)
        s.pickupEnabled = bool(v.pickupEnabled)
        s.pickupCity = text(v.pickupCity)
        s.deliveryTimeText = loc(v.deliveryTimeText, 'de')
        s.rates = rates
        s.trackingUrlTemplates = tracking
        doc.shipping = s
      },
      en: (doc) => {
        const s = obj(doc.shipping)
        s.deliveryTimeText = loc(v.deliveryTimeText, 'en')
        doc.shipping = s
      },
    }
  },

  packing: (v, c) => {
    const checklists = list(v.packingChecklists).map((r) => ({
      ...(rowId(r.id) ? { id: rowId(r.id) } : {}),
      shippingClass: str(r.shippingClass),
      items: str(r.items)
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((t) => ({ text: t })),
    }))
    const templates = list(v.templates).map((t, i) => ({
      ...(rowId(t.id) ? { id: rowId(t.id) } : {}),
      key: str(t.key).trim(),
      name: str(t.name).trim(),
      components: list(t.components).map((k, j) => ({
        ...(rowId(k.id) ? { id: rowId(k.id) } : {}),
        material: str(k.material),
        grams: c.int(`packaging.templates.${i}.components.${j}.grams`, k.grams),
      })),
    }))
    const defaults = list(v.defaultsByShippingClass).map((d) => ({
      ...(rowId(d.id) ? { id: rowId(d.id) } : {}),
      shippingClass: str(d.shippingClass),
      templateKey: str(d.templateKey),
    }))
    return {
      de: (doc) => {
        doc.packingChecklists = checklists
        const p = obj(doc.packaging)
        p.templates = templates
        p.defaultsByShippingClass = defaults
        doc.packaging = p
      },
    }
  },

  costs: (v, c) => {
    const budget = c.cents('costs.budgetCents', v.budget)
    const warn = c.cents('costs.warningThresholdCents', v.warningThreshold)
    const entries = list(v.monthlyEntries).map((r, i) => ({
      ...(rowId(r.id) ? { id: rowId(r.id) } : {}),
      month: str(r.month).trim(),
      amountCents: c.cents(`costs.monthlyEntries.${i}.amountCents`, r.amount),
      note: text(r.note),
    }))
    return {
      de: (doc) => {
        const costs = obj(doc.costs)
        costs.budgetCents = budget
        costs.warningThresholdCents = warn
        costs.monthlyEntries = entries
        doc.costs = costs
      },
    }
  },

  templates: (v) => {
    const safety = localizedRows('safetyTemplates', v)
    const care = localizedRows('careTemplates', v)
    return {
      de: (doc, now) => {
        safety.de(doc, now)
        care.de(doc, now)
      },
      en: (doc, saved) => {
        safety.en!(doc, saved)
        care.en!(doc, saved)
      },
    }
  },

  taxConfirm: () => ({
    de: (doc, now) => {
      const tax = obj(doc.tax)
      tax.confirmedAt = now.toISOString()
      doc.tax = tax
    },
  }),

  yearTotals: (v, c) => {
    const rows = list(v.manualYearTotals).map((r, i) => ({
      ...(rowId(r.id) ? { id: rowId(r.id) } : {}),
      year: c.int(`revenueGuard.manualYearTotals.${i}.year`, r.year),
      amountCents: c.cents(`revenueGuard.manualYearTotals.${i}.amountCents`, r.amount),
      note: text(r.note),
    }))
    return {
      de: (doc) => {
        const g = obj(doc.revenueGuard)
        g.manualYearTotals = rows
        doc.revenueGuard = g
      },
    }
  },

  analytics: (v, c) => {
    const date = str(v.confirmedAt).trim()
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      c.errors.push({ path: 'analytics.confirmedAt', message: 'Bitte ein Datum wählen.' })
    }
    return {
      de: (doc) => {
        const a = obj(doc.analytics)
        a.enabled = bool(v.enabled)
        a.confirmedAt = date ? berlinDayStart(new Date(`${date}T12:00:00Z`)).toISOString() : null
        a.note = text(v.note)
        doc.analytics = a
      },
    }
  },

  mailTexts: (v) => {
    const set = (locale: Locale) => (doc: Obj) => {
      const pickup = obj(doc.pickup)
      pickup.instructions = loc(v.pickupInstructions, locale)
      doc.pickup = pickup
    }
    const setTexts = (locale: Locale) => (doc: Obj) => {
      const emails = obj(doc.emails)
      emails.signature = loc(v.signature, locale)
      emails.inquiryResponseTime = loc(v.inquiryResponseTime, locale)
      doc.emails = emails
    }
    return { de: set('de'), en: set('en'), siteTexts: { de: setTexts('de'), en: setTexts('en') } }
  },

  legal: (v, c) => {
    const days = c.int('legal.reviewIntervalDays', v.reviewIntervalDays)
    return {
      de: (doc) => {
        const l = obj(doc.legal)
        l.reviewIntervalDays = days
        l.allowVisibleBlankBrands = bool(v.allowVisibleBlankBrands)
        doc.legal = l
      },
    }
  },
}

type GlobalSlug = 'settings' | 'site-texts'

async function loadDoc(
  req: PayloadRequest,
  locale: Locale,
  slug: GlobalSlug = 'settings',
): Promise<Obj> {
  const current = (await req.payload.findGlobal({
    slug,
    depth: 0,
    locale,
    fallbackLocale: false,
    overrideAccess: true,
    req,
  })) as unknown as Obj
  const data = structuredClone(current)
  for (const key of META_KEYS) delete data[key]
  return data
}

async function save(
  req: PayloadRequest,
  data: Obj,
  locale: Locale,
  slug: GlobalSlug = 'settings',
): Promise<Obj> {
  return (await req.payload.updateGlobal({
    slug,
    data: data as never,
    depth: 0,
    locale,
    overrideAccess: true,
    req,
  })) as unknown as Obj
}

class LocaleValidationError extends Error {
  constructor(
    readonly locale: Locale,
    readonly validation: ValidationError,
  ) {
    super(validation.message)
  }
}

function validationErrors(err: ValidationError, locale: Locale): FieldError[] {
  return (err.data?.errors ?? []).map((e) => {
    const path = String(e.path ?? '')
    return { path: LOCALIZED_PATH_RE.test(path) ? `${path}.${locale}` : path, message: e.message }
  })
}

const isArea = (v: unknown): v is SettingsArea =>
  typeof v === 'string' && (SETTINGS_AREAS as readonly string[]).includes(v)

export const settingsAreaEndpoint: Endpoint = {
  path: '/area',
  method: 'post',
  handler: async (req) => {
    if (!isAdminRequest(req)) return json(403, { error: 'Nicht erlaubt.' })
    const body = await readJsonBody(req)
    if (!isArea(body.area)) return json(400, { error: 'Unbekannter Bereich.' })
    const collector = new Collector()
    const plan = AREAS[body.area](obj(body.values), collector)
    if (collector.errors.length > 0) {
      return json(400, { error: 'Bitte die markierten Felder prüfen.', errors: collector.errors })
    }
    const now = requestNow(req)
    try {
      await inTransaction(req, async () => {
        const de = await loadDoc(req, 'de')
        plan.de(de, now)
        let saved: Obj
        try {
          saved = await save(req, de, 'de')
        } catch (err) {
          if (err instanceof ValidationError) throw new LocaleValidationError('de', err)
          throw err
        }
        if (plan.en) {
          const en = await loadDoc(req, 'en')
          plan.en(en, saved)
          try {
            await save(req, en, 'en')
          } catch (err) {
            if (err instanceof ValidationError) throw new LocaleValidationError('en', err)
            throw err
          }
        }
        for (const locale of plan.siteTexts ? (['de', 'en'] as const) : []) {
          const doc = await loadDoc(req, locale, 'site-texts')
          plan.siteTexts![locale](doc)
          try {
            await save(req, doc, locale, 'site-texts')
          } catch (err) {
            if (err instanceof ValidationError) throw new LocaleValidationError(locale, err)
            throw err
          }
        }
      })
      return json(200, { unchanged: false })
    } catch (err) {
      if (err instanceof LocaleValidationError) {
        return json(400, {
          error: 'Bitte die markierten Felder prüfen.',
          errors: validationErrors(err.validation, err.locale),
        })
      }
      log.error('settings.area_save_failed', { area: body.area, reason: (err as Error)?.message })
      return json(500, {
        error: 'Speichern hat nicht geklappt. Bitte die Seite neu laden und noch einmal versuchen.',
      })
    }
  },
}

/**
 * „Übersetzen → EN“ für Texte der Einstellungen (P5.22a, P5.4): `POST /api/globals/settings/translate?text=…` übersetzt
 * den übergebenen deutschen Text (≤ 1000 Zeichen) über den Übersetzungs-Adapter und gibt ihn nur zurück – gespeichert
 * wird mit „Speichern“ des Bereichs. In Produktion ohne DeepL 409 „Übersetzen ist noch nicht eingerichtet“.
 */
export const settingsTranslateEndpoint: Endpoint = {
  path: '/translate',
  method: 'post',
  handler: async (req) => {
    if (!isAdminRequest(req)) return json(403, { error: 'Nicht erlaubt.' })
    const source = (req.searchParams?.get('text') ?? '').trim()
    if (!source || source.length > 1000) {
      return json(400, {
        error: 'Bitte zuerst den deutschen Text eingeben (höchstens 1000 Zeichen).',
      })
    }
    const { getTranslationAdapter, translationAvailability } = await import('@/lib/translation')
    const availability = translationAvailability()
    if (!availability.enabled) return json(409, { error: availability.reason })
    try {
      const [text] = await getTranslationAdapter().translate({
        texts: [source],
        source: 'de',
        target: 'en',
      })
      return json(200, { text: text ?? '' })
    } catch (err) {
      log.warn('settings.translate_failed', { reason: (err as Error)?.message })
      return json(502, { error: 'Übersetzen hat nicht geklappt. Bitte später noch einmal.' })
    }
  },
}

/**
 * Manuelle Monatssumme eintragen (P5.23, KONZEPT §8.4, A45): `POST /api/globals/settings/revenue-entry`
 * `{ month, source, amount, note }` – legt den Eintrag (Monat, Quelle) an oder ändert ihn (eindeutig je Monat und
 * Quelle). Regeln (Format, keine Zukunft, Grenzen) prüft die Collection `revenue-entries`; sie reiht danach den
 * Umsatz-Wächter neu ein.
 */
export const settingsRevenueEntryEndpoint: Endpoint = {
  path: '/revenue-entry',
  method: 'post',
  handler: async (req) => {
    if (!isAdminRequest(req)) return json(403, { error: 'Nicht erlaubt.' })
    const body = await readJsonBody(req)
    const c = new Collector()
    const month = str(body.month).trim()
    const source = str(body.source)
    const amountCents = c.cents('amountCents', body.amount)
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
      c.errors.push({ path: 'month', message: 'Monat im Format JJJJ-MM, z. B. 2026-09.' })
    }
    if (c.errors.length > 0) {
      return json(400, { error: 'Bitte die markierten Felder prüfen.', errors: c.errors })
    }
    const data = { month, source, amountCents, note: text(body.note) }
    try {
      const existing = await req.payload.find({
        collection: 'revenue-entries',
        where: {
          and: [
            { month: { equals: month } },
            { source: { equals: source } },
            { seed: { not_equals: true } },
          ],
        },
        limit: 1,
        depth: 0,
        overrideAccess: true,
        req,
      })
      const doc = existing.docs[0]
      if (doc) {
        await req.payload.update({
          collection: 'revenue-entries',
          id: doc.id,
          data: data as never,
          depth: 0,
          overrideAccess: true,
          req,
        })
      } else {
        await req.payload.create({
          collection: 'revenue-entries',
          data: data as never,
          depth: 0,
          overrideAccess: true,
          req,
        })
      }
      return json(200, { unchanged: false })
    } catch (err) {
      if (err instanceof ValidationError) {
        return json(400, {
          error: 'Bitte die markierten Felder prüfen.',
          errors: (err.data?.errors ?? []).map((e) => ({
            path: String(e.path ?? ''),
            message: e.message,
          })),
        })
      }
      log.error('settings.revenue_entry_failed', { reason: (err as Error)?.message })
      return json(500, { error: 'Speichern hat nicht geklappt. Bitte noch einmal versuchen.' })
    }
  },
}
