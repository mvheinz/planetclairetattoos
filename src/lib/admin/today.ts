import 'server-only'

import type { Payload, Where } from 'payload'

import { ENUM_LABELS } from '@/lib/enumLabels'
import type { AttentionReason, OrderStatus, RevenueGuardStage } from '@/lib/enums'
import { missingManualSources, previousMonth } from '@/lib/export/monthlyClose'
import { listJobRuns, poolDb } from '@/lib/jobs/runLog'
import { formatEuroInput } from '@/lib/money'
import { formatItemNumber } from '@/lib/products/itemNumber'
import { getRevenueStatus } from '@/lib/revenue/check'
import { stageMessage } from '@/lib/revenue/guard'
import { seedSummary } from '@/lib/seed/remove'
import { addBerlinDays, addBerlinMonths, berlinDayStart, formatBerlin } from '@/lib/time'
import type { Inquiry, LegalText, Order, Product, Setting, Withdrawal } from '@/payload-types'

import { OPEN_WITHDRAWAL_STATUSES } from '@/admin/views/withdrawals/withdrawalQuery'

// Start-Ansicht „Heute“ (PLAN P5.28, KONZEPT §7.3): Kacheln (Zahl + Link), rote/gelbe Hinweise mit Link, letzte 5
// Bestellungen. Eine Funktion, wenige gebündelte Abfragen (nacheinander), feste Uhr `now` (Tests, Seed `SEED_NOW`).
// Pfade sind relativ zu `ADMIN_ROUTE` (der Pfad selbst steht nie hier, E-93). Zählt Beispieldaten mit – „Heute“ zeigt
// dieselben Datensätze wie die Listen (der Hinweis „Beispieldaten vorhanden“ macht sie sichtbar).

const DAY = 86_400_000

/** „Zu packen“ auf „Heute“: Versandbestellungen `paid`/`packed` (SEED-SPEC §17: O14 + O12). */
export const TODAY_PACKING_STATUSES = ['paid', 'packed'] as const satisfies readonly OrderStatus[]
/** „Abholung“: wie die Ansicht `/abholung` – `paid` mit Abholung und `ready_for_pickup`. */
export const TODAY_PICKUP_STATUSES = [
  'paid',
  'ready_for_pickup',
] as const satisfies readonly OrderStatus[]
/** Hinweis „Abholung wartet“ ab so vielen Tagen seit „Kann abgeholt werden“. */
export const PICKUP_WAIT_WARN_DAYS = 14
/** Aufbewahrungssperren zur Prüfung: letzte Prüfung (sonst Beginn) mindestens so viele Monate her (auch P6.15). */
export const LEGAL_HOLD_REVIEW_MONTHS = 6
/** Standard-Schwelle der Kostenwarnung (E-05 „ab 30 €“). */
export const DEFAULT_COST_WARNING_CENTS = 3000
/** Standard-Intervall der Rechtstexte-Prüfung (R-014). */
export const DEFAULT_LEGAL_REVIEW_DAYS = 365

/** Rote Stufen des Umsatz-Wächters (Handeln nötig); die übrigen sind gelb. */
const RED_STAGES: readonly RevenueGuardStage[] = ['U2', 'U3a', 'U4', 'U5']

export type TodayTone = 'error' | 'warning' | 'info'

export interface TodayHint {
  /** Stabiler Schlüssel (Tests, `data-hint`). */
  id: string
  tone: TodayTone
  text: string
  /** Link relativ zu `ADMIN_ROUTE`. */
  href: `/${string}`
  linkLabel: string
}

export interface TodaySummary {
  tiles: {
    packen: { count: number }
    vorkasse: { count: number; dueToday: number }
    abholung: { count: number }
    widerrufe: { count: number; nextDueAt: string | null; nextReference: string | null }
    anfragen: { count: number }
  }
  hints: TodayHint[]
  recentOrders: {
    id: number
    orderNumber: string
    totalCents: number
    status: OrderStatus
    statusLabel: string
    seed: boolean
  }[]
  /** Startklar-Prüfung: Platzhalter bis P10.14. */
  startklar: 'later'
}

