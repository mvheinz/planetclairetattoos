import { ValidationError, type Endpoint, type PayloadRequest } from 'payload'

import { isAdminRequest } from '@/access'
import { ADMIN_NO_STORE, adminActionResponse } from '@/endpoints/adminResponse'
import { errorResponse, readJsonBody } from '@/endpoints/products/actions'
import {
  moveTattooFaq,
  saveFaq,
  savePageTexts,
  saveTattooFaq,
  saveTattooPageTexts,
  setFlashPublished,
  setFlashStatus,
  suggestFlashNumber,
  translatePage,
  translateTattooDocument,
  withdrawGalleryConsent,
  type FaqForm,
} from '@/lib/tattoo/admin'
import { adoptSeedDocument } from '@/lib/seed/adopt'
import {
  isPageKey as isAnyPageKey,
  TATTOO_TEXT_PAGE_KEYS,
  type EditorBlock,
  type TattooTextPageKey,
} from '@/lib/tattoo/textBlocks'

// Admin-Endpunkte der Tattoo-Verwaltung `/tattoo` (PLAN P7.6–P7.9, alle nur für die Verwaltung):
// `GET /api/flash/next-number` · `POST /api/flash/:id/status` `{ status }` · `POST /api/flash/:id/published`
// `{ published }` · `POST /api/{flash,faqs,pages}/:id/translate` `{ force }` ·
// `POST /api/tattoo-gallery/:id/withdraw-consent` `{ email?, locale? }` · `POST /api/pages/tattoo-texts`
// `{ key, blocks, title? }` · `POST /api/faqs/tattoo-save` `{ id?, category, question, answer, published }` ·
// `POST /api/faqs/:id/move` `{ direction }` · `POST /api/{flash,tattoo-gallery,media}/:id/adopt` (P8.19) ·
// `POST /api/pages/texts` `{ key, blocks, title?, seo? }` und `POST /api/faqs/texts-save` (alle Seiten/Kategorien, P8.19a). Antwort `{ doc, unchanged }` (+ `warnings`); Fehler `{ error, errors? }` –
// bei Feldfehlern steht die erste deutsche Meldung in `error` (der Knopf zeigt sie direkt an).

const forbidden = () =>
  Response.json({ error: 'Nicht erlaubt.' }, { status: 403, headers: ADMIN_NO_STORE })

function fail(err: unknown): Response {
  if (err instanceof ValidationError) {
    const errors = err.data?.errors ?? []
    return Response.json(
      { error: errors[0]?.message ?? err.message, errors },
      { status: 400, headers: ADMIN_NO_STORE },
    )
  }
  return errorResponse(err)
}

type Handler = (req: PayloadRequest, id: number, body: Record<string, unknown>) => Promise<unknown>

function idAction(path: string, handler: Handler): Endpoint {
  return {
    path: `/:id/${path}`,
    method: 'post',
    handler: async (req) => {
      if (!isAdminRequest(req)) return forbidden()
      const id = Number(req.routeParams?.id)
      if (!Number.isSafeInteger(id) || id < 1) {
        return Response.json({ error: 'Nicht gefunden.' }, { status: 404, headers: ADMIN_NO_STORE })
      }
      try {
        const result = (await handler(req, id, await readJsonBody(req))) as {
          doc?: unknown
          unchanged?: boolean
        } & Record<string, unknown>
        const { doc, unchanged, ...extra } = result
        return adminActionResponse({ doc: doc ?? null, unchanged }, extra)
      } catch (err) {
        return fail(err)
      }
    },
  }
}

function plainAction(
  path: string,
  handler: (req: PayloadRequest, body: Record<string, unknown>) => Promise<unknown>,
): Endpoint {
  return {
    path: `/${path}`,
    method: 'post',
    handler: async (req) => {
      if (!isAdminRequest(req)) return forbidden()
      try {
        const result = (await handler(req, await readJsonBody(req))) as {
          doc?: unknown
          unchanged?: boolean
        } & Record<string, unknown>
        const { doc, unchanged, ...extra } = result
        return adminActionResponse({ doc: doc ?? null, unchanged }, extra)
      } catch (err) {
        return fail(err)
      }
    },
  }
}

