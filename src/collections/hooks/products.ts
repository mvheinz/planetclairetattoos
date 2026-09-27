import {
  ValidationError,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeValidateHook,
  type PayloadRequest,
} from 'payload'

import { CARE_TEMPLATE_TEXTS, SAFETY_TEMPLATE_TEXTS } from '@/globals/settingsDefaults'
import { writeAudit } from '@/lib/audit'
import { revalidateProduct } from '@/lib/cache/revalidate'
import { LOCALES, type Locale, type ProductCategory, type ProductStatus } from '@/lib/enums'
import { formatMoney } from '@/lib/money'
import { getAppContext } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import {
  applyCategoryDefaults,
  clearForeignFields,
  DEFAULT_SHIPPING_CLASS,
  isTextile,
  type CategoryTemplates,
} from '@/lib/products/categoryRules'
import { formatItemNumber, isValidItemNumber } from '@/lib/products/itemNumber'
import { pickLocale } from '@/lib/products/localized'
import {
  appendWarnings,
  containsWarning,
  MANDATORY_WARNING_TEXTS,
  requiredWarningKeys,
  stripWarnings,
} from '@/lib/products/warnings'

// Hooks der Collection `products` (DATENMODELL §6.6.3, §6.6.8). Statusautomat, EN-Status und Löschregeln folgen in
// P1.19, die Veröffentlichungsprüfung in P1.18.

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
  return data
}

const LOCKED_WHEN_TAKEN = ['priceCents', 'shippingClass', 'category'] as const
const FIELD_LABELS: Record<(typeof LOCKED_WHEN_TAKEN)[number], string> = {
  priceCents: 'Der Preis',
  shippingClass: 'Die Versandklasse',
  category: 'Die Kategorie',
}

/** `beforeChange` Nr. 2, 5 und 7 (§6.6.8). */
export const guardProduct: CollectionBeforeChangeHook = ({ data, originalDoc, operation, req }) => {
  const locale = requestLocale(req)
  const original = (originalDoc ?? {}) as Doc
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
  return data
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
    if (locale === current) continue
    const patch: Doc = {}
    const at = (field: string) => (full[field] as Doc | undefined)?.[locale] as string | undefined

    const adminTitle = adminTitleOf(doc.itemNumber, pickLocale(full.title, locale))
    if (adminTitle && at('adminTitle') !== adminTitle) patch.adminTitle = adminTitle

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

    if (Object.keys(patch).length === 0) continue
    await preservingReq(req, () =>
      req.payload.update({
        collection: 'products',
        id: doc.id as number,
        locale,
        data: patch as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, system: true, localeSync: true },
      }),
    )
  }
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

  if (!ctx.seed) {
    const label = isValidItemNumber(doc.itemNumber)
      ? formatItemNumber(doc.itemNumber, 'de')
      : `Stück ${doc.id}`
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

  revalidateProduct(doc.id, { context: ctx, category: doc.category })
  if (previousDoc?.category && previousDoc.category !== doc.category) {
    revalidateProduct(doc.id, { context: ctx, category: previousDoc.category })
  }
  return doc
}
