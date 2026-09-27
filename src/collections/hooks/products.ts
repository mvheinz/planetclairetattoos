import {
  APIError,
  ValidationError,
  type CollectionAfterChangeHook,
  type CollectionAfterDeleteHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionBeforeValidateHook,
  type PayloadRequest,
} from 'payload'

import { CARE_TEMPLATE_TEXTS, SAFETY_TEMPLATE_TEXTS } from '@/globals/settingsDefaults'
import { writeAudit } from '@/lib/audit'
import { revalidateProduct } from '@/lib/cache/revalidate'
import { TransitionError } from '@/lib/commerce/transitionError'
import { isProductTransition, productTransitionId } from '@/lib/commerce/productTransitions'
import { findMediaReferences } from '@/lib/media/references'
import { LOCALES, type Locale, type ProductCategory, type ProductStatus } from '@/lib/enums'
import { formatMoney } from '@/lib/money'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import {
  applyCategoryDefaults,
  clearForeignFields,
  DEFAULT_SHIPPING_CLASS,
  isTextile,
  type CategoryTemplates,
} from '@/lib/products/categoryRules'
import { exampleDataPresent, nextFreeItemNumber } from '@/endpoints/products/nextItemNumber'
import { changedFields } from './immutable'
import {
  buildProductSlug,
  formatItemNumber,
  isReservedItemNumber,
  isValidItemNumber,
} from '@/lib/products/itemNumber'
import { pickLocale, type LocalizedValue } from '@/lib/products/localized'
import {
  checkFoodContact,
  relationId,
  validateForPublish,
  type ProductForValidation,
  type PublishContext,
  type PublishIssue,
} from '@/lib/products/validate'
import {
  appendWarnings,
  containsWarning,
  MANDATORY_WARNING_TEXTS,
  requiredWarningKeys,
  stripWarnings,
} from '@/lib/products/warnings'

// Hooks der Collection `products` (DATENMODELL §6.6.3, §6.6.8): Vorbelegung, Nummer, Sperren, Statusautomat (Tabelle
// in src/lib/commerce/productTransitions.ts), Veröffentlichungsprüfung, EN-Status, Audit und Löschregeln (P15).

export const PRODUCTS_SLUG = 'products'

type Doc = Record<string, unknown>

export function requestLocale(req: Pick<PayloadRequest, 'locale'>): Locale {
  return req.locale === 'en' ? 'en' : 'de'
}

export function fail(message: string, path: string): never {
  throw new ValidationError({ collection: PRODUCTS_SLUG, errors: [{ message, path }] })
}

/** Strings (auch verschachtelt) trimmen; Relationen/IDs bleiben unberührt. */
export function trimStrings(value: unknown): void {
  if (!value || typeof value !== 'object') return
  const entries = Array.isArray(value)
    ? value.map((v, i) => [i, v] as const)
    : Object.entries(value as Doc)
  for (const [key, v] of entries) {
    if (typeof v === 'string') (value as Record<string | number, unknown>)[key] = v.trim()
    else if (v && typeof v === 'object' && !(v instanceof Date)) trimStrings(v)
  }
}

interface Templates {
  get(category: ProductCategory): CategoryTemplates
}

/** Vorlagen aus `settings` (Sprache `locale`), ohne Global/Eintrag die Startwerte (SEED-SPEC §3.2). */
async function loadTemplates(req: PayloadRequest, locale: Locale): Promise<Templates> {
  let safety: { category?: string | null; text?: string | null }[] = []
  let care: { category?: string | null; text?: string | null }[] = []
  if (req.payload.config.globals.some((g) => g.slug === 'settings')) {
    const settings = await preservingReq(req, () =>
      req.payload.findGlobal({
        slug: 'settings',
        req,
        locale,
        // Ohne Rückfall auf DE: eine fehlende EN-Vorlage nimmt den EN-Startwert statt des deutschen Texts.
        fallbackLocale: false,
        depth: 0,
        overrideAccess: true,
      }),
    )
    safety = (settings.safetyTemplates ?? []) as typeof safety
    care = (settings.careTemplates ?? []) as typeof care
  }
  return {
    get(category) {
      const s = safety.find((t) => t.category === category)?.text
      const c = care.find((t) => t.category === category)?.text
      return {
        safety: s || SAFETY_TEMPLATE_TEXTS[category][locale],
        care: isTextile(category)
          ? c || CARE_TEMPLATE_TEXTS[category as 'textil' | 'cap'][locale]
          : undefined,
      }
    },
  }
}

