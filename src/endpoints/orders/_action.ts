import { APIError, ValidationError, type Endpoint, type PayloadRequest } from 'payload'

import { isAdminRequest } from '@/access'
import { ADMIN_NO_STORE, adminActionResponse } from '@/endpoints/adminResponse'
import { readJsonBody } from '@/endpoints/products/actions'
import { transitionOrder } from '@/lib/commerce/transitionOrder'
import type { OrderStatus } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { requestNow } from '@/lib/payload/context'
import { inTransaction } from '@/lib/payload/transaction'
import type { Order } from '@/payload-types'

// Gemeinsamer Aktions-Rahmen der Bestell-Aktionen in der Verwaltung (PLAN P5.9, ARCHITEKTUR §2.4, KONZEPT §6.1):
// - nur angemeldete Verwaltung (sonst 403), unbekannte Bestellung 404;
// - der Handler läuft in **einer** Transaktion (`inTransaction`); Mails nur über die Outbox (`enqueueEmail`) mit
//   Idempotenz-Schlüssel „Mailtyp:Objekt-ID:Ereignis“ – rollt die Transaktion zurück, gibt es keine Mail;
// - Statuswechsel nur über `transitionByAdmin` → `transitionOrder` (Prüfung gegen `ORDER_TRANSITIONS`, DATENMODELL
//   §6.8.5): der Speicher-Hook schreibt den `statusHistory`-Eintrag mit `actorType = admin` und O-Nummer in
//   `transition` sowie das Audit `order_status_changed`; unerlaubt → 409 ohne Änderung;
// - zustandsbasiert idempotent: Zielzustand schon erreicht → 200 `{ unchanged: true }` ohne zweite Wirkung;
// - Wirkungen nach dem Commit (Mail sofort zustellen) über `afterCommit`.

const log = createLogger()

/** Abgelehnte Aktion mit HTTP-Status und deutscher Meldung (`code` für die Oberfläche, z. B. eine Rückfrage). */
export class OrderActionError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'OrderActionError'
  }
}

export interface OrderActionInput {
  req: PayloadRequest
  /** Bestellung beim Aufruf (vor der Sperre; für Prüfungen ohne Wettlauf `transitionByAdmin` nutzen). */
  order: Order
  body: Record<string, unknown>
  now: Date
  /** `Idempotency-Key` des Klicks (nur fürs Log). */
  key: string | null
}

export interface OrderActionResult {
  doc: Order
  unchanged?: boolean
  afterCommit?: () => Promise<void>
  extra?: Record<string, unknown>
}

export type OrderActionHandler = (input: OrderActionInput) => Promise<OrderActionResult>

export const orderActionError = (
  status: number,
  message: string,
  extra: Record<string, unknown> = {},
) => Response.json({ error: message, ...extra }, { status, headers: ADMIN_NO_STORE })

/** Fachliche Fehler der Dienste (`PackingError`, `ShipError`, `ResendError` …) tragen Status und ggf. `code`. */
function isStatusError(err: unknown): err is { status: number; message: string; code?: string } {
  if (!(err instanceof Error) || err instanceof APIError) return false
  const status = (err as unknown as { status?: unknown }).status
  return typeof status === 'number' && status >= 400 && status < 500
}

/** Fehler als Antwort: Rahmen-Fehler mit Status, Validierung 400, Übergang (`TransitionError`) 409, sonst 500. */
export function orderActionErrorResponse(err: unknown, path = ''): Response {
  if (isStatusError(err)) {
    return orderActionError(err.status, err.message, err.code ? { code: err.code } : {})
  }
  if (err instanceof ValidationError) {
    return orderActionError(400, err.message, { errors: err.data?.errors ?? [] })
  }
  if (err instanceof APIError) return orderActionError(err.status, err.message)
  log.error('orders.admin_action_failed', { path, reason: (err as Error)?.message })
  return orderActionError(
    500,
    'Unerwarteter Fehler. Bitte die Seite neu laden und noch einmal versuchen.',
  )
}

/** Bestellung zur Route laden (Admin-Pflicht). Liefert eine Antwort, wenn es nicht weitergeht. */
export async function loadAdminOrder(req: PayloadRequest): Promise<Order | Response> {
  if (!isAdminRequest(req)) return orderActionError(403, 'Nicht erlaubt.')
  const id = Number(req.routeParams?.id)
  if (!Number.isSafeInteger(id) || id < 1) return orderActionError(404, 'Unbekannte Bestellung.')
  const order = (await req.payload.findByID({
    collection: 'orders',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })) as Order | null
  return order ?? orderActionError(404, 'Unbekannte Bestellung.')
}

/** `POST /api/orders/:id/<path>` über den Rahmen. */
export function adminOrderAction(path: string, handler: OrderActionHandler): Endpoint {
  return {
    path: `/:id/${path}`,
    method: 'post',
    handler: async (req) => {
      const order = await loadAdminOrder(req)
      if (order instanceof Response) return order
      const key = req.headers.get('idempotency-key')?.slice(0, 100) ?? null
      try {
        const body = await readJsonBody(req)
        const now = requestNow(req)
        const result = await inTransaction(req, () => handler({ req, order, body, now, key }))
        if (result.afterCommit) {
          await result.afterCommit().catch((e: unknown) =>
            log.error('orders.admin_action_after_commit_failed', {
              orderId: order.id,
              path,
              reason: (e as Error)?.message,
            }),
          )
        }
        log.info('orders.admin_action', {
          orderId: order.id,
          path,
          key,
          unchanged: !!result.unchanged,
        })
        return adminActionResponse({ doc: result.doc, unchanged: result.unchanged }, result.extra)
      } catch (err) {
        return orderActionErrorResponse(err, path)
      }
    },
  }
}

export interface AdminTransitionOptions {
  /** Notiz im Statusverlauf. */
  note?: string
  /** Weitere Felder im selben Schritt. */
  data?: Record<string, unknown>
  /** Nur aus diesen Status (sonst 409). */
  expectedFrom?: readonly OrderStatus[]
}

/**
 * Statuswechsel durch die Verwaltung: Zeile sperren, Übergang gegen `ORDER_TRANSITIONS` prüfen (409 bei unerlaubtem
 * Übergang), speichern. Historie (`actorType = admin`, O-Nummer) und Audit schreibt der Speicher-Hook der Bestellung.
 */
export async function transitionByAdmin(
  input: Pick<OrderActionInput, 'req' | 'order' | 'now'>,
  to: OrderStatus,
  options: AdminTransitionOptions = {},
): Promise<Order> {
  const res = await transitionOrder(input.req, input.order.id, to, {
    now: input.now,
    note: options.note,
    data: options.data,
    expectedFrom: options.expectedFrom,
    actorType: 'admin',
  })
  return res.order
}
