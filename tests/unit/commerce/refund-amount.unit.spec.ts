import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  checkRefundAmount,
  proposeRefund,
  type RefundItem,
  type RefundProposalInput,
} from '@/lib/commerce/refundAmount'
import type { ShippingSettings } from '@/lib/commerce/shipping'

// P6.10 – Erstattungsvorschlag (KONZEPT §5.3, R-072, KA-32/K-09) mit den Tarifen aus dem Grund-Seed
// (`content/seed/data/base.json`: Brief 450, Paket klein 650, Keramik 890).

const base = JSON.parse(
  readFileSync(path.resolve(import.meta.dirname, '../../../content/seed/data/base.json'), 'utf8'),
) as { settings: ShippingSettings }
const settings = base.settings

const cup: RefundItem = { id: 'L1', priceCents: 3800, shippingClass: 'keramik', itemNumber: 17 }
const shirt: RefundItem = {
  id: 'L2',
  priceCents: 2900,
  shippingClass: 'paket_klein',
  itemNumber: 18,
}
const card: RefundItem = { id: 'L3', priceCents: 900, shippingClass: 'brief', itemNumber: 19 }

const order = (
  items: RefundItem[],
  over: Partial<RefundProposalInput> = {},
): RefundProposalInput => {
  const shippingCents = 890
  const total = items.reduce((n, i) => n + i.priceCents, 0) + shippingCents
  return {
    items,
    selectedIds: [],
    shippingCents,
    fulfillmentMethod: 'shipping',
    settings,
    totalCents: total,
    refundedCents: 0,
    ...over,
  }
}

describe('proposeRefund (R-072)', () => {
  it('R-072 Grund-Seed-Tarife wie erwartet', () => {
    expect(settings.shipping?.rates?.map((r) => [r.shippingClass, r.priceCents])).toEqual([
      ['brief', 450],
      ['paket_klein', 650],
      ['keramik', 890],
    ])
  })

  it('R-072 Voll-Widerruf: alle Stückpreise + ursprüngliche Versandkosten', () => {
    const p = proposeRefund(order([cup, shirt], { selectedIds: ['L1', 'L2'] }))
    expect(p).toMatchObject({
      itemsCents: 6700,
      shippingCents: 890,
      proposedCents: 7590,
      partial: false,
    })
    expect(p.proposedCents).toBe(p.maxCents)
  })

  it('R-072 Teil-Widerruf (SEED O05): Keramik zurück, Paket behalten → 3800 + (890 − 650) = 4040', () => {
    const p = proposeRefund(order([cup, shirt], { selectedIds: ['L1'] }))
    expect(p).toMatchObject({
      itemsCents: 3800,
      shippingCents: 240,
      proposedCents: 4040,
      partial: true,
    })
  })

  it('R-072 Teil-Widerruf: behaltenes Stück braucht denselben Tarif → keine Versanddifferenz', () => {
    const p = proposeRefund(order([cup, shirt], { selectedIds: ['L2'] }))
    expect(p).toMatchObject({ itemsCents: 2900, shippingCents: 0, proposedCents: 2900 })
  })

  it('R-072 Teil-Widerruf: Keramik und Paket zurück, Brief behalten → 6700 + (890 − 450)', () => {
    const p = proposeRefund(order([cup, shirt, card], { selectedIds: ['L1', 'L2'] }))
    expect(p.proposedCents).toBe(6700 + 440)
  })

  it('R-072 Abholung: kein Versandanteil', () => {
    const p = proposeRefund(
      order([cup, shirt], {
        selectedIds: ['L1'],
        shippingCents: 0,
        fulfillmentMethod: 'pickup',
        totalCents: 6700,
      }),
    )
    expect(p).toMatchObject({ shippingCents: 0, proposedCents: 3800 })
  })

  it('R-072 zweiter Teil-Widerruf: schon erstattete Positionen zählen nicht, Rest begrenzt den Vorschlag', () => {
    const first = order([cup, shirt], { selectedIds: ['L1'] })
    const p = proposeRefund({
      ...first,
      items: [{ ...cup, status: 'refunded' }, shirt],
      selectedIds: ['L2'],
      refundedCents: 4040,
    })
    // 2900 + 890 wären 3790, erstattbar sind nur noch 7590 − 4040 = 3550 (2900 + 650)
    expect(p.maxCents).toBe(3550)
    expect(p.proposedCents).toBe(3550)
  })

  it('R-072 ohne Auswahl (Kulanz): Vorschlag 0', () => {
    expect(proposeRefund(order([cup])).proposedCents).toBe(0)
  })
})

describe('checkRefundAmount', () => {
  const proposal = { proposedCents: 4040, maxCents: 7590 }
  it('R-072 nur erhöhen, Erhöhung mit Notiz, nie über den Rest', () => {
    expect(checkRefundAmount(4040, proposal, null)).toEqual({ ok: true })
    expect(checkRefundAmount(4000, proposal, 'x')).toMatchObject({ ok: false, code: 'too_low' })
    expect(checkRefundAmount(4500, proposal, '')).toMatchObject({
      ok: false,
      code: 'note_required',
    })
    expect(checkRefundAmount(4500, proposal, 'Rücksendekosten übernommen')).toEqual({ ok: true })
    expect(checkRefundAmount(7591, proposal, 'zu viel')).toMatchObject({
      ok: false,
      code: 'too_high',
    })
    expect(checkRefundAmount(40.4, proposal, null)).toMatchObject({ ok: false, code: 'invalid' })
  })
})
