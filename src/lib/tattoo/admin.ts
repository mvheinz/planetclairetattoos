import 'server-only'

import { APIError, ValidationError, type PayloadRequest } from 'payload'

import { writeAudit } from '@/lib/audit'
import { revalidateContent } from '@/lib/cache/revalidate'
import { TAGS } from '@/lib/cache/tags'
import { FAQ_CATEGORIES, type FaqCategory, type Locale, type PageKey } from '@/lib/enums'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import { lexicalToPlain, toLexical } from '@/lib/richtext/plain'
import { getTranslationAdapter, translationAvailability } from '@/lib/translation'
import { getPath, translateDocumentFields } from '@/lib/translation/translateDocument'
import type { Faq, Flash, Page, TattooGallery } from '@/payload-types'

import {
  PAGE_FIELD_LIMITS,
  PAGE_TEXT_BLOCKS,
  TATTOO_TEXT_BLOCKS,
  TATTOO_TEXT_PAGES,
  TEXT_PAGES,
  editorTexts,
  type BlockDef,
  type BlockFieldDef,
  type EditorBlock,
  type LocalizedText,
  type TattooTextPageKey,
} from './textBlocks'
import { tattooTextWarnings, type TattooTextWarning } from './textWarnings'

// Dienste der Tattoo-Verwaltung `/tattoo` (PLAN P7.6–P7.9, KONZEPT §7.12): Flash-Status in zwei Taps, Nummernvorschlag,
// Übersetzen (über `translateDocumentFields`), Galerie-Einwilligung widerrufen (R-172, L-19 b, L-20, R-152) und die
// Tattoo-Texte (Blöcke der Seiten `tattoo`/`tattoo_aftercare`, FAQ der Kategorien `tattoo`/`aftercare`) mit Warnungen
// (V-24, V-15; Speichern bleibt möglich). Endpunkte: `src/endpoints/tattoo.ts`.

type Doc = Record<string, unknown>

export interface ServiceResult<T> {
  doc: T
  unchanged?: boolean
}

const fieldError = (collection: string, path: string, message: string): never => {
  throw new ValidationError({ collection, errors: [{ path, message }] })
}

// --- Flash (P7.6) ------------------------------------------------------------------------------------------------

/** Nummernvorschlag: höchste Nummer der echten Motive + 1 (Seed 901–910 und Fixtures 980–999 zählen nicht). */
export async function suggestFlashNumber(req: PayloadRequest): Promise<number> {
  const last = await preservingReq(req, () =>
    req.payload.find({
      collection: 'flash',
      where: { seed: { not_equals: true } },
      sort: '-number',
      limit: 1,
      depth: 0,
      select: { number: true },
      overrideAccess: true,
      req,
    }),
  )
  return ((last.docs[0]?.number as number | undefined) ?? 0) + 1
}

async function loadFlash(req: PayloadRequest, id: number): Promise<Flash> {
  const doc = await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'flash',
      id,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )
  if (!doc) throw new APIError('Unbekanntes Flash-Motiv.', 404, undefined, true)
  return doc as Flash
}

/** „verfügbar ↔ vergeben“ (Chip). Wiederholbare Motive lehnt der Hook bzw. der DB-CHECK ab (DATENMODELL §9.2). */
export async function setFlashStatus(
  req: PayloadRequest,
  id: number,
  status: 'available' | 'claimed',
): Promise<ServiceResult<Flash>> {
  const doc = await loadFlash(req, id)
  if (doc.status === status) return { doc, unchanged: true }
  if (status === 'claimed' && doc.repeatable) {
    fieldError(
      'flash',
      'status',
      'Ein wiederholbares Motiv kann nicht „vergeben“ sein. Zum Pausieren nutze „Offline nehmen“.',
    )
  }
  const updated = await inTransaction(req, () =>
    preservingReq(req, () =>
      req.payload.update({
        collection: 'flash',
        id,
        data: { status },
        depth: 0,
        overrideAccess: true,
        req,
      }),
    ),
  )
  return { doc: updated as Flash }
}

/** „Offline nehmen“ / „Online stellen“. */
export async function setFlashPublished(
  req: PayloadRequest,
  id: number,
  published: boolean,
): Promise<ServiceResult<Flash>> {
  const doc = await loadFlash(req, id)
  if ((doc.published !== false) === published) return { doc, unchanged: true }
  const updated = await inTransaction(req, () =>
    preservingReq(req, () =>
      req.payload.update({
        collection: 'flash',
        id,
        data: { published },
        depth: 0,
        overrideAccess: true,
        req,
      }),
    ),
  )
  return { doc: updated as Flash }
}

