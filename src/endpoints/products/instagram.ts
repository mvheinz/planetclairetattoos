import type { Endpoint, PayloadRequest } from 'payload'

import { isAdminRequest } from '@/access'
import { ADMIN_NO_STORE } from '@/endpoints/adminResponse'
import { createLogger, errorSummary } from '@/lib/monitoring/logger'
import { instagramFileName, plainTitle } from '@/lib/products/instagram'

// „Für Instagram“ (V-39, U-93), nur Verwaltung, keine Meta-Schnittstelle:
// `GET /api/products/:id/instagram-photo.jpg` – erstes Foto als JPEG 1080 × 1350 (für das Teilen-Menü des iPads bzw.
// zum Speichern); `GET /api/products/:id/instagram-story.png` – Story-Bild 1080 × 1920 (Foto, Titel, Nummer, Preis
// „Endpreis zzgl. Versand“) über den OG-Renderer (satori). Beides `private, no-store`, als Datei mit Namen
// `planet-claire-nr-017(-story).jpg|png`. Entwürfe ohne Nummer oder Preis → 409.

const log = createLogger()
const error = (status: number, message: string) =>
  Response.json({ error: message }, { status, headers: ADMIN_NO_STORE })

type Piece = {
  itemNumber?: number | null
  title?: string | null
  adminTitle?: string | null
  priceCents?: number | null
  shippingClass?: string | null
  images?: unknown[] | null
}

async function loadPiece(req: PayloadRequest): Promise<Piece | Response> {
  if (!isAdminRequest(req)) return error(403, 'Nicht erlaubt.')
  const id = Number(req.routeParams?.id)
  if (!Number.isSafeInteger(id) || id < 1) return error(404, 'Unbekanntes Stück.')
  const doc = (await req.payload.findByID({
    collection: 'products',
    id,
    depth: 1,
    locale: 'de',
    fallbackLocale: false,
    overrideAccess: true,
    disableErrors: true,
    req,
  })) as Piece | null
  if (!doc) return error(404, 'Unbekanntes Stück.')
  if (typeof doc.itemNumber !== 'number' || typeof doc.priceCents !== 'number')
    return error(409, 'Das Stück braucht zuerst Nummer und Preis.')
  return doc
}

const firstImage = (doc: Piece) => {
  const img = doc.images?.[0]
  return img && typeof img === 'object' ? (img as Record<string, unknown>) : null
}

function file(bytes: ArrayBuffer | Buffer, name: string, type: string): Response {
  const body = new Uint8Array(bytes)
  return new Response(body, {
    status: 200,
    headers: {
      ...ADMIN_NO_STORE,
      'content-type': type,
      'content-disposition': `inline; filename="${name}"`,
      'content-length': String(body.byteLength),
      'x-content-type-options': 'nosniff',
    },
  })
}

export const instagramPhotoEndpoint: Endpoint = {
  path: '/:id/instagram-photo.jpg',
  method: 'get',
  handler: async (req) => {
    const doc = await loadPiece(req)
    if (doc instanceof Response) return doc
    try {
      const { productPhotoJpeg } = await import('@/og/photo')
      const { STORY_PHOTO } = await import('@/og/templates')
      const jpeg = await productPhotoJpeg(firstImage(doc) as never, STORY_PHOTO)
      if (!jpeg) return error(404, 'Das Stück hat noch kein Foto.')
      return file(jpeg, instagramFileName(doc.itemNumber!, 'photo', 'jpg'), 'image/jpeg')
    } catch (err) {
      log.error('products.instagram_photo_failed', { reason: errorSummary(err) })
      return error(500, 'Foto konnte nicht erstellt werden.')
    }
  },
}

export const instagramStoryEndpoint: Endpoint = {
  path: '/:id/instagram-story.png',
  method: 'get',
  handler: async (req) => {
    const doc = await loadPiece(req)
    if (doc instanceof Response) return doc
    try {
      const { renderStoryImage } = await import('@/og/render')
      const res = await renderStoryImage({
        title: plainTitle(doc.title?.trim() || doc.adminTitle?.trim() || ''),
        itemNumber: doc.itemNumber!,
        priceCents: doc.priceCents!,
        pickupOnly: doc.shippingClass === 'nur_abholung',
        image: firstImage(doc) as never,
      })
      return file(
        await res.arrayBuffer(),
        instagramFileName(doc.itemNumber!, 'story', 'png'),
        'image/png',
      )
    } catch (err) {
      log.error('products.instagram_story_failed', { reason: errorSummary(err) })
      return error(500, 'Story-Bild konnte nicht erstellt werden.')
    }
  },
}

export const instagramEndpoints: Endpoint[] = [instagramPhotoEndpoint, instagramStoryEndpoint]
