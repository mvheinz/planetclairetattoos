import 'server-only'

import {
  COUNTRY_CODES,
  type FulfillmentMethod,
  type ShippingClass,
  type ShippingZone,
} from '@/lib/enums'
import { zoneForCountry } from '@/lib/settings/rules'

import {
  parseShippingRatesSnapshot,
  shippingFromSnapshot,
  snapshotShippingRates,
  type ShippingRatesSnapshot,
  type ShippingSettings,
} from './shipping'

// Erstattungsvorschlag (PLAN P6.10, KONZEPT §5.3 „Regeln zu Erstattungen“, R-072, KA-32): Voll-Widerruf = Stückpreise
// + ursprüngliche Versandkosten; Teil-Widerruf = Preise der gewählten Stücke + Differenz aus bezahlten Versandkosten
// und den Versandkosten, die für die behaltenen Stücke angefallen wären (vorläufig kundenfreundlich bis Kanzleifrage
// K-09) – zu den Tarifen bei der Bestellung (`orders.shippingRatesAtOrder`; Altbestellungen ohne Snapshot: aktuelle
// Tarife). Fehlt der Tarif der behaltenen Stücke, bleibt der Versandanteil 0 und der Dialog sagt das
// (`shippingRateMissing`), statt still zu rechnen. Nie über den noch erstattbaren Betrag. Reine Funktion, alles in Cent.

export interface RefundItem {
  id: string
  priceCents: number
  shippingClass: ShippingClass
  itemNumber?: number | null
  /** `refunded` = schon erstattet (zählt weder als erstattet noch als behalten). */
  status?: string | null
}

export interface RefundProposalInput {
  items: readonly RefundItem[]
  selectedIds: readonly string[]
  /** Bezahlte Versandkosten der Bestellung. */
  shippingCents: number
  fulfillmentMethod: FulfillmentMethod
  /** Versandtarife der Bestellung (`orderShippingRates`); `null` = keine bekannt. */
  rates: ShippingRatesSnapshot | null
  totalCents: number
  /** Summe der erfolgreichen und laufenden Erstattungen. */
  refundedCents: number
}

export interface RefundProposal {
  itemsCents: number
  shippingCents: number
  proposedCents: number
  /** Noch erstattbar (Gesamtbetrag − bisherige Erstattungen). */
  maxCents: number
  /** Teil-Widerruf (es bleiben Stücke behalten) → Hinweis auf K-09 im Dialog. */
  partial: boolean
  /** Kein Tarif für die behaltenen Stücke → Versandanteil nicht berechnet, Dialog: „bitte prüfen“. */
  shippingRateMissing: boolean
}

/** Bestellung, soweit der Vorschlag sie braucht (`orders`-Dokument). */
export interface RefundRatesOrder {
  fulfillmentMethod: FulfillmentMethod
  shippingRatesAtOrder?: unknown
  shippingZone?: ShippingZone | null
  shippingClass?: ShippingClass | null
  shippingCents?: number | null
  shippingAddress?: { country?: string | null } | null
  items: readonly { shippingClass: ShippingClass }[]
}

/**
 * Tarife für den Vorschlag: der Snapshot der Bestellung; für Altbestellungen ohne Snapshot die aktuellen Tarife aus
 * `settings` (Zone der Bestellung, die bezahlte Klasse mit dem bezahlten Versand). `null` bei Abholung.
 */
export function orderShippingRates(
  order: RefundRatesOrder,
  settings: ShippingSettings | null | undefined,
): ShippingRatesSnapshot | null {
  if (order.fulfillmentMethod !== 'shipping') return null
  const saved = parseShippingRatesSnapshot(order.shippingRatesAtOrder)
  if (saved) return saved
  const country = String(order.shippingAddress?.country ?? 'DE').toUpperCase()
  const zone =
    order.shippingZone ??
    ((COUNTRY_CODES as readonly string[]).includes(country)
      ? zoneForCountry(country as (typeof COUNTRY_CODES)[number])
      : null)
  if (!zone) return null
  const paid =
    order.shippingClass && typeof order.shippingCents === 'number'
      ? { shippingClass: order.shippingClass, shippingCents: order.shippingCents }
      : null
  return snapshotShippingRates(
    order.items.map((i) => i.shippingClass),
    zone,
    settings,
    paid,
  )
}

/** Versandkosten, die für `kept` angefallen wären; `null`, wenn dafür kein Tarif bekannt ist. */
function shippingFor(kept: readonly RefundItem[], input: RefundProposalInput): number | null {
  if (kept.length === 0) return 0
  if (input.fulfillmentMethod === 'pickup') return 0
  return input.rates ? shippingFromSnapshot(kept, input.rates) : null
}

export function proposeRefund(input: RefundProposalInput): RefundProposal {
  const maxCents = Math.max(0, input.totalCents - input.refundedCents)
  const open = input.items.filter((i) => i.status !== 'refunded')
  const chosen = new Set(input.selectedIds)
  const selected = open.filter((i) => chosen.has(i.id))
  const kept = open.filter((i) => !chosen.has(i.id))
  const itemsCents = selected.reduce((n, i) => n + i.priceCents, 0)
  let shippingCents = 0
  let shippingRateMissing = false
  if (selected.length > 0) {
    const keptShipping = shippingFor(kept, input)
    // Ohne Tarif keine Differenz (der Vorschlag ist eine Untergrenze, Jutta kann erhöhen) – aber mit Hinweis.
    if (keptShipping === null) shippingRateMissing = true
    else shippingCents = Math.max(0, input.shippingCents - keptShipping)
  }
  return {
    itemsCents,
    shippingCents,
    proposedCents: Math.min(maxCents, itemsCents + shippingCents),
    maxCents,
    partial: selected.length > 0 && kept.length > 0,
    shippingRateMissing,
  }
}

export type RefundAmountCheck =
  | { ok: true }
  | { ok: false; code: 'too_low' | 'too_high' | 'note_required' | 'invalid'; message: string }

/**
 * Prüft den Betrag aus dem Dialog: ganze Cent > 0, nie über `maxCents`; unter dem Vorschlag nicht erlaubt (Jutta kann
 * nur erhöhen), darüber nur mit Notiz (3–300 Zeichen).
 */
export function checkRefundAmount(
  amountCents: unknown,
  proposal: Pick<RefundProposal, 'proposedCents' | 'maxCents'>,
  note: string | null | undefined,
): RefundAmountCheck {
  if (typeof amountCents !== 'number' || !Number.isSafeInteger(amountCents) || amountCents <= 0) {
    return { ok: false, code: 'invalid', message: 'Bitte einen Betrag in ganzen Cent angeben.' }
  }
  if (amountCents > proposal.maxCents) {
    return {
      ok: false,
      code: 'too_high',
      message: 'Der Betrag ist höher als der noch erstattbare Rest.',
    }
  }
  if (amountCents < proposal.proposedCents) {
    return {
      ok: false,
      code: 'too_low',
      message: 'Der Vorschlag lässt sich nur erhöhen, nicht verringern.',
    }
  }
  if (amountCents > proposal.proposedCents && (note ?? '').trim().length < 3) {
    return {
      ok: false,
      code: 'note_required',
      message: 'Bitte kurz notieren, warum du mehr erstattest.',
    }
  }
  return { ok: true }
}