// --- Übersetzen (E-61) ---------------------------------------------------------------------------------------------

function assertTranslation(): void {
  const availability = translationAvailability()
  if (!availability.enabled) throw new APIError(availability.reason!, 409, undefined, true)
}

export const FLASH_TRANSLATE_PATHS = ['title', 'sizeNote'] as const
export const OFFER_TRANSLATE_PATHS = ['title', 'description', 'locationNote', 'priceNote'] as const
export const FAQ_TRANSLATE_PATHS = ['question', 'answer'] as const

/** EN-Wert ist eine unveränderte Kopie des deutschen (Pflichtfeld beim Speichern aufgefüllt) → darf überschrieben werden. */
const sameAsGerman = (de: Doc) => (path: string, en: Doc) =>
  JSON.stringify(getPath(en, path) ?? null) === JSON.stringify(getPath(de, path) ?? null)

async function readLocale(
  req: PayloadRequest,
  collection: 'flash' | 'tattoo-offers' | 'faqs' | 'pages',
  id: number,
  locale: Locale,
): Promise<Doc> {
  const doc = await preservingReq(req, () =>
    req.payload.findByID({
      collection,
      id,
      locale,
      fallbackLocale: false,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )
  if (!doc) throw new APIError('Nicht gefunden.', 404, undefined, true)
  return doc as unknown as Doc
}

export async function translateTattooDocument(
  req: PayloadRequest,
  collection: 'flash' | 'tattoo-offers' | 'faqs',
  id: number,
  { force = false }: { force?: boolean } = {},
) {
  assertTranslation()
  const paths =
    collection === 'flash'
      ? FLASH_TRANSLATE_PATHS
      : collection === 'tattoo-offers'
        ? OFFER_TRANSLATE_PATHS
        : FAQ_TRANSLATE_PATHS
  const de = await readLocale(req, collection, id, 'de')
  return translateDocumentFields(req, collection, id, paths, {
    force,
    adapter: getTranslationAdapter(),
    mayOverwrite: sameAsGerman(de),
  })
}

/**
 * Übersetzbare Pfade einer Seite: Titel, SEO-Texte und die Textfelder der bearbeitbaren Blöcke
 * (`layout.0.steps.1.title`; alle Blöcke aus `PAGE_TEXT_BLOCKS`, P8.19a).
 */
export function pageTranslatePaths(de: Doc): string[] {
  const paths = ['title']
  const seo = (de.seo ?? {}) as Doc
  for (const f of ['metaTitle', 'metaDescription'])
    if (typeof seo[f] === 'string' && (seo[f] as string).trim()) paths.push(`seo.${f}`)
  const layout = Array.isArray(de.layout) ? (de.layout as Doc[]) : []
  layout.forEach((block, i) => {
    const def = PAGE_TEXT_BLOCKS[String(block.blockType)]
    if (!def) return
    for (const f of def.fields) paths.push(`layout.${i}.${f.name}`)
    if (def.rows) {
      const rows = Array.isArray(block[def.rows.name]) ? (block[def.rows.name] as Doc[]) : []
      rows.forEach((_, j) => {
        for (const f of def.rows!.fields) paths.push(`layout.${i}.${def.rows!.name}.${j}.${f.name}`)
      })
    }
  })
  return paths
}

/** `POST /api/pages/:id/translate`: alle Texte der Blöcke (Struktur bleibt gleich, Blöcke sind nicht lokalisiert). */
export async function translatePage(
  req: PayloadRequest,
  id: number,
  { force = false }: { force?: boolean } = {},
) {
  assertTranslation()
  const de = await readLocale(req, 'pages', id, 'de')
  return translateDocumentFields(req, 'pages', id, pageTranslatePaths(de), {
    force,
    adapter: getTranslationAdapter(),
    mayOverwrite: sameAsGerman(de),
  })
}

// --- Galerie: Einwilligung widerrufen (P7.8) ---------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface WithdrawConsentOptions {
  /** Optional: Adresse für die Bestätigung M16 (Variante Portfolio); der Eintrag speichert sie nicht. */
  email?: string | null
  locale?: Locale
}

/**
 * `POST /api/tattoo-gallery/:id/withdraw-consent` (DATENMODELL §6.16, R-172): `consentGiven = false`,
 * `published = false`, `consentWithdrawnAt`; die Bilder werden gesperrt (Hook `syncMedia` → Datei-URL 404), die Galerie
 * sofort neu erzeugt, Audit `gallery_consent_withdrawn`. Der Nachweis bekommt seine Frist (3 Jahre, L-19 b), die
 * Bilddateien löscht `retentionConsentEvidence` nach 24 h (L-20). Mit Adresse genau eine M16 (R-152).
 */
export async function withdrawGalleryConsent(
  req: PayloadRequest,
  id: number,
  { email, locale = 'de' }: WithdrawConsentOptions = {},
): Promise<ServiceResult<TattooGallery> & { mailQueued: boolean }> {
  const to = typeof email === 'string' ? email.trim() : ''
  if (to && (to.length > 254 || !EMAIL_RE.test(to))) {
    fieldError(
      'tattoo-gallery',
      'email',
      'Bitte eine gültige E-Mail-Adresse eingeben (oder leer lassen).',
    )
  }
  return inTransaction(req, async () => {
    const current = (await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'tattoo-gallery',
        id,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      }),
    )) as TattooGallery | null
    if (!current) throw new APIError('Unbekanntes Galerie-Foto.', 404, undefined, true)
    if (current.consentWithdrawnAt && !current.consentGiven && !current.published) {
      return { doc: current, unchanged: true, mailQueued: false }
    }
    const now = requestNow(req)
    const doc = (await preservingReq(req, () =>
      req.payload.update({
        collection: 'tattoo-gallery',
        id,
        data: {
          consentGiven: false,
          published: false,
          featured: false,
          consentWithdrawnAt: now.toISOString(),
        },
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, transition: 'withdraw-consent' },
      }),
    )) as TattooGallery
    // Frist des Nachweises neu berechnen (L-19 b: 3 Jahre ab Widerruf).
    const evidence =
      typeof doc.consentEvidence === 'object' && doc.consentEvidence
        ? doc.consentEvidence.id
        : doc.consentEvidence
    if (evidence) {
      await preservingReq(req, () =>
        req.payload.update({
          collection: 'private-uploads',
          id: evidence,
          data: { relatedGalleryItem: id } as never,
          depth: 0,
          overrideAccess: true,
          req,
          context: { ...req.context, system: true },
        }),
      )
    }
    revalidateContent(TAGS.tattooGallery, { context: getAppContext(req), immediate: true })
    revalidateContent(TAGS.home, { context: getAppContext(req), immediate: true })
    await writeAudit(req, {
      action: 'gallery_consent_withdrawn',
      entityCollection: 'tattoo-gallery',
      entityId: id,
      summary: `Galerie-Foto ${id}: Einwilligung widerrufen, offline genommen`,
    })
    let mailQueued = false
    if (to) {
      const { enqueueEmail } = await import('@/lib/email/outbox')
      await enqueueEmail(req, {
        template: 'consent_withdrawal_confirmation',
        to,
        locale,
        data: { purpose: 'portfolio', withdrawnAt: now.toISOString(), name: null },
        idempotencyKey: `consent_withdrawal_confirmation:gallery-${id}:portfolio`,
      })
      // `suppressed` (Testadresse) und `duplicate` stehen ebenfalls im Mail-Protokoll – genau ein Eintrag je Widerruf.
      mailQueued = true
    }
    return { doc, mailQueued }
  })
}

