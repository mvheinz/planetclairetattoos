import 'server-only'

import type { PayloadRequest } from 'payload'
import { toDataURL } from 'qrcode'
import sharp from 'sharp'
import React from 'react'

import { formatShippingAddress } from '@/lib/commerce/address'
import { packingChecklist } from '@/lib/commerce/packing'
import { ENUM_LABELS } from '@/lib/enumLabels'
import { getEnv } from '@/lib/env'
import { preservingReq } from '@/lib/payload/localReq'
import { formatItemNumber } from '@/lib/products/itemNumber'
import { productPath } from '@/lib/shop/format'
import { readMediaFile } from '@/lib/storage/read'
import { formatBerlin } from '@/lib/time'
import type { Media, Order, Product, Setting } from '@/payload-types'

import { PackingSlip, type InsertBlock, type MakerInfo, type PackingSlipData } from './PackingSlip'
import { ProductLabel, type ProductLabelData } from './ProductLabel'
import { renderPdf, type RenderedPdf } from './render'

// Daten und Erzeugung von Packzettel und Etikett (PLAN P5.12, R-203): Stammdaten aus `settings.business` (bis P11
// Platzhalter „[Name folgt]“), Stücke mit DE/EN-Hinweisen, Fotos aus dem eigenen Speicher (nie über eine URL).

type Localized = { de?: string | null; en?: string | null } | string | null | undefined

const text = (v: Localized, locale: 'de' | 'en'): string | null => {
  if (v === null || v === undefined) return null
  if (typeof v === 'string') return locale === 'de' ? v.trim() || null : null
  return v[locale]?.trim() || null
}

/** Herstellerin laut `settings.business` (GPSR Art. 9 Abs. 6: Name, Postanschrift, E-Mail). */
export function makerFromSettings(settings: Pick<Setting, 'business'>): MakerInfo {
  const b = settings.business ?? ({} as NonNullable<Setting['business']>)
  const country = b.country && b.country !== 'DE' ? b.country : 'Deutschland'
  return {
    name: [b.legalName, b.tradeName ? `(${b.tradeName})` : null].filter(Boolean).join(' '),
    address: [b.street ?? '', [b.postalCode, b.city].filter(Boolean).join(' '), country].filter(
      Boolean,
    ),
    email: b.email ?? '',
  }
}

type ProductAll = Omit<Product, 'title' | 'safetyWarnings' | 'careInstructions' | 'slug'> & {
  title?: Localized
  safetyWarnings?: Localized
  careInstructions?: Localized
  slug?: Localized
}

/** Beileger-Block eines Stücks (DE und EN). */
export function insertFor(product: ProductAll, fallbackTitle?: string | null): InsertBlock {
  return {
    nr: formatItemNumber(product.itemNumber, 'de'),
    nrEn: formatItemNumber(product.itemNumber, 'en'),
    title: {
      de: text(product.title, 'de') ?? fallbackTitle ?? null,
      en: text(product.title, 'en'),
    },
    safety: { de: text(product.safetyWarnings, 'de'), en: text(product.safetyWarnings, 'en') },
    care: { de: text(product.careInstructions, 'de'), en: text(product.careInstructions, 'en') },
    decoOnly: product.category === 'keramik' && product.foodContact !== 'lebensmittelecht',
  }
}

async function loadSettings(req: PayloadRequest): Promise<Setting> {
  return (await preservingReq(req, () =>
    req.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
  )) as Setting
}

async function loadProductAll(req: PayloadRequest, id: number): Promise<ProductAll | null> {
  return (await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'products',
      id,
      depth: 0,
      locale: 'all',
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )) as ProductAll | null
}

const idOf = (v: unknown): number | null =>
  v === null || v === undefined
    ? null
    : typeof v === 'object'
      ? (v as { id: number }).id
      : Number(v)

