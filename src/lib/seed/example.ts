import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import type { CollectionSlug, Payload, PayloadRequest } from 'payload'
import sharp from 'sharp'

import { computeShipping, type ShippingSettings } from '@/lib/commerce/shipping'
import type { Locale, ShippingClass } from '@/lib/enums'
import { buildCharacteristics, type CharacteristicsInput } from '@/lib/products/characteristics'
import { pickLocale, type LocalizedValue } from '@/lib/products/localized'
import type { Clock } from '@/lib/time'

import { seedOp, seedStep } from './context'
import { placeholderArtWebp } from './fallbackArt'
import { pickLocaleTree } from './globals'
import { toLexical } from './lexical'
import type { SeedData } from './loader'
import { simplePdf } from './pdf'
import type { SeedReport } from './report'
import type { PageBlockSeed, ProductSeed } from './schemas'
import { seedIso } from './time'
import { seedTokenHash } from './tokens'
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
  'pages',
  'checkouts',
  'reservations',
] as const

export interface ExampleOptions {
  report: SeedReport
  /** Referenzzeit N (`SEED_NOW`). */
  now: Date
  /** Aktuelle Zeit der injizierten Uhr (für `settings.seed.importedAt`, ARCHITEKTUR A-08). */
  clock: Clock
  refreshMedia?: boolean
  only?: readonly string[]
  /** Projektwurzel (Instagram-Bilder, Platzhalter-SVGs); Standard `process.cwd()`. */
  root?: string
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
      data.pages.length >
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

async function instagramFile(
  root: string,
  entry: SeedData['media']['instagram'][number],
): Promise<UploadFile> {
  const src = await readFile(path.join(root, INSTAGRAM_DIR, entry.file))
  const name = `ig-${entry.key.slice(3).replace(/[^A-Za-z0-9_-]/g, '-')}.jpg`
  if (!entry.crop) return fileOf(src, name, 'image/jpeg')
  const meta = await sharp(src).metadata()
  const region = cropPixels(entry.crop, meta.width ?? 0, meta.height ?? 0)
  const data = await sharp(src).extract(region).jpeg({ quality: 92 }).toBuffer()
  return fileOf(data, name, 'image/jpeg')
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
  for (const entry of data.media.instagram) {
    const de = {
      alt: entry.alt.de,
      showsPerson: entry.showsPerson,
      source: 'instagram_seed',
      sourceRef: entry.key.slice(3),
      ...(entry.focal ? { focalX: entry.focal.x, focalY: entry.focal.y } : {}),
    }
    const en = entry.alt.en ? { alt: entry.alt.en } : undefined
    const file = () => instagramFile(root, entry)
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
    await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'private-uploads',
      seedKey: `private-uploads:${entry.key}`,
      group: 'process',
      create: () => ({
        purpose: entry.purpose,
        ...(entry.complianceCategory ? { complianceCategory: entry.complianceCategory } : {}),
        ...(entry.note ? { note: entry.note } : {}),
      }),
      file: async () =>
        fileOf(simplePdf('BEISPIELDOKUMENT', entry.pdfText), `${entry.key}.pdf`, 'application/pdf'),
    })
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
  const checkout = state.reservationCheckout
    ? data.orders.checkouts.find((c) => `checkouts:${c.key}` === state.reservationCheckout)
    : undefined
  const sale: Obj = {
    status: state.status,
    firstPublishedAt: t(state.firstPublishedAt),
    soldAt: t(state.soldAt),
    soldChannel: state.soldChannel,
    archivedAt: t(state.archivedAt),
    offlineSaleNote: state.offlineSaleNote,
    showInArchiveAfterSale: state.showInArchiveAfterSale ?? true,
    reservedUntil: t(state.reservedUntil),
    reservationRef: checkout?.reservationRef,
  }
  for (const k of Object.keys(sale)) if (sale[k] === undefined) delete sale[k]
  return { de, en, sale }
}

/** Nummernkollision mit einem echten Stück → Abbruch vor dem ersten Schreiben (§1.3). */
export async function assertNoNumberCollision(payload: Payload, data: SeedData): Promise<void> {
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

function blockData(block: PageBlockSeed, locale: Locale): Obj {
  const pick = (v: { de: string; en: string } | undefined) => (v ? v[locale] : undefined)
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
      return { blockType: 'richText', content: toLexical(block.content[locale]) }
    case 'contactLinks':
      return {
        blockType: 'contactLinks',
        heading: pick(block.heading),
        showEmail: block.showEmail ?? true,
        showInstagram: block.showInstagram ?? true,
        showDistrict: block.showDistrict ?? true,
        emailSubject: pick(block.emailSubject),
      }
    case 'callout':
      return { blockType: 'callout', text: block.text[locale], tone: block.tone }
    case 'faqList':
      return { blockType: 'faqList', heading: pick(block.heading), category: block.category }
  }
}

async function writePageEn(req: PayloadRequest, doc: Doc, page: SeedData['pages'][number]) {
  const layout = (doc.layout ?? []) as { id?: string }[]
  await req.payload.update({
    collection: 'pages',
    id: doc.id,
    locale: 'en',
    data: {
      title: page.title.en,
      _status: 'published',
      layout: page.layout.map((b, i) => ({ ...blockData(b, 'en'), id: layout[i]?.id })),
    } as never,
    ...seedOp(req),
  })
}

