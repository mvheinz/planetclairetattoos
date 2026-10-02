import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getTodaySummary } from '@/lib/admin/today'
import {
  INQUIRY_STATUSES,
  WITHDRAWAL_MATCH_STATUSES,
  WITHDRAWAL_STATUSES,
  COMPLAINT_STATUSES,
  PRIVACY_REQUEST_STATUSES,
} from '@/lib/enums'
import { SEED_TODAY_ANCHORS, expectedCount } from '@/lib/seed/expected'
import { resolveSeedDate } from '@/lib/seed/time'
import { inquiryDeleteAfter } from '@/lib/retention/policy'

import { getTestPayload } from '../helpers/payload'
import {
  SEED_N,
  SEED_TIMEOUT,
  bySeedKey,
  findAll,
  runCanonicalSeed,
  type SeedDoc,
} from './canonical'

// P8.5/P8.5a: Widerrufe W1–W7 (SEED-SPEC §10) und Anfragen A1–A7 (§11) mit Status, Zuordnung, Fristen und
// unveränderlichen Texten; Verwaltung „Heute“ zeigt genau die Anker aus §17 (`SEED_TODAY_ANCHORS`); AK-SEED-22.

let payload: Payload
let withdrawals: SeedDoc[]
let inquiries: SeedDoc[]

const d = (expr: string) => resolveSeedDate(expr, SEED_N).toISOString()
const key = (doc: SeedDoc) => String(doc.seedKey).split(':')[1]!

beforeAll(async () => {
  payload = await getTestPayload()
  await runCanonicalSeed(payload)
  withdrawals = await findAll(payload, 'withdrawals', { seed: { equals: true } })
  inquiries = await findAll(payload, 'inquiries', { seed: { equals: true } })
}, SEED_TIMEOUT)

afterAll(async () => {
  await runCanonicalSeed(payload, 'remove', { yes: true, dropTexts: true })
}, SEED_TIMEOUT)

