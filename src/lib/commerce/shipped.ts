import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import {
  defaultCarrierFor,
  getCarrierAdapter,
  isCarrierCode,
  parseTrackingNumber,
  trackingTemplatesFromSettings,
  type CarrierCode,
} from '@/lib/carrier'
import type { SqlExecutor } from '@/lib/db/tx'
import { buildShippedMailData } from '@/lib/email/fulfillmentMailData'
import { enqueueEmail } from '@/lib/email/outbox'
import { createLogger } from '@/lib/monitoring/logger'
import { inTransaction } from '@/lib/payload/transaction'
import { addBerlinDays, berlinDayStart } from '@/lib/time'
import type { Order } from '@/payload-types'

import { loadSettings } from './packOrder'
import { shippedMailKey } from './shipOrder'
import { loadOrder, lockOrder, transitionOrder, updateOrderFields } from './transitionOrder'

// „Versendet“ (PLAN P5.16, KONZEPT §7.8, DATENMODELL §6.8.5 O10): „Zugestellt“ durch die Verwaltung
// (`deliveredSource = manual`), „Sendungsnummer korrigieren/nachtragen“ (optional mit neuer Versandmail M06 unter dem
// Schlüssel der neuen Nummer) und der Task `markDelivered`: `shipped`, deren Versandtag (Berlin) mindestens 10
// Kalendertage zurückliegt → `delivered` mit `deliveredSource = auto`, ohne Mail.

const log = createLogger()

/** O10 automatisch nach so vielen Berliner Kalendertagen ab dem Versandtag (DM-14). */
export const AUTO_DELIVERED_AFTER_DAYS = 10
export const MARK_DELIVERED_BATCH = 200

export class ShippedActionError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ShippedActionError'
  }
}

/** „Zugestellt“ (O10, manuell). Schon zugestellt → `unchanged`. */
export async function markDeliveredByAdmin(
  req: PayloadRequest,
  order: Order,
  now: Date,
): Promise<{ order: Order; unchanged: boolean }> {
  return inTransaction(req, async () => {
    const locked = await lockOrder(req, order.id)
    if (locked.status === 'delivered')
      return { order: await loadOrder(req, order.id), unchanged: true }
    if (locked.status !== 'shipped') {
      throw new ShippedActionError(409, '„Zugestellt“ geht nur bei versendeten Bestellungen.')
    }
    const current = await loadOrder(req, order.id)
    const res = await transitionOrder(req, order.id, 'delivered', {
      now,
      expectedFrom: ['shipped'],
      actorType: 'admin',
      data: { shipment: { ...(current.shipment ?? {}), deliveredSource: 'manual' } },
    })
    return { order: res.order, unchanged: false }
  })
}

export interface TrackingFixInput {
  carrier?: unknown
  trackingNumber?: unknown
  /** Antwort auf „Versandmail erneut senden?“. */
  resendMail?: unknown
}

/**
 * „Sendungsnummer korrigieren“ bzw. „nachtragen“ (`shipped`/`delivered`): neue Nummer und Link; bei `resendMail`
 * eine neue M06 mit Schlüssel `order_shipped:<id>:<neue Nummer>` (zweiter Tipp → keine zweite Mail).
 */
export async function fixTrackingNumber(
  req: PayloadRequest,
  order: Order,
  input: TrackingFixInput,
  now: Date,
): Promise<{ order: Order; unchanged: boolean; mailJobId: number | string | null }> {
  return inTransaction(req, async () => {
    const locked = await lockOrder(req, order.id)
    if (locked.status !== 'shipped' && locked.status !== 'delivered') {
      throw new ShippedActionError(
        409,
        'Die Sendungsnummer lässt sich nur bei versendeten Bestellungen ändern.',
      )
    }
    const raw = typeof input.trackingNumber === 'string' ? input.trackingNumber : ''
    const trackingNumber = parseTrackingNumber(raw)
    if (!trackingNumber) {
      throw new ShippedActionError(
        400,
        'Sendungsnummer: 8–35 Buchstaben oder Ziffern, ohne Sonderzeichen.',
      )
    }
    const current = await loadOrder(req, order.id)
    const carrier: CarrierCode = isCarrierCode(input.carrier)
      ? input.carrier
      : isCarrierCode(current.shipment?.carrier)
        ? current.shipment.carrier
        : defaultCarrierFor(current.shippingClass)
    const sameNumber =
      current.shipment?.trackingNumber === trackingNumber && current.shipment?.carrier === carrier
    let updated = current
    if (!sameNumber) {
      const settings = await loadSettings(req)
      const adapter = getCarrierAdapter(trackingTemplatesFromSettings(settings))
      const trackingUrl = adapter.trackingUrl(
        carrier,
        trackingNumber,
        current.locale === 'en' ? 'en' : 'de',
      )
      updated = await updateOrderFields(
        req,
        order.id,
        { shipment: { ...(current.shipment ?? {}), carrier, trackingNumber, trackingUrl } },
        now,
      )
    }
    let mailJobId: number | string | null = null
    if (input.resendMail === true) {
      const mail = await enqueueEmail(req, {
        template: 'order_shipped',
        to: updated.customer.email,
        locale: updated.locale,
        data: buildShippedMailData(updated) as unknown as Record<string, unknown>,
        idempotencyKey: shippedMailKey(order.id, trackingNumber),
        relations: { order: order.id },
      })
      mailJobId = mail.jobId
    }
    return { order: updated, unchanged: sameNumber && mailJobId === null, mailJobId }
  })
}

/** Grenze: Versand vor diesem Zeitpunkt (Beginn des Berliner Tages heute − 9) ⇒ 10 Kalendertage erreicht. */
export function autoDeliveredCutoff(now: Date): Date {
  return addBerlinDays(berlinDayStart(now), -(AUTO_DELIVERED_AFTER_DAYS - 1))
}

export interface MarkDeliveredResult {
  delivered: number
  errors: number
}

const sqlOf = (payload: Payload) => (payload.db as unknown as { drizzle: SqlExecutor }).drizzle

/** Task `markDelivered`: O10 automatisch (`deliveredSource = auto`), keine Mail. */
export async function markDeliveredAuto(payload: Payload, now: Date): Promise<MarkDeliveredResult> {
  const cutoff = autoDeliveredCutoff(now).toISOString()
  const due = await sqlOf(payload).execute(sql`
    SELECT id FROM orders
     WHERE status = 'shipped' AND timestamps_shipped_at < ${cutoff}::timestamptz
     ORDER BY timestamps_shipped_at LIMIT ${MARK_DELIVERED_BATCH}
  `)
  const out: MarkDeliveredResult = { delivered: 0, errors: 0 }
  for (const row of due.rows) {
    const orderId = Number(row.id)
    try {
      const req = await createLocalReq(
        { context: { system: true, now: now.toISOString() } },
        payload,
      )
      await inTransaction(req, async () => {
        const locked = await lockOrder(req, orderId)
        if (locked.status !== 'shipped') return
        const current = await loadOrder(req, orderId)
        await transitionOrder(req, orderId, 'delivered', {
          now,
          expectedFrom: ['shipped'],
          actorType: 'job',
          data: { shipment: { ...(current.shipment ?? {}), deliveredSource: 'auto' } },
        })
        out.delivered += 1
      })
    } catch (err) {
      out.errors += 1
      log.error('orders.mark_delivered_failed', { orderId, reason: (err as Error)?.message })
    }
  }
  return out
}
