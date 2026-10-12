import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

import { dbFor } from '@/lib/db/tx'
import type { Withdrawal } from '@/payload-types'

// Teil-Widerruf nur im Freitext (KONZEPT §5.4 W1 Umsetzungsnotiz, DATENMODELL §6.11): Nennt die Person Stücke nur im
// Feld „Nur bestimmte Stücke?“ und hakt keins an, bucht W1 keine Position automatisch – nach § 133 BGB gilt der
// erklärte Teil-Widerruf, welche Stücke gemeint sind, entscheidet Jutta im Posteingang („Stücke zuordnen“). Bis dahin
// sind Packen, Versand und Übergabe der Bestellung gesperrt; „Ware ist zurück“ und die Erstattung mit Grund
// `withdrawal` ebenfalls (sonst wäre unklar, welche Stücke dazugehören).

/** Notiz am Hinweis `adminAttention` der Bestellung (≤ 500 Zeichen). */
export const itemsUnassignedNote = (reference: string) =>
  `Teil-Widerruf ${reference} im Freitext – bitte Stücke zuordnen`

/** Meldung, wenn eine Aktion wegen eines noch nicht zugeordneten Teil-Widerrufs gesperrt ist. */
export const itemsUnassignedMessage = (reference: string) =>
  `Erst die Stücke zuordnen: Widerruf ${reference} nennt Stücke nur im Freitext (Widerrufe → ${reference} → „Stücke zuordnen“).`

type WithdrawalLike = Pick<Withdrawal, 'order' | 'status' | 'affectedItemIds' | 'itemsText'>

const ownIds = (w: Pick<Withdrawal, 'affectedItemIds'>): string[] =>
  Array.isArray(w.affectedItemIds) ? (w.affectedItemIds as unknown[]).map(String) : []

/** Zugeordneter, offener Widerruf, dessen Stücke nur im Freitext stehen und noch nicht zugeordnet sind. */
export function withdrawalNeedsItems(w: WithdrawalLike): boolean {
  return (
    w.order !== null &&
    w.order !== undefined &&
    w.status === 'received' &&
    ownIds(w).length === 0 &&
    !!w.itemsText?.trim()
  )
}

/** Je Bestellung die Vorgangsnummer des ältesten solchen Widerrufs (für Listen in einer Abfrage). */
export async function unassignedWithdrawals(
  req: PayloadRequest,
  orderIds: readonly number[],
): Promise<Map<number, string>> {
  const out = new Map<number, string>()
  const ids = [...new Set(orderIds)].filter((id) => Number.isSafeInteger(id) && id > 0)
  if (ids.length === 0) return out
  const db = await dbFor(req)
  const res = await db.execute(sql`
    SELECT order_id, reference FROM withdrawals
     WHERE order_id IN (${sql.join(
       ids.map((id) => sql`${id}`),
       sql`, `,
     )})
       AND status = 'received'
       AND btrim(coalesce(items_text, '')) <> ''
       AND (affected_item_ids IS NULL
            OR jsonb_typeof(affected_item_ids) <> 'array'
            OR jsonb_array_length(affected_item_ids) = 0)
     ORDER BY received_at, id
  `)
  for (const row of res.rows) {
    const orderId = Number(row.order_id)
    if (!out.has(orderId)) out.set(orderId, String(row.reference))
  }
  return out
}

/** Vorgangsnummer eines noch nicht zugeordneten Teil-Widerrufs der Bestellung oder `null`. */
export async function unassignedWithdrawalOf(
  req: PayloadRequest,
  orderId: number,
): Promise<string | null> {
  return (await unassignedWithdrawals(req, [orderId])).get(orderId) ?? null
}

/**
 * Ist der Hinweis an der Bestellung der „Stücke zuordnen“-Hinweis eines noch offenen Teil-Widerrufs? Den setzt das
 * System (Grund `manual`, Notiz `itemsUnassignedNote`) und nimmt ihn beim Zuordnen selbst wieder weg – „Erledigt“
 * (V-31) darf ihn nicht vorher löschen. `unassignedRef` = Ergebnis von `unassignedWithdrawalOf`.
 */
export function isUnassignedWithdrawalHint(
  attention: { flag?: boolean | null; reason?: string | null; note?: string | null } | null,
  unassignedRef: string | null,
): boolean {
  return (
    !!attention?.flag &&
    attention.reason === 'manual' &&
    unassignedRef !== null &&
    attention.note === itemsUnassignedNote(unassignedRef)
  )
}
