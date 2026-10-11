import { describe, expect, it } from 'vitest'

import {
  erasureChoices,
  followUpsOf,
  orderStillRunning,
  stateWithoutAction,
  summarizeOutcomes,
  type ErasureOutcome,
  type ErasurePlanRow,
} from '@/lib/privacy/erasure'
import type { Order } from '@/payload-types'
import { parseConfirmed } from '@/lib/privacy/search'

// P18.5 – Antwort M15 meldet den tatsächlichen Zustand (R-151, LOESCHKONZEPT §5.6): „keine Aktion“ ist nur dann
// „eingeschränkt“, wenn die Bestellung bzw. der Widerruf schon eingeschränkt war; sonst „aufbewahrt bis“ bzw. – bei
// laufendem Vertrag – „brauche ich noch“ ohne Datum. Frist abgelaufen ohne Aktion wird abgelehnt. Bestätigte mögliche
// Treffer der Personensuche (R-150) kommen nur als gültige `{ area, id }`-Liste an.

const UNTIL_A = '2032-12-31T23:00:00.000Z'
const UNTIL_B = '2033-12-31T23:00:00.000Z'

const row = (over: Partial<ErasurePlanRow>): ErasurePlanRow => ({
  area: 'orders',
  collection: 'orders',
  id: 1,
  label: 'PC-2026-00001',
  ruleId: 'L-05 Stufe D',
  until: UNTIL_A,
  actions: ['restrict', 'keep'],
  suggested: 'restrict',
  note: '',
  ...over,
})

const outcome = (over: Partial<ErasureOutcome>): ErasureOutcome => ({
  collection: 'orders',
  id: 1,
  area: 'orders',
  action: 'none',
  state: 'inUse',
  until: UNTIL_A,
  ...over,
})

describe('R-151 Zustand bei „keine Aktion“', () => {
  it('Bestellungen und Widerrufe: eingeschränkt nur, wenn schon eingeschränkt', () => {
    expect(stateWithoutAction(row({ state: 'restricted' }))).toBe('restricted')
    expect(stateWithoutAction(row({ state: 'retained' }))).toBe('inUse')
    expect(stateWithoutAction(row({ state: 'running' }))).toBe('inUse')
    expect(stateWithoutAction(row({ state: 'held' }))).toBe('kept')
    expect(stateWithoutAction(row({ state: 'anonymized', until: null }))).toBe('deleted')
    expect(
      stateWithoutAction(
        row({ area: 'withdrawals', collection: 'withdrawals', state: 'retained' }),
      ),
    ).toBe('inUse')
  })

  it('Frist abgelaufen ohne Aktion → 400 (löschen oder begründet behalten)', () => {
    expect(() => stateWithoutAction(row({ state: 'due', until: null }))).toThrow(
      expect.objectContaining({ status: 400 }),
    )
  })

  it('Belege „unverändert“, andere Bereiche ohne Meldung', () => {
    expect(stateWithoutAction(row({ area: 'invoices', collection: 'invoices' }))).toBe('unchanged')
    expect(stateWithoutAction(row({ area: 'complaints', collection: 'complaints' }))).toBeNull()
    expect(stateWithoutAction(row({ area: 'emailLog', collection: 'email-log' }))).toBeNull()
  })
})