/** `POST /api/{flash,tattoo-gallery,media}/:id/adopt` – Beispiel übernehmen (DATENMODELL §13.4, PLAN P8.19). */
const adopt = (collection: 'flash' | 'tattoo-gallery' | 'media') =>
  idAction('adopt', (req, id) => adoptSeedDocument(req, collection, id))

/** `GET /api/media/:id/enhance-preview` – Vorher/Nachher des Foto-Looks (DESIGN §12.2 Schritt 6, P9.14). */
const enhancePreview: Endpoint = {
  path: '/:id/enhance-preview',
  method: 'get',
  handler: async (req) => {
    if (!isAdminRequest(req)) return forbidden()
    const id = Number(req.routeParams?.id)
    if (!Number.isSafeInteger(id) || id < 1) {
      return Response.json({ error: 'Nicht gefunden.' }, { status: 404, headers: ADMIN_NO_STORE })
    }
    try {
      const { mediaEnhancePreview } = await import('@/lib/media/preview')
      return Response.json(await mediaEnhancePreview(req.payload, id), { headers: ADMIN_NO_STORE })
    } catch (err) {
      return fail(err)
    }
  },
}

export const mediaAdminEndpoints: Endpoint[] = [adopt('media'), enhancePreview]

const translate = (collection: 'flash' | 'faqs') =>
  idAction('translate', (req, id, body) =>
    translateTattooDocument(req, collection, id, { force: body.force === true }),
  )

export const flashAdminEndpoints: Endpoint[] = [
  {
    path: '/next-number',
    method: 'get',
    handler: async (req) => {
      if (!isAdminRequest(req)) return forbidden()
      return Response.json({ number: await suggestFlashNumber(req) }, { headers: ADMIN_NO_STORE })
    },
  },
  idAction('status', (req, id, body) => {
    const status = body.status
    if (status !== 'available' && status !== 'claimed') {
      throw new ValidationError({
        collection: 'flash',
        errors: [{ path: 'status', message: 'Status „verfügbar“ oder „vergeben“ wählen.' }],
      })
    }
    return setFlashStatus(req, id, status)
  }),
  idAction('published', (req, id, body) => setFlashPublished(req, id, body.published === true)),
  translate('flash'),
  adopt('flash'),
]

export const galleryAdminEndpoints: Endpoint[] = [
  idAction('withdraw-consent', (req, id, body) =>
    withdrawGalleryConsent(req, id, {
      email: typeof body.email === 'string' ? body.email : null,
      locale: body.locale === 'en' ? 'en' : 'de',
    }),
  ),
  adopt('tattoo-gallery'),
]

const isPageKey = (v: unknown): v is TattooTextPageKey =>
  typeof v === 'string' && (TATTOO_TEXT_PAGE_KEYS as readonly string[]).includes(v)

export const pageAdminEndpoints: Endpoint[] = [
  plainAction('tattoo-texts', async (req, body) => {
    if (!isPageKey(body.key)) {
      throw new ValidationError({
        collection: 'pages',
        errors: [{ path: 'key', message: 'Unbekannte Seite.' }],
      })
    }
    const blocks = Array.isArray(body.blocks) ? (body.blocks as EditorBlock[]) : []
    const title = body.title as { de: string; en: string } | undefined
    return saveTattooPageTexts(req, body.key, { blocks, title })
  }),
  plainAction('texts', async (req, body) => {
    if (!isAnyPageKey(body.key)) {
      throw new ValidationError({
        collection: 'pages',
        errors: [{ path: 'key', message: 'Unbekannte Seite.' }],
      })
    }
    const blocks = Array.isArray(body.blocks) ? (body.blocks as EditorBlock[]) : []
    return savePageTexts(req, body.key, {
      blocks,
      title: body.title as { de: string; en: string } | undefined,
      seo: (body.seo ?? undefined) as Parameters<typeof savePageTexts>[2]['seo'],
    })
  }),
  idAction('translate', (req, id, body) => translatePage(req, id, { force: body.force === true })),
]

export const faqAdminEndpoints: Endpoint[] = [
  plainAction('tattoo-save', (req, body) => saveTattooFaq(req, body as unknown as FaqForm)),
  plainAction('texts-save', (req, body) =>
    saveFaq(req, body as unknown as Parameters<typeof saveFaq>[1]),
  ),
  idAction('move', (req, id, body) =>
    moveTattooFaq(req, id, body.direction === 'up' ? 'up' : 'down'),
  ),
  translate('faqs'),
]
