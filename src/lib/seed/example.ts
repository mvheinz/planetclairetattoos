import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { CollectionSlug, Payload, PayloadRequest } from 'payload'
import sharp from 'sharp'

import type { Locale } from '@/lib/enums'
import type { Clock } from '@/lib/time'

import { seedOp, seedStep } from './context'
import { EXPORT_MAP_FILE, exportSource, readExportMap, type ExportMap } from './exportMap'
import { placeholderArtWebp } from './fallbackArt'
import { pickLocaleTree } from './globals'
import { seedRichText, withDateTokens } from './lexical'
import type { SeedData } from './loader'
import type { SeedReport } from './report'
import type { PageBlockSeed, ProductSeed } from './schemas'
import { seedIso } from './time'
import { seedReservationRef } from './orderPlan'
import { importInvoices } from './invoices'
import { importAuditLog, importConsentLog, importEmailLog } from './logs'
import { importFlash, importGallery } from './tattoo'
import { importPrivateUpload } from './uploads'
import { importCheckouts, importOrders, importReservations } from './orders'
import {
  importComplaints,
  importInquiries,
  importPrivacyRequests,
  importRevenue,
  importWithdrawals,
  linkCaseUploads,
} from './cases'
import { findBySeedKey, upsertBySeedKey } from './upsert'

// Beispielbestand (SEED-SPEC §1.7 Schritte 3–9). P1 legt nur den Mini-Satz an (W-21, DATENMODELL §13.1); P8 ergänzt
// die übrigen Datensätze in denselben Dateien. Idempotent über `seedKey` (§1.3): Inhalte (Medien, Stücke, Seiten)
// werden aktualisiert, solange sie nicht übernommen sind; Vorgänge (Kassen, Reservierungen, private Dateien) werden nur
// angelegt.

export const INSTAGRAM_DIR = path.join('content', 'seed', 'instagram')

export const EXAMPLE_STEPS = [
  'media',
  'private-uploads',
  'products',
  'flash',
  'tattoo-gallery',
  'pages',
  'faqs',
  'checkouts',
  'orders',
  'reservations',
  'invoices',
  'withdrawals',
  'complaints',
  'inquiries',
  'privacy-requests',
  'revenue-entries',
  'email-log',
  'consent-log',
  'audit-log',
] as const

export interface ExampleOptions {
  report: SeedReport
  /** Referenzzeit N (`SEED_NOW`). */
  now: Date
  /** Aktuelle Zeit der injizierten Uhr (für `settings.seed.importedAt`, ARCHITEKTUR A-08). */
  clock: Clock
  refreshMedia?: boolean
  only?: readonly string[]
  /** `APP_ENV` (Mock-Zustand der Kassen). */
  appEnv?: string
  /** Projektwurzel (Instagram-Bilder, Platzhalter-SVGs); Standard `process.cwd()`. */
  root?: string
  /** Zuordnung zum Instagram-Datenexport (P8.10); Standard `<root>/content/seed/instagram-export-map.json`. */
  exportMapFile?: string
}

type Doc = Record<string, unknown> & { id: number | string }
type Obj = Record<string, unknown>
type UploadFile = { data: Buffer; mimetype: string; name: string; size: number }

export function hasExampleData(data: SeedData): boolean {
  return (
    data.media.instagram.length +
      data.media.placeholders.length +
      data.privateUploads.length +
      data.products.length +
      data.orders.checkouts.length +
      data.orders.orders.length +
      data.pages.length +
      data.faqs.length +
      data.withdrawals.length +
      data.complaints.length +
      data.inquiries.length +
      data.privacyRequests.length +
      data.revenue.length +
      data.tattoo.flash.length +
      data.tattoo.gallery.length >
    0
  )
}

const fileOf = (data: Buffer, name: string, mimetype: string): UploadFile => ({
  data,
  name,
  mimetype,
  size: data.length,
})

/** `seedKey` → Dokument-ID (Fehler, wenn der Verweis fehlt, z. B. bei `--only`). */
async function idOf(req: PayloadRequest, seedKey: string): Promise<number | string> {
  const collection = seedKey.slice(0, seedKey.indexOf(':')) as CollectionSlug
  const doc = await findBySeedKey(req, collection, seedKey)
  if (!doc) throw new Error(`Verweis ${seedKey} fehlt – bitte zuerst ${collection} importieren.`)
  return doc.id
}

