import 'server-only'

import type { PayloadRequest } from 'payload'

import { loadOrder, transitionOrder, updateOrderFields } from '@/lib/commerce/transitionOrder'
import type { WithdrawalCloseReason, WithdrawalStatus } from '@/lib/enums'
import { WITHDRAWAL_CLOSE_REASONS } from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import type { Order, Withdrawal } from '@/payload-types'

import { applyWithdrawalToOrder } from './withdrawal'

// Aktionen im Widerrufs-Posteingang `/widerrufe/:id` (PLAN P6.9, KONZEPT §5.4/§7.10, R-094, DATENMODELL §6.11):
// W2 „Bestellung zuordnen“ (O11 bzw. O4 + W5), W3 „Ware ist zurück“ (O12), „Rücksendenachweis liegt vor“,
// W5 „Ohne Erstattung abschließen“ (O20 nur ohne weiteren offenen Widerruf derselben Bestellung), W7 „Ablehnen“ und
// „Als Test/Spam markieren“ (beide nur manuell, mit Begründung). Jede Aktion läuft in der Transaktion von `req`
// (Verwaltung: `req.user` gesetzt); der Speicher-Hook prüft Übergänge, unveränderliche Felder und schreibt Audit.
// Nie automatisch ablehnen.

/** Abgelehnte Aktion mit HTTP-Status (400 Eingabe, 404 unbekannt, 409 Zustand). */
export class WithdrawalActionError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'WithdrawalActionError'
  }
}

/** Offen für O20 (DATENMODELL §6.8.5): solange einer davon existiert, bleibt die Bestellung `withdrawal_received`. */
export const WITHDRAWAL_OPEN_FOR_ORDER: readonly WithdrawalStatus[] = [
  'received',
  'goods_returned',
  'partially_refunded',
]

export interface WithdrawalActionResult {
  doc: Withdrawal
  unchanged?: boolean
  afterCommit?: () => Promise<void>
}

const idOf = (v: unknown): number | null =>
  v === null || v === undefined
    ? null
    : typeof v === 'object'
      ? (v as { id: number }).id
      : Number(v)

const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

export async function loadWithdrawal(req: PayloadRequest, id: number): Promise<Withdrawal> {
  const doc = (await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'withdrawals',
      id,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )) as Withdrawal | null
  if (!doc) throw new WithdrawalActionError(404, 'Unbekannter Widerruf.')
  return doc
}

async function saveWithdrawal(
  req: PayloadRequest,
  id: number,
  data: Record<string, unknown>,
  now: Date,
  transition?: string,
): Promise<Withdrawal> {
  return (await preservingReq(req, () =>
    req.payload.update({
      collection: 'withdrawals',
      id,
      data: data as never,
      depth: 0,
      overrideAccess: true,
      req,
      context: {
        ...req.context,
        now: now.toISOString(),
        ...(transition ? { transition } : {}),
      },
    }),
  )) as Withdrawal
}

const requireStatus = (w: Withdrawal, allowed: readonly WithdrawalStatus[], what: string) => {
  if (!allowed.includes(w.status)) {
    throw new WithdrawalActionError(
      409,
      `„${what}“ geht bei diesem Widerruf nicht mehr (Status „${w.status}“).`,
    )
  }
}

/** Bestellungen für „Bestellung zuordnen“: Suche nach Nummer, E-Mail oder Name (höchstens 10 Treffer). */
export async function searchOrdersForWithdrawal(
  req: PayloadRequest,
  query: string,
): Promise<{ id: number; orderNumber: string; name: string; email: string; status: string }[]> {
  const q = query.trim().slice(0, 100)
  if (q.length < 2) return []
  const res = await req.payload.find({
    collection: 'orders',
    where: {
      or: [
        { orderNumber: { like: q } },
        { 'customer.email': { like: q } },
        { 'customer.name': { like: q } },
      ],
    },
    sort: '-createdAt',
    limit: 10,
    depth: 0,
    select: { orderNumber: true, customer: true, status: true },
    overrideAccess: true,
    req,
  })
  return (res.docs as Pick<Order, 'id' | 'orderNumber' | 'customer' | 'status'>[]).map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    name: o.customer?.name ?? '',
    email: o.customer?.email ?? '',
    status: o.status,
  }))
}

/** W2: Bestellung zuordnen (Status des Widerrufs bleibt), danach O11 bzw. bei offener Vorkasse O4 + W5. */
export async function matchWithdrawalOrder(
  req: PayloadRequest,
  id: number,
  input: { orderId: unknown; itemIds?: unknown },
  now: Date,
): Promise<WithdrawalActionResult> {
  return inTransaction(req, async () => {
    const w = await loadWithdrawal(req, id)
    const orderId = Number(input.orderId)
    if (!Number.isSafeInteger(orderId) || orderId < 1) {
      throw new WithdrawalActionError(400, 'Bitte eine Bestellung wählen.')
    }
    if (idOf(w.order) === orderId) return { doc: w, unchanged: true }
    if (idOf(w.order) !== null) {
      throw new WithdrawalActionError(409, 'Der Widerruf ist schon einer Bestellung zugeordnet.')
    }
    requireStatus(w, ['received'], 'Bestellung zuordnen')
    const order = await loadOrder(req, orderId).catch(() => null)
    if (!order) throw new WithdrawalActionError(404, 'Unbekannte Bestellung.')
    const known = new Set(order.items.map((i) => i.id))
    const itemIds = (Array.isArray(input.itemIds) ? input.itemIds : [])
      .map(String)
      .filter((i) => known.has(i))
    const matched = await saveWithdrawal(req, id, { order: orderId }, now)
    const effect = await applyWithdrawalToOrder(req, matched, orderId, itemIds, now)
    return { doc: await loadWithdrawal(req, id), afterCommit: effect.afterCommit }
  })
}

