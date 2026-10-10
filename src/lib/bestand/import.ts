import 'server-only'

import { readFile } from 'node:fs/promises'

import { createLocalReq, type Payload, type PayloadRequest, type RequestContext } from 'payload'

import { formatItemNumber } from '@/lib/products/itemNumber'
import { inTransaction } from '@/lib/payload/transaction'

import { bestandPhotoPath, photosOf, type BestandProduct } from './schema'

// Import des echten Bestands (U-76, PLAN P16.2): legt je Stück die Fotos (Medien, Herkunft „Upload“, Kürzel
// `bestand:B001-1`) und das Stück als **Entwurf** an – echte Daten (`seed: false`), mit rotem Vermerk „bitte prüfen“ und
// den Prüfpunkten als interner Notiz. Die Kategorie-Vorlagen (Warn- und Pflegehinweise) setzt die Collection wie beim
// Anlegen in der Verwaltung. Online stellt Jutta jedes Stück selbst (Veröffentlichungsprüfung, R-042 ff.).
//
// Wiederholbar ohne Doppel: Ein Stück gilt als schon importiert, wenn ein Stück auf sein erstes Foto
// (`bestand:<key>-1`) zeigt – auch nach geänderter Nummer oder geändertem Titel; vorhandene Fotos werden
// wiederverwendet, nie überschrieben. Ist die Nummer schon an ein anderes Stück vergeben, wird das Stück übersprungen
// (Meldung), nie umnummeriert. Jedes Stück hat eine eigene Transaktion.

/** Kürzel eines Fotos in `media.sourceRef`. */
export const bestandSourceRef = (file: string): string => `bestand:${file.replace(/\.jpg$/, '')}`

/** Kurzer Vermerk am Stück (Verwaltung → „Hinweis für dich“, höchstens 500 Zeichen). */
export const ATTENTION_NOTE =
  'Bitte prüfen: automatisch aus deinen Fotos angelegt. Preis, Maße, Gewicht und Material sind geschätzt – die ' +
  'einzelnen Punkte stehen unter „Interne Notiz“.'

const NOTE_HEAD = 'Aus deinen Fotos angelegt (Oktober 2026). Bitte prüfen:'
const NOTE_MAX = 1000

/** Interne Notiz aus den Prüfpunkten (höchstens 1000 Zeichen; zu lange Listen enden mit „…“). */
export function reviewNote(review: readonly string[]): string {
  let note = NOTE_HEAD
  for (const point of review) {
    const line = `\n• ${point}`
    if (note.length + line.length > NOTE_MAX - 2) return `${note}\n…`
    note += line
  }
  return note
}

export interface BestandImportOptions {
  /** Projektwurzel (Fotos); Standard `process.cwd()`. */
  root?: string
  /** Nur diese Schlüssel (`B001`, …). */
  only?: readonly string[]
  /**
   * Nur für die Vorschau-Datei (P16.3, `SEED_PREVIEW_MODE`): Stücke nach dem Anlegen direkt „verfügbar“ – ohne
   * Veröffentlichungsprüfung, denn Pflichtangaben wie Faserangaben oder Nickel-Nachweise trägt Jutta erst nach.
   * `firstPublishedAt` = `now` minus eine Minute je Position (B001 zuerst, stabile Reihenfolge).
   */
  previewPublish?: { now: Date }
  log?: (line: string) => void
}

export interface BestandImportResult {
  created: string[]
  /** Schon importiert (Stück zeigt auf das erste Foto). */
  existing: string[]
  /** Nicht angelegt, mit Grund. */
  skipped: { key: string; reason: string }[]
  media: { created: number; reused: number }
}

type Doc = Record<string, unknown> & { id: number | string }

const systemContext = (): RequestContext => ({ system: true, actorType: 'system' })

function op(req: PayloadRequest, context: RequestContext = systemContext()) {
  return { req, overrideAccess: true as const, depth: 0, context }
}

async function findOne(
  req: PayloadRequest,
  collection: 'media' | 'products',
  where: Record<string, unknown>,
): Promise<Doc | null> {
  const res = await req.payload.find({
    collection,
    where: where as never,
    limit: 1,
    pagination: false,
    ...op(req),
  })
  return (res.docs[0] as unknown as Doc | undefined) ?? null
}

async function ensureMedia(
  req: PayloadRequest,
  root: string,
  photo: { file: string; alt: { de: string; en: string } },
  result: BestandImportResult,
): Promise<number | string> {
  const sourceRef = bestandSourceRef(photo.file)
  const existing = await findOne(req, 'media', { sourceRef: { equals: sourceRef } })
  if (existing) {
    result.media.reused++
    return existing.id
  }
  const data = await readFile(bestandPhotoPath(root, photo.file))
  const doc = (await req.payload.create({
    collection: 'media',
    data: { alt: photo.alt.de, showsPerson: 'none', source: 'upload', sourceRef } as never,
    file: { data, name: photo.file, mimetype: 'image/jpeg', size: data.length },
    locale: 'de',
    ...op(req),
  })) as unknown as Doc
  await req.payload.update({
    collection: 'media',
    id: doc.id,
    data: { alt: photo.alt.en } as never,
    locale: 'en',
    ...op(req),
  })
  result.media.created++
  return doc.id
}