// ---------------------------------------------------------------------------------------------------------------
// Medien (§4)

/** Ausschnitt in Prozent der tatsächlichen Quelle, auf das Bild begrenzt (§2.4). */
export function cropPixels(
  crop: { x: number; y: number; w: number; h: number },
  width: number,
  height: number,
): { left: number; top: number; width: number; height: number } {
  const left = Math.min(width - 1, Math.max(0, Math.round((crop.x / 100) * width)))
  const top = Math.min(height - 1, Math.max(0, Math.round((crop.y / 100) * height)))
  return {
    left,
    top,
    width: Math.max(1, Math.min(width - left, Math.round((crop.w / 100) * width))),
    height: Math.max(1, Math.min(height - top, Math.round((crop.h / 100) * height))),
  }
}

/** Kürzel eines Instagram-Medien-Schlüssels (`ig:DdHXUQsDjqm#cap` → `DdHXUQsDjqm`). */
export function instagramShortcode(key: string): string {
  return key.slice(3).split('#')[0]!
}

/**
 * Bilddatei eines Instagram-Eintrags: Original aus dem Datenexport, wenn gemappt (P8.10), sonst das 640-px-Bild.
 * Ausschnitte in Prozent, umgerechnet auf die Maße der tatsächlich verwendeten Quelle (AK-SEED-19).
 */
async function instagramFile(
  root: string,
  entry: SeedData['media']['instagram'][number],
  exportMap: ExportMap,
): Promise<{ file: UploadFile; source: 'instagram_seed' | 'instagram_export' }> {
  const original = await exportSource(root, exportMap, instagramShortcode(entry.key))
  const name = `ig-${entry.key.slice(3).replace(/[^A-Za-z0-9_-]/g, '-')}.jpg`
  if (original) {
    // Export-Originale immer neu kodieren: Orientierung anwenden, Metadaten (EXIF/GPS) fallen weg.
    const upright = await sharp(original).rotate().toBuffer()
    const meta = await sharp(upright).metadata()
    const img = entry.crop
      ? sharp(upright).extract(cropPixels(entry.crop, meta.width ?? 0, meta.height ?? 0))
      : sharp(upright)
    const data = await img.jpeg({ quality: 92 }).toBuffer()
    return { file: fileOf(data, name, 'image/jpeg'), source: 'instagram_export' }
  }
  const src = await readFile(path.join(root, INSTAGRAM_DIR, entry.file))
  if (!entry.crop) return { file: fileOf(src, name, 'image/jpeg'), source: 'instagram_seed' }
  const meta = await sharp(src).metadata()
  const region = cropPixels(entry.crop, meta.width ?? 0, meta.height ?? 0)
  const data = await sharp(src).extract(region).jpeg({ quality: 92 }).toBuffer()
  return { file: fileOf(data, name, 'image/jpeg'), source: 'instagram_seed' }
}

