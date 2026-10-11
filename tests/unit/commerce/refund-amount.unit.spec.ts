import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  checkRefundAmount,
  orderShippingRates,
  proposeRefund,
  type RefundItem,
  type RefundProposalInput,
  type RefundRatesOrder,
} from '@/lib/commerce/refundAmount'
import {
  parseShippingRatesSnapshot,
  snapshotShippingRates,
  type ShippingSettings,
} from '@/lib/commerce/shipping'

// P6.10 – Erstattungsvorschlag (KONZEPT §5.3, R-072, KA-32/K-09) mit den Tarifen aus dem Grund-Seed
// (`content/seed/data/base.json`: Brief 450, Paket klein 650, Keramik 890). P18.5: Versanddifferenz zu den Tarifen
// bei der Bestellung (Snapshot `orders.shippingRatesAtOrder`), fehlender Tarif wird angezeigt statt still 0.

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
    rates: orderShippingRates(
      { fulfillmentMethod: 'shipping', shippingZone: 'DE', items },
      settings,
    ),
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

describe('Versandtarife bei der Bestellung (KA-32, P18.5)', () => {
  /** Grund-Seed-Tarife mit geändertem Preis für eine Klasse (Tarifänderung nach der Bestellung). */
  const changed = (shippingClass: string, priceCents: number): ShippingSettings => ({
    shipping: {
      ...settings.shipping,
      rates: (settings.shipping?.rates ?? []).map((r) =>
        r.shippingClass === shippingClass ? { ...r, priceCents } : r,
      ),
    },
  })
  const placed: RefundRatesOrder = {
    fulfillmentMethod: 'shipping',
    shippingZone: 'DE',
    shippingClass: 'keramik',
    shippingCents: 890,
    items: [cup, shirt],
  }

  it('Snapshot bei der Bestellanlage: Klassen der Positionen, bezahlte Klasse mit dem bezahlten Versand', () => {
    expect(
      snapshotShippingRates(['keramik', 'paket_klein', 'keramik'], 'DE', settings, {
        shippingClass: 'keramik',
        shippingCents: 890,
      }),
    ).toEqual({ zone: 'DE', rates: { keramik: 890, paket_klein: 650 } })
    // Was tatsächlich bezahlt wurde, gilt für die bezahlte Klasse (auch wenn der Tarif kurz davor geändert wurde)
    expect(
      snapshotShippingRates(['keramik'], 'DE', changed('keramik', 990), {
        shippingClass: 'keramik',
        shippingCents: 890,
      }).rates,
    ).toEqual({ keramik: 890 })
    // ohne Tarif fehlt die Klasse, `nur_abholung` nie
    expect(snapshotShippingRates(['brief', 'nur_abholung'], 'CH', settings)).toEqual({
      zone: 'CH',
      rates: {},
    })
  })

  it('Tarifänderung zwischen Bestellung und Widerruf: der Vorschlag rechnet mit dem Tarif der Bestellung', () => {
    const snapshot = snapshotShippingRates(['keramik', 'paket_klein'], 'DE', settings, {
      shippingClass: 'keramik',
      shippingCents: 890,
    })
    // Später: Paket klein 650 → 800 (die Kundin behielte das T-Shirt)
    const later = changed('paket_klein', 800)
    const withSnapshot = proposeRefund(
      order([cup, shirt], {
        selectedIds: ['L1'],
        rates: orderShippingRates(
          { ...placed, shippingRatesAtOrder: JSON.parse(JSON.stringify(snapshot)) },
          later,
        ),
      }),
    )
    expect(withSnapshot).toMatchObject({
      shippingCents: 240,
      proposedCents: 4040,
      shippingRateMissing: false,
    })
    // Altbestellung ohne Snapshot: aktuelle Tarife (890 − 800)
    const legacy = proposeRefund(
      order([cup, shirt], { selectedIds: ['L1'], rates: orderShippingRates(placed, later) }),
    )
    expect(legacy).toMatchObject({ shippingCents: 90, proposedCents: 3890 })
    // Altbestellung, behaltenes Stück in der bezahlten Klasse: keine Differenz, auch wenn Keramik teurer wurde
    const sameClass = proposeRefund(
      order([cup, shirt], {
        selectedIds: ['L2'],
        rates: orderShippingRates(placed, changed('keramik', 990)),
      }),
    )
    expect(sameClass).toMatchObject({ shippingCents: 0, proposedCents: 2900 })
  })

  it('fehlender Tarif der behaltenen Stücke: Versandanteil 0 mit Hinweis statt still gerechnet', () => {
    const p = proposeRefund(
      order([cup, shirt], {
        selectedIds: ['L1'],
        rates: { zone: 'EU', rates: { keramik: 1690 } },
      }),
    )
    expect(p).toMatchObject({
      itemsCents: 3800,
      shippingCents: 0,
      proposedCents: 3800,
      partial: true,
      shippingRateMissing: true,
    })
    // ohne bekannte Tarife (z. B. Land ohne Zone) ebenso
    expect(
      proposeRefund(order([cup, shirt], { selectedIds: ['L1'], rates: null })).shippingRateMissing,
    ).toBe(true)
    // Voll-Widerruf braucht keinen Tarif
    expect(
      proposeRefund(order([cup, shirt], { selectedIds: ['L1', 'L2'], rates: null })),
    ).toMatchObject({ shippingCents: 890, shippingRateMissing: false })
    // Abholung: keine Tarife, kein Hinweis
    expect(orderShippingRates({ ...placed, fulfillmentMethod: 'pickup' }, settings)).toBeNull()
    expect(
      proposeRefund(
        order([cup, shirt], {
          selectedIds: ['L1'],
          fulfillmentMethod: 'pickup',
          shippingCents: 0,
          rates: null,
        }),
      ),
    ).toMatchObject({ shippingCents: 0, shippingRateMissing: false })
  })

  it('gespeicherter Snapshot wird geprüft: Unbrauchbares zählt als „kein Snapshot“', () => {
    expect(parseShippingRatesSnapshot(null)).toBeNull()
    expect(parseShippingRatesSnapshot({ zone: 'XX', rates: {} })).toBeNull()
    expect(parseShippingRatesSnapshot({ zone: 'DE', rates: [] })).toBeNull()
    expect(
      parseShippingRatesSnapshot({
        zone: 'DE',
        rates: { keramik: 890, paket_klein: -1, brief: 4.5, quatsch: 1 },
      }),
    ).toEqual({ zone: 'DE', rates: { keramik: 890 } })
    // Zone aus dem Lieferland, wenn die Bestellung keine hat
    expect(
      orderShippingRates(
        { ...placed, shippingZone: null, shippingAddress: { country: 'at' } },
        settings,
      )?.zone,
    ).toBe('EU')
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