/** Deutsche Fassung (und nicht lokalisierte Felder) eines Stücks für `create`. */
export function productDataDe(
  p: BestandProduct,
  images: (number | string)[],
  scalePhoto: number | string | undefined,
): Record<string, unknown> {
  const { note, ...dims } = p.dimensions
  const data: Record<string, unknown> = {
    itemNumber: p.itemNumber,
    category: p.category,
    title: p.title.de,
    description: p.description.de,
    materials: p.materials.de,
    dimensions: { ...dims, ...(note ? { note: note.de } : {}) },
    weightGrams: p.weightGrams,
    shippingClass: p.shippingClass,
    priceCents: p.priceCents,
    vatCategory: p.vatCategory,
    deviationDecision: p.deviationDecision,
    ownDesignConfirmed: false,
    images,
    internalNote: reviewNote(p.review),
    adminAttention: { flag: true, reason: 'manual', note: ATTENTION_NOTE },
  }
  if (scalePhoto !== undefined) data.scalePhoto = scalePhoto
  if (p.deviationDescription) data.deviationDescription = p.deviationDescription.de
  if (p.sizeLabel) data.sizeLabel = p.sizeLabel.de
  if (p.careInstructions) data.careInstructions = p.careInstructions.de
  for (const key of [
    'isSecondHand',
    'condition',
    'fiberComposition',
    'blankBrandVisible',
    'foodContact',
    'smallPartsWarning',
  ] as const) {
    if (p[key] !== undefined) data[key] = p[key]
  }
  return data
}

/** Englische Texte (zweiter Schreibvorgang mit `locale: 'en'`, als „maschinell“ markiert – Jutta prüft sie). */
export function productDataEn(p: BestandProduct): Record<string, unknown> {
  const data: Record<string, unknown> = {
    title: p.title.en,
    description: p.description.en,
    materials: p.materials.en,
  }
  if (p.dimensions.note) data.dimensions = { note: p.dimensions.note.en }
  if (p.sizeLabel) data.sizeLabel = p.sizeLabel.en
  if (p.careInstructions) data.careInstructions = p.careInstructions.en
  if (p.deviationDescription) data.deviationDescription = p.deviationDescription.en
  return data
}

async function importOne(
  req: PayloadRequest,
  p: BestandProduct,
  index: number,
  options: BestandImportOptions,
  result: BestandImportResult,
): Promise<void> {
  const root = options.root ?? process.cwd()
  const photos = photosOf(p)
  const first = await findOne(req, 'media', {
    sourceRef: { equals: bestandSourceRef(photos[0]!.file) },
  })
  if (first && (await findOne(req, 'products', { images: { in: [first.id] } }))) {
    result.existing.push(p.key)
    return
  }
  const clash = await findOne(req, 'products', { itemNumber: { equals: p.itemNumber } })
  if (clash) {
    result.skipped.push({
      key: p.key,
      reason: `${formatItemNumber(p.itemNumber, 'de')} ist schon an ein anderes Stück vergeben`,
    })
    return
  }
  const ids: (number | string)[] = []
  for (const photo of photos) ids.push(await ensureMedia(req, root, photo, result))
  const scale = p.scalePhoto ? ids.pop() : undefined
  const created = (await req.payload.create({
    collection: 'products',
    data: productDataDe(p, ids, scale) as never,
    locale: 'de',
    ...op(req),
  })) as unknown as Doc
  await req.payload.update({
    collection: 'products',
    id: created.id,
    data: productDataEn(p) as never,
    locale: 'en',
    ...op(req, { ...systemContext(), translation: true }),
  })
  if (options.previewPublish) {
    const at = new Date(options.previewPublish.now.getTime() - index * 60_000)
    // Nur in der Vorschau: Status direkt setzen – `seed` umgeht die Übergangsregel, `system` die
    // Veröffentlichungsprüfung (reiner Systemschreibvorgang); das Stück bleibt echt (`seed: false`).
    await req.payload.update({
      collection: 'products',
      id: created.id,
      data: { status: 'available', firstPublishedAt: at.toISOString() } as never,
      ...op(req, { seed: true, system: true, skipAudit: true }),
    })
  }
  result.created.push(p.key)
}

export async function importBestand(
  payload: Payload,
  products: readonly BestandProduct[],
  options: BestandImportOptions = {},
): Promise<BestandImportResult> {
  const result: BestandImportResult = {
    created: [],
    existing: [],
    skipped: [],
    media: { created: 0, reused: 0 },
  }
  const only = options.only ? new Set(options.only) : null
  for (const [index, p] of products.entries()) {
    if (only && !only.has(p.key)) continue
    const req = await createLocalReq({ context: systemContext() }, payload)
    const before = result.created.length
    await inTransaction(req, () => importOne(req, p, index, options, result))
    const state = result.created.length > before ? 'angelegt' : 'übersprungen'
    options.log?.(`${p.key} ${formatItemNumber(p.itemNumber, 'de')} ${p.title.de}: ${state}`)
  }
  return result
}