async function importMedia(req: PayloadRequest, data: SeedData, options: ExampleOptions) {
  const root = options.root ?? process.cwd()
  const refresh = async (existing: Doc, file: () => Promise<UploadFile>) => {
    if (!options.refreshMedia || existing.seed !== true) return
    await req.payload.update({
      collection: 'media',
      id: existing.id,
      data: {} as never,
      file: await file(),
      ...seedOp(req),
    })
  }
  const exportMap = await readExportMap(options.exportMapFile ?? path.join(root, EXPORT_MAP_FILE))
  for (const entry of data.media.instagram) {
    const image = await instagramFile(root, entry, exportMap)
    const de = {
      alt: entry.alt.de,
      showsPerson: entry.showsPerson,
      sourceRef: entry.key.slice(3),
      ...(entry.focal ? { focalX: entry.focal.x, focalY: entry.focal.y } : {}),
    }
    const en = entry.alt.en ? { alt: entry.alt.en } : undefined
    const file = async () => image.file
    // `source` folgt der Datei: beim Anlegen und bei `--refresh-media`, sonst bleibt sie, wie sie ist.
    const withSource = { ...de, source: image.source }
    const res = await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'media',
      seedKey: `media:${entry.key}`,
      group: 'content',
      create: () => withSource,
      en,
      update: () => ({ de: options.refreshMedia ? withSource : de, en }),
      file,
    })
    if (res.outcome === 'updated') await refresh(res.doc, file)
  }
  for (const entry of data.media.placeholders) {
    const de = {
      alt: entry.alt.de,
      showsPerson: 'none',
      source: 'placeholder',
      sourceRef: entry.key,
    }
    const en = entry.alt.en ? { alt: entry.alt.en } : undefined
    const file = async () =>
      fileOf(
        (await placeholderArtWebp(entry.key, entry.wash, root)).data,
        `${entry.key.replace(':', '-')}.webp`,
        'image/webp',
      )
    const res = await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'media',
      seedKey: `media:${entry.key}`,
      group: 'content',
      create: () => de,
      en,
      update: () => ({ de, en }),
      file,
    })
    if (res.outcome === 'updated') await refresh(res.doc, file)
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Private Dateien (§4.4)