describe('Widerrufe (SEED-SPEC §10)', () => {
  it('Mengen, Nummern WR-2026-9000N steigen mit dem Eingang, alle online_form', () => {
    expect(withdrawals).toHaveLength(expectedCount('withdrawals'))
    const sorted = [...withdrawals].sort((a, b) =>
      String(a.receivedAt).localeCompare(String(b.receivedAt)),
    )
    expect(sorted.map((w) => w.reference)).toEqual(
      [1, 2, 3, 4, 5, 6, 7].map((n) => `WR-2026-9000${n}`),
    )
    expect(withdrawals.every((w) => w.channel === 'online_form')).toBe(true)
  })

  it('matchStatus/status je Widerruf wie §10; jeder Wert aus WITHDRAWAL_STATUSES und WITHDRAWAL_MATCH_STATUSES kommt vor', async () => {
    const table = Object.fromEntries(withdrawals.map((w) => [key(w), [w.matchStatus, w.status]]))
    expect(table).toEqual({
      W1: ['auto_matched', 'refunded'],
      W2: ['manually_matched', 'partially_refunded'],
      W3: ['auto_matched', 'goods_returned'],
      W4: ['needs_manual_match', 'received'],
      W5: ['auto_matched', 'received'],
      W6: ['needs_manual_match', 'closed'],
      W7: ['no_order', 'rejected'],
    })
    expect(new Set(withdrawals.map((w) => w.status))).toEqual(new Set(WITHDRAWAL_STATUSES))
    expect(new Set(withdrawals.map((w) => w.matchStatus))).toEqual(
      new Set(WITHDRAWAL_MATCH_STATUSES),
    )
    const order = async (k: string) => (await bySeedKey(payload, 'orders', k)).id
    const byKey = Object.fromEntries(withdrawals.map((w) => [key(w), w]))
    expect(byKey.W1!.order).toBe(await order('O01'))
    expect(byKey.W2!.order).toBe(await order('O05'))
    expect(byKey.W2!.affectedItemIds).toEqual(['O05-L2'])
    expect(byKey.W3!.order).toBe(await order('O04'))
    expect(byKey.W5!.order).toBe(await order('O06'))
    for (const k of ['W4', 'W6', 'W7']) expect(byKey[k]!.order ?? null, k).toBeNull()
  })

  it('W3 refundDueAt = D+5@19:30, W5 locale en mit Frist D+13@21:18; Zeitpunkte, Texte und Snapshot', () => {
    const byKey = Object.fromEntries(withdrawals.map((w) => [key(w), w]))
    expect(byKey.W3!.refundDueAt).toBe(d('D+5@19:30'))
    expect(byKey.W5!.locale).toBe('en')
    expect(byKey.W5!.refundDueAt).toBe(d('D+13@21:18'))
    expect(byKey.W1!.receivedAt).toBe(d('D-43@18:22'))
    expect(byKey.W1!.goodsReturnedAt).toBe(d('D-38@11:00'))
    expect(byKey.W1!.refundedAt).toBe(d('D-37@09:15'))
    expect(byKey.W1!.returnTrackingNumber).toBe('SEEDRET9000000000001')
    expect(byKey.W1!.contractIdentification).toBe('Bestellung PC-2026-90001 vom 26.08.2026')
    expect(byKey.W1!.confirmationSentAt).toBe(byKey.W1!.receivedAt)
    for (const w of withdrawals) {
      const snap = w.submissionSnapshot as Record<string, unknown>
      expect(snap.receivedAt, key(w)).toBe(w.receivedAt)
      expect(snap.contractIdentification).toBe(w.contractIdentification)
      expect(String(snap.receivedAtBerlin)).toMatch(/Europe\/Berlin/)
      expect(String(w.email)).toMatch(/@example\.(com|org)$/)
    }
  })

  it('W6 closed (duplicate), W7 rejected mit closeNote und Test/Spam-Markierung, retainUntil = markedAt + 30 Tage', () => {
    const byKey = Object.fromEntries(withdrawals.map((w) => [key(w), w]))
    expect(byKey.W6).toMatchObject({ closeReason: 'duplicate', closedAt: d('D+0@08:40') })
    expect(byKey.W7).toMatchObject({ rejectedAt: d('D+0@08:45') })
    expect(String(byKey.W7!.closeNote)).toMatch(/^Test-Eingabe ohne Vertragsbezug/)
    const spam = byKey.W7!.spam as { markedAt: string; reason: string }
    expect(spam.markedAt).toBe(d('D+0@08:45'))
    expect(spam.reason).toBe('Offensichtliche Testeingabe ohne Vertragsbezug.')
    const days =
      (Date.parse(String(byKey.W7!.retainUntil)) - Date.parse(spam.markedAt)) / 86_400_000
    expect(Math.round(days)).toBe(30)
    expect(String(byKey.W6!.retainUntil)).toMatch(/^2032-12-31T/)
  })

  it('W6 und W7 ändern keine Bestellung (beide ohne Bezug); die Bestellstatus bleiben wie §7', async () => {
    const orders = await findAll(payload, 'orders', { seed: { equals: true } })
    const status = Object.fromEntries(orders.map((o) => [key(o), o.status]))
    expect(status).toMatchObject({
      O01: 'refunded',
      O04: 'return_received',
      O05: 'partially_refunded',
      O06: 'withdrawal_received',
    })
  })
})

