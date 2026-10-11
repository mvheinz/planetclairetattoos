import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

import { dbFor } from '@/lib/db/tx'
import type { ActorType, OrderCancelReason, OrderStatus } from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import type { Order } from '@/payload-types'

import { evaluateOrderTransition, type OrderTransitionId } from './orderTransitions'
import { TransitionError } from './transitionError'

// Einziger Weg für Statuswechsel einer bestehenden Bestellung (DATENMODELL §6.8.5, KONZEPT §5.3 O3…O21): sperrt die
// Zeile (`FOR UPDATE`) in der Transaktion von `req`, prüft den Übergang (Tabelle + O17/O20) und speichert mit
// `context.transition` – der Speicher-Hook der Bestellung schreibt Statusverlauf, Zeitstempel und Audit. Nebenwirkungen
// (Verkauf, Freigabe, Rechnung, Mails) bleiben Sache des Aufrufers in derselben Transaktion.

export interface TransitionOrderOptions {
  now: Date
  /** Weitere Felder im selben Schritt (z. B. `cancelReason`, `prepayment.receivedAt`). */
  data?: Record<string, unknown>
  /** Notiz im Statusverlauf (≤ 300 Zeichen). */
  note?: string
  /** Auslöser im Statusverlauf, wenn kein Admin angemeldet ist (Standard `system`). */
  actorType?: ActorType
  /** Nur wechseln, wenn die Bestellung (noch) in einem dieser Status ist; sonst `TransitionError`. */
  expectedFrom?: readonly OrderStatus[]
}

export interface TransitionOrderResult {
  order: Order
  from: OrderStatus
  transition: OrderTransitionId
}

/** Gesperrte Zeile: Status und die Angaben, die `evaluateOrderTransition` braucht. */
export interface LockedOrder {
  status: OrderStatus
  statusBeforeDispute: OrderStatus | null
  statusBeforeWithdrawal: OrderStatus | null
  cancelReason: OrderCancelReason | null
  /** Positionen mit `status = active` (Rest-Lieferung aus `partially_refunded`). */
  activeItemCount: number
  shippedAt: string | null
  deliveredAt: string | null
  readyForPickupAt: string | null
  pickedUpAt: string | null
}

const isoOrNull = (v: unknown): string | null =>
  v === null || v === undefined ? null : new Date(v as string).toISOString()

export async function lockOrder(req: PayloadRequest, orderId: number): Promise<LockedOrder> {
  const db = await dbFor(req)
  const res = await db.execute(
    sql`SELECT status, status_before_dispute, status_before_withdrawal, cancel_reason,
               timestamps_shipped_at, timestamps_delivered_at, timestamps_ready_for_pickup_at,
               timestamps_picked_up_at,
               (SELECT count(*) FROM orders_items i WHERE i._parent_id = orders.id AND i.status = 'active')
                 AS active_items
          FROM orders WHERE id = ${orderId} FOR UPDATE`,
  )
  const row = res.rows[0]
  if (!row) throw new TransitionError(`Bestellung ${orderId} gibt es nicht.`)
  return {
    status: row.status as OrderStatus,
    statusBeforeDispute: (row.status_before_dispute as OrderStatus | null) ?? null,
    statusBeforeWithdrawal: (row.status_before_withdrawal as OrderStatus | null) ?? null,
    cancelReason: (row.cancel_reason as OrderCancelReason | null) ?? null,
    activeItemCount: Number(row.active_items ?? 0),
    shippedAt: isoOrNull(row.timestamps_shipped_at),
    deliveredAt: isoOrNull(row.timestamps_delivered_at),
    readyForPickupAt: isoOrNull(row.timestamps_ready_for_pickup_at),
    pickedUpAt: isoOrNull(row.timestamps_picked_up_at),
  }
}

export async function transitionOrder(
  req: PayloadRequest,
  orderId: number,
  to: OrderStatus,
  options: TransitionOrderOptions,
): Promise<TransitionOrderResult> {
  return inTransaction(req, async () => {
    const locked = await lockOrder(req, orderId)
    const from = locked.status
    if (options.expectedFrom && !options.expectedFrom.includes(from)) {
      throw new TransitionError(`Die Bestellung ist „${from}“ – dieser Schritt geht hier nicht.`)
    }
    const cancelReason =
      (options.data?.cancelReason as OrderCancelReason | undefined) ?? locked.cancelReason
    const items = options.data?.items as { status?: string | null }[] | undefined
    const result = evaluateOrderTransition(from, to, {
      ...locked,
      cancelReason,
      ...(Array.isArray(items)
        ? { activeItemCount: items.filter((i) => (i.status ?? 'active') === 'active').length }
        : {}),
    })
    if (!result.ok) throw new TransitionError(result.message)
    const order = (await preservingReq(req, () =>
      req.payload.update({
        collection: 'orders',
        id: orderId,
        data: { ...(options.data ?? {}), status: to } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: {
          ...req.context,
          system: true,
          transition: result.id,
          now: options.now.toISOString(),
          ...(options.note ? { note: options.note.slice(0, 300) } : {}),
          ...(options.actorType ? { actorType: options.actorType } : {}),
        },
      }),
    )) as Order
    return { order, from, transition: result.id }
  })
}

/** Felder einer Bestellung ohne Statuswechsel speichern (System-Kontext, gleiche Transaktion). */
export async function updateOrderFields(
  req: PayloadRequest,
  orderId: number,
  data: Record<string, unknown>,
  now: Date,
): Promise<Order> {
  return (await preservingReq(req, () =>
    req.payload.update({
      collection: 'orders',
      id: orderId,
      data: data as never,
      depth: 0,
      overrideAccess: true,
      req,
      context: { ...req.context, system: true, now: now.toISOString() },
    }),
  )) as Order
}

export async function loadOrder(req: PayloadRequest, orderId: number): Promise<Order> {
  return (await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'orders',
      id: orderId,
      depth: 0,
      overrideAccess: true,
      req,
    }),
  )) as Order
}