async function importPrivateUploads(req: PayloadRequest, data: SeedData, options: ExampleOptions) {
  for (const entry of data.privateUploads) {
    // Reklamationsfotos brauchen ihre Reklamation schon beim Anlegen → Schritt 7 (`importComplaints`).
    if (entry.relatedComplaint) continue
    await importPrivateUpload(req, entry, options.report)
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Stücke (§5)

/** Lokalisierte Felder eines Stücks (zweiter Schreibvorgang mit `locale: 'en'`). */
const PRODUCT_LOCALIZED = [
  'title',
  'description',
  'juttaSays',
  'materials',
  'sizeLabel',
  'conditionNote',
  'fiberFreeText',
  'metalPartsMaterial',
  'safetyWarnings',
  'deviationDescription',
] as const

/** Nie per Seed-Aktualisierung geändert (§1.3): Nummer, Status und Verkaufsfelder. */
const PRODUCT_NEVER_UPDATE = new Set(['itemNumber', 'status', 'i18n'])

async function productData(
  req: PayloadRequest,
  p: ProductSeed,
  data: SeedData,
  now: Date,
): Promise<{ de: Obj; en: Obj; sale: Obj }> {
  const { key: _key, state, images, nickelEvidence, enStatus, ...rest } = p
  const de = pickLocaleTree(rest, 'de') as Obj
  const images_ = await Promise.all(images.map((k) => idOf(req, k)))
  de.images = images_
  if (nickelEvidence) de.nickelEvidence = await idOf(req, nickelEvidence)
  de.i18n = { enStatus }
  const enAll = pickLocaleTree(rest, 'en') as Obj
  const en: Obj = {}
  for (const f of PRODUCT_LOCALIZED) {
    if (typeof enAll[f] === 'string') en[f] = enAll[f]
  }
  const note = (enAll.dimensions as Obj | undefined)?.note
  if (typeof note === 'string') en.dimensions = { note }

  const t = (expr: string | undefined) => (expr ? seedIso(expr, now) : undefined)
  const sale: Obj = {
    status: state.status,
    firstPublishedAt: t(state.firstPublishedAt),
    soldAt: t(state.soldAt),
    soldChannel: state.soldChannel,
    archivedAt: t(state.archivedAt),
    offlineSaleNote: state.offlineSaleNote,
    showInArchiveAfterSale: state.showInArchiveAfterSale ?? true,
    reservedUntil: t(state.reservedUntil),
    reservationRef: state.reservationCheckout
      ? seedReservationRef(state.reservationCheckout.slice('checkouts:'.length))
      : undefined,
  }
  for (const k of Object.keys(sale)) if (sale[k] === undefined) delete sale[k]
  return { de, en, sale }
}

/** Nummernkollision mit einem echten Stück → Abbruch vor dem ersten Schreiben (§1.3). */
export async function assertNoNumberCollision(payload: Payload, data: SeedData): Promise<void> {
  if (data.tattoo.flash.length > 0) {
    const flash = await payload.find({
      collection: 'flash',
      where: { number: { in: data.tattoo.flash.map((f) => f.number) } },
      limit: 0,
      pagination: false,
      depth: 0,
      overrideAccess: true,
      select: { number: true, seedKey: true },
    })
    const clash = flash.docs.filter((doc) => {
      const expected = data.tattoo.flash.find((f) => f.number === doc.number)
      return expected && doc.seedKey !== `flash:${expected.key}`
    })
    if (clash.length > 0) {
      throw new Error(
        `Nummernkollision mit echten Flash-Motiven: ${clash
          .map((d) => `F-${d.number}`)
          .join(', ')} – nichts wurde geschrieben.`,
      )
    }
  }
  if (data.products.length === 0) return
  const res = await payload.find({
    collection: 'products',
    where: { itemNumber: { in: data.products.map((p) => p.itemNumber) } },
    limit: 0,
    pagination: false,
    depth: 0,
    overrideAccess: true,
    select: { itemNumber: true, seedKey: true },
  })
  const clash = res.docs.filter((doc) => {
    const expected = data.products.find((p) => p.itemNumber === doc.itemNumber)
    return expected && doc.seedKey !== `products:${expected.key}`
  })
  if (clash.length > 0) {
    throw new Error(
      `Nummernkollision mit echten Stücken: ${clash
        .map((d) => `Nr. ${String(d.itemNumber).padStart(3, '0')}`)
        .join(', ')} – nichts wurde geschrieben.`,
    )
  }
}

async function importProducts(req: PayloadRequest, data: SeedData, options: ExampleOptions) {
  for (const p of data.products) {
    const built = () => productData(req, p, data, options.now)
    await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'products',
      seedKey: `products:${p.key}`,
      group: 'content',
      create: async () => {
        const { de, sale } = await built()
        return { ...de, ...sale }
      },
      en: (await built()).en,
      // Inhaltsfelder aktualisieren (§1.3): nie Nummer, Status, Verkaufsfelder; Kategorie nur im Entwurf, Preis nicht
      // bei reservierten/verkauften Stücken.
      update: async (existing) => {
        const { de, en } = await built()
        const patch: Obj = {}
        for (const [k, v] of Object.entries(de)) if (!PRODUCT_NEVER_UPDATE.has(k)) patch[k] = v
        if (existing.status !== 'draft') delete patch.category
        if (existing.status === 'reserved' || existing.status === 'sold') delete patch.priceCents
        return { de: patch, en }
      },
    })
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Seiten (§13)

type Loc = { de: string; en: string }

/** Block der Datendatei → Payload-Daten in `locale` (Klartext → Lexical, Datums-Token, Medien-IDs). */
async function blockData(
  req: PayloadRequest,
  block: PageBlockSeed,
  locale: Locale,
  now: Date,
): Promise<Obj> {
  const pick = (v: Loc | undefined) => (v ? withDateTokens(v[locale], locale, now) : undefined)
  const rich = (v: Loc) => seedRichText(v[locale], locale, now)
  switch (block.blockType) {
    case 'hero':
      return {
        blockType: 'hero',
        heading: pick(block.heading),
        subheading: pick(block.subheading),
        cocoPose: block.cocoPose,
      }
    case 'station':
      return {
        blockType: 'station',
        stationId: block.stationId,
        heading: pick(block.heading),
        text: pick(block.text),
        cocoPose: block.cocoPose,
        ornament: block.ornament,
        ...(block.link
          ? {
              link: {
                target: block.link.target,
                ...(block.link.category ? { category: block.link.category } : {}),
                label: block.link.label[locale],
              },
            }
          : {}),
      }
    case 'richText':
      return { blockType: 'richText', content: rich(block.content) }
    case 'contactLinks':
      return {
        blockType: 'contactLinks',
        heading: pick(block.heading),
        showEmail: block.showEmail ?? true,
        showDistrict: block.showDistrict ?? true,
        emailSubject: pick(block.emailSubject),
      }
    case 'callout':
      return { blockType: 'callout', text: pick(block.text), tone: block.tone }
    case 'faqList':
      return { blockType: 'faqList', heading: pick(block.heading), category: block.category }
    case 'imageText':
      return {
        blockType: 'imageText',
        image: await idOf(req, block.image),
        content: rich(block.content),
        imagePosition: block.imagePosition,
      }
    case 'imageGallery':
      return {
        blockType: 'imageGallery',
        images: await Promise.all(block.images.map((k) => idOf(req, k))),
        caption: pick(block.caption),
      }
    case 'categoryTeaser':
      return {
        blockType: 'categoryTeaser',
        heading: pick(block.heading),
        categories: block.categories,
      }
    case 'processSteps':
      return {
        blockType: 'processSteps',
        heading: pick(block.heading),
        steps: block.steps.map((st) => ({ title: pick(st.title), text: pick(st.text) })),
      }
    case 'commissionForm':
      return {
        blockType: 'commissionForm',
        heading: pick(block.heading),
        intro: pick(block.intro),
        successText: pick(block.successText),
      }
    case 'flashGrid':
      return {
        blockType: 'flashGrid',
        heading: pick(block.heading),
        showClaimed: block.showClaimed,
      }
    case 'tattooGallery':
      return {
        blockType: 'tattooGallery',
        heading: pick(block.heading),
        filter: block.filter,
        limit: block.limit,
      }
    case 'priceInfo':
      return { blockType: 'priceInfo', heading: pick(block.heading), content: rich(block.content) }
    case 'aftercareSteps':
      return {
        blockType: 'aftercareSteps',
        heading: pick(block.heading),
        phases: block.phases.map((ph) => ({ title: pick(ph.title), content: rich(ph.content) })),
      }
  }
}

const layoutData = (
  req: PayloadRequest,
  page: SeedData['pages'][number],
  locale: Locale,
  now: Date,
) => Promise.all(page.layout.map((b) => blockData(req, b, locale, now)))

/** Englische Fassung: gleiche Block- und Zeilen-IDs wie die deutsche (Blöcke selbst sind nicht lokalisiert). */
async function writePageEn(
  req: PayloadRequest,
  doc: Doc,
  page: SeedData['pages'][number],
  now: Date,
) {
  const layout = (doc.layout ?? []) as (Obj & { id?: string })[]
  const en = await layoutData(req, page, 'en', now)
  const withIds = en.map((block, i) => {
    const current = layout[i] ?? {}
    const out: Obj = { ...block, id: current.id }
    for (const arr of ['steps', 'phases'] as const) {
      const rows = block[arr] as Obj[] | undefined
      const ids = (current[arr] as { id?: string }[] | undefined) ?? []
      if (rows) out[arr] = rows.map((r, j) => ({ ...r, id: ids[j]?.id }))
    }
    return out
  })
  await req.payload.update({
    collection: 'pages',
    id: doc.id,
    locale: 'en',
    data: {
      title: page.title.en,
      _status: 'published',
      layout: withIds,
      ...(page.seo?.metaTitle ? { seo: { metaTitle: page.seo.metaTitle.en } } : {}),
    } as never,
    ...seedOp(req),
  })
}

async function importPages(req: PayloadRequest, data: SeedData, options: ExampleOptions) {
  for (const page of data.pages) {
    const layout = await layoutData(req, page, 'de', options.now)
    const de = {
      key: page.key,
      title: page.title.de,
      _status: 'published',
      layout,
      ...(page.seo?.metaTitle ? { seo: { metaTitle: page.seo.metaTitle.de } } : {}),
    }
    // Nicht übernommen: Titel und Blöcke neu schreiben; EN danach mit den Block-IDs der deutschen Fassung.
    const res = await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'pages',
      seedKey: `pages:${page.key}`,
      group: 'content',
      create: () => de,
      update: () => {
        const { key: _key, ...patch } = de
        return { de: patch }
      },
    })
    if (res.outcome !== 'skipped') await writePageEn(req, res.doc, page, options.now)
  }
}