export function adminTitleOf(itemNumber: unknown, title: unknown): string | undefined {
  if (!isValidItemNumber(itemNumber) || typeof title !== 'string' || !title.trim()) return undefined
  return `${formatItemNumber(itemNumber, 'de')} · ${title.trim()}`
}

const sameTemplate = (text: unknown, template: string | null | undefined, locale: Locale) =>
  typeof text === 'string' &&
  !!template &&
  stripWarnings(text, locale) === stripWarnings(template, locale)

/**
 * `beforeValidate`: trimmen, Kategorie-Voreinstellungen (nur leere Felder, beim Anlegen/Kategoriewechsel),
 * kategoriefremde Angaben beim Wechsel leeren, `hasDeviation` aus `deviationDecision`, `frameHasGlass` nur mit Rahmen,
 * `adminTitle`.
 */
export const prepareProduct: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  if (!data) return data
  trimStrings(data)
  const locale = requestLocale(req)
  const original = (originalDoc ?? {}) as Doc
  const category = (data.category ?? original.category) as ProductCategory | undefined
  const changed =
    operation === 'update' &&
    data.category !== undefined &&
    !!original.category &&
    data.category !== original.category

  if (category && (operation === 'create' || changed)) {
    const templates = await loadTemplates(req, locale)
    if (changed && original.status === 'draft') {
      clearForeignFields(data, category)
      // Unveränderte Vorlage der alten Kategorie durch die neue ersetzen.
      const old = templates.get(original.category as ProductCategory)
      const current = data.safetyWarnings ?? original.safetyWarnings
      if (sameTemplate(current, old.safety, locale)) data.safetyWarnings = null
      // Ebenso die Versandklasse, wenn sie noch der Voreinstellung der alten Kategorie entspricht.
      const shipping = data.shippingClass ?? original.shippingClass
      if (shipping === DEFAULT_SHIPPING_CLASS[original.category as ProductCategory]) {
        data.shippingClass = null
      }
    }
    applyCategoryDefaults(data, { ...original, ...data }, category, templates.get(category))
  }

  const merged = { ...original, ...data }
  if (merged.deviationDecision === 'none' || merged.deviationDecision === 'described') {
    data.hasDeviation = merged.deviationDecision === 'described'
  }
  if (!merged.framed && merged.frameHasGlass) data.frameHasGlass = false
  data.isCustomCommission = false
  const adminTitle = adminTitleOf(merged.itemNumber, merged.title)
  if (adminTitle) data.adminTitle = adminTitle
  // Slug je Sprache aus Nummer und Titel (§6.6.8); fehlt der Titel dieser Sprache, zieht `afterChange` nach.
  if (isValidItemNumber(merged.itemNumber) && typeof merged.title === 'string' && merged.title) {
    data.slug = buildProductSlug(merged.itemNumber, merged.title)
  }
  return data
}

/**
 * Objektnummer (E-12, R-041, §6.6.4): nach der ersten Veröffentlichung unveränderlich (außer Seed), eindeutig mit
 * verständlicher Meldung, 901–999 gesperrt, solange Beispieldaten existieren (Anlage durch die Verwaltung).
 */
async function guardItemNumber(
  data: Doc,
  original: Doc,
  operation: 'create' | 'update',
  req: PayloadRequest,
): Promise<void> {
  const ctx = getAppContext(req)
  const nr = data.itemNumber ?? original.itemNumber
  const changed =
    operation === 'create' ||
    (data.itemNumber !== undefined && data.itemNumber !== original.itemNumber)
  if (!changed || !isValidItemNumber(nr)) return
  if (operation === 'update' && original.firstPublishedAt && !ctx.seed) {
    fail(
      `Die Nummer ist seit der ersten Veröffentlichung fest (${formatItemNumber(original.itemNumber as number, 'de')}).`,
      'itemNumber',
    )
  }
  if (req.user && !ctx.seed && !ctx.system && isReservedItemNumber(nr)) {
    if (await exampleDataPresent(req)) {
      fail('Nr. 901–999 sind für Beispieldaten reserviert, bis sie entfernt sind.', 'itemNumber')
    }
  }
  const clash = await preservingReq(req, () =>
    req.payload.find({
      collection: 'products',
      where: {
        and: [
          { itemNumber: { equals: nr } },
          ...(original.id ? [{ id: { not_equals: original.id } }] : []),
        ],
      },
      limit: 1,
      depth: 0,
      select: { itemNumber: true },
      overrideAccess: true,
      req,
    }),
  )
  if (clash.docs.length > 0) {
    const next = await nextFreeItemNumber(req, nr)
    fail(
      `${formatItemNumber(nr, 'de')} ist schon vergeben – nächste freie: ${next ? formatItemNumber(next, 'de') : 'keine'}.`,
      'itemNumber',
    )
  }
}