type Privacy = {
  legalHold?: boolean | null
  legalHoldSince?: string | null
  legalHoldReviewedAt?: string | null
}

/** Ist eine Aufbewahrungssperre zur Prüfung fällig? (letzte Prüfung, sonst Beginn, ≥ 6 Monate her) */
export function legalHoldReviewDue(privacy: Privacy | null | undefined, now: Date): boolean {
  if (!privacy?.legalHold) return false
  const last = privacy.legalHoldReviewedAt ?? privacy.legalHoldSince
  if (!last) return true
  return new Date(last).getTime() <= addBerlinMonths(now, -LEGAL_HOLD_REVIEW_MONTHS).getTime()
}

const date = (iso: string) => formatBerlin(new Date(iso), 'dd.MM.yyyy')
const attentionLabel = (reason: string | null | undefined) =>
  reason && reason in ENUM_LABELS.ATTENTION_REASONS
    ? ENUM_LABELS.ATTENTION_REASONS[reason as AttentionReason].de
    : 'Bitte prüfen'

interface FindArgs {
  collection: 'orders' | 'products' | 'withdrawals' | 'inquiries' | 'legal-texts' | 'email-log'
  where: Where
  limit?: number
  sort?: string
  select?: Record<string, true>
}

/** Abfragen nacheinander (eine Verbindung, auch innerhalb einer Transaktion der Anfrage), Typen wie `Promise.all`. */
async function inSequence<T extends readonly (() => Promise<unknown>)[] | []>(
  fns: T,
): Promise<{ -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> }> {
  const out: unknown[] = []
  for (const fn of fns) out.push(await fn())
  return out as { -readonly [K in keyof T]: Awaited<ReturnType<T[K]>> }
}