// ---------------------------------------------------------------------------------------------------------------
// FAQ (§14)

async function importFaqs(req: PayloadRequest, data: SeedData, options: ExampleOptions) {
  for (const f of data.faqs) {
    const loc = (l: Locale) => ({
      question: f.question[l],
      answer: seedRichText(f.answer[l], l, options.now),
    })
    await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'faqs',
      seedKey: `faqs:${f.key}`,
      group: 'content',
      create: () => ({
        ...loc('de'),
        category: f.category,
        sortOrder: f.sortOrder,
        published: true,
      }),
      en: loc('en'),
      update: () => ({
        de: { ...loc('de'), category: f.category, sortOrder: f.sortOrder },
        en: loc('en'),
      }),
    })
  }
}

// ---------------------------------------------------------------------------------------------------------------

export async function importExample(
  payload: Payload,
  data: SeedData,
  options: ExampleOptions,
): Promise<void> {
  if (!hasExampleData(data)) return
  await assertNoNumberCollision(payload, data)
  const run = (step: (typeof EXAMPLE_STEPS)[number]) =>
    !options.only || options.only.length === 0 || options.only.includes(step)

  // Schritt 3: Medien → private Dateien
  if (run('media')) await seedStep(payload, (req) => importMedia(req, data, options))
  if (run('private-uploads')) {
    await seedStep(payload, (req) => importPrivateUploads(req, data, options))
  }
  // Schritt 4: Stücke → (Flash, Galerie ab P8) → Seiten → (FAQ ab P8)
  if (run('products')) await seedStep(payload, (req) => importProducts(req, data, options))
  const tattoo = { report: options.report, now: options.now }
  if (run('flash')) await seedStep(payload, (req) => importFlash(req, data, tattoo), options.now)
  if (run('tattoo-gallery')) {
    await seedStep(payload, (req) => importGallery(req, data, tattoo), options.now)
  }
  if (run('pages')) await seedStep(payload, (req) => importPages(req, data, options))
  if (run('faqs')) await seedStep(payload, (req) => importFaqs(req, data, options))
  // Schritt 5: Kassen → (Bestellungen ab P8) → Reservierungen
  const process = {
    report: options.report,
    now: options.now,
    appEnv: options.appEnv ?? 'development',
  }
  if (run('checkouts')) await seedStep(payload, (req) => importCheckouts(req, data, process))
  if (run('orders')) await seedStep(payload, (req) => importOrders(req, data, process))
  if (run('reservations')) {
    await seedStep(payload, (req) => importReservations(req, data, process))
  }
  // Schritt 6: Belege je Serie nach issueAt, danach orders.invoice / refunds[].creditNote
  if (run('invoices')) await seedStep(payload, (req) => importInvoices(req, data, process))
  // Schritt 7: Widerrufe → Reklamationen → Anfragen → Datenschutz-Anfragen → Umsätze, danach Dateien verknüpfen
  // (mit N als Request-Zeit der Hooks)
  const cases = { report: options.report, now: options.now }
  const at = options.now
  if (run('withdrawals')) {
    await seedStep(payload, (req) => importWithdrawals(req, data, cases), at)
  }
  if (run('complaints')) await seedStep(payload, (req) => importComplaints(req, data, cases), at)
  if (run('inquiries')) await seedStep(payload, (req) => importInquiries(req, data, cases), at)
  if (run('privacy-requests')) {
    await seedStep(payload, (req) => importPrivacyRequests(req, data, cases), at)
  }
  if (run('revenue-entries')) {
    await seedStep(payload, (req) => importRevenue(req, data, cases), at)
  }
  await seedStep(payload, (req) => linkCaseUploads(req, data), at)
  // Schritt 8: Protokolle (nur Einträge, kein Versand)
  const logs = { report: options.report, now: options.now, clock: options.clock }
  if (run('email-log')) await seedStep(payload, (req) => importEmailLog(req, data, logs), at)
  if (run('consent-log')) await seedStep(payload, (req) => importConsentLog(req, data, logs), at)
  if (run('audit-log')) await seedStep(payload, (req) => importAuditLog(req, data, logs), at)
  // Schritt 9: settings.seed
  await seedStep(payload, (req) =>
    req.payload.updateGlobal({
      slug: 'settings',
      data: {
        seed: { exampleDataPresent: true, importedAt: options.clock.now().toISOString() },
      } as never,
      ...seedOp(req),
    }),
  )
}