/** Vom System gesetzte Verkaufsfelder (§6.6.1 „S“): nur über einen Übergang (oder Seed) änderbar. */
const SYSTEM_FIELDS = [
  'firstPublishedAt',
  'soldAt',
  'soldChannel',
  'archivedAt',
  'reservedUntil',
  'reservationRef',
  'currentOrder',
] as const

/**
 * `beforeChange` Nr. 3 (§6.6.7, §6.6.8): neue Stücke sind Entwürfe; `status` ändert sich nur mit `context.transition`
 * und einem Übergang der Tabelle `PRODUCT_TRANSITIONS` (sonst 403 bzw. 409). Seed legt mit Endstatus an.
 */
function guardStatus(
  data: Doc,
  original: Doc,
  operation: 'create' | 'update',
  req: PayloadRequest,
): void {
  const ctx = getAppContext(req)
  if (ctx.seed || ctx.localeSync) return
  if (operation === 'create') {
    if (data.status !== undefined && data.status !== null && data.status !== 'draft') {
      throw new APIError('Neue Stücke beginnen immer als Entwurf.', 403, undefined, true)
    }
    for (const field of SYSTEM_FIELDS) {
      if (data[field] !== undefined && data[field] !== null) {
        fail('Wird vom System gesetzt.', field)
      }
    }
    return
  }
  const from = original.status as ProductStatus
  const to = (data.status ?? from) as ProductStatus
  if (to !== from) {
    if (!ctx.transition || !isProductTransition(ctx.transition)) {
      throw new APIError(
        'Der Status ändert sich nur über die Aktionen (z. B. „Online stellen“).',
        403,
        undefined,
        true,
      )
    }
    if (!productTransitionId(ctx.transition, from, to)) {
      throw new TransitionError(`Von „${from}“ nach „${to}“ ist nicht möglich.`)
    }
  }
  if (!ctx.transition) {
    const changed = changedFields(SYSTEM_FIELDS, original, data)
    if (changed.length > 0) fail('Wird vom System gesetzt.', changed[0]!)
  }
}

/** Übersetzbare Textfelder (Pfad), Übersetzen-Knopf und EN-Status (§6.6.8 Nr. 6, §6.6.10 `translate`). */
export const EN_TEXT_PATHS = [
  'title',
  'description',
  'juttaSays',
  'materials',
  'dimensions.note',
  'sizeLabel',
  'conditionNote',
  'fiberFreeText',
  'careInstructions',
  'metalPartsMaterial',
  'safetyWarnings',
  'deviationDescription',
  'seo.metaTitle',
  'seo.metaDescription',
] as const
/** Aus Vorlagen vorbelegte Felder: zählen nicht als eigene Übersetzung. */
export const EN_TEMPLATE_PATHS: ReadonlySet<string> = new Set([
  'safetyWarnings',
  'careInstructions',
])

export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (isObj(o) ? o[k] : undefined), obj)
}
const hasPath = (obj: unknown, path: string): boolean => {
  const [head, ...rest] = path.split('.')
  if (!isObj(obj) || !(head! in obj)) return false
  return rest.length === 0 || hasPath(obj[head!], rest.join('.'))
}
const textOf = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/**
 * EN-Status (§6.6.8 Nr. 6): Übersetzen-Knopf (`context.translation`) → `machine` + `translatedAt`; eine Änderung an
 * EN-Texten durch dich → `reviewed`; sind danach alle eigenen EN-Texte leer → `missing`.
 */