/** Kleines JPEG eines Medienbilds als Data-URL (eigener Speicher; `null`, wenn nicht lesbar). */
async function photoDataUrl(req: PayloadRequest, mediaId: number | null): Promise<string | null> {
  if (!mediaId) return null
  try {
    const media = (await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'media',
        id: mediaId,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
        req,
      }),
    )) as (Media & { prefix?: string | null }) | null
    if (!media) return null
    const thumb = media.sizes?.thumb?.filename
    const buf =
      (thumb ? await readMediaFile(thumb, media.prefix) : null) ??
      (media.filename ? await readMediaFile(media.filename, media.prefix) : null)
    if (!buf) return null
    const jpeg = await sharp(buf)
      .resize(160, 200, { fit: 'cover' })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 80 })
      .toBuffer()
    return `data:image/jpeg;base64,${jpeg.toString('base64')}`
  } catch {
    return null
  }
}

/** Daten des Packzettels (ohne Preise). */
export async function packingSlipData(req: PayloadRequest, order: Order): Promise<PackingSlipData> {
  const settings = await loadSettings(req)
  const maker = makerFromSettings(settings)
  const items: PackingSlipData['items'] = []
  const inserts: InsertBlock[] = []
  for (const item of order.items) {
    const productId = idOf(item.product)
    const product = productId ? await loadProductAll(req, productId) : null
    const images = (product?.images ?? []) as unknown[]
    const photo = await photoDataUrl(req, idOf(item.coverImage) ?? idOf(images[0]))
    items.push({
      nr: formatItemNumber(item.itemNumber, 'de'),
      title: item.titleDe,
      storageLocation: product?.storageLocation ?? null,
      photo,
    })
    inserts.push(
      product
        ? insertFor(product, item.titleDe)
        : {
            nr: formatItemNumber(item.itemNumber, 'de'),
            nrEn: formatItemNumber(item.itemNumber, 'en'),
            title: { de: item.titleDe, en: item.titleEn ?? null },
            safety: { de: null, en: null },
            care: { de: null, en: null },
            decoOnly: item.category === 'keramik' && item.foodContact !== 'lebensmittelecht',
          },
    )
  }
  return {
    orderNumber: order.orderNumber,
    placedAt: formatBerlin(new Date(order.timestamps.placedAt), 'dd.MM.yyyy'),
    locale: order.locale === 'en' ? 'en' : 'de',
    recipient: formatShippingAddress(order).split('\n').filter(Boolean),
    shippingClassLabel: order.shippingClass
      ? ENUM_LABELS.SHIPPING_CLASSES[order.shippingClass].de
      : null,
    items,
    checklist: packingChecklist(order, settings).map((c) => c.text),
    maker,
    inserts,
  }
}

export async function renderPackingSlip(req: PayloadRequest, order: Order): Promise<Buffer> {
  const data = await packingSlipData(req, order)
  const pdf: RenderedPdf = await renderPdf(React.createElement(PackingSlip, { data }) as never)
  return pdf.data
}

/** Daten von Etikett und Beileger eines Stücks. */
export async function productLabelData(
  req: PayloadRequest,
  productId: number,
): Promise<ProductLabelData | null> {
  const product = await loadProductAll(req, productId)
  if (!product) return null
  const settings = await loadSettings(req)
  const siteUrl = getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  const productUrl = `${siteUrl}${productPath(
    { itemNumber: product.itemNumber, slug: product.slug as never },
    'de',
  )}`
  return {
    maker: makerFromSettings(settings),
    insert: insertFor(product),
    productUrl,
    qr: await toDataURL(productUrl, { errorCorrectionLevel: 'M', margin: 1, width: 256 }),
  }
}

export async function renderProductLabel(
  req: PayloadRequest,
  productId: number,
): Promise<Buffer | null> {
  const data = await productLabelData(req, productId)
  if (!data) return null
  const pdf = await renderPdf(React.createElement(ProductLabel, { data }) as never)
  return pdf.data
}