// --- Tattoo-Texte: Seiten (P7.9) ----------------------------------------------------------------------------------

function plainOf(field: BlockFieldDef, value: unknown): { text: string; lossy: boolean } {
  if (field.kind === 'rich') return lexicalToPlain(value)
  return { text: typeof value === 'string' ? value : '', lossy: false }
}

function valueOf(field: BlockFieldDef, text: string): unknown {
  const t = text.trim()
  if (!t) return null
  return field.kind === 'rich' ? toLexical(t) : t
}

async function findPageByKey(
  req: PayloadRequest,
  key: PageKey,
  locale: Locale,
): Promise<Page | null> {
  const res = await preservingReq(req, () =>
    req.payload.find({
      collection: 'pages',
      where: { key: { equals: key } },
      limit: 1,
      depth: 0,
      locale,
      fallbackLocale: false,
      draft: true,
      overrideAccess: true,
      req,
    }),
  )
  return (res.docs[0] as Page | undefined) ?? null
}

/** Seite → Formularwerte (DE und EN, Rich Text als Klartext). */
export function editorBlocksFromPage(
  de: Page | null,
  en: Page | null,
  defs: Readonly<Record<string, BlockDef>> = TATTOO_TEXT_BLOCKS,
): EditorBlock[] {
  const layoutEn = (en?.layout ?? []) as unknown as Doc[]
  return ((de?.layout ?? []) as unknown as Doc[]).map((block, i) => {
    const def = defs[String(block.blockType)]
    const blockEn = layoutEn.find((b) => b.id === block.id) ?? layoutEn[i] ?? {}
    const out: EditorBlock = {
      id: typeof block.id === 'string' ? block.id : undefined,
      blockType: String(block.blockType),
      editable: Boolean(def),
      fields: {},
      rows: [],
    }
    if (!def) return out
    let lossy = false
    const pair = (f: BlockFieldDef, d: unknown, e: unknown): LocalizedText => {
      const pd = plainOf(f, d)
      const pe = plainOf(f, e)
      lossy ||= pd.lossy || pe.lossy
      return { de: pd.text, en: pe.text }
    }
    for (const f of def.fields) out.fields[f.name] = pair(f, block[f.name], blockEn[f.name])
    if (def.rows) {
      const rowsEn = Array.isArray(blockEn[def.rows.name]) ? (blockEn[def.rows.name] as Doc[]) : []
      const rows = Array.isArray(block[def.rows.name]) ? (block[def.rows.name] as Doc[]) : []
      out.rows = rows.map((row, j) => {
        const rowEn = rowsEn.find((r) => r.id === row.id) ?? rowsEn[j] ?? {}
        return {
          id: typeof row.id === 'string' ? row.id : undefined,
          fields: Object.fromEntries(
            def.rows!.fields.map((f) => [f.name, pair(f, row[f.name], rowEn[f.name])]),
          ),
        }
      })
    }
    if (lossy) out.lossy = true
    return out
  })
}

