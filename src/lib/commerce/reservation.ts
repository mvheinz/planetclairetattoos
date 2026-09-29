import 'server-only'

import config from '@payload-config'
import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, getPayload, type Payload } from 'payload'

import { revalidateProduct } from '@/lib/cache/revalidate'
import { dbFor, type SqlExecutor } from '@/lib/db/tx'
import type {
  CheckoutCloseReason,
  CheckoutStatus,
  ReservationReleaseReason,
} from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { inTransaction } from '@/lib/payload/transaction'
import { getPaymentsAdapter, type PaymentsAdapter } from '@/lib/payments'
import type { Checkout } from '@/payload-types'

import { canTransitionCheckout, transitionCheckout } from './checkoutTransitions'

// Reservierung und Freigabe (DATENMODELL §8.1/§8.2, KONZEPT §4.6, E-22). Das atomare SQL ist die einzige Stelle, an
// der ein Stück `reserved` wird: `UPDATE … WHERE status = 'available' … RETURNING id` in der Transaktion des Aufrufers –
// weniger Zeilen als angefragt ⇒ `ReservationConflictError` und Rollback (keine Teilreservierung). Die Freigabe beendet
// vorher die Zahlungs-Session beim Anbieter; meldet er „bezahlt“, wird nichts freigegeben (die Übergabe an
// `fulfillCheckout` verdrahtet P4.16a). Uhr immer injiziert (A-08).

const log = createLogger()

/** Mindestens ein Stück war nicht (mehr) `available` – Transaktion zurückgerollt. */
export class ReservationConflictError extends Error {
  constructor(readonly productIds: number[]) {
    super(`Gerade reserviert oder nicht mehr frei: ${productIds.join(', ')}`)
    this.name = 'ReservationConflictError'
  }
}

export interface ReserveInput {
  productIds: readonly number[]
  /** = `checkouts.reservationRef` (UUID v4). */
  ref: string
  checkoutId: number
  expiresAt: Date
  displayExpiresAt: Date
  now: Date
}

/** `'{1,2,3}'::int[]` aus geprüften Ganzzahlen (Drizzle würde ein Array als Werteliste einsetzen). */
export function intArray(ids: readonly number[]) {
  for (const id of ids) {
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`Ungültige Stück-ID: ${id}`)
  }
  return sql.raw(`'{${ids.join(',')}}'::int[]`)
}

/** SQLSTATE 23505 (UNIQUE) – zweite Sicherung über `reservations_one_active_per_product`. */
function isUniqueViolation(err: unknown): boolean {
  for (let e: unknown = err, i = 0; e && i < 5; i++) {
    if ((e as { code?: unknown }).code === '23505') return true
    e = (e as { cause?: unknown }).cause
  }
  return false
}

/**
 * DATENMODELL §8.1: atomares Reservieren aller Stücke in der Transaktion von `db` plus je Stück eine Reservierung
 * (`source = checkout_session`). Wirft `ReservationConflictError` mit den nicht reservierbaren IDs.
 */
export async function reserveProducts(db: SqlExecutor, input: ReserveInput): Promise<number[]> {
  const ids = [...new Set(input.productIds)]
  if (ids.length === 0) throw new Error('Keine Stücke zum Reservieren.')
  const idList = intArray(ids)
  const now = input.now.toISOString()
  const expires = input.expiresAt.toISOString()
  const display = input.displayExpiresAt.toISOString()
  const updated = await db.execute(sql`
    UPDATE products
       SET status = 'reserved', reserved_until = ${expires}::timestamptz, reservation_ref = ${input.ref},
           updated_at = ${now}::timestamptz
     WHERE id = ANY(${idList})
       AND status = 'available'
       AND is_custom_commission IS NOT TRUE
    RETURNING id
  `)
  const got = new Set(updated.rows.map((r) => Number(r.id)))
  if (got.size < ids.length) throw new ReservationConflictError(ids.filter((id) => !got.has(id)))
  try {
    await db.execute(sql`
      INSERT INTO reservations (ref, checkout_id, product_id, source, status, expires_at, display_expires_at, seed,
                                created_at, updated_at)
      SELECT ${input.ref}, ${input.checkoutId}, unnest(${idList}),
             'checkout_session'::enum_reservations_source, 'active'::enum_reservations_status,
             ${expires}::timestamptz, ${display}::timestamptz, false, ${now}::timestamptz, ${now}::timestamptz
    `)
  } catch (err) {
    if (isUniqueViolation(err)) throw new ReservationConflictError(ids)
    throw err
  }
  return ids
}

