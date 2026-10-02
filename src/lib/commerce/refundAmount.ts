import 'server-only'

import type { FulfillmentMethod, ShippingClass } from '@/lib/enums'

import { computeShipping, type ShippingSettings } from './shipping'

// Erstattungsvorschlag (PLAN P6.10, KONZEPT §5.3 „Regeln zu Erstattungen“, R-072, KA-32): Voll-Widerruf = Stückpreise
// + ursprüngliche Versandkosten; Teil-Widerruf = Preise der gewählten Stücke + Differenz aus bezahlten Versandkosten
// und den Versandkosten, die für die behaltenen Stücke angefallen wären (vorläufig kundenfreundlich bis Kanzleifrage
// K-09). Nie über den noch erstattbaren Betrag. Reine Funktion (Tarife aus `settings.shipping.rates`), alles in Cent.

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
  /** Lieferland (Standard `DE`). */
  country?: string | null
  settings: ShippingSettings
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
}

/** Versandkosten, die für `kept` angefallen wären (ohne Tarif: bezahlter Versand, also keine Differenz). */
function shippingFor(kept: readonly RefundItem[], input: RefundProposalInput): number {
  if (kept.length === 0) return 0
  if (input.fulfillmentMethod === 'pickup') return 0
  try {
    return computeShipping(kept, 'shipping', input.settings, { country: input.country ?? 'DE' })
      .shippingCents
  } catch {
    return input.shippingCents
  }
}

export function proposeRefund(input: RefundProposalInput): RefundProposal {
  const maxCents = Math.max(0, input.totalCents - input.refundedCents)
  const open = input.items.filter((i) => i.status !== 'refunded')
  const chosen = new Set(input.selectedIds)
  const selected = open.filter((i) => chosen.has(i.id))
  const kept = open.filter((i) => !chosen.has(i.id))
  const itemsCents = selected.reduce((n, i) => n + i.priceCents, 0)
  const shippingCents =
    selected.length === 0 ? 0 : Math.max(0, input.shippingCents - shippingFor(kept, input))
  return {
    itemsCents,
    shippingCents,
    proposedCents: Math.min(maxCents, itemsCents + shippingCents),
    maxCents,
    partial: selected.length > 0 && kept.length > 0,
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