async function applyEnStatus(
  data: Doc,
  original: Doc,
  operation: 'create' | 'update',
  req: PayloadRequest,
): Promise<void> {
  const ctx = getAppContext(req)
  if (ctx.localeSync || ctx.seed || operation !== 'update' || requestLocale(req) !== 'en') return
  const i18n = {
    ...(isObj(original.i18n) ? original.i18n : {}),
    ...(isObj(data.i18n) ? data.i18n : {}),
  }
  if (ctx.translation) {
    data.i18n = { ...i18n, enStatus: 'machine', translatedAt: requestNow(req).toISOString() }
    return
  }
  const touched = EN_TEXT_PATHS.filter((p) => hasPath(data, p))
  if (touched.length === 0) return
  const en = (await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'products',
      id: original.id as number,
      locale: 'en',
      fallbackLocale: false,
      depth: 0,
      overrideAccess: true,
      req,
    }),
  )) as unknown as Doc
  if (!touched.some((p) => textOf(getPath(data, p)) !== textOf(getPath(en, p)))) return
  const value = (p: string) => (hasPath(data, p) ? getPath(data, p) : getPath(en, p))
  const empty = EN_TEXT_PATHS.filter((p) => !EN_TEMPLATE_PATHS.has(p)).every(
    (p) => !textOf(value(p)),
  )
  data.i18n = { ...i18n, enStatus: empty ? 'missing' : 'reviewed' }
}

const LOCKED_WHEN_TAKEN = ['priceCents', 'shippingClass', 'category'] as const
const FIELD_LABELS: Record<(typeof LOCKED_WHEN_TAKEN)[number], string> = {
  priceCents: 'Der Preis',
  shippingClass: 'Die Versandklasse',
  category: 'Die Kategorie',
}

/** `beforeChange` Nr. 1, 2, 5 und 7 (§6.6.8). */
export const guardProduct: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  const locale = requestLocale(req)
  const original = (originalDoc ?? {}) as Doc
  guardStatus(data, original, operation, req)
  await guardItemNumber(data, original, operation, req)
  await applyEnStatus(data, original, operation, req)
  if (operation === 'update' && originalDoc) {
    const status = original.status as ProductStatus
    if (data.category !== undefined && data.category !== original.category && status !== 'draft') {
      fail('Die Kategorie lässt sich nur im Entwurf ändern.', 'category')
    }
    if (status === 'reserved' || status === 'sold') {
      for (const field of LOCKED_WHEN_TAKEN) {
        if (data[field] !== undefined && data[field] !== original[field]) {
          fail(
            `${FIELD_LABELS[field]} ist gesperrt, solange das Stück reserviert oder verkauft ist.`,
            field,
          )
        }
      }
    }
  }

  // Pflicht-Warnhinweise (R-045, R-046): fehlende anfügen, Entfernen ablehnen.
  const keys = requiredWarningKeys({ ...original, ...data })
  if (keys.length > 0) {
    if (operation === 'update' && data.safetyWarnings !== undefined) {
      for (const key of keys) {
        if (
          containsWarning(original.safetyWarnings as string, key, locale) &&
          !containsWarning(data.safetyWarnings as string, key, locale)
        ) {
          fail(
            `Der Pflicht-Hinweis „${MANDATORY_WARNING_TEXTS[key][locale]}“ lässt sich nicht entfernen.`,
            'safetyWarnings',
          )
        }
      }
    }
    const text = (data.safetyWarnings ?? original.safetyWarnings) as string | null | undefined
    data.safetyWarnings = appendWarnings(text, keys, locale)
  }
  data.isCustomCommission = false
  await runPublishChecks(data, original, operation, req)
  return data
}

/** Übergänge, bei denen das System die Veröffentlichungsprüfung braucht (§6.6.7 P2, P11). */
const PUBLISH_TRANSITIONS = new Set(['publish', 'returnToStock'])
/** Lokalisierte Felder, die `validateForPublish` liest. */
const LOCALIZED_FIELDS = new Set([
  'title',
  'description',
  'juttaSays',
  'materials',
  'sizeLabel',
  'conditionNote',
  'fiberFreeText',
  'careInstructions',
  'metalPartsMaterial',
  'safetyWarnings',
  'deviationDescription',
])

const isObj = (v: unknown): v is Doc => typeof v === 'object' && v !== null && !Array.isArray(v)
const idList = (v: unknown): (number | string)[] =>
  Array.isArray(v) ? v.map(relationId).filter((id): id is number | string => id !== null) : []
const sameIds = (a: unknown, b: unknown) => idList(a).join(',') === idList(b).join(',')