export interface ReleaseOptions {
  payload?: Payload
  payments?: PaymentsAdapter
  /** `closeReason` der Kasse, falls abweichend vom Standard des Freigabegrunds (z. B. `replaced`). */
  closeReason?: CheckoutCloseReason
  /** Kontext `inServerAction` für die Cache-Erneuerung. */
  inServerAction?: boolean
}

export type ReleaseOutcome =
  | { status: 'released'; productIds: number[]; checkoutId: number | null }
  /** Der Anbieter meldet „bezahlt“ – keine Freigabe; `fulfillCheckout` übernimmt (P4.16a). */
  | { status: 'paid'; checkoutId: number }
  /** Zahlung abgeschlossen, aber noch nicht bestätigt – keine Freigabe. */
  | { status: 'payment_pending'; checkoutId: number }
  /** Anbieter nicht erreichbar – vorsichtshalber keine Freigabe (eine Zahlung könnte laufen). */
  | { status: 'provider_error'; checkoutId: number }

/** Zielstatus der Kasse je Freigabegrund (DATENMODELL §6.25.3); `null` = Kasse bleibt (z. B. Vorkasse `completed`). */
export const CHECKOUT_END_BY_RELEASE: Readonly<
  Record<ReservationReleaseReason, { to: CheckoutStatus; closeReason: CheckoutCloseReason } | null>
> = {
  session_expired: { to: 'expired', closeReason: 'reservation_expired' },
  payment_failed: { to: 'failed', closeReason: 'payment_failed' },
  customer_cancelled: { to: 'cancelled', closeReason: 'cart_changed' },
  checkout_error: { to: 'cancelled', closeReason: 'checkout_error' },
  admin: { to: 'cancelled', closeReason: 'sold_offline' },
  prepayment_overdue: null,
  order_cancelled: null,
}

const LIVE_STATES: ReadonlySet<CheckoutStatus> = new Set(['open', 'confirming'])

async function checkoutByRef(payload: Payload, ref: string): Promise<Checkout | null> {
  const res = await payload.find({
    collection: 'checkouts',
    where: { reservationRef: { equals: ref } },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })
  return (res.docs[0] as Checkout | undefined) ?? null
}

/**
 * Freigabe nach DATENMODELL §8.2 für alle aktiven Reservierungen mit `ref`: vorher Session beim Anbieter beenden
 * (bei „bezahlt“ keine Freigabe), dann in einer Transaktion Stücke `available`, Reservierungen `released` und – sofern
 * noch offen – die Kasse nach `expired`/`cancelled`/`failed` (über `transitionCheckout`). Nach dem Commit werden die
 * Stückseiten sofort erneuert.
 */