export interface PageTextsForm {
  page: { id: number; title: LocalizedText } | null
  blocks: EditorBlock[]
}

/** Startwerte des Formulars einer Seite. */
export async function loadTattooPageTexts(
  req: PayloadRequest,
  key: TattooTextPageKey,
): Promise<PageTextsForm> {
  const de = await findPageByKey(req, key, 'de')
  const en = de ? await findPageByKey(req, key, 'en') : null
  return {
    page: de ? { id: de.id, title: { de: de.title ?? '', en: en?.title ?? '' } } : null,
    blocks: editorBlocksFromPage(de, en),
  }
}

export interface SaveTextsResult<T> {
  doc: T
  warnings: TattooTextWarning[]
}

function checkBlocks(
  addable: readonly string[],
  defs: Readonly<Record<string, BlockDef>>,
  blocks: readonly EditorBlock[],
  current: Doc[],
): { path: string; message: string }[] {
  const errors: { path: string; message: string }[] = []
  blocks.forEach((b, i) => {
    if (!b.editable) {
      if (!b.id || !current.some((c) => c.id === b.id))
        errors.push({ path: `blocks.${i}`, message: 'Unbekannter Block.' })
      return
    }
    const def = defs[b.blockType]
    if (!def || (!b.id && !addable.includes(b.blockType))) {
      errors.push({ path: `blocks.${i}`, message: 'Dieser Block kann hier nicht angelegt werden.' })
      return
    }
    const check = (f: BlockFieldDef, v: LocalizedText | undefined, path: string) => {
      const de = (v?.de ?? '').trim()
      if (f.required && !de) errors.push({ path: `${path}.de`, message: 'Pflichtfeld (Deutsch).' })
      for (const l of ['de', 'en'] as const) {
        const len = (v?.[l] ?? '').trim().length
        if (f.maxLength && len > f.maxLength)
          errors.push({ path: `${path}.${l}`, message: `Höchstens ${f.maxLength} Zeichen.` })
      }
    }
    for (const f of def.fields) check(f, b.fields[f.name], `blocks.${i}.fields.${f.name}`)
    if (def.rows) {
      if (b.rows.length < def.rows.min || b.rows.length > def.rows.max) {
        errors.push({
          path: `blocks.${i}.rows`,
          message: `${def.rows.min}–${def.rows.max} Einträge.`,
        })
      }
      b.rows.forEach((r, j) => {
        for (const f of def.rows!.fields)
          check(f, r.fields[f.name], `blocks.${i}.rows.${j}.fields.${f.name}`)
      })
    }
  })
  return errors
}

