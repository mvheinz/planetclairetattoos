import { describe, expect, it } from 'vitest'

import { buildStatusLine, customerStatus, maskEmail } from '@/lib/commerce/orderStatusLine'

// P4.23 – Statusverlauf der Bestellstatus-Seite (KO-16): Varianten Versand, Abholung, Vorkasse; Widerruf/Erstattung als
// eigene Einträge; `disputed` zeigt den Status davor (DATENMODELL §6.8.2); E-Mail maskiert (R-067).

const placedAt = '2026-10-01T10:00:00.000Z'
const at = (d: number) => `2026-10-0${d}T10:00:00.000Z`
const summary = (steps: ReturnType<typeof buildStatusLine>) =>
  steps.map((s) => `${s.key}:${s.state}${s.extra ? '+' : ''}`)

describe('buildStatusLine', () => {
  it('Versand, versendet: bestellt → bezahlt → gepackt → versendet (aktuell) → zugestellt (kommt)', () => {
    const steps = buildStatusLine({
      status: 'shipped',
      fulfillmentMethod: 'shipping',
      paymentMethod: 'card',
      placedAt,
      history: [
        { to: 'paid', at: at(1) },
        { to: 'packed', at: at(2) },
        { to: 'shipped', at: at(3) },
      ],
    })
    expect(summary(steps)).toEqual([
      'ordered:done',
      'paid:done',
      'packed:done',
      'shipped:current',
      'delivered:upcoming',
    ])
    expect(steps[3]!.at).toBe(at(3))
    expect(steps.filter((s) => s.state === 'current')).toHaveLength(1)
  })

  it('Abholung: bereit zur Abholung → abgeholt', () => {
    const steps = buildStatusLine({
      status: 'ready_for_pickup',
      fulfillmentMethod: 'pickup',
      paymentMethod: 'paypal',
      placedAt,
      history: [
        { to: 'paid', at: at(1) },
        { to: 'ready_for_pickup', at: at(2) },
      ],
    })
    expect(summary(steps)).toEqual([
      'ordered:done',
      'paid:done',
      'ready_for_pickup:current',
      'picked_up:upcoming',
    ])
  })

  it('Vorkasse offen: bestellt (aktuell), „Zahlung eingegangen“ kommt noch', () => {
    const steps = buildStatusLine({
      status: 'awaiting_prepayment',
      fulfillmentMethod: 'shipping',
      paymentMethod: 'prepayment',
      placedAt,
      history: [{ to: 'awaiting_prepayment', at: placedAt }],
    })
    expect(summary(steps).slice(0, 2)).toEqual(['ordered:current', 'prepaymentReceived:upcoming'])
  })

  it('Erstattung (O19) als eigener Eintrag, keine kommenden Schritte', () => {
    const steps = buildStatusLine({
      status: 'refunded',
      fulfillmentMethod: 'shipping',
      paymentMethod: 'card',
      placedAt,
      history: [{ to: 'refunded', at: at(1) }],
    })
    expect(summary(steps)).toEqual(['ordered:done', 'refunded:current+'])
  })

  it('Widerruf nach Zustellung: Widerruf und Erstattung als eigene Einträge', () => {
    const steps = buildStatusLine({
      status: 'refunded',
      fulfillmentMethod: 'shipping',
      paymentMethod: 'card',
      placedAt,
      history: [
        { to: 'paid', at: at(1) },
        { to: 'packed', at: at(2) },
        { to: 'shipped', at: at(3) },
        { to: 'delivered', at: at(4) },
        { to: 'withdrawal_received', at: at(5) },
        { to: 'refunded', at: at(6) },
      ],
    })
    expect(summary(steps)).toEqual([
      'ordered:done',
      'paid:done',
      'packed:done',
      'shipped:done',
      'delivered:done',
      'withdrawal_received:done+',
      'refunded:current+',
    ])
  })

  it('DM-ORD Anfechtung: `disputed` zeigt den Status aus `statusBeforeDispute`', () => {
    expect(customerStatus('disputed', 'delivered')).toBe('delivered')
    const steps = buildStatusLine({
      status: 'disputed',
      statusBeforeDispute: 'delivered',
      fulfillmentMethod: 'shipping',
      paymentMethod: 'card',
      placedAt,
      history: [
        { to: 'paid', at: at(1) },
        { to: 'packed', at: at(2) },
        { to: 'shipped', at: at(3) },
        { to: 'delivered', at: at(4) },
        { to: 'disputed', at: at(5) },
      ],
    })
    expect(summary(steps)).toEqual([
      'ordered:done',
      'paid:done',
      'packed:done',
      'shipped:done',
      'delivered:current',
    ])
  })
})

describe('maskEmail', () => {
  it('R-067: e•••@example.com', () => {
    expect(maskEmail('erika.beispiel@example.com')).toBe('e•••@example.com')
    expect(maskEmail('')).toBeNull()
    expect(maskEmail('kaputt')).toBeNull()
  })
})