/** Stand nach dem Speichern: alle Sprachen aus der Datenbank, darüber die Änderungen dieser Sprache. */
async function productView(
  data: Doc,
  original: Doc,
  operation: 'create' | 'update',
  req: PayloadRequest,
): Promise<Doc> {
  const locale = requestLocale(req)
  const full =
    operation === 'update' && original.id !== undefined
      ? ((await preservingReq(req, () =>
          req.payload.findByID({
            collection: 'products',
            id: original.id as number,
            locale: 'all',
            depth: 0,
            overrideAccess: true,
            req,
          }),
        )) as unknown as Doc)
      : {}
  const view: Doc = { ...full }
  for (const [key, value] of Object.entries(data)) {
    if (LOCALIZED_FIELDS.has(key)) {
      view[key] = { ...(isObj(full[key]) ? full[key] : {}), [locale]: value }
    } else if (key === 'dimensions' && isObj(value)) {
      view[key] = { ...(isObj(full[key]) ? full[key] : {}), ...value }
    } else {
      view[key] = value
    }
  }
  return view
}

/**
 * `beforeChange` Nr. 4 (§6.6.6): Veröffentlichungsprüfung bei jedem Speichern mit `status ∈ {available, reserved}`
 * (auch `draft → available`, `sold → available`); „lebensmittelecht“ zusätzlich bei jedem Entwurf und bei
 * `sold`/`archived`, wenn Lebensmittelkontakt oder Erklärungen geändert werden (AK-7-01, R-044). Reine
 * Systemschreibvorgänge (Reservierung freigeben, Folge-Updates) prüfen nur bei `publish`/`returnToStock`.
 */
async function runPublishChecks(
  data: Doc,
  original: Doc,
  operation: 'create' | 'update',
  req: PayloadRequest,
): Promise<void> {
  const ctx = getAppContext(req)
  if (ctx.localeSync) return
  const status = (data.status ?? original.status ?? 'draft') as ProductStatus
  const systemOnly = !!ctx.system && !PUBLISH_TRANSITIONS.has(ctx.transition ?? '')
  // Reine Systemschreibvorgänge (Reservierung, Freigabe, Offline-Nehmen beim Widerruf einer Erklärung) prüfen nicht.
  if (systemOnly) return
  const live = (status === 'available' || status === 'reserved') && !systemOnly
  const merged = { ...original, ...data }
  const foodChanged =
    (data.foodContact !== undefined && data.foodContact !== original.foodContact) ||
    (data.conformityDeclarations !== undefined &&
      !sameIds(data.conformityDeclarations, original.conformityDeclarations))
  const checkFood =
    merged.foodContact === 'lebensmittelecht' &&
    (status === 'draft' || live || ((status === 'sold' || status === 'archived') && foodChanged))
  if (!live && !checkFood) return

  const view = await productView(data, original, operation, req)
  const find = (collection: 'media' | 'conformity-declarations', ids: (number | string)[]) =>
    ids.length === 0
      ? Promise.resolve([] as Doc[])
      : preservingReq(req, () =>
          req.payload.find({
            collection,
            where: { id: { in: ids } },
            locale: 'all',
            depth: 0,
            limit: 0,
            pagination: false,
            overrideAccess: true,
            req,
          }),
        ).then((r) => r.docs as unknown as Doc[])
  const declarations = (
    await find('conformity-declarations', idList(view.conformityDeclarations))
  ).map((d) => ({
    id: d.id as number,
    status: d.status as string,
    validFrom: d.validFrom as string,
  }))
  const now = requestNow(req)
  let issues: PublishIssue[]
  if (live) {
    const images = (await find('media', idList(view.images))).map((m) => ({
      id: m.id as number,
      alt: m.alt as LocalizedValue,
      restricted: m.restricted as boolean | null,
    }))
    const settings = req.payload.config.globals.some((g) => g.slug === 'settings')
      ? ((await preservingReq(req, () =>
          req.payload.findGlobal({ slug: 'settings', req, depth: 0, overrideAccess: true }),
        )) as unknown as Doc)
      : {}
    const legal = (settings.legal ?? {}) as Doc
    issues = validateForPublish(view as ProductForValidation, {
      allowVisibleBlankBrands: legal.allowVisibleBlankBrands === true,
      business: (settings.business ?? null) as PublishContext['business'],
      images,
      declarations,
      now,
    })
  } else {
    issues = checkFoodContact(view as ProductForValidation, { declarations, now })
  }
  if (issues.length > 0) {
    throw new ValidationError({
      collection: PRODUCTS_SLUG,
      errors: issues.map((i) => ({ path: i.field, message: i.message })),
    })
  }
}