/** Blöcke einer Sprache bauen; EN ergänzt fehlende Pflichttexte mit dem deutschen Text (wie die öffentliche Rückfall-Sprache). */
function buildLayout(
  blocks: readonly EditorBlock[],
  base: Doc[],
  locale: Locale,
  defs: Readonly<Record<string, BlockDef>>,
): Doc[] {
  const value = (f: BlockFieldDef, v: LocalizedText | undefined) => {
    const own = v?.[locale] ?? ''
    const text = locale === 'en' && f.required && !own.trim() ? (v?.de ?? '') : own
    return valueOf(f, text)
  }
  return blocks.map((b) => {
    const current = (b.id ? base.find((c) => c.id === b.id) : undefined) ?? {}
    if (!b.editable) return current
    const def = defs[b.blockType]!
    const out: Doc = { ...current, blockType: b.blockType }
    if (b.id) out.id = b.id
    for (const f of def.fields) out[f.name] = value(f, b.fields[f.name])
    if (def.rows) {
      const baseRows = Array.isArray(current[def.rows.name])
        ? (current[def.rows.name] as Doc[])
        : []
      out[def.rows.name] = b.rows.map((r) => {
        const row: Doc = { ...(r.id ? (baseRows.find((x) => x.id === r.id) ?? {}) : {}) }
        if (r.id) row.id = r.id
        for (const f of def.rows!.fields) row[f.name] = value(f, r.fields[f.name])
        return row
      })
    }
    return out
  })
}

export interface PageSeoInput {
  metaTitle?: LocalizedText
  metaDescription?: LocalizedText
}

interface SavePageOptions {
  defs: Readonly<Record<string, BlockDef>>
  addable: readonly string[]
  /** Titel, wenn keiner angegeben ist (DE, EN). */
  title: (current: { de: string | null; en: string | null }) => LocalizedText
  seo?: PageSeoInput
}

function checkPageMeta(
  title: LocalizedText,
  seo: PageSeoInput | undefined,
): { path: string; message: string }[] {
  const errors: { path: string; message: string }[] = []
  const { min, max } = PAGE_FIELD_LIMITS.title
  for (const l of ['de', 'en'] as const) {
    const len = title[l].trim().length
    if (len < min || len > max)
      errors.push({ path: `title.${l}`, message: `Titel: ${min}–${max} Zeichen.` })
    for (const f of ['metaTitle', 'metaDescription'] as const) {
      const n = (seo?.[f]?.[l] ?? '').trim().length
      if (n > PAGE_FIELD_LIMITS[f])
        errors.push({
          path: `seo.${f}.${l}`,
          message: `Höchstens ${PAGE_FIELD_LIMITS[f]} Zeichen.`,
        })
    }
  }
  return errors
}

