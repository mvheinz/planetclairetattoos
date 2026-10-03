import type { Endpoint, PayloadRequest } from 'payload'

import { isAdminRequest } from '@/access'
import { ADMIN_NO_STORE } from '@/endpoints/adminResponse'
import { errorResponse, readJsonBody } from '@/endpoints/products/actions'
import type { LegalTextType } from '@/lib/enums'
import {
  confirmLegalReview,
  LegalAdminError,
  parseLegalSnippetInput,
  parseLegalTextInput,
  previewLegalSnippet,
  previewLegalText,
  publishLegalSnippet,
  publishLegalText,
} from '@/lib/legal/admin'
import { requestNow } from '@/lib/payload/context'

// Bereich „Rechtstexte“ der Ansicht „Texte“ (PLAN P6.4, KONZEPT §7.13), nur angemeldete Verwaltung:
// `POST /api/legal-texts/preview-version` `{ type, format, de, en?, origin, validFrom? }` – Vorschau + Fehlerliste, ohne
// zu speichern; `POST /api/legal-texts/publish-version` (gleicher Rumpf + `sourceNote`, `changeNote`) – Fassung anlegen
// und sofort bzw. ab `validFrom` veröffentlichen (422 mit Fehlerliste, wenn eine Prüfung scheitert; nichts gespeichert);
// `POST /api/legal-texts/confirm-review` `{ type }` – „Geprüft, keine Änderung“ (R-014).
// Für Bausteine `POST /api/legal-snippets/preview-version` bzw. `/publish-version` `{ key, de, en?, origin, … }`.

const json = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: ADMIN_NO_STORE })

function handle(fn: (req: PayloadRequest, body: Record<string, unknown>) => Promise<unknown>) {
  return async (req: PayloadRequest): Promise<Response> => {
    if (!isAdminRequest(req)) return json(403, { error: 'Nicht erlaubt.' })
    try {
      const body = await readJsonBody(req)
      return json(200, { ...((await fn(req, body)) as Record<string, unknown>) })
    } catch (err) {
      if (err instanceof LegalAdminError) return json(err.status, { error: err.message })
      return errorResponse(err)
    }
  }
}

export const legalTextAdminEndpoints: Endpoint[] = [
  {
    path: '/preview-version',
    method: 'post',
    handler: handle(async (req, body) => ({
      preview: await previewLegalText(req, parseLegalTextInput(body), requestNow(req)),
    })),
  },
  {
    path: '/publish-version',
    method: 'post',
    handler: handle(async (req, body) => ({
      published: await publishLegalText(req, parseLegalTextInput(body), requestNow(req)),
    })),
  },
  {
    path: '/confirm-review',
    method: 'post',
    handler: handle(async (req, body) => ({
      review: await confirmLegalReview(req, body.type as LegalTextType, requestNow(req)),
    })),
  },
]

export const legalSnippetAdminEndpoints: Endpoint[] = [
  {
    path: '/preview-version',
    method: 'post',
    handler: handle(async (req, body) => ({
      preview: await previewLegalSnippet(req, parseLegalSnippetInput(body), requestNow(req)),
    })),
  },
  {
    path: '/publish-version',
    method: 'post',
    handler: handle(async (req, body) => ({
      published: await publishLegalSnippet(req, parseLegalSnippetInput(body), requestNow(req)),
    })),
  },
]
