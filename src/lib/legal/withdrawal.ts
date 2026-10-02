import 'server-only'

import config from '@payload-config'
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { z } from 'zod'

import { cancelPrepaymentOrder } from '@/lib/commerce/prepayment'
import { ORDER_TRANSITIONS } from '@/lib/commerce/orderTransitions'
import { loadOrder, transitionOrder, updateOrderFields } from '@/lib/commerce/transitionOrder'
import { notifyAdmin } from '@/lib/email/notifyAdmin'
import { enqueueEmail, runEmailJobNow } from '@/lib/email/outbox'
import { LOCALES, type Locale, type WithdrawalMatchStatus } from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import { ipHash } from '@/lib/security/ipHash'
import { hit, retryAfterSeconds } from '@/lib/security/rateLimit'
import { formatBerlinWithZone } from '@/lib/time'
import type { Order, Withdrawal } from '@/payload-types'

// Widerrufs-Dienst (PLAN P6.7, KONZEPT §5.4 W1, R-093, DATENMODELL §6.11): nimmt die über „Widerruf bestätigen“
// abgegebene Erklärung an.
// 1. Honeypot (`website`) gefüllt → Schein-Erfolg (200), nichts gespeichert, keine Mail (R-134; keine Mindestzeit).
// 2. Rate-Limit `withdrawal_submit` 30/h je IP-Hash – nur in `rate_limit_hits`, nie am Datensatz (ARCHITEKTUR §8.5).
// 3. zod-Prüfung; dann in **einer** Transaktion: unveränderlicher Datensatz (`WR-JJJJ-NNNNN` aus
//    `withdrawal_number_seq`, `receivedAt` = Serverzeit der injizierten Uhr, `submissionSnapshot`, `refundDueAt`; keine
//    IP, kein IP-Hash, kein User-Agent), automatische Zuordnung durch den Collection-Hook (Bestellnummer **und**
//    E-Mail ohne Groß/Klein → `auto_matched`, sonst `needs_manual_match`), Bestellung O11 (`statusBeforeWithdrawal`,
//    Positionen `withdrawn`) bzw. bei `awaiting_prepayment` O4 (`withdrawn`, Stücke frei, keine M04) + W5 (`closed`,
//    `unpaid_order_cancelled`), M08 und A04 in die Outbox.
// 4. Direkt nach dem Commit M08 und A04 ausführen; scheitert M08, wiederholt `sendEmail` (≤ 5 min, bis 24 h).

const log = createLogger()

/** Name des unsichtbaren Honeypot-Felds (KONZEPT §10 „Honeypot“, R-134). */
export const WITHDRAWAL_HONEYPOT_FIELD = 'website'
/** Frist der Erstattung ab Eingang (§ 357 Abs. 1 BGB). */
export const WITHDRAWAL_REFUND_DAYS = 14

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null))

export const withdrawalInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  contractIdentification: z.string().trim().min(3).max(500),
  email: z.string().trim().max(254).pipe(z.email()),
  /** Freitext „Nur bestimmte Stücke?“. */
  itemsText: optionalText(1000),
  /** Ausgewählte Positionen (`orders.items[].id`) aus dem Zwischenschritt; leer = ganzer Vertrag. */
  affectedItemIds: z.array(z.string().trim().min(1).max(64)).max(50).default([]),
  /** Grund – nie Pflicht. */
  reason: optionalText(2000),
  locale: z.enum(LOCALES),
})
export type WithdrawalInput = z.input<typeof withdrawalInputSchema>
export type WithdrawalFieldErrors = Partial<Record<keyof WithdrawalInput, string>>

/** Was die Ergebnisseite und die Mails zeigen (alle Eingaben, Eingang mit Zeitzone, Vorgangsnummer). */
export interface WithdrawalReceipt {
  id: number
  reference: string
  receivedAt: string
  /** z. B. „12.10.2026, 14:03 Uhr (MESZ)“ bzw. „12 Oct 2026, 14:03 (CEST)“. */
  receivedAtText: string
  refundDueAt: string
  name: string
  contractIdentification: string
  email: string
  itemsText: string | null
  items: { itemNumber: number; title: string }[]
  reason: string | null
  locale: Locale
  matchStatus: WithdrawalMatchStatus
  unpaidOrderCancelled: boolean
}

export type SubmitWithdrawalResult =
  | { ok: true; status: 200; spam: true }
  | { ok: true; status: 201; spam: false; receipt: WithdrawalReceipt }
  | { ok: false; status: 400; code: 'invalid'; errors: WithdrawalFieldErrors }
  | { ok: false; status: 429; code: 'rate_limited'; retryAfterSeconds: number }

export interface SubmitWithdrawalOptions {
  now: Date
  /** Client-IP nur für den Rate-Limit-Schlüssel (täglich wechselnder Hash, nie gespeichert am Datensatz). */
  ip?: string | null
  payload?: Payload
}

const isFilled = (v: unknown) => typeof v === 'string' && v.trim() !== ''

