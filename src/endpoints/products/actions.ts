import { APIError, ValidationError, type Endpoint, type PayloadRequest } from 'payload'

import { isAdminRequest } from '@/access'
import { transitionProduct, type ProductTransition } from '@/lib/commerce/productTransitions'
import { createLogger } from '@/lib/monitoring/logger'

// Admin-Endpunkte der Stücke (DATENMODELL §6.6.10, alle `isAdmin`): je Aktion ein Übergang des Statusautomaten.
// `publish` P2 · `unpublish` P3 · `sell-offline` P9/P10 · `archive` P12 · `archive-after-return` P13 · `restore` P14 ·
// `return-to-stock` P11. Antwort: `{ doc }` bzw. `{ error, errors? }` mit deutscher Meldung.

const log = createLogger()

export async function readJsonBody(req: PayloadRequest): Promise<Record<string, unknown>> {
  try {
    const body = typeof req.json === 'function' ? await req.json() : {}
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const noStore = { 'cache-control': 'private, no-store' }

/** Fehler eines Service als JSON-Antwort (Validierung 400, Übergang 409, sonst Status des APIError). */
export function errorResponse(err: unknown): Response {
  if (err instanceof ValidationError) {
    return Response.json(
      { error: err.message, errors: err.data?.errors ?? [] },
      { status: 400, headers: noStore },
    )
  }
  if (err instanceof APIError) {
    return Response.json({ error: err.message }, { status: err.status, headers: noStore })
  }
  log.error('products.action_failed', { reason: (err as Error)?.message })
  return Response.json({ error: 'Unerwarteter Fehler.' }, { status: 500, headers: noStore })
}

type Handler = (req: PayloadRequest, id: number, body: Record<string, unknown>) => Promise<unknown>

/** `POST /api/products/:id/<path>` nur für die Verwaltung. */
export function productAction(path: string, handler: Handler): Endpoint {
  return {
    path: `/:id/${path}`,
    method: 'post',
    handler: async (req) => {
      if (!isAdminRequest(req)) {
        return Response.json({ error: 'Nicht erlaubt.' }, { status: 403, headers: noStore })
      }
      const id = Number(req.routeParams?.id)
      if (!Number.isSafeInteger(id) || id < 1) {
        return Response.json({ error: 'Unbekanntes Stück.' }, { status: 404, headers: noStore })
      }
      try {
        const doc = await handler(req, id, await readJsonBody(req))
        return Response.json({ doc }, { headers: noStore })
      } catch (err) {
        return errorResponse(err)
      }
    },
  }
}

const transitionAction = (path: string, transition: ProductTransition): Endpoint =>
  productAction(path, (req, id) => transitionProduct(req, id, transition, { actor: 'admin' }))

export const productTransitionEndpoints: Endpoint[] = [
  transitionAction('publish', 'publish'),
  transitionAction('unpublish', 'unpublish'),
  transitionAction('archive', 'archive'),
  transitionAction('archive-after-return', 'archiveAfterReturn'),
  transitionAction('restore', 'restore'),
  transitionAction('return-to-stock', 'returnToStock'),
  productAction('sell-offline', (req, id, body) =>
    transitionProduct(req, id, 'sellOffline', {
      actor: 'admin',
      note: typeof body.note === 'string' ? body.note.slice(0, 120) : null,
      showInArchive: typeof body.showInArchive === 'boolean' ? body.showInArchive : undefined,
      confirmReservedCheckout: body.confirmReservedCheckout === true,
    }),
  ),
]