/**
 * Abgeleitete Werte der anderen Sprache nachziehen (Titel in Listen, Vorlagen, Pflicht-Hinweise). Payload schreibt
 * lokalisierte Felder nur in der Sprache des Requests; daher ein Folge-Update in derselben Transaktion.
 */
async function syncOtherLocales(
  doc: Doc,
  previousDoc: Doc | undefined,
  operation: 'create' | 'update',
  req: PayloadRequest,
): Promise<void> {
  const current = requestLocale(req)
  const full = (await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'products',
      id: doc.id as number,
      locale: 'all',
      depth: 0,
      overrideAccess: true,
      req,
    }),
  )) as unknown as Doc
  const category = doc.category as ProductCategory | undefined
  const changed =
    operation === 'create' || (!!previousDoc?.category && previousDoc.category !== category)
  const keys = requiredWarningKeys(doc)
  for (const locale of LOCALES) {
    const patch: Doc = {}
    const at = (field: string) => (full[field] as Doc | undefined)?.[locale] as string | undefined

    // Titel in Listen und Slug für jede Sprache (EN aus dem EN-Titel, sonst aus dem deutschen).
    const title = pickLocale(full.title, locale)
    const adminTitle = adminTitleOf(doc.itemNumber, title)
    if (adminTitle && at('adminTitle') !== adminTitle) patch.adminTitle = adminTitle
    if (isValidItemNumber(doc.itemNumber) && title) {
      const slug = buildProductSlug(doc.itemNumber, title)
      if (at('slug') !== slug) patch.slug = slug
    }
    if (locale === current) {
      if (Object.keys(patch).length > 0) await syncUpdate(req, doc.id as number, locale, patch)
      continue
    }

    let safety = at('safetyWarnings')
    if (category && changed) {
      const templates = await loadTemplates(req, locale)
      const next = templates.get(category)
      const old =
        previousDoc?.category && previousDoc.category !== category
          ? templates.get(previousDoc.category as ProductCategory)
          : undefined
      if (!safety?.trim() || (old && sameTemplate(safety, old.safety, locale))) {
        safety = next.safety ?? undefined
        patch.safetyWarnings = safety
      }
      if (isTextile(category) && !at('careInstructions')?.trim() && next.care) {
        patch.careInstructions = next.care
      }
    }
    if (keys.length > 0 && safety?.trim()) {
      const withWarnings = appendWarnings(safety, keys, locale)
      if (withWarnings !== safety) patch.safetyWarnings = withWarnings
    }

    if (Object.keys(patch).length > 0) await syncUpdate(req, doc.id as number, locale, patch)
  }
}

function syncUpdate(req: PayloadRequest, id: number, locale: Locale, patch: Doc) {
  return preservingReq(req, () =>
    req.payload.update({
      collection: 'products',
      id,
      locale,
      data: patch as never,
      depth: 0,
      overrideAccess: true,
      req,
      context: { ...req.context, system: true, localeSync: true },
    }),
  )
}