function fieldErrors(error: z.ZodError): WithdrawalFieldErrors {
  const out: WithdrawalFieldErrors = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'name') as keyof WithdrawalInput
    out[key] ??= issue.code === 'too_small' ? 'required' : 'invalid'
  }
  return out
}

/** Einfaches Formular-Objekt bzw. `FormData` → Rohdaten. */
function rawOf(input: unknown): Record<string, unknown> {
  if (typeof FormData !== 'undefined' && input instanceof FormData) {
    const out: Record<string, unknown> = {}
    for (const [k, v] of input.entries()) {
      if (k === 'affectedItemIds') {
        out[k] = [...((out[k] as string[] | undefined) ?? []), String(v)]
      } else out[k] = typeof v === 'string' ? v : ''
    }
    return out
  }
  return input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
}

const idOf = (v: unknown): number | null =>
  v === null || v === undefined
    ? null
    : typeof v === 'object'
      ? (v as { id: number }).id
      : Number(v)

type OrderItem = Order['items'][number]
const itemTitle = (i: OrderItem, locale: Locale) =>
  (locale === 'en' ? i.titleEn || i.titleDe : i.titleDe) ?? `Nr. ${i.itemNumber}`

interface OrderEffect {
  unpaidOrderCancelled: boolean
  selectedItems: OrderItem[]
  afterCommit?: () => Promise<void>
}

/**
 * Bestellung zum zugeordneten Widerruf (KONZEPT §5.4 W1): `awaiting_prepayment` → O4 (`withdrawn`) + W5; sonst O11 mit
 * `statusBeforeWithdrawal` und den gewählten (bzw. allen aktiven) Positionen `withdrawn`. Steht die Bestellung schon
 * in `withdrawal_received` (zweiter Widerruf), werden nur die Positionen markiert.
 */
async function applyToOrder(
  req: PayloadRequest,
  withdrawal: Withdrawal,
  orderId: number,
  selectedIds: readonly string[],
  now: Date,
): Promise<OrderEffect> {
  const order = await loadOrder(req, orderId)
  const note = `Widerruf ${withdrawal.reference}`
  if (order.status === 'awaiting_prepayment') {
    const cancelled = await cancelPrepaymentOrder(req, orderId, {
      now,
      reason: 'withdrawn',
      note,
      actorType: 'customer',
    })
    await preservingReq(req, () =>
      req.payload.update({
        collection: 'withdrawals',
        id: withdrawal.id,
        data: { status: 'closed', closeReason: 'unpaid_order_cancelled' },
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, system: true, transition: 'W5', now: now.toISOString() },
      }),
    )
    return { unpaidOrderCancelled: true, selectedItems: [], afterCommit: cancelled.afterCommit }
  }

  const known = new Set(order.items.map((i) => i.id).filter(Boolean) as string[])
  const chosen = selectedIds.filter((id) => known.has(id))
  const target = new Set(
    chosen.length > 0
      ? chosen
      : order.items.filter((i) => i.status === 'active').map((i) => i.id as string),
  )
  const items = order.items.map((i) =>
    target.has(i.id as string) && i.status === 'active'
      ? { ...i, status: 'withdrawn' as const }
      : i,
  )
  await preservingReq(req, () =>
    req.payload.update({
      collection: 'withdrawals',
      id: withdrawal.id,
      data: { affectedItemIds: [...target] },
      depth: 0,
      overrideAccess: true,
      req,
      context: { ...req.context, system: true, now: now.toISOString() },
    }),
  )
  const selectedItems = order.items.filter((i) => chosen.includes(i.id as string))
  if (order.status === 'withdrawal_received') {
    await updateOrderFields(req, orderId, { items }, now)
  } else if (ORDER_TRANSITIONS[order.status].includes('withdrawal_received')) {
    await transitionOrder(req, orderId, 'withdrawal_received', {
      now,
      note,
      actorType: 'customer',
      data: { items },
    })
  } else {
    // z. B. schon storniert/erstattet/angefochten: Bestellung bleibt, Jutta entscheidet im Posteingang (R-094)
    log.warn('withdrawal.order_not_transitionable', { orderId, status: order.status })
  }
  return { unpaidOrderCancelled: false, selectedItems }
}

/**
 * Widerruf annehmen (siehe Kopf). `input` ist ein Objekt oder `FormData` der Server Action; `now` kommt von der Uhr
 * des Aufrufers (Route/Action), nie aus dem Client.
 */
