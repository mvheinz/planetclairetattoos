import { APIError, ValidationError, type Endpoint, type PayloadRequest } from 'payload'

import { isAdminRequest } from '@/access'
import { ADMIN_NO_STORE, adminActionResponse } from '@/endpoints/adminResponse'
import { TransitionError } from '@/lib/commerce/transitionError'
import { transitionProduct } from '@/lib/commerce/productTransitions'
import { PRICE_CENTS_RANGE } from '@/lib/money'
import { requestNow } from '@/lib/payload/context'
import { inTransaction } from '@/lib/payload/transaction'
import { formatItemNumber, isValidItemNumber } from '@/lib/products/itemNumber'
import { loadDraftViews, readinessFor, readinessOfProduct } from '@/lib/products/publishReadiness'
import { addBerlinDays, berlinDayStart } from '@/lib/time'

import { errorResponse, productAction, readJsonBody } from './actions'

// Abläufe der Verwaltung rund um „Meine Stücke“ und „Heute“ (P20.6, U-93):
// - `POST /api/products/:id/attention-done` – „Erledigt“ (V-31): löscht eine Markierung **von Hand** (z. B. aus dem
//   Bestands-Import). Markierungen des Systems (z. B. „Konformitätserklärung widerrufen“) bleiben – 409.
// - `GET|POST /api/products/publish-ready` – „Alle fertigen online stellen“ (V-32): GET zählt die fertigen Entwürfe
//   (dieselbe Prüfung wie beim Online-Stellen), POST stellt höchstens `PUBLISH_READY_BATCH` davon nacheinander online
//   (je Stück eigener Übergang P2 mit Veröffentlichungsprüfung; Bestätigungen wie „nur eigene Figuren“ oder „nickelfrei“
//   setzt die Sammelaktion nie – R-047, V-03) und meldet Erfolge und Fehler. `ids` = die im Dialog gezählten und
//   bestätigten Stücke (nur diese gehen online), `skip` = Stücke, die schon scheiterten.
// - `GET /api/products/:id/readiness` – „Was fehlt noch?“ im Formular (nach jedem Speichern neu).
// - `GET|POST /api/products/market-sale` – Markt-Knopf unter „Heute“ (V-33 a): Nummer → Stück (GET zeigt es an),
//   POST verkauft es über denselben Übergang wie „Verkauft (Markt/privat)“ (P9, Statusautomat, Umsatz-Wächter) mit
//   Datum heute; läuft heute genau ein Markt-Termin, wird er zugeordnet. Preis freiwillig (später nachtragbar).
//   Reserviert (Kasse oder Vorkasse), Entwurf, weggelegt oder schon verkauft → klare Meldung, keine Wirkung.

type Doc = Record<string, unknown>

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: ADMIN_NO_STORE })
const forbidden = () => json({ error: 'Nicht erlaubt.' }, 403)

/** Höchstens so viele Stücke je Aufruf (die Verwaltung ruft so lange nach, bis alles erledigt ist). */
export const PUBLISH_READY_BATCH = 10

// --- V-31 „Erledigt“ -------------------------------------------------------------------------------------------

export const attentionDoneEndpoint: Endpoint = productAction('attention-done', async (req, id) => {
  const product = (await req.payload.findByID({
    collection: 'products',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })) as Doc | null
  if (!product) throw new APIError('Unbekanntes Stück.', 404)
  const attention = (product.adminAttention ?? {}) as { flag?: boolean; reason?: string | null }
  if (attention.flag !== true) return { doc: product, unchanged: true }
  if (attention.reason !== 'manual') {
    throw new APIError(
      'Diese Markierung hat das System gesetzt – sie verschwindet, sobald die Ursache behoben ist.',
      409,
    )
  }
  const doc = await inTransaction(req, () =>
    req.payload.update({
      collection: 'products',
      id,
      data: { adminAttention: { flag: false, reason: null, note: null } } as never,
      depth: 0,
      overrideAccess: true,
      req,
      // Nur die Markierung: keine Veröffentlichungsprüfung, kein Statuswechsel.
      context: { ...req.context, system: true },
    }),
  )
  return { doc, unchanged: false }
})

// --- V-32 „Alle fertigen online stellen“ ------------------------------------------------------------------------

interface PieceRef {
  id: number
  itemNumber: number
  nr: string
  title: string | null
}