/** W3/O12: Ware ist zurück (Zustandsnotiz, optional Fotos `return_photo` an der Bestellung). */
export async function markGoodsReturned(
  req: PayloadRequest,
  id: number,
  input: { note?: unknown; photoIds?: unknown },
  now: Date,
): Promise<WithdrawalActionResult> {
  return inTransaction(req, async () => {
    const w = await loadWithdrawal(req, id)
    if (w.status === 'goods_returned') return { doc: w, unchanged: true }
    requireStatus(w, ['received'], 'Ware ist zurück')
    const note = text(input.note, 500)
    const photoIds = (Array.isArray(input.photoIds) ? input.photoIds : [])
      .map(Number)
      .filter((n) => Number.isSafeInteger(n) && n > 0)
      .slice(0, 6)
    const doc = await saveWithdrawal(
      req,
      id,
      { status: 'goods_returned', returnConditionNote: note || null },
      now,
      'W3',
    )
    const orderId = idOf(w.order)
    if (orderId !== null) {
      const order = await loadOrder(req, orderId)
      const own = new Set(
        Array.isArray(w.affectedItemIds) ? (w.affectedItemIds as unknown[]).map(String) : [],
      )
      const items = order.items.map((i) =>
        i.status === 'withdrawn' && (own.size === 0 || own.has(String(i.id)))
          ? { ...i, status: 'returned' as const }
          : i,
      )
      const photos = [
        ...new Set([...(order.returnPhotos ?? []).map((p) => idOf(p)!), ...photoIds]),
      ].slice(0, 6)
      const data = { items, ...(photoIds.length > 0 ? { returnPhotos: photos } : {}) }
      if (order.status === 'withdrawal_received') {
        await transitionOrder(req, orderId, 'return_received', {
          now,
          note: `Ware zurück (${w.reference})${note ? `: ${note}` : ''}`,
          data,
        })
      } else {
        await updateOrderFields(req, orderId, data, now)
      }
    }
    return { doc }
  })
}

/** „Rücksendenachweis liegt vor“ (beendet das Zurückbehaltungsrecht, § 357 Abs. 4 BGB). */
export async function markReturnProof(
  req: PayloadRequest,
  id: number,
  now: Date,
): Promise<WithdrawalActionResult> {
  return inTransaction(req, async () => {
    const w = await loadWithdrawal(req, id)
    if (w.returnProofReceivedAt) return { doc: w, unchanged: true }
    requireStatus(w, ['received', 'goods_returned'], 'Rücksendenachweis liegt vor')
    return { doc: await saveWithdrawal(req, id, { returnProofReceivedAt: now.toISOString() }, now) }
  })
}

/** Anzahl anderer offener Widerrufe derselben Bestellung (für O20). */
async function otherOpenWithdrawals(req: PayloadRequest, orderId: number, exceptId: number) {
  const res = await req.payload.count({
    collection: 'withdrawals',
    where: {
      and: [
        { order: { equals: orderId } },
        { id: { not_equals: exceptId } },
        { status: { in: [...WITHDRAWAL_OPEN_FOR_ORDER] } },
      ],
    },
    overrideAccess: true,
    req,
  })
  return res.totalDocs
}

/**
 * W5 „Ohne Erstattung abschließen“ (`closeReason` Pflicht, bei `other` mit `closeNote`). Zugeordnete, nicht stornierte
 * Bestellung: Positionen dieses Widerrufs wieder `active`; O20 auf `statusBeforeWithdrawal` nur, wenn kein anderer
 * Widerruf derselben Bestellung offen ist.
 */