export async function submitWithdrawal(
  input: unknown,
  options: SubmitWithdrawalOptions,
): Promise<SubmitWithdrawalResult> {
  const { now } = options
  const raw = rawOf(input)
  // Honeypot zuerst: nichts speichern, auch keinen Rate-Limit-Zähler (R-134)
  if (isFilled(raw[WITHDRAWAL_HONEYPOT_FIELD])) return { ok: true, status: 200, spam: true }

  const payload = options.payload ?? (await getPayload({ config }))
  const limit = await hit(
    'withdrawal_submit',
    ipHash(options.ip ?? 'unknown', { now: () => now }),
    now,
    payload,
  )
  if (!limit.allowed) {
    return {
      ok: false,
      status: 429,
      code: 'rate_limited',
      retryAfterSeconds: retryAfterSeconds(limit, now),
    }
  }

  const parsed = withdrawalInputSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, status: 400, code: 'invalid', errors: fieldErrors(parsed.error) }
  }
  const value = parsed.data
  const receivedAt = now.toISOString()

  const req = await createLocalReq({ context: { system: true, now: receivedAt } }, payload)
  const tx = await inTransaction(req, async () => {
    const created = (await preservingReq(req, () =>
      req.payload.create({
        collection: 'withdrawals',
        data: {
          channel: 'online_form',
          name: value.name,
          contractIdentification: value.contractIdentification,
          email: value.email,
          itemsText: value.itemsText,
          reason: value.reason,
          locale: value.locale,
          submissionSnapshot: {
            name: value.name,
            contractIdentification: value.contractIdentification,
            email: value.email,
            itemsText: value.itemsText,
            affectedItemIds: value.affectedItemIds,
            reason: value.reason,
            locale: value.locale,
            receivedAt,
            receivedAtBerlin: formatBerlinWithZone(now, 'de'),
          },
        } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, system: true, now: receivedAt },
      }),
    )) as Withdrawal
    const orderId = created.matchStatus === 'auto_matched' ? idOf(created.order) : null
    const effect: OrderEffect = orderId
      ? await applyToOrder(req, created, orderId, value.affectedItemIds, now)
      : { unpaidOrderCancelled: false, selectedItems: [] }
    const order = orderId ? await loadOrder(req, orderId) : null

    const items = effect.selectedItems.map((i) => ({
      itemNumber: i.itemNumber,
      title: itemTitle(i, value.locale).slice(0, 200),
    }))
    const settings = await preservingReq(req, () =>
      req.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
    )
    const m08 = await enqueueEmail(req, {
      template: 'withdrawal_receipt',
      to: value.email,
      locale: value.locale,
      data: {
        withdrawalId: created.id,
        reference: created.reference,
        receivedAt: created.receivedAt,
        refundDueAt: created.refundDueAt,
        name: value.name,
        contractIdentification: value.contractIdentification,
        email: value.email,
        itemsText: value.itemsText,
        items,
        reason: value.reason,
        unpaidOrderCancelled: effect.unpaidOrderCancelled,
        returnAddress: settings.business?.returnAddress ?? null,
      },
      idempotencyKey: `withdrawal_receipt:${created.id}:W1`,
      relations: { withdrawal: created.id },
    })
    await preservingReq(req, () =>
      req.payload.update({
        collection: 'withdrawals',
        id: created.id,
        data: { confirmationEmail: m08.emailLogId },
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, system: true, now: receivedAt },
      }),
    )
    const a04 = await notifyAdmin(
      req,
      'admin_withdrawal_received',
      {
        withdrawalId: created.id,
        reference: created.reference,
        orderNumber: order?.orderNumber ?? null,
        receivedAt: created.receivedAt,
        items: items.length > 0 ? items : [],
        refundDueAt: created.refundDueAt,
        declaration: {
          name: value.name,
          contractIdentification: value.contractIdentification,
          email: value.email,
          itemsText: value.itemsText,
          reason: value.reason,
          receivedAtText: formatBerlinWithZone(now, 'de'),
          unpaidOrderCancelled: effect.unpaidOrderCancelled,
        },
      },
      {
        now,
        idempotencyKey: `admin_withdrawal_received:${created.id}:W1`,
        relations: { withdrawal: created.id, order: orderId },
      },
    )
    const doc = (await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'withdrawals',
        id: created.id,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )) as Withdrawal
    return { doc, effect, items, jobs: [m08.jobId, a04.jobId] }
  })

  // Direkt nach dem Commit (KONZEPT §6.1): M08 zuerst, dann A04; Fehler holt `sendEmail` nach
  await tx.effect
    .afterCommit?.()
    .catch((e: unknown) =>
      log.error('withdrawal.after_commit_failed', { error: (e as Error)?.message }),
    )
  for (const job of tx.jobs) {
    await runEmailJobNow(payload, job, { now }).catch((e: unknown) =>
      log.error('withdrawal.mail_failed', { error: (e as Error)?.message }),
    )
  }

  const d = tx.doc
  return {
    ok: true,
    status: 201,
    spam: false,
    receipt: {
      id: d.id,
      reference: d.reference,
      receivedAt: d.receivedAt,
      receivedAtText: formatBerlinWithZone(new Date(d.receivedAt), value.locale),
      refundDueAt: d.refundDueAt,
      name: value.name,
      contractIdentification: value.contractIdentification,
      email: value.email,
      itemsText: value.itemsText,
      items: tx.items,
      reason: value.reason,
      locale: value.locale,
      matchStatus: d.matchStatus,
      unpaidOrderCancelled: tx.effect.unpaidOrderCancelled,
    },
  }
}
