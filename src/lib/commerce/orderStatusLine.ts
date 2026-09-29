import 'server-only'

import type { OrderStatus } from '@/lib/enums'

// Statusverlauf der Bestellstatus-Seite R09 (DESIGN KO-16, KONZEPT §4.12 Nr. 1, DATENMODELL §6.8.2): reine Funktionen
// ohne DB. Hauptlinie je Variante (Versand, Abholung; bei Vorkasse heißt „bezahlt“ „Zahlung eingegangen“), Widerruf,
// Rücksendung, Erstattung und Storno als eigene Einträge. Eine Anfechtung (`disputed`) sieht die Kund:in nicht – gezeigt
// wird der Status aus `statusBeforeDispute`. Außerdem die maskierte E-Mail (`j•••@outlook.de`).

export type StatusStepKey =
  | 'ordered'
  | 'paid'
  | 'prepaymentReceived'
  | 'packed'
  | 'shipped'
  | 'delivered'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'withdrawal_received'
  | 'return_received'
  | 'partially_refunded'
  | 'refunded'
  | 'cancelled'

export type StatusStepState = 'done' | 'current' | 'upcoming'

export interface StatusStep {
  key: StatusStepKey
  state: StatusStepState
  /** Zeitpunkt (ISO) des ersten Erreichens; kommende Schritte ohne. */
  at: string | null
  /** Eigener Eintrag außerhalb der Hauptlinie (Widerruf, Erstattung, Storno). */
  extra: boolean
}

export interface StatusLineInput {
  status: OrderStatus
  statusBeforeDispute?: OrderStatus | null
  fulfillmentMethod: 'shipping' | 'pickup'
  paymentMethod: 'card' | 'paypal' | 'prepayment'
  placedAt: string
  history: readonly { to: OrderStatus; at: string }[]
}

const EXTRA: readonly OrderStatus[] = [
  'withdrawal_received',
  'return_received',
  'partially_refunded',
  'refunded',
  'cancelled',
]

/** Status, den die Kund:in sieht (bei `disputed` der Status davor). */
export function customerStatus(
  status: OrderStatus,
  statusBeforeDispute?: OrderStatus | null,
): OrderStatus {
  return status === 'disputed' ? (statusBeforeDispute ?? 'paid') : status
}

function mainLine(input: StatusLineInput): { key: StatusStepKey; status: OrderStatus | null }[] {
  const paid: StatusStepKey = input.paymentMethod === 'prepayment' ? 'prepaymentReceived' : 'paid'
  const head = [
    { key: 'ordered' as const, status: null },
    { key: paid, status: 'paid' as const },
  ]
  return input.fulfillmentMethod === 'pickup'
    ? [
        ...head,
        { key: 'ready_for_pickup', status: 'ready_for_pickup' },
        { key: 'picked_up', status: 'picked_up' },
      ]
    : [
        ...head,
        { key: 'packed', status: 'packed' },
        { key: 'shipped', status: 'shipped' },
        { key: 'delivered', status: 'delivered' },
      ]
}

/** Schritte für `OrderStatusLine` (genau ein Schritt `current`). */
export function buildStatusLine(input: StatusLineInput): StatusStep[] {
  const shown = customerStatus(input.status, input.statusBeforeDispute)
  const history = input.history.filter((h) => h.to !== 'disputed')
  const firstAt = new Map<OrderStatus, string>()
  for (const h of history) if (!firstAt.has(h.to)) firstAt.set(h.to, h.at)

  const main = mainLine(input)
  const reachedIndex = main.reduce(
    (max, step, i) => (step.status === null || firstAt.has(step.status) ? i : max),
    0,
  )
  const extras = history
    .filter((h) => EXTRA.includes(h.to))
    .filter((h, i, all) => all.findIndex((x) => x.to === h.to) === i)
  const endedOutsideMain = EXTRA.includes(shown)

  const steps: StatusStep[] = main
    .map((step, i): StatusStep | null => {
      const at = step.status === null ? input.placedAt : (firstAt.get(step.status) ?? null)
      if (i <= reachedIndex) {
        const current = !endedOutsideMain && i === reachedIndex
        return { key: step.key, state: current ? 'current' : 'done', at, extra: false }
      }
      // Nach Storno, Widerruf oder Erstattung keine „kommenden“ Schritte mehr.
      return endedOutsideMain ? null : { key: step.key, state: 'upcoming', at: null, extra: false }
    })
    .filter((s): s is StatusStep => s !== null)

  extras.forEach((h, i) => {
    const last = i === extras.length - 1
    steps.push({
      key: h.to as StatusStepKey,
      state: last && endedOutsideMain ? 'current' : 'done',
      at: h.at,
      extra: true,
    })
  })
  if (!steps.some((s) => s.state === 'current')) {
    const lastDone = [...steps].reverse().find((s) => s.state === 'done')
    if (lastDone) lastDone.state = 'current'
  }
  return steps
}

/** `jutta.dollmann@outlook.de` → `j•••@outlook.de` (R-067: keine volle E-Mail auf der Statusseite). */
export function maskEmail(email: string | null | undefined): string | null {
  if (!email) return null
  const at = email.lastIndexOf('@')
  if (at < 1) return null
  return `${email[0]}•••${email.slice(at)}`
}