export async function getTodaySummary(now: Date, payload: Payload): Promise<TodaySummary> {
  const find = <T>({ collection, where, limit = 200, sort, select }: FindArgs) =>
    payload
      .find({
        collection,
        where,
        limit,
        sort,
        depth: 0,
        overrideAccess: true,
        ...(select ? { select } : {}),
      } as never)
      .then((r) => (r as unknown as { docs: T[] }).docs)
  const count = (collection: FindArgs['collection'], where: Where) =>
    payload.count({ collection, where, overrideAccess: true }).then((r) => r.totalDocs)

  const dayStart = berlinDayStart(now)
  const dayEnd = addBerlinDays(dayStart, 1)

  const [
    packen,
    prepayment,
    abholung,
    withdrawals,
    anfragen,
    attentionOrders,
    attentionProducts,
    disputed,
    holdOrders,
    holdWithdrawals,
    holdInquiries,
    failedMails,
    recent,
    activeLegal,
    settings,
    seed,
    jobRuns,
    missingSources,
    stuckReceipts,
  ] = await inSequence([
    () =>
      count('orders', {
        and: [
          { fulfillmentMethod: { equals: 'shipping' } },
          { status: { in: [...TODAY_PACKING_STATUSES] } },
        ],
      }),
    () =>
      find<Order>({
        collection: 'orders',
        where: { status: { equals: 'awaiting_prepayment' } },
        select: { prepayment: true },
      }),
    () =>
      find<Order>({
        collection: 'orders',
        where: {
          and: [
            { fulfillmentMethod: { equals: 'pickup' } },
            { status: { in: [...TODAY_PICKUP_STATUSES] } },
          ],
        },
        select: { orderNumber: true, status: true, timestamps: true },
      }),
    () =>
      find<Withdrawal>({
        collection: 'withdrawals',
        where: { status: { in: [...OPEN_WITHDRAWAL_STATUSES] } },
        sort: 'refundDueAt',
        select: { reference: true, refundDueAt: true },
      }),
    () => count('inquiries', { status: { equals: 'new' } }),
    () =>
      find<Order>({
        collection: 'orders',
        where: { 'adminAttention.flag': { equals: true } },
        sort: '-timestamps.placedAt',
        select: { orderNumber: true, status: true, adminAttention: true },
      }),
    () =>
      find<Product>({
        collection: 'products',
        where: { 'adminAttention.flag': { equals: true } },
        sort: 'itemNumber',
        select: { itemNumber: true, title: true, adminAttention: true },
      }),
    () =>
      find<Order>({
        collection: 'orders',
        where: { status: { equals: 'disputed' } },
        sort: '-timestamps.placedAt',
        select: { orderNumber: true },
      }),
    () =>
      find<Order>({
        collection: 'orders',
        where: { 'privacy.legalHold': { equals: true } },
        select: { orderNumber: true, privacy: true },
      }),
    () =>
      find<Withdrawal>({
        collection: 'withdrawals',
        where: { 'privacy.legalHold': { equals: true } },
        select: { reference: true, privacy: true },
      }),
    () =>
      find<Inquiry>({
        collection: 'inquiries',
        where: { 'privacy.legalHold': { equals: true } },
        select: { reference: true, privacy: true },
      }),
    () => count('email-log', { status: { equals: 'failed' } }),
    () =>
      find<Order>({
        collection: 'orders',
        where: {},
        limit: 5,
        sort: '-timestamps.placedAt',
        select: { orderNumber: true, totalCents: true, status: true, seed: true },
      }),
    () =>
      find<LegalText>({
        collection: 'legal-texts',
        where: { status: { equals: 'active' } },
        select: { type: true, activatedAt: true, validFrom: true },
      }),
    () => payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true }),
    () => seedSummary(payload),
    () => listJobRuns(poolDb(payload), { since: new Date(now.getTime() - DAY), limit: 500 }),
    () => missingManualSources(payload, previousMonth(now)),
    // M08 hängt (R-093): ab dem 2. Fehlversuch Hinweis, bis der Versand gelingt oder nach 24 h aufgegeben wird
    () =>
      count('email-log', {
        and: [
          { template: { equals: 'withdrawal_receipt' } },
          { status: { equals: 'queued' } },
          { attempts: { greater_than_equal: 2 } },
        ],
      }),
  ])
  const s = settings as Setting

  const hints: TodayHint[] = []
  const hint = (h: TodayHint) => hints.push(h)

  // Umsatz-Wächter-Stufe (KONZEPT §8.4)
  const revenue = await getRevenueStatus(payload, now, {
    settings: s as unknown as Record<string, unknown>,
  })
  const stage: RevenueGuardStage | null =
    revenue.current ?? (revenue.reached.some((r) => r.stage === 'U0') ? 'U0' : null)
  if (stage) {
    hint({
      id: `revenue-${stage}`,
      tone: RED_STAGES.includes(stage) ? 'error' : 'warning',
      text: `Umsatz-Wächter: ${stageMessage(stage, { year: revenue.year, totalCents: revenue.totalCents, thresholds: revenue.thresholds })}`,
      href: '/einstellungen/umsatz-waechter',
      linkLabel: 'Umsatz-Wächter öffnen',
    })
  }

  // Stücke und Bestellungen mit adminAttention (rot, mit Grund)
  for (const p of attentionProducts) {
    hint({
      id: `attention-product-${p.id}`,
      tone: 'error',
      text: `Stück ${formatItemNumber(p.itemNumber, 'de')}${p.title ? ` „${p.title}“` : ''}: ${attentionLabel(p.adminAttention?.reason)}`,
      href: `/stuecke/${p.id}`,
      linkLabel: 'Stück öffnen',
    })
  }
  const disputedIds = new Set(disputed.map((o) => o.id))
  for (const o of attentionOrders) {
    if (o.adminAttention?.reason === 'dispute_open' && disputedIds.has(o.id)) continue
    hint({
      id: `attention-order-${o.id}`,
      tone: 'error',
      text: `Bestellung ${o.orderNumber}: ${attentionLabel(o.adminAttention?.reason)}`,
      href: `/bestellungen/${o.id}`,
      linkLabel: 'Bestellung öffnen',
    })
  }

  // Offene Anfechtungen (rot)
  for (const o of disputed) {
    hint({
      id: `dispute-${o.id}`,
      tone: 'error',
      text: `Zahlung angefochten: Bestellung ${o.orderNumber}. Bitte Unterlagen beim Zahlungsanbieter einreichen.`,
      href: `/bestellungen/${o.id}`,
      linkLabel: 'Bestellung öffnen',
    })
  }

  // Eingangsbestätigung eines Widerrufs hängt (rot, R-093)
  if (stuckReceipts > 0) {
    hint({
      id: 'withdrawal-receipt-stuck',
      tone: 'error',
      text:
        stuckReceipts === 1
          ? 'Die Eingangsbestätigung eines Widerrufs konnte noch nicht verschickt werden – sie wird alle 5 Minuten erneut versucht.'
          : `${stuckReceipts} Eingangsbestätigungen von Widerrufen konnten noch nicht verschickt werden – sie werden alle 5 Minuten erneut versucht.`,
      href: '/widerrufe',
      linkLabel: 'Widerrufe öffnen',
    })
  }

  // Fehlgeschlagene Mails und Jobs (rot)
  if (failedMails > 0) {
    hint({
      id: 'failed-mails',
      tone: 'error',
      text:
        failedMails === 1
          ? '1 Mail konnte nicht verschickt werden.'
          : `${failedMails} Mails konnten nicht verschickt werden.`,
      href: '/einstellungen/system',
      linkLabel: 'System öffnen',
    })
  }
  const failedRuns = jobRuns.filter((r) => r.status === 'failed')
  if (failedRuns.length > 0) {
    const tasks = [...new Set(failedRuns.map((r) => r.task))].join(', ')
    hint({
      id: 'failed-jobs',
      tone: 'error',
      text: `Hintergrund-Aufgaben in den letzten 24 Stunden fehlgeschlagen: ${tasks}.`,
      href: '/einstellungen/system',
      linkLabel: 'System öffnen',
    })
  }

  // Aufbewahrungssperren zur Prüfung (gelb)
  const holds: { label: string; href: `/${string}`; id: string }[] = [
    ...holdOrders
      .filter((o) => legalHoldReviewDue(o.privacy, now))
      .map((o) => ({
        id: `order-${o.id}`,
        label: `Bestellung ${o.orderNumber}`,
        href: `/bestellungen/${o.id}` as const,
      })),
    ...holdWithdrawals
      .filter((w) => legalHoldReviewDue(w.privacy, now))
      .map((w) => ({
        id: `withdrawal-${w.id}`,
        label: `Widerruf ${w.reference}`,
        href: `/widerrufe/${w.id}` as const,
      })),
    ...holdInquiries
      .filter((i) => legalHoldReviewDue(i.privacy, now))
      .map((i) => ({
        id: `inquiry-${i.id}`,
        label: `Anfrage ${i.reference}`,
        href: `/anfragen/${i.id}` as const,
      })),
  ]
  for (const h of holds) {
    hint({
      id: `legal-hold-${h.id}`,
      tone: 'warning',
      text: `Aufbewahrungssperre zur Prüfung: ${h.label} (letzte Prüfung vor über ${LEGAL_HOLD_REVIEW_MONTHS} Monaten).`,
      href: h.href,
      linkLabel: 'Öffnen',
    })
  }

  // Rechtstexte-Prüfung fällig (R-014, je Typ)
  const intervalDays = s.legal?.reviewIntervalDays ?? DEFAULT_LEGAL_REVIEW_DAYS
  const reviews = s.legal?.reviews ?? []
  const dueTypes = activeLegal
    .filter((t) => {
      const reviewed = reviews
        .filter((r) => r.type === t.type && r.reviewedAt)
        .map((r) => Date.parse(r.reviewedAt!))
      const last = Math.max(Date.parse(t.activatedAt ?? t.validFrom), ...reviewed)
      return now.getTime() - last >= intervalDays * DAY
    })
    .map((t) => ENUM_LABELS.LEGAL_TEXT_TYPES[t.type].de)
  if (dueTypes.length > 0) {
    hint({
      id: 'legal-review',
      tone: 'warning',
      text: `Rechtstexte prüfen (letzte Prüfung vor über ${intervalDays} Tagen): ${[...new Set(dueTypes)].join(', ')}.`,
      href: '/texte',
      linkLabel: 'Texte öffnen',
    })
  }

  // Abholungen > 14 Tage (gelb)
  const pickupLimit = addBerlinDays(now, -PICKUP_WAIT_WARN_DAYS).getTime()
  for (const o of abholung) {
    const since = o.timestamps?.readyForPickupAt
    if (o.status !== 'ready_for_pickup' || !since || Date.parse(since) > pickupLimit) continue
    hint({
      id: `pickup-${o.id}`,
      tone: 'warning',
      text: `Bestellung ${o.orderNumber} wartet seit ${date(since)} auf die Abholung.`,
      href: '/abholung',
      linkLabel: 'Abholung öffnen',
    })
  }

  // Manuelle Monatssummen des Vormonats fehlen (gelb)
  if (missingSources.length > 0) {
    hint({
      id: 'monthly-sums',
      tone: 'warning',
      text: `Monatssummen für ${previousMonth(now)} fehlen: ${missingSources.map((x) => ENUM_LABELS.REVENUE_SOURCES[x].de).join(', ')}.`,
      href: '/einstellungen/umsatz-waechter',
      linkLabel: 'Monatssumme eintragen',
    })
  }

  // Kostenwarnung: letzter Monatswert ≥ Schwelle (E-05)
  const entries = [...(s.costs?.monthlyEntries ?? [])].sort((a, b) =>
    a.month.localeCompare(b.month),
  )
  const last = entries.at(-1)
  const threshold = s.costs?.warningThresholdCents ?? DEFAULT_COST_WARNING_CENTS
  if (last && last.amountCents >= threshold) {
    hint({
      id: 'costs',
      tone: 'warning',
      text: `Kosten ${last.month}: ${euro(last.amountCents)} – ab ${euro(threshold)} gibt es diesen Hinweis.`,
      href: '/einstellungen#kosten',
      linkLabel: 'Kosten öffnen',
    })
  }

  // Beispieldaten vorhanden
  const seedTotal = Object.values(seed).reduce((a, b) => a + b, 0)
  if (seedTotal > 0) {
    hint({
      id: 'seed',
      tone: 'warning',
      text: `Beispieldaten vorhanden (${seedTotal} Einträge). Vor dem Shop-Start entfernen.`,
      href: '/einstellungen#beispieldaten',
      linkLabel: 'Beispieldaten ansehen',
    })
  }

  const nextWithdrawal = withdrawals.find((w) => w.refundDueAt) ?? null
  return {
    tiles: {
      packen: { count: packen },
      vorkasse: {
        count: prepayment.length,
        dueToday: prepayment.filter((o) => {
          const due = o.prepayment?.dueAt ? Date.parse(o.prepayment.dueAt) : NaN
          return due >= dayStart.getTime() && due < dayEnd.getTime()
        }).length,
      },
      abholung: { count: abholung.length },
      widerrufe: {
        count: withdrawals.length,
        nextDueAt: nextWithdrawal?.refundDueAt ?? null,
        nextReference: nextWithdrawal?.reference ?? null,
      },
      anfragen: { count: anfragen },
    },
    hints,
    recentOrders: recent.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      totalCents: o.totalCents,
      status: o.status,
      statusLabel: ENUM_LABELS.ORDER_STATUSES[o.status].de,
      seed: o.seed === true,
    })),
    startklar: 'later',
  }
}

/** Euro-Betrag für Hinweistexte der Verwaltung („30,00 €“). */
const euro = (cents: number) => `${formatEuroInput(cents)} €`