/** Blöcke (und ggf. Titel/SEO) einer Seite speichern: DE, dann EN mit denselben IDs; legt die Seite bei Bedarf an. */
async function savePageTextsWith(
  req: PayloadRequest,
  key: PageKey,
  blocks: EditorBlock[],
  options: SavePageOptions,
): Promise<Page> {
  const { defs } = options
  const currentDe = await findPageByKey(req, key, 'de')
  const currentEn = currentDe ? await findPageByKey(req, key, 'en') : null
  const title = options.title({ de: currentDe?.title ?? null, en: currentEn?.title ?? null })
  const errors = [
    ...checkBlocks(options.addable, defs, blocks, (currentDe?.layout ?? []) as unknown as Doc[]),
    ...(options.seo ? checkPageMeta(title, options.seo) : []),
  ]
  if (errors.length > 0) throw new ValidationError({ collection: 'pages', errors })
  const seoOf = (locale: Locale): Doc | undefined => {
    if (!options.seo) return undefined
    const base = ((locale === 'de' ? currentDe?.seo : currentEn?.seo) ?? {}) as Doc
    const text = (v?: LocalizedText) => {
      const own = v?.[locale]?.trim() ?? ''
      return own || null
    }
    return {
      ...base,
      metaTitle: text(options.seo.metaTitle),
      metaDescription: text(options.seo.metaDescription),
    }
  }
  const withSeo = (data: Doc, locale: Locale): Doc => {
    const seo = seoOf(locale)
    return seo ? { ...data, seo } : data
  }

  return inTransaction(req, async () => {
    const layoutDe = buildLayout(blocks, (currentDe?.layout ?? []) as unknown as Doc[], 'de', defs)
    const dataDe = withSeo({ title: title.de, layout: layoutDe, _status: 'published' }, 'de')
    const savedDe = currentDe
      ? await preservingReq(req, () =>
          req.payload.update({
            collection: 'pages',
            id: currentDe.id,
            locale: 'de',
            data: dataDe as never,
            depth: 0,
            overrideAccess: true,
            req,
          }),
        )
      : await preservingReq(req, () =>
          req.payload.create({
            collection: 'pages',
            locale: 'de',
            data: { key, ...dataDe } as never,
            depth: 0,
            overrideAccess: true,
            req,
          }),
        )
    // EN: gespeicherte Struktur (IDs neuer Blöcke/Zeilen) übernehmen
    const savedEnBase = await readLocale(req, 'pages', savedDe.id, 'en')
    const structure = ((savedDe as Page).layout ?? []) as unknown as Doc[]
    const enBase = (savedEnBase.layout ?? []) as Doc[]
    const withIds: EditorBlock[] = blocks.map((b, i) => {
      const s = structure[i] ?? {}
      const def = defs[b.blockType]
      const rows = def?.rows && Array.isArray(s[def.rows.name]) ? (s[def.rows.name] as Doc[]) : []
      return {
        ...b,
        id: typeof s.id === 'string' ? s.id : b.id,
        rows: b.rows.map((r, j) => ({
          ...r,
          id: typeof rows[j]?.id === 'string' ? (rows[j]!.id as string) : r.id,
        })),
      }
    })
    const layoutEn = buildLayout(withIds, enBase, 'en', defs)
    return (await preservingReq(req, () =>
      req.payload.update({
        collection: 'pages',
        id: savedDe.id,
        locale: 'en',
        data: withSeo({ title: title.en, layout: layoutEn, _status: 'published' }, 'en') as never,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )) as Page
  })
}

/** Speichern der Blöcke einer Tattoo-Seite (DE, dann EN mit denselben IDs); legt die Seite bei Bedarf an. */
export async function saveTattooPageTexts(
  req: PayloadRequest,
  key: TattooTextPageKey,
  input: { blocks: EditorBlock[]; title?: LocalizedText },
): Promise<SaveTextsResult<Page>> {
  const blocks = input.blocks
  const doc = await savePageTextsWith(req, key, blocks, {
    defs: TATTOO_TEXT_BLOCKS,
    addable: TATTOO_TEXT_PAGES[key].addable,
    title: (current) => ({
      de: input.title?.de?.trim() || current.de || TATTOO_TEXT_PAGES[key].title.de,
      en: input.title?.en?.trim() || TATTOO_TEXT_PAGES[key].title.en,
    }),
  })
  return {
    doc,
    warnings: tattooTextWarnings([...editorTexts(blocks, 'de'), ...editorTexts(blocks, 'en')]),
  }
}

// --- Alle Seiten (P8.19a, KONZEPT §7.13): Verwaltung „Texte“ → „Seiten und FAQ“ -------------------------------------

export interface PageTextsFull {
  page: {
    id: number
    title: LocalizedText
    seo: { metaTitle: LocalizedText; metaDescription: LocalizedText }
    seed: boolean
    updatedAt: string | null
  } | null
  blocks: EditorBlock[]
}

/** Startwerte des Formulars einer beliebigen Seite (Titel, SEO, alle Textblöcke). */
export async function loadPageTexts(req: PayloadRequest, key: PageKey): Promise<PageTextsFull> {
  const de = await findPageByKey(req, key, 'de')
  const en = de ? await findPageByKey(req, key, 'en') : null
  const seo = (p: Page | null, f: 'metaTitle' | 'metaDescription') =>
    ((p?.seo as Doc | undefined)?.[f] as string | null | undefined) ?? ''
  return {
    page: de
      ? {
          id: de.id,
          title: { de: de.title ?? '', en: en?.title ?? '' },
          seo: {
            metaTitle: { de: seo(de, 'metaTitle'), en: seo(en, 'metaTitle') },
            metaDescription: { de: seo(de, 'metaDescription'), en: seo(en, 'metaDescription') },
          },
          seed: (de as Page & { seed?: boolean | null }).seed === true,
          updatedAt: de.updatedAt ?? null,
        }
      : null,
    blocks: editorBlocksFromPage(de, en, PAGE_TEXT_BLOCKS),
  }
}

/**
 * Seite speichern (`POST /api/pages/texts`): Titel, SEO-Texte und Blöcke DE/EN. Speichern durch Jutta macht aus einer
 * Beispiel-Seite eine echte (`seed = false`, Hook `adoptOnSave`, DATENMODELL §13.4); `revalidatePage` erneuert die
 * öffentliche Seite (≤ 60 s). Leerer englischer Titel = deutscher Titel (öffentliche Rückfall-Sprache).
 */
export async function savePageTexts(
  req: PayloadRequest,
  key: PageKey,
  input: { blocks: EditorBlock[]; title?: LocalizedText; seo?: PageSeoInput },
): Promise<SaveTextsResult<Page>> {
  const def = TEXT_PAGES[key]
  const doc = await savePageTextsWith(req, key, input.blocks, {
    defs: PAGE_TEXT_BLOCKS,
    addable: def.addable,
    seo: input.seo ?? {},
    title: (current) => {
      const de = input.title?.de?.trim() || current.de || def.title.de
      // Leeres englisches Feld = deutscher Titel (öffentliche Rückfall-Sprache; „Übersetzen“ füllt ihn danach).
      const en = input.title ? input.title.en?.trim() || de : current.en || de
      return { de, en }
    },
  })
  const tattoo = key === 'tattoo' || key === 'tattoo_aftercare'
  return {
    doc,
    warnings: tattoo
      ? tattooTextWarnings([...editorTexts(input.blocks, 'de'), ...editorTexts(input.blocks, 'en')])
      : [],
  }
}

// --- Tattoo-Texte: FAQ (P7.9) -------------------------------------------------------------------------------------

export const TATTOO_FAQ_CATEGORIES = [
  'tattoo',
  'aftercare',
] as const satisfies readonly FaqCategory[]
export type TattooFaqCategory = (typeof TATTOO_FAQ_CATEGORIES)[number]

export interface FaqForm<C extends FaqCategory = TattooFaqCategory> {
  id?: number
  category: C
  question: LocalizedText
  answer: LocalizedText
  published: boolean
}

/** FAQ der Tattoo-Kategorien in Reihenfolge (DE und EN, Antwort als Klartext). */
export async function loadTattooFaqs(
  req: PayloadRequest,
): Promise<(FaqForm & { id: number; lossy: boolean })[]> {
  return loadFaqs(req, TATTOO_FAQ_CATEGORIES)
}

/** FAQ der genannten Kategorien in Reihenfolge `sortOrder` (wie öffentlich; DE und EN, Antwort als Klartext). */
export async function loadFaqs<C extends FaqCategory>(
  req: PayloadRequest,
  categories: readonly C[],
): Promise<(FaqForm<C> & { id: number; lossy: boolean; seed: boolean })[]> {
  const find = (locale: Locale) =>
    preservingReq(req, () =>
      req.payload.find({
        collection: 'faqs',
        where: { category: { in: [...categories] } },
        sort: ['sortOrder', 'id'],
        pagination: false,
        depth: 0,
        locale,
        fallbackLocale: false,
        overrideAccess: true,
        req,
      }),
    )
  const de = (await find('de')).docs as Faq[]
  const en = (await find('en')).docs as Faq[]
  return de.map((d) => {
    const e = en.find((x) => x.id === d.id)
    const aDe = lexicalToPlain(d.answer)
    const aEn = lexicalToPlain(e?.answer)
    return {
      id: d.id,
      category: d.category as C,
      seed: (d as Faq & { seed?: boolean | null }).seed === true,
      question: { de: d.question ?? '', en: e?.question ?? '' },
      answer: { de: aDe.text, en: aEn.text },
      published: d.published !== false,
      lossy: aDe.lossy || aEn.lossy,
    }
  })
}

/** FAQ anlegen/ändern (DE, dann EN; fehlende englische Pflichttexte = deutscher Text). */
export async function saveTattooFaq(
  req: PayloadRequest,
  input: FaqForm,
): Promise<SaveTextsResult<Faq>> {
  return saveFaq(req, input, TATTOO_FAQ_CATEGORIES, 'Kategorie Tattoo oder Aftercare wählen.')
}

/**
 * FAQ aller Kategorien (`POST /api/faqs/texts-save`, P8.19a): wie `saveTattooFaq`; Speichern setzt `seed = false`
 * (Hook `adoptOnSave`). Warnungen V-24/V-15 nur in den Tattoo-Kategorien.
 */
export async function saveFaq(
  req: PayloadRequest,
  input: FaqForm<FaqCategory>,
  allowed: readonly FaqCategory[] = FAQ_CATEGORIES,
  categoryMessage = 'Bitte eine Kategorie wählen.',
): Promise<SaveTextsResult<Faq>> {
  const errors: { path: string; message: string }[] = []
  if (!allowed.includes(input.category)) errors.push({ path: 'category', message: categoryMessage })
  const q = { de: input.question?.de?.trim() ?? '', en: input.question?.en?.trim() ?? '' }
  const a = { de: input.answer?.de?.trim() ?? '', en: input.answer?.en?.trim() ?? '' }
  for (const l of ['de', 'en'] as const) {
    if ((l === 'de' || q.en) && (q[l].length < 5 || q[l].length > 200))
      errors.push({ path: `question.${l}`, message: 'Frage: 5–200 Zeichen.' })
  }
  if (!a.de) errors.push({ path: 'answer.de', message: 'Pflichtfeld (Deutsch).' })
  if (errors.length > 0) throw new ValidationError({ collection: 'faqs', errors })

  const doc = await inTransaction(req, async () => {
    let id = input.id
    let sortOrder: number | undefined
    if (!id) {
      const last = await preservingReq(req, () =>
        req.payload.find({
          collection: 'faqs',
          where: { category: { equals: input.category } },
          sort: '-sortOrder',
          limit: 1,
          depth: 0,
          overrideAccess: true,
          req,
        }),
      )
      sortOrder = Math.min(9999, ((last.docs[0]?.sortOrder as number | undefined) ?? -10) + 10)
    }
    const de = {
      question: q.de,
      answer: toLexical(a.de),
      category: input.category,
      published: input.published,
    }
    const saved = id
      ? await preservingReq(req, () =>
          req.payload.update({
            collection: 'faqs',
            id: id!,
            locale: 'de',
            data: de as never,
            depth: 0,
            overrideAccess: true,
            req,
          }),
        )
      : await preservingReq(req, () =>
          req.payload.create({
            collection: 'faqs',
            locale: 'de',
            data: { ...de, sortOrder } as never,
            depth: 0,
            overrideAccess: true,
            req,
          }),
        )
    id = saved.id as number
    if (!q.en && !a.en) {
      const existingEn = await readLocale(req, 'faqs', id, 'en')
      if (!existingEn.question) return saved as Faq
    }
    return (await preservingReq(req, () =>
      req.payload.update({
        collection: 'faqs',
        id: id!,
        locale: 'en',
        data: { question: q.en || q.de, answer: toLexical(a.en || a.de) } as never,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )) as Faq
  })
  const tattoo = (TATTOO_FAQ_CATEGORIES as readonly string[]).includes(input.category)
  return { doc, warnings: tattoo ? tattooTextWarnings([q.de, q.en, a.de, a.en]) : [] }
}

/** FAQ eine Position nach oben/unten (innerhalb der Kategorie; Reihenfolge wird lückenlos neu nummeriert). */
export async function moveTattooFaq(
  req: PayloadRequest,
  id: number,
  direction: 'up' | 'down',
): Promise<ServiceResult<Faq>> {
  return inTransaction(req, async () => {
    const doc = (await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'faqs',
        id,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      }),
    )) as Faq | null
    if (!doc) throw new APIError('Unbekannte Frage.', 404, undefined, true)
    const all = (
      await preservingReq(req, () =>
        req.payload.find({
          collection: 'faqs',
          where: { category: { equals: doc.category } },
          sort: ['sortOrder', 'id'],
          pagination: false,
          depth: 0,
          overrideAccess: true,
          req,
        }),
      )
    ).docs as Faq[]
    const i = all.findIndex((f) => f.id === id)
    const j = direction === 'up' ? i - 1 : i + 1
    if (i < 0 || j < 0 || j >= all.length) return { doc, unchanged: true }
    const order = [...all]
    ;[order[i], order[j]] = [order[j]!, order[i]!]
    for (const [pos, f] of order.entries()) {
      const sortOrder = pos * 10
      if (f.sortOrder === sortOrder) continue
      await preservingReq(req, () =>
        req.payload.update({
          collection: 'faqs',
          id: f.id,
          data: { sortOrder } as never,
          depth: 0,
          overrideAccess: true,
          req,
        }),
      )
    }
    return {
      doc: (await preservingReq(req, () =>
        req.payload.findByID({ collection: 'faqs', id, depth: 0, overrideAccess: true, req }),
      )) as Faq,
    }
  })
}