describe('Prüfung P18.5 laufender Vertrag, Auswahl und Nachlauf', () => {
  const NOW = new Date('2026-10-12T10:00:00.000Z')
  const PAST = '2026-09-05T10:00:00.000Z'
  const ord = (over: Partial<Order>) =>
    ({
      status: 'delivered',
      timestamps: { placedAt: PAST, finalStatusAt: PAST },
      refunds: [],
      dispute: { status: 'none' },
      ...over,
    }) as Pick<Order, 'status' | 'timestamps' | 'refunds' | 'dispute'>

  it('läuft ohne bzw. mit künftigem Endstatus und bei offenen Vorgängen nach der Zustellung', () => {
    expect(orderStillRunning(ord({}), NOW)).toBe(false)
    expect(orderStillRunning(ord({ status: 'picked_up' }), NOW)).toBe(false)
    expect(orderStillRunning(ord({ status: 'refunded' }), NOW)).toBe(false)
    expect(orderStillRunning(ord({ status: 'cancelled' }), NOW)).toBe(false)
    expect(orderStillRunning(ord({ status: 'partially_refunded' }), NOW)).toBe(false)
    // versendet: vorläufiger Endstatus nach 30 Tagen
    expect(orderStillRunning(ord({ status: 'shipped' }), NOW)).toBe(false)
    expect(
      orderStillRunning(
        ord({ status: 'shipped', timestamps: { placedAt: PAST, finalStatusAt: '2026-11-09' } }),
        NOW,
      ),
    ).toBe(true)
    expect(orderStillRunning(ord({ status: 'paid', timestamps: { placedAt: PAST } }), NOW)).toBe(
      true,
    )
    // `finalStatusAt` bleibt nach „zugestellt“ stehen – Widerruf, Rücksendung und Anfechtung laufen trotzdem
    for (const status of ['withdrawal_received', 'return_received', 'disputed'] as const) {
      expect(orderStillRunning(ord({ status }), NOW), status).toBe(true)
    }
    // nachträglich bezahlt nach Storno (alter Endstatus) läuft wieder
    expect(orderStillRunning(ord({ status: 'paid' }), NOW)).toBe(true)
    expect(
      orderStillRunning(
        ord({
          refunds: [
            { amountCents: 100, reason: 'goodwill', status: 'pending' },
          ] as unknown as Order['refunds'],
        }),
        NOW,
      ),
    ).toBe(true)
    expect(orderStillRunning(ord({ dispute: { status: 'open' } }), NOW)).toBe(true)
    expect(orderStillRunning(ord({ status: 'partially_refunded' }), NOW, true)).toBe(true)
  })

  it('„keine Aktion“ ist bei abgelaufener Frist nicht wählbar', () => {
    expect(erasureChoices(row({ state: 'due', actions: ['delete', 'keep'] }))).toEqual([
      'delete',
      'keep',
    ])
    expect(erasureChoices(row({ state: 'retained' }))).toEqual(['restrict', 'keep', 'none'])
    expect(
      erasureChoices(row({ state: 'running', actions: ['none', 'restrict', 'keep'] })),
    ).toEqual(['none', 'restrict', 'keep'])
    expect(
      erasureChoices(row({ area: 'checkouts', collection: 'checkouts', actions: ['delete'] })),
    ).toEqual(['delete', 'none'])
  })

  it('Nachlauf-Einträge aus `remindersSent` nur mit gültigem Bereich und ID', () => {
    expect(followUpsOf(null)).toEqual([])
    expect(followUpsOf({ '7d': PAST })).toEqual([])
    expect(followUpsOf({ erasureFollowUp: 'orders:1' })).toEqual([])
    expect(
      followUpsOf({
        '7d': PAST,
        erasureFollowUp: [
          { collection: 'orders', id: 3, since: PAST },
          { collection: 'withdrawals', id: '4', since: PAST },
          { collection: 'inquiries', id: 5 },
          { collection: 'orders', id: 1.5 },
          null,
        ],
      }),
    ).toEqual([
      { collection: 'orders', id: 3, since: PAST },
      { collection: 'withdrawals', id: 4, since: PAST },
    ])
  })
})

describe('R-151 summarizeOutcomes nach tatsächlichem Zustand', () => {
  it('„keine Aktion“ ohne Einschränkung wird nie als „eingeschränkt“ gemeldet', () => {
    expect(summarizeOutcomes([outcome({ id: 1 }), outcome({ id: 2, until: UNTIL_B })])).toEqual([
      { area: 'orders', outcome: 'inUse', until: UNTIL_B },
    ])
  })

  it('je Bereich: Sperre, Einschränkung, laufend (ohne Datum), aufbewahrt, gelöscht; Belege unverändert', () => {
    expect(
      summarizeOutcomes([
        outcome({ id: 1, state: 'restricted', until: UNTIL_A }),
        outcome({ id: 2, action: 'restrict', state: 'restricted', until: UNTIL_B }),
        outcome({ id: 3, state: 'inUse', until: null }),
        outcome({ id: 4, state: 'inUse', until: UNTIL_A }),
        outcome({ id: 5, action: 'delete', state: 'deleted', until: null }),
        outcome({ id: 6, action: 'keep', state: 'kept', until: UNTIL_A }),
        outcome({
          collection: 'invoices',
          id: 7,
          area: 'invoices',
          state: 'unchanged',
          until: UNTIL_B,
        }),
        outcome({ collection: 'withdrawals', id: 8, area: 'withdrawals', until: UNTIL_A }),
      ]),
    ).toEqual([
      { area: 'orders', outcome: 'kept', until: UNTIL_A },
      { area: 'orders', outcome: 'restricted', until: UNTIL_B },
      { area: 'orders', outcome: 'inUse', until: null },
      { area: 'orders', outcome: 'inUse', until: UNTIL_A },
      { area: 'orders', outcome: 'deleted' },
      { area: 'invoices', outcome: 'unchanged', until: UNTIL_B },
      { area: 'withdrawals', outcome: 'inUse', until: UNTIL_A },
    ])
  })
})

describe('R-150 bestätigte mögliche Treffer', () => {
  it('nimmt nur gültige Bereiche und IDs an', () => {
    expect(parseConfirmed(undefined)).toEqual({})
    expect(parseConfirmed(null)).toEqual({})
    expect(
      parseConfirmed([
        { area: 'orders', id: 3 },
        { area: 'orders', id: '4' },
        { area: 'inquiries', id: 9 },
      ]),
    ).toEqual({ orders: [3, 4], inquiries: [9] })
    for (const bad of [
      'orders:3',
      [{ area: 'invoices', id: 1 }],
      [{ area: 'files', id: 1 }],
      [{ area: 'orders', id: 0 }],
      [{ area: 'orders', id: 1.5 }],
      [{ area: 'orders' }],
      [null],
    ]) {
      expect(() => parseConfirmed(bad), JSON.stringify(bad)).toThrow(
        expect.objectContaining({ status: 400 }),
      )
    }
  })
})
