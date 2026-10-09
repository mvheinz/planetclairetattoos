import 'server-only'

import { APIError, ValidationError, type PayloadRequest } from 'payload'

import { computeNextItemNumber, nextFreeItemNumber } from '@/endpoints/products/nextItemNumber'
import type { Locale } from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import type { Product } from '@/payload-types'

// „Als neues Stück kopieren“ (U-60, P14.11): legt aus einem vorhandenen Stück einen neuen **Entwurf** an – mit Titel
// („(Kopie)“), Kategorie, Texten DE/EN, Maßen, Material, Preis, Versand und den Angaben zu Produktsicherheit (GPSR).
// Nicht übernommen werden alles, was nur zu genau diesem Unikat gehört: Fotos, Nummer (nächste freie Nummer wie bei
// „Neues Stück“), Status/Verkauf, Abweichung (Fleck, Glasurfehler …), die Bestätigung „nur eigene Figuren“ (für jedes
// Motiv neu), Lagerort, interne Notiz, Suchmaschinen-Texte und Hinweise.

type Doc = Record<string, unknown>

/** Nicht lokalisierte Felder, die die Kopie übernimmt. */
const SHARED_FIELDS = [
  'category',
  'priceCents',
  'vatCategory',
  'vatReducedReason',
  'weightGrams',
  'shippingClass',
  'isSecondHand',
  'condition',
  'labelMissing',
  'blankBrandVisible',
  'foodContact',
  'nickelFreeConfirmed',
  'leadFreeGlazeConfirmed',
  'smallPartsWarning',
  'framed',
  'frameHasGlass',
] as const

/** Lokalisierte Textfelder (DE und EN). */
const LOCALIZED_FIELDS = [
  'description',
  'juttaSays',
  'materials',
  'sizeLabel',
  'conditionNote',
  'fiberFreeText',
  'careInstructions',
  'metalPartsMaterial',
  'safetyWarnings',
] as const

export const COPY_SUFFIX: Readonly<Record<Locale, string>> = Object.freeze({
  de: ' (Kopie)',
  en: ' (copy)',
})
const TITLE_MAX = 80

/** Titel mit „(Kopie)“, gekürzt auf die erlaubte Länge (80 Zeichen). */
export function copyTitle(title: string | null | undefined, locale: Locale): string | null {
  const base = (title ?? '').trim()
  if (!base) return null
  const suffix = COPY_SUFFIX[locale]
  if (base.endsWith(suffix.trim())) return base.slice(0, TITLE_MAX)
  return `${base.slice(0, TITLE_MAX - suffix.length).trimEnd()}${suffix}`
}

const idOf = (v: unknown): number | null => {
  const raw = v && typeof v === 'object' ? (v as { id?: unknown }).id : v
  const n = Number(raw)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

const present = (v: unknown) => v !== undefined && v !== null && v !== ''

function localizedData(doc: Doc, locale: Locale): Doc {
  const out: Doc = {}
  const title = copyTitle(doc.title as string | null, locale)
  if (title) out.title = title
  for (const f of LOCALIZED_FIELDS) if (present(doc[f])) out[f] = doc[f]
  const note = (doc.dimensions as Doc | null | undefined)?.note
  if (present(note)) out.dimensions = { note }
  return out
}

function sharedData(de: Doc): Doc {
  const out: Doc = {}
  for (const f of SHARED_FIELDS) if (present(de[f])) out[f] = de[f]
  const dims = (de.dimensions ?? {}) as Doc
  const dimensions: Doc = {}
  for (const k of ['widthCm', 'heightCm', 'depthCm', 'diameterCm'])
    if (present(dims[k])) dimensions[k] = dims[k]
  if (present(dims.note)) dimensions.note = dims.note
  if (Object.keys(dimensions).length > 0) out.dimensions = dimensions
  const fibers = Array.isArray(de.fiberComposition) ? (de.fiberComposition as Doc[]) : []
  if (fibers.length > 0)
    out.fiberComposition = fibers.map(({ component, fiber, percent }) => ({
      component,
      fiber,
      percent,
    }))
  const declarations = (Array.isArray(de.conformityDeclarations) ? de.conformityDeclarations : [])
    .map(idOf)
    .filter((n): n is number => n !== null)
  if (declarations.length > 0) out.conformityDeclarations = declarations
  const evidence = idOf(de.nickelEvidence)
  if (evidence) out.nickelEvidence = evidence
  const customs = (de.customs ?? null) as Doc | null
  if (customs) {
    const c: Doc = {}
    for (const k of ['hsCode', 'countryOfOrigin', 'descriptionEn'])
      if (present(customs[k])) c[k] = customs[k]
    if (Object.keys(c).length > 0) out.customs = c
  }
  return out
}

const isUniqueViolation = (err: unknown): boolean => {
  const e = err as { message?: string; data?: { errors?: { path?: string }[] } }
  return (
    (e?.data?.errors ?? []).some((x) => x.path === 'itemNumber') ||
    /item_number|itemNumber|unique/i.test(e?.message ?? '')
  )
}

/** Feldfehler mit deutscher Meldung (die Collection-Regeln schreiben Deutsch in `errors[0].message`). */
function germanError(err: unknown): unknown {
  if (err instanceof ValidationError) {
    const first = err.data?.errors?.[0]?.message
    if (first) return new APIError(`Kopieren ging nicht: ${first}`, 400)
  }
  return err
}

export interface DuplicateResult {
  doc: { id: number; itemNumber: number; status: string }
  unchanged: false
}

/** Kopie als Entwurf anlegen (nur Verwaltung; Rechte prüft der Endpunkt, die Collection-Regeln laufen mit `req`). */
export async function duplicateProduct(
  req: PayloadRequest,
  sourceId: number,
): Promise<DuplicateResult> {
  const read = (locale: Locale) =>
    preservingReq(req, () =>
      req.payload.findByID({
        collection: 'products',
        id: sourceId,
        locale,
        fallbackLocale: false,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      }),
    ) as Promise<Product | null>
  const de = (await read('de')) as Doc | null
  if (!de) throw new APIError('Das Stück gibt es nicht (mehr).', 404)
  const en = ((await read('en')) ?? {}) as Doc

  const enData = localizedData(en, 'en')
  const create = (itemNumber: number) =>
    inTransaction(req, async () => {
      const doc = (await preservingReq(req, () =>
        req.payload.create({
          collection: 'products',
          locale: 'de',
          data: { ...sharedData(de), ...localizedData(de, 'de'), itemNumber } as never,
          depth: 0,
          overrideAccess: false,
          req,
        }),
      )) as unknown as Doc
      if (Object.keys(enData).length > 0) {
        await preservingReq(req, () =>
          req.payload.update({
            collection: 'products',
            id: Number(doc.id),
            locale: 'en',
            data: enData as never,
            depth: 0,
            overrideAccess: false,
            req,
          }),
        )
      }
      return doc
    })

  let itemNumber = await computeNextItemNumber(req)
  let created: Doc | null = null
  for (let attempt = 0; !created; attempt++) {
    if (itemNumber === null) throw new APIError('Keine freie Nummer gefunden.', 409)
    try {
      created = await create(itemNumber)
    } catch (err) {
      // Nummer inzwischen vergeben (zweiter Tab, paralleles Anlegen): nächste freie Nummer darüber.
      if (!isUniqueViolation(err) || attempt >= 2) throw germanError(err)
      itemNumber = await nextFreeItemNumber(req, itemNumber)
    }
  }
  const id = Number(created.id)
  return {
    doc: { id, itemNumber: Number(created.itemNumber), status: String(created.status) },
    unchanged: false,
  }
}