/** `afterChange`: andere Sprache nachziehen, Audit (Anlage, Preis), Cache erneuern. */
export const afterProductChange: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  const ctx = getAppContext(req)
  if (ctx.localeSync) return doc
  await syncOtherLocales(doc as Doc, previousDoc as Doc | undefined, operation, req)

  const statusChanged = !!previousDoc && operation === 'update' && previousDoc.status !== doc.status
  if (!ctx.seed) {
    const label = isValidItemNumber(doc.itemNumber)
      ? formatItemNumber(doc.itemNumber, 'de')
      : `Stück ${doc.id}`
    if (statusChanged) {
      const transition = ctx.transition ?? ''
      const id = productTransitionId(transition, previousDoc.status, doc.status) ?? transition
      const actorType = ctx.system ? 'system' : undefined
      await writeAudit(req, {
        action: 'product_status_changed',
        entityCollection: PRODUCTS_SLUG,
        entityId: doc.id,
        summary: `${label}: ${previousDoc.status} → ${doc.status}${ctx.note ? ` (${ctx.note})` : ''}`,
        changes: { status: [previousDoc.status, doc.status] },
        transition: id,
        actorType,
      })
      if (transition === 'publish' && !previousDoc.firstPublishedAt) {
        await writeAudit(req, {
          action: 'product_published',
          entityCollection: PRODUCTS_SLUG,
          entityId: doc.id,
          summary: `${label} erstmals veröffentlicht`,
          transition: id,
          actorType,
        })
      }
      if (transition === 'sellOffline') {
        await writeAudit(req, {
          action: 'product_offline_sold',
          entityCollection: PRODUCTS_SLUG,
          entityId: doc.id,
          summary: `${label} offline verkauft`,
          transition: id,
          actorType,
        })
      }
    }
    if (operation === 'create') {
      await writeAudit(req, {
        action: 'product_created',
        entityCollection: PRODUCTS_SLUG,
        entityId: doc.id,
        summary: `${label} angelegt`,
      })
    } else if (
      previousDoc &&
      typeof previousDoc.priceCents === 'number' &&
      typeof doc.priceCents === 'number' &&
      previousDoc.priceCents !== doc.priceCents
    ) {
      await writeAudit(req, {
        action: 'product_price_changed',
        entityCollection: PRODUCTS_SLUG,
        entityId: doc.id,
        summary: `${label}: Preis ${formatMoney(previousDoc.priceCents, 'de')} → ${formatMoney(doc.priceCents, 'de')}`,
        changes: { priceCents: [previousDoc.priceCents, doc.priceCents] },
      })
    }
  }

  revalidateProduct(doc.id, { context: ctx, category: doc.category, immediate: statusChanged })
  if (previousDoc?.category && previousDoc.category !== doc.category) {
    revalidateProduct(doc.id, { context: ctx, category: previousDoc.category })
  }
  return doc
}

/** Referenzprüfung der Bestellpositionen (P15). */
async function orderItemsReference(req: PayloadRequest, id: number | string): Promise<boolean> {
  const res = await preservingReq(req, () =>
    req.payload.find({
      collection: 'orders',
      where: { 'items.product': { equals: id } },
      limit: 1,
      depth: 0,
      select: { orderNumber: true },
      overrideAccess: true,
      req,
    }),
  )
  return res.totalDocs > 0
}

/**
 * `beforeDelete` (P15, §6.6.8): nur nie veröffentlichte Entwürfe ohne Bestellposition. Seed-Entfernung ist
 * ausgenommen (§13.5).
 */
export const guardProductDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  if (getAppContext(req).seed) return
  const doc = (await preservingReq(req, () =>
    req.payload.findByID({ collection: 'products', id, depth: 0, overrideAccess: true, req }),
  )) as unknown as Doc
  if (doc.status !== 'draft' || doc.firstPublishedAt || (await orderItemsReference(req, id))) {
    throw new APIError(
      'Stücke mit Verlauf werden ins Archiv gelegt, nicht gelöscht.',
      409,
      undefined,
      true,
    )
  }
}

/** `afterDelete`: nur von diesem Stück genutzte Bilder mit löschen; Audit `product_deleted`. */
export const afterProductDelete: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const ctx = getAppContext(req)
  if (ctx.seed) return doc
  const images = Array.isArray(doc.images) ? doc.images.map(relationId) : []
  for (const imageId of images) {
    if (imageId === null) continue
    const others = await preservingReq(req, () =>
      req.payload.find({
        collection: 'products',
        where: { images: { equals: imageId } },
        limit: 1,
        depth: 0,
        select: { itemNumber: true },
        overrideAccess: true,
        req,
      }),
    )
    if (others.totalDocs > 0) continue
    if ((await findMediaReferences(req.payload, imageId, req)).length > 0) continue
    await preservingReq(req, () =>
      req.payload.delete({ collection: 'media', id: imageId, overrideAccess: true, req }),
    )
  }
  const label = isValidItemNumber(doc.itemNumber)
    ? formatItemNumber(doc.itemNumber, 'de')
    : `Stück ${doc.id}`
  await writeAudit(req, {
    action: 'product_deleted',
    entityCollection: PRODUCTS_SLUG,
    entityId: doc.id,
    summary: `${label} gelöscht (Nummer wieder frei)`,
  })
  revalidateProduct(doc.id, { context: ctx, category: doc.category })
  return doc
}
