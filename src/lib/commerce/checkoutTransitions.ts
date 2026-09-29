import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

import { dbFor } from '@/lib/db/tx'
import type { CheckoutCloseReason, CheckoutStatus } from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import type { Checkout } from '@/payload-types'

import { TransitionError } from './transitionError'

// Statusautomat der Kasse (DATENMODELL §6.25.3, KONZEPT §5.2): Tabelle, Prüfung und `transitionCheckout()` – der
// einzige Weg für Statuswechsel. Die Services mit Nebenwirkungen (`startCheckout`, `cancelCheckout`,
// `releaseReservation` in P4.6; `submitCheckout`, `fulfillCheckout` später) rufen ihn auf.

/** Erlaubte Übergänge; alle anderen werden abgelehnt. Anlage immer mit `open`. */
export const CHECKOUT_TRANSITIONS: Readonly<Record<CheckoutStatus, readonly CheckoutStatus[]>> = {
  open: ['confirming', 'completed', 'expired', 'cancelled'],
  confirming: ['open', 'completed', 'expired', 'failed'],
  completed: [],
  expired: [],
  cancelled: [],
  failed: [],
}

export const CHECKOUT_INITIAL_STATUS: CheckoutStatus = 'open'

/** Zeitstempel je Zielstatus (`timestamps.*`). */
export const CHECKOUT_TIMESTAMP_FIELD: Readonly<Partial<Record<CheckoutStatus, string>>> = {
  confirming: 'confirmingAt',
  completed: 'completedAt',
  expired: 'expiredAt',
  cancelled: 'cancelledAt',
  failed: 'failedAt',
}

/** Zielstatus, bei denen `closeReason` Pflicht ist. */
export const CHECKOUT_CLOSE_REASON_REQUIRED: ReadonlySet<CheckoutStatus> = new Set([
  'expired',
  'cancelled',
  'failed',
])

export function canTransitionCheckout(from: CheckoutStatus, to: CheckoutStatus): boolean {
  return CHECKOUT_TRANSITIONS[from]?.includes(to) ?? false
}

/** Wirft `TransitionError`, wenn `from → to` nicht erlaubt ist. */
export function assertCheckoutTransition(from: CheckoutStatus, to: CheckoutStatus): void {
  if (!canTransitionCheckout(from, to)) {
    throw new TransitionError(`Die Kasse kann nicht von „${from}“ nach „${to}“ wechseln.`)
  }
}

export interface TransitionCheckoutOptions {
  /** Pflicht bei `expired`, `cancelled`, `failed`. */
  closeReason?: CheckoutCloseReason
  /** Injizierte Zeit (A-08) für `timestamps.*`. */
  now: Date
  /** Weitere Felder, die im selben Schritt gespeichert werden (z. B. Eingaben beim Absenden). */
  data?: Record<string, unknown>
}

/**
 * Einziger Weg für einen Statuswechsel der Kasse (DATENMODELL §6.25.3): sperrt die Zeile (`FOR UPDATE`) in der
 * Transaktion von `req`, prüft den Übergang und speichert mit `context.transition` (der Speicher-Hook setzt den
 * Zeitstempel). Nebenwirkungen (Freigabe, Bestellung) bleiben Sache des Aufrufers in derselben Transaktion.
 */
export async function transitionCheckout(
  req: PayloadRequest,
  checkoutId: number,
  to: CheckoutStatus,
  options: TransitionCheckoutOptions,
): Promise<Checkout> {
  return inTransaction(req, async () => {
    const db = await dbFor(req)
    const locked = await db.execute(
      sql`SELECT status FROM checkouts WHERE id = ${checkoutId} FOR UPDATE`,
    )
    const from = locked.rows[0]?.status as CheckoutStatus | undefined
    if (!from) throw new TransitionError(`Kasse ${checkoutId} gibt es nicht.`)
    assertCheckoutTransition(from, to)
    if (CHECKOUT_CLOSE_REASON_REQUIRED.has(to) && !options.closeReason) {
      throw new TransitionError('Bitte den Grund angeben, warum die Kasse endet.')
    }
    const field = CHECKOUT_TIMESTAMP_FIELD[to]
    return preservingReq(req, () =>
      req.payload.update({
        collection: 'checkouts',
        id: checkoutId,
        data: {
          ...(options.data ?? {}),
          status: to,
          ...(options.closeReason ? { closeReason: options.closeReason } : {}),
          ...(field ? { timestamps: { [field]: options.now.toISOString() } } : {}),
        } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: {
          ...req.context,
          system: true,
          transition: `checkout:${to}`,
          now: options.now.toISOString(),
        },
      }),
    ) as Promise<Checkout>
  })
}