const refOf = (view: Doc): PieceRef => {
  const title = view.title as { de?: string | null } | string | null | undefined
  const itemNumber = Number(view.itemNumber)
  return {
    id: Number(view.id),
    itemNumber,
    nr: isValidItemNumber(itemNumber) ? formatItemNumber(itemNumber, 'de') : `#${view.id}`,
    title: (typeof title === 'string' ? title : title?.de) ?? null,
  }
}

/** Fertige Entwürfe (keine sperrende Meldung) in Listenreihenfolge, ohne `skip`. */
export async function readyDrafts(
  req: PayloadRequest,
  skip: ReadonlySet<number> = new Set(),
): Promise<{ drafts: number; ready: PieceRef[] }> {
  const views = await loadDraftViews(req)
  const readiness = await readinessFor(req, views)
  const ready = views
    .filter((v) => !skip.has(Number(v.id)) && readiness.get(Number(v.id))?.ready === true)
    .map(refOf)
  return { drafts: views.length, ready }
}

const idsOf = (v: unknown): number[] =>
  (Array.isArray(v) ? v : []).map(Number).filter((n) => Number.isSafeInteger(n) && n > 0)

const messagesOf = (err: unknown): string => {
  if (err instanceof ValidationError) {
    const list = (err.data?.errors ?? []).map((e) => e.message).filter(Boolean)
    return list.length ? list.join(' ') : err.message
  }
  if (err instanceof TransitionError || err instanceof APIError) return err.message
  return 'Unerwarteter Fehler.'
}

export const publishReadyEndpoints: Endpoint[] = [
  {
    path: '/publish-ready',
    method: 'get',
    handler: async (req) => {
      if (!isAdminRequest(req)) return forbidden()
      try {
        const { drafts, ready } = await readyDrafts(req)
        return json({ drafts, ready })
      } catch (err) {
        return errorResponse(err)
      }
    },
  },
  {
    path: '/publish-ready',
    method: 'post',
    handler: async (req) => {
      if (!isAdminRequest(req)) return forbidden()
      try {
        const body = await readJsonBody(req)
        const skip = new Set(idsOf(body.skip))
        // Nur die Stücke, die der Dialog gezählt und Jutta bestätigt hat (`ids`); ohne `ids` alle fertigen.
        const only = Array.isArray(body.ids) ? new Set(idsOf(body.ids)) : null
        const { ready: all } = await readyDrafts(req, skip)
        const ready = only ? all.filter((p) => only.has(p.id)) : all
        const batch = ready.slice(0, PUBLISH_READY_BATCH)
        const published: PieceRef[] = []
        const failed: (PieceRef & { message: string })[] = []
        for (const piece of batch) {
          try {
            // Nur der Übergang P2: keine Daten dazu – Bestätigungen bleiben, wie Jutta sie je Stück gesetzt hat.
            await transitionProduct(req, piece.id, 'publish', { actor: 'admin' })
            published.push(piece)
          } catch (err) {
            failed.push({ ...piece, message: messagesOf(err) })
          }
        }
        return json({ published, failed, remaining: ready.length - batch.length })
      } catch (err) {
        return errorResponse(err)
      }
    },
  },
]

/** `GET /api/products/:id/readiness` – für das Formular nach dem Speichern (V-32). */
export const productReadinessEndpoint: Endpoint = {
  path: '/:id/readiness',
  method: 'get',
  handler: async (req) => {
    if (!isAdminRequest(req)) return forbidden()
    const id = Number(req.routeParams?.id)
    if (!Number.isSafeInteger(id) || id < 1) return json({ error: 'Unbekanntes Stück.' }, 404)
    const readiness = await readinessOfProduct(req, id)
    return readiness ? json({ readiness }) : json({ error: 'Unbekanntes Stück.' }, 404)
  },
}

// --- V-33 a Markt-Knopf -----------------------------------------------------------------------------------------

const parseNumber = (v: unknown): number | null => {
  const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : ''
  if (!/^\d{1,5}$/.test(s)) return null
  const n = Number(s)
  return isValidItemNumber(n) ? n : null
}

async function productByNumber(req: PayloadRequest, itemNumber: number): Promise<Doc | null> {
  const res = await req.payload.find({
    collection: 'products',
    where: { itemNumber: { equals: itemNumber } },
    locale: 'de',
    fallbackLocale: false,
    depth: 0,
    limit: 1,
    overrideAccess: true,
    req,
  })
  return (res.docs[0] as unknown as Doc | undefined) ?? null
}