export async function closeWithoutRefund(
  req: PayloadRequest,
  id: number,
  input: { closeReason?: unknown; closeNote?: unknown },
  now: Date,
): Promise<WithdrawalActionResult> {
  return inTransaction(req, async () => {
    const w = await loadWithdrawal(req, id)
    if (w.status === 'closed') return { doc: w, unchanged: true }
    requireStatus(
      w,
      ['received', 'goods_returned', 'partially_refunded'],
      'Ohne Erstattung abschließen',
    )
    const reason = input.closeReason as WithdrawalCloseReason
    if (
      !(WITHDRAWAL_CLOSE_REASONS as readonly string[]).includes(reason) ||
      reason === 'unpaid_order_cancelled'
    ) {
      throw new WithdrawalActionError(400, 'Bitte einen Grund wählen.')
    }
    const note = text(input.closeNote, 300)
    if (reason === 'other' && note.length < 10) {
      throw new WithdrawalActionError(400, 'Bitte begründen (10–300 Zeichen).')
    }
    const doc = await saveWithdrawal(
      req,
      id,
      { status: 'closed', closeReason: reason, closeNote: note || null },
      now,
      'W5',
    )
    const orderId = idOf(w.order)
    if (orderId !== null) {
      const order = await loadOrder(req, orderId)
      if (order.status !== 'cancelled') {
        const own = new Set(
          Array.isArray(w.affectedItemIds) ? (w.affectedItemIds as unknown[]).map(String) : [],
        )
        const items = order.items.map((i) =>
          (i.status === 'withdrawn' || i.status === 'returned') && own.has(String(i.id))
            ? { ...i, status: 'active' as const }
            : i,
        )
        const others = await otherOpenWithdrawals(req, orderId, id)
        const back = order.statusBeforeWithdrawal
        if (
          others === 0 &&
          (order.status === 'withdrawal_received' || order.status === 'return_received') &&
          back
        ) {
          if (order.status === 'withdrawal_received') {
            await transitionOrder(req, orderId, back, {
              now,
              note: `Widerruf ${w.reference} ohne Erstattung abgeschlossen`,
              data: { items },
            })
          } else {
            // `return_received` hat keinen Rückweg (O20 nur aus `withdrawal_received`): nur Positionen anpassen
            await updateOrderFields(req, orderId, { items }, now)
          }
        } else {
          await updateOrderFields(req, orderId, { items }, now)
        }
      }
    }
    return { doc }
  })
}

/** W7 „Ablehnen“ – nur manuell aus `received`, Begründung Pflicht (nie automatisch, R-094). */
export async function rejectWithdrawal(
  req: PayloadRequest,
  id: number,
  input: { closeNote?: unknown },
  now: Date,
): Promise<WithdrawalActionResult> {
  return inTransaction(req, async () => {
    const w = await loadWithdrawal(req, id)
    if (w.status === 'rejected') return { doc: w, unchanged: true }
    requireStatus(w, ['received'], 'Ablehnen')
    if (req.user?.collection !== 'users') {
      throw new WithdrawalActionError(403, 'Ablehnen nur durch dich – nie automatisch.')
    }
    const note = text(input.closeNote, 300)
    if (note.length < 10) throw new WithdrawalActionError(400, 'Bitte begründen (10–300 Zeichen).')
    const doc = await saveWithdrawal(req, id, { status: 'rejected', closeNote: note }, now, 'W7')
    await restoreOrderAfterEnd(req, w, now)
    return { doc }
  })
}

/** „Als Test/Spam markieren“: W7 mit `spam.markedAt`/`spam.reason` (Löschung 30 Tage danach, L-08). */
export async function markWithdrawalSpam(
  req: PayloadRequest,
  id: number,
  input: { reason?: unknown },
  now: Date,
): Promise<WithdrawalActionResult> {
  return inTransaction(req, async () => {
    const w = await loadWithdrawal(req, id)
    if (w.spam?.markedAt) return { doc: w, unchanged: true }
    requireStatus(w, ['received'], 'Als Test/Spam markieren')
    if (req.user?.collection !== 'users') {
      throw new WithdrawalActionError(403, 'Markieren nur durch dich – nie automatisch.')
    }
    const reason = text(input.reason, 300)
    if (reason.length < 10)
      throw new WithdrawalActionError(400, 'Bitte begründen (10–300 Zeichen).')
    const doc = await saveWithdrawal(
      req,
      id,
      {
        status: 'rejected',
        closeNote: reason,
        spam: { markedAt: now.toISOString(), reason },
      },
      now,
      'W7',
    )
    await restoreOrderAfterEnd(req, w, now)
    return { doc }
  })
}

/**
 * Nach W7 einer zugeordneten Bestellung: wie bei O20 Positionen dieses Widerrufs zurück auf `active` und – ohne
 * weiteren offenen Widerruf – Bestellung auf `statusBeforeWithdrawal` (sonst bliebe sie ohne Ausweg
 * `withdrawal_received`).
 */
async function restoreOrderAfterEnd(req: PayloadRequest, w: Withdrawal, now: Date) {
  const orderId = idOf(w.order)
  if (orderId === null) return
  const order = await loadOrder(req, orderId)
  const own = new Set(
    Array.isArray(w.affectedItemIds) ? (w.affectedItemIds as unknown[]).map(String) : [],
  )
  const items = order.items.map((i) =>
    i.status === 'withdrawn' && own.has(String(i.id)) ? { ...i, status: 'active' as const } : i,
  )
  const back = order.statusBeforeWithdrawal
  if (
    order.status === 'withdrawal_received' &&
    back &&
    (await otherOpenWithdrawals(req, orderId, w.id)) === 0
  ) {
    await transitionOrder(req, orderId, back, {
      now,
      note: `Widerruf ${w.reference} abgelehnt`,
      data: { items },
    })
  } else if (order.status !== 'cancelled') {
    await updateOrderFields(req, orderId, { items }, now)
  }
}