async function importPages(req: PayloadRequest, data: SeedData, options: ExampleOptions) {
  for (const page of data.pages) {
    const de = {
      key: page.key,
      title: page.title.de,
      _status: 'published',
      layout: page.layout.map((b) => blockData(b, 'de')),
    }
    // Nicht übernommen: Titel und Blöcke neu schreiben; EN danach mit den Block-IDs der deutschen Fassung.
    const res = await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'pages',
      seedKey: `pages:${page.key}`,
      group: 'content',
      create: () => de,
      update: () => ({ de: { title: de.title, _status: 'published', layout: de.layout } }),
    })
    if (res.outcome !== 'skipped') await writePageEn(req, res.doc, page)
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Kassen und Reservierungen (§7.3, §8)

async function importCheckouts(req: PayloadRequest, data: SeedData, options: ExampleOptions) {
  const t = (expr: string | undefined) => (expr ? seedIso(expr, options.now) : undefined)
  const settings = (await req.payload.findGlobal({
    slug: 'settings',
    ...seedOp(req),
  })) as unknown as ShippingSettings
  for (const c of data.orders.checkouts) {
    await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'checkouts',
      seedKey: `checkouts:${c.key}`,
      group: 'process',
      create: async () => {
        const items = []
        for (const key of c.items) {
          const id = await idOf(req, key)
          const p = (await req.payload.findByID({
            collection: 'products',
            id,
            locale: 'all',
            ...seedOp(req),
          })) as unknown as Obj & CharacteristicsInput
          items.push({
            product: id,
            itemNumber: p.itemNumber,
            titleDe: pickLocale(p.title as LocalizedValue, 'de'),
            titleEn: pickLocale(p.title as LocalizedValue, 'en') || undefined,
            category: p.category,
            priceCents: p.priceCents,
            vatCategory: p.vatCategory,
            shippingClass: p.shippingClass,
            characteristicsDe: buildCharacteristics(p, 'de'),
            characteristicsEn: buildCharacteristics(p, 'en'),
            ...(p.hasDeviation
              ? { deviationText: pickLocale(p.deviationDescription as LocalizedValue, 'de') }
              : {}),
          })
        }
        const shipping = computeShipping(
          items.map((i) => ({
            itemNumber: i.itemNumber as number,
            shippingClass: i.shippingClass as ShippingClass,
          })),
          c.fulfillmentMethod,
          settings,
          c.shippingZone ?? 'DE',
        )
        const subtotal = items.reduce((s, i) => s + (i.priceCents as number), 0)
        return {
          tokenHash: seedTokenHash(`checkouts:${c.key}`, 'checkout'),
          status: c.status,
          locale: c.locale,
          reservationRef: c.reservationRef,
          items,
          fulfillmentMethod: c.fulfillmentMethod,
          shippingZone: shipping.zone ?? undefined,
          shippingClass: shipping.shippingClass,
          subtotalCents: subtotal,
          shippingCents: shipping.shippingCents,
          totalCents: subtotal + shipping.shippingCents,
          expiresAt: t(c.expiresAt),
          displayExpiresAt: t(c.displayExpiresAt),
          ...(c.paymentChoice ? { paymentChoice: c.paymentChoice } : {}),
          ...(c.submittedAt ? { submittedAt: t(c.submittedAt) } : {}),
          ...(c.closeReason ? { closeReason: c.closeReason } : {}),
          stripe: {
            checkoutSessionId: c.stripe.checkoutSessionId,
            sessionExpiresAt: t(c.stripe.sessionExpiresAt),
            sessionSeq: c.stripe.sessionSeq,
            livemode: false,
          },
          mock: { state: { status: c.status, sessionId: c.stripe.checkoutSessionId } },
          createdAt: t(c.createdAt),
        }
      },
    })
  }
}

async function importReservations(req: PayloadRequest, data: SeedData, options: ExampleOptions) {
  const t = (expr: string | undefined) => (expr ? seedIso(expr, options.now) : undefined)
  for (const r of data.orders.reservations) {
    await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'reservations',
      seedKey: `reservations:${r.key}`,
      group: 'process',
      create: async () => {
        const checkout = data.orders.checkouts.find((c) => `checkouts:${c.key}` === r.checkout)
        const out: Obj = {
          ref: checkout?.reservationRef,
          checkout: await idOf(req, r.checkout),
          product: await idOf(req, r.product),
          source: r.source,
          status: r.status,
          expiresAt: t(r.expiresAt),
          displayExpiresAt: t(r.displayExpiresAt),
          convertedAt: t(r.convertedAt),
          releasedAt: t(r.releasedAt),
          releaseReason: r.releaseReason,
          createdAt: t(r.createdAt),
        }
        for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k]
        return out
      },
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
  // Schritt 4: Stücke → (Flash, Angebote, Galerie ab P8) → Seiten → (FAQ ab P8)
  if (run('products')) await seedStep(payload, (req) => importProducts(req, data, options))
  if (run('pages')) await seedStep(payload, (req) => importPages(req, data, options))
  // Schritt 5: Kassen → (Bestellungen ab P8) → Reservierungen
  if (run('checkouts')) await seedStep(payload, (req) => importCheckouts(req, data, options))
  if (run('reservations')) {
    await seedStep(payload, (req) => importReservations(req, data, options))
  }
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