describe('Anfragen (SEED-SPEC §11)', () => {
  it('A1–A7 im Status laut §11; jeder Wert aus INQUIRY_STATUSES genau einmal; Nummern steigen mit dem Eingang', () => {
    expect(inquiries).toHaveLength(expectedCount('inquiries'))
    const table = Object.fromEntries(inquiries.map((i) => [key(i), [i.reference, i.status]]))
    expect(table).toEqual({
      A1: ['AA-2026-9001', 'declined'],
      A2: ['AA-2026-9002', 'accepted'],
      A3: ['AA-2026-9003', 'completed'],
      A4: ['AA-2026-9004', 'new'],
      A5: ['AA-2026-9005', 'offer_sent'],
      A6: ['AA-2026-9006', 'in_progress'],
      A7: ['AA-2026-9007', 'closed'],
    })
    expect([...inquiries.map((i) => i.status)].sort()).toEqual([...INQUIRY_STATUSES].sort())
    const sorted = [...inquiries].sort((a, b) =>
      String(a.createdAt).localeCompare(String(b.createdAt)),
    )
    expect(sorted.map((i) => i.reference)).toEqual(
      [...inquiries.map((i) => String(i.reference))].sort(),
    )
  })

  it('createdAt, lastActivityAt, deleteAfter = createdAt + 6 Monate, Sprache, Referenzbild nur bei A2', async () => {
    const byKey = Object.fromEntries(inquiries.map((i) => [key(i), i]))
    expect(byKey.A1).toMatchObject({
      createdAt: d('D-40@16:20'),
      lastActivityAt: d('D-38@10:00'),
      locale: 'en',
    })
    expect(byKey.A6!.locale).toBe('en')
    expect(
      inquiries
        .filter((i) => i.locale === 'en')
        .map(key)
        .sort(),
    ).toEqual(['A1', 'A6'])
    expect(byKey.A5!.lastActivityAt).toBe(d('D+0@09:15'))
    for (const i of inquiries) {
      expect(i.deleteAfter, key(i)).toBe(
        inquiryDeleteAfter(new Date(String(i.createdAt))).toISOString(),
      )
      expect(i.privacyNoticeVersion, key(i)).toBeTruthy()
    }
    const sketch = await bySeedKey(payload, 'private-uploads', 'A2:sketch-1')
    expect(byKey.A2!.referenceImages).toEqual([sketch.id])
    expect(sketch.relatedInquiry).toBe(byKey.A2!.id)
    for (const k of ['A1', 'A3', 'A4', 'A5', 'A6', 'A7']) {
      expect((byKey[k]!.referenceImages as unknown[] | undefined) ?? [], k).toEqual([])
    }
    expect(String(byKey.A2!.adminNotes)).toContain('Zusage per Mail am 10.10.2026')
  })
})

describe('Verwaltung „Heute“ (SEED-SPEC §17)', () => {
  it('zeigt genau die Anker aus SEED_TODAY_ANCHORS', async () => {
    const today = await getTodaySummary(SEED_N, payload)
    const a = SEED_TODAY_ANCHORS
    expect(today.tiles.packen.count).toBe(a.packen)
    expect(today.tiles.vorkasse.count).toBe(a.vorkasse)
    expect(today.tiles.abholung.count).toBe(a.abholung)
    expect(today.tiles.widerrufe).toMatchObject({
      count: a.widerrufe,
      nextReference: a.nextWithdrawalReference,
      nextDueAt: d(a.nextWithdrawalDue),
    })
    expect(today.tiles.anfragen.count).toBe(a.anfragen)
    const shipped = await findAll(payload, 'orders', { status: { equals: 'shipped' } })
    expect(shipped).toHaveLength(a.versendet)
    const disputes = today.hints.filter((h) => h.id.startsWith('dispute-'))
    expect(disputes.map((h) => h.tone)).toEqual(a.disputedOrders.map(() => 'error'))
    for (const n of a.disputedOrders) expect(disputes.some((h) => h.text.includes(n))).toBe(true)
    const privacy = today.hints.find((h) => h.id === 'privacy-requests')
    expect(privacy?.text).toContain(`${a.privacyOpen} offene Datenschutz-Anfragen`)
    expect(privacy?.text).toContain(a.nextPrivacyReference)
    expect(today.hints.some((h) => h.id === 'seed')).toBe(a.seedHint)
  })
})

describe('Status-Abdeckung (AK-SEED-22)', () => {
  it('jeder Wert aus WITHDRAWAL_STATUSES, WITHDRAWAL_MATCH_STATUSES, COMPLAINT_STATUSES, INQUIRY_STATUSES und PRIVACY_REQUEST_STATUSES kommt vor', async () => {
    const values = async (collection: 'complaints' | 'privacy-requests') =>
      new Set((await findAll(payload, collection, { seed: { equals: true } })).map((x) => x.status))
    expect(new Set(withdrawals.map((w) => w.status))).toEqual(new Set(WITHDRAWAL_STATUSES))
    expect(new Set(withdrawals.map((w) => w.matchStatus))).toEqual(
      new Set(WITHDRAWAL_MATCH_STATUSES),
    )
    expect(new Set(inquiries.map((i) => i.status))).toEqual(new Set(INQUIRY_STATUSES))
    expect(await values('complaints')).toEqual(new Set(COMPLAINT_STATUSES))
    expect(await values('privacy-requests')).toEqual(new Set(PRIVACY_REQUEST_STATUSES))
  })
})
