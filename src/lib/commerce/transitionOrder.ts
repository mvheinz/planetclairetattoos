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

export async function lockOrder(
  req: PayloadRequest,
  orderId: number,
): Promise<{
  status: OrderStatus
  statusBeforeDispute: OrderStatus | null
  statusBeforeWithdrawal: OrderStatus | null
  cancelReason: OrderCancelReason | null
}> {
  const db = await dbFor(req)
  const res = await db.execute(
    sql`SELECT status, status_before_dispute, status_before_withdrawal, cancel_reason FROM orders WHERE id = ${orderId} FOR UPDATE`,
  )
  const row = res.rows[0]
  if (!row) throw new TransitionError(`Bestellung ${orderId} gibt es nicht.`)
  return {
    status: row.status as OrderStatus,
    statusBeforeDispute: (row.status_before_dispute as OrderStatus | null) ?? null,
    statusBeforeWithdrawal: (row.status_before_withdrawal as OrderStatus | null) ?? null,
    cancelReason: (row.cancel_reason as OrderCancelReason | null) ?? null,
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
    const result = evaluateOrderTransition(from, to, {
      statusBeforeDispute: locked.statusBeforeDispute,
      statusBeforeWithdrawal: locked.statusBeforeWithdrawal,
      cancelReason,
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