/** Warum der Markt-Knopf ein Stück nicht verkaufen kann (`null` = geht). */
export function marketRefusal(product: Doc): string | null {
  const nr = formatItemNumber(Number(product.itemNumber), 'de')
  switch (product.status) {
    case 'available':
      return null
    case 'reserved':
      return `${nr} ist gerade reserviert – jemand bezahlt es online oder es wartet auf eine Vorkasse. Bitte jetzt nicht verkaufen und unter „Meine Stücke“ nachsehen.`
    case 'draft':
      return `${nr} ist ein Entwurf und gar nicht im Shop – online kann es niemand kaufen. Hier musst du nichts eintragen.`
    case 'archived':
      return `${nr} ist weggelegt und nicht im Shop. Hier musst du nichts eintragen.`
    case 'sold':
      return product.soldChannel === 'offline'
        ? `${nr} ist schon als verkauft eingetragen.`
        : `${nr} wurde schon online verkauft.`
    default:
      return `${nr} lässt sich gerade nicht verkaufen.`
  }
}

/** Heute laufender Markt-Termin (Europe/Berlin) – nur wenn es genau einen gibt (sonst keiner, nichts raten). */
async function todaysTour(req: PayloadRequest, now: Date): Promise<number | null> {
  const dayStart = berlinDayStart(now)
  const dayEnd = addBerlinDays(dayStart, 1)
  const res = await req.payload.find({
    collection: 'tour-dates',
    where: {
      and: [
        { startsAt: { less_than: dayEnd.toISOString() } },
        { endsAt: { greater_than_equal: dayStart.toISOString() } },
        { status: { not_equals: 'cancelled' } },
      ],
    },
    depth: 0,
    limit: 2,
    overrideAccess: true,
    req,
  })
  return res.docs.length === 1 ? Number(res.docs[0]!.id) : null
}

const priceOf = (v: unknown): number | null => {
  if (v === undefined || v === null || v === '') return null
  if (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= PRICE_CENTS_RANGE.max)
    return v
  throw new APIError('Bitte einen gültigen Preis in Euro eingeben, z. B. 45,00.', 400)
}

const summaryOf = (p: Doc) => ({
  id: Number(p.id),
  itemNumber: Number(p.itemNumber),
  nr: formatItemNumber(Number(p.itemNumber), 'de'),
  title: typeof p.title === 'string' ? p.title : null,
  priceCents: typeof p.priceCents === 'number' ? p.priceCents : null,
  status: p.status,
})

export const marketSaleEndpoints: Endpoint[] = [
  {
    path: '/market-sale',
    method: 'get',
    handler: async (req) => {
      if (!isAdminRequest(req)) return forbidden()
      const nr = parseNumber(req.searchParams?.get('nr'))
      if (nr === null) return json({ error: 'Bitte eine Nummer eingeben.' }, 400)
      const product = await productByNumber(req, nr)
      if (!product) {
        return json({ error: `${formatItemNumber(nr, 'de')} gibt es nicht.` }, 404)
      }
      return json({ piece: summaryOf(product), refusal: marketRefusal(product) })
    },
  },
  {
    path: '/market-sale',
    method: 'post',
    handler: async (req) => {
      if (!isAdminRequest(req)) return forbidden()
      try {
        const body = await readJsonBody(req)
        const nr = parseNumber(body.itemNumber)
        if (nr === null) return json({ error: 'Bitte eine Nummer eingeben.' }, 400)
        const priceCents = priceOf(body.priceCents)
        const product = await productByNumber(req, nr)
        if (!product) {
          return json({ error: `${formatItemNumber(nr, 'de')} gibt es nicht.` }, 404)
        }
        const refusal = marketRefusal(product)
        if (refusal) {
          // Zweiter Tipp nach einem Erfolg: nichts ändern, kein Fehler (zustandsbasiert idempotent).
          if (product.status === 'sold' && product.soldChannel === 'offline') {
            return adminActionResponse(
              { doc: summaryOf(product), unchanged: true },
              { message: refusal },
            )
          }
          return json({ error: refusal }, 409)
        }
        const tourDateId = await todaysTour(req, requestNow(req))
        // Derselbe Übergang wie „Verkauft (Markt/privat)“ (P9): sofort aus dem Shop, zählt mit Preis im Umsatz-Wächter.
        const doc = (await transitionProduct(req, Number(product.id), 'sellOffline', {
          actor: 'admin',
          priceCents,
          tourDateId,
          note: null,
        })) as unknown as Doc
        return adminActionResponse({ doc: summaryOf(doc), unchanged: false }, { tourDateId })
      } catch (err) {
        return errorResponse(err)
      }
    },
  },
]