export async function releaseReservation(
  ref: string,
  reason: ReservationReleaseReason,
  now: Date,
  options: ReleaseOptions = {},
): Promise<ReleaseOutcome> {
  const payload = options.payload ?? (await getPayload({ config }))
  const checkout = await checkoutByRef(payload, ref)
  const checkoutId = checkout ? (checkout.id as number) : null
  const live = checkout !== null && LIVE_STATES.has(checkout.status)
  const sessionId = checkout?.stripe?.checkoutSessionId

  if (checkoutId !== null && live && sessionId) {
    const payments = options.payments ?? getPaymentsAdapter()
    try {
      const result = await payments.expireCheckoutSession(sessionId)
      if (result === 'already_complete_paid') {
        // P4.16a: hier `fulfillCheckout` aufrufen. Bis dahin bleibt alles reserviert.
        log.info('reservation.release_skipped_paid', { checkoutId, reason })
        return { status: 'paid', checkoutId }
      }
      if (result === 'already_complete_unpaid') {
        log.info('reservation.release_skipped_pending', { checkoutId, reason })
        return { status: 'payment_pending', checkoutId }
      }
    } catch (err) {
      log.warn('reservation.release_provider_error', {
        checkoutId,
        reason,
        error: (err as Error)?.message,
      })
      return { status: 'provider_error', checkoutId }
    }
  }

  const end = CHECKOUT_END_BY_RELEASE[reason]
  const req = await createLocalReq({ context: { system: true, now: now.toISOString() } }, payload)
  const productIds = await inTransaction(req, async () => {
    const db = await dbFor(req)
    const at = now.toISOString()
    const freed = await db.execute(sql`
      UPDATE products
         SET status = 'available', reserved_until = NULL, reservation_ref = NULL, current_order_id = NULL,
             updated_at = ${at}::timestamptz
       WHERE reservation_ref = ${ref} AND status = 'reserved'
      RETURNING id
    `)
    await db.execute(sql`
      UPDATE reservations
         SET status = 'released', released_at = ${at}::timestamptz,
             release_reason = ${reason}::enum_reservations_release_reason, updated_at = ${at}::timestamptz
       WHERE ref = ${ref} AND status = 'active'
    `)
    if (checkoutId !== null && end) {
      const current = await db.execute(
        sql`SELECT status FROM checkouts WHERE id = ${checkoutId} FOR UPDATE`,
      )
      const from = current.rows[0]?.status as CheckoutStatus | undefined
      if (from && canTransitionCheckout(from, end.to)) {
        await transitionCheckout(req, checkoutId, end.to, {
          closeReason: options.closeReason ?? end.closeReason,
          now,
        })
      }
    }
    return freed.rows.map((r) => Number(r.id))
  })
  for (const id of productIds) {
    revalidateProduct(id, { immediate: true, inServerAction: options.inServerAction })
  }
  if (productIds.length > 0) log.info('reservation.released', { checkoutId, reason, productIds })
  return { status: 'released', productIds, checkoutId }
}

/**
 * „Lazy release“ (DATENMODELL §8.1, ARCHITEKTUR §9.6): abgelaufene Kassen-Reservierungen (`reserved_until < now`,
 * `source = checkout_session`) der angefragten Stücke vor einem neuen Kassenstart freigeben. Liefert je Referenz das
 * Ergebnis; nicht freigegebene Stücke (bezahlt, Anbieter nicht erreichbar) bleiben reserviert.
 */
export async function releaseExpiredFor(
  productIds: readonly number[],
  now: Date,
  options: ReleaseOptions = {},
): Promise<ReleaseOutcome[]> {
  if (productIds.length === 0) return []
  const payload = options.payload ?? (await getPayload({ config }))
  const idList = intArray(productIds)
  const db = (payload.db as unknown as { drizzle: SqlExecutor }).drizzle
  const res = await db.execute(sql`
    SELECT DISTINCT r.ref
      FROM products p
      JOIN reservations r ON r.product_id = p.id AND r.status = 'active' AND r.ref = p.reservation_ref
     WHERE p.id = ANY(${idList})
       AND p.status = 'reserved'
       AND p.reserved_until < ${now.toISOString()}::timestamptz
       AND r.source = 'checkout_session'
  `)
  const out: ReleaseOutcome[] = []
  for (const row of res.rows) {
    out.push(await releaseReservation(String(row.ref), 'session_expired', now, options))
  }
  return out
}
