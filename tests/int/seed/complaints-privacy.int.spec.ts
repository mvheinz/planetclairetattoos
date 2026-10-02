import { readdir } from 'node:fs/promises'

import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getEnv } from '@/lib/env'
import { COMPLAINT_STATUSES, PRIVACY_REQUEST_STATUSES } from '@/lib/enums'
import { runWithdrawalDeadlines } from '@/lib/legal/withdrawalDeadlines'
import { runPrivacyRequestReminders } from '@/lib/privacy/reminders'
import { privacyRequestDueAt } from '@/lib/privacy/deadlines'
import { SEED_TODAY_ANCHORS, expectedCount } from '@/lib/seed/expected'
import { resolveSeedDate } from '@/lib/seed/time'
import { addBerlinMonths } from '@/lib/time'

import { getTestPayload } from '../helpers/payload'
import {
  SEED_N,
  SEED_TIMEOUT,
  bySeedKey,
  findAll,
  runCanonicalSeed,
  type SeedDoc,
} from './canonical'

// P8.5a: Reklamationen RK1–RK4 (SEED-SPEC §10a, DATENMODELL §6.29) und Datenschutz-Anfragen DS1–DS5 (§11a, §6.26) –
// Status-Abdeckung (AK-SEED-22), Feldregeln (DM-CMP-01, DM-PRQ-01), keine fällige Erinnerung bei kanonischem N, der
// Seed versendet nichts (AK-SEED-05), Entfernen und Idempotenz (§1.3, §18).

let payload: Payload
let complaints: SeedDoc[]
let requests: SeedDoc[]

const d = (expr: string) => resolveSeedDate(expr, SEED_N).toISOString()
const key = (doc: SeedDoc) => String(doc.seedKey).split(':')[1]!
const years = (iso: string, n: number) => addBerlinMonths(new Date(iso), 12 * n).toISOString()

async function mailFiles(): Promise<number> {
  try {
    return (await readdir(getEnv().EMAIL_FILE_DIR)).length
  } catch {
    return 0
  }
}

beforeAll(async () => {
  payload = await getTestPayload()
  await runCanonicalSeed(payload)
  complaints = await findAll(payload, 'complaints', { seed: { equals: true } })
  requests = await findAll(payload, 'privacy-requests', { seed: { equals: true } })
}, SEED_TIMEOUT)

afterAll(async () => {
  await runCanonicalSeed(payload, 'remove', { yes: true, dropTexts: true })
}, SEED_TIMEOUT)

describe('Reklamationen (SEED-SPEC §10a)', () => {
  it('Mengen = SEED_EXPECTED_COUNTS; je Wert aus COMPLAINT_STATUSES genau eine', () => {
    expect(complaints).toHaveLength(expectedCount('complaints'))
    expect([...complaints.map((c) => c.status)].sort()).toEqual([...COMPLAINT_STATUSES].sort())
    const table = Object.fromEntries(
      complaints.map((c) => [key(c), [c.kind, c.status, c.remedy ?? null]]),
    )
    expect(table).toEqual({
      RK1: ['transport_damage', 'open', null],
      RK2: ['defect', 'waiting_customer', 'repair'],
      RK3: ['defect', 'resolved', 'repair'],
      RK4: ['defect', 'rejected', 'none'],
    })
  })

  it('DM-CMP-01: nur an bezahlten Bestellungen nach Versand bzw. Übergabe; Fristen berechnet', async () => {
    for (const c of complaints) {
      const order = await payload.findByID({
        collection: 'orders',
        id: c.order as number,
        depth: 0,
        overrideAccess: true,
      })
      const ts = order.timestamps as Record<string, string | null | undefined>
      expect(ts.paidAt, key(c)).toBeTruthy()
      const after = ts.pickedUpAt ?? ts.shippedAt
      expect(Date.parse(String(c.receivedAt)), key(c)).toBeGreaterThan(Date.parse(String(after)))
      expect(order.status, key(c)).not.toBe('refunded')
    }
    const byKey = Object.fromEntries(complaints.map((c) => [key(c), c]))
    // RK1: Transportschaden ohne erfasste Zustellung → Frist ab Eingang
    expect(byKey.RK1!.carrierClaimDueAt).toBe(d('D+6@19:05'))
    expect(byKey.RK1!.warrantyEndsAt ?? null).toBeNull()
    expect(byKey.RK2!.warrantyEndsAt).toBe(years(d('D-19@10:20'), 2))
    expect(byKey.RK2!.repairChoiceSentAt).toBe(d('D-3@10:00'))
    expect(byKey.RK2!.customerChoice ?? null).toBeNull()
    expect(byKey.RK3).toMatchObject({
      customerChoice: 'repair',
      customerChoiceAt: d('D-28@18:10'),
      warrantyEndsAt: years(d('D-36@17:00'), 3),
    })
    expect(byKey.RK4).toMatchObject({ vsbgNoticeSentAt: d('D-4@11:00') })
    expect(byKey.RK4!.warrantyEndsAt).toBe(years(d('D-8@13:05'), 2))
    for (const k of ['RK2', 'RK3', 'RK4']) expect(byKey[k]!.carrierClaimDueAt ?? null).toBeNull()
    expect(String(byKey.RK1!.notes)).toContain('Bei DHL bis 21.10.2026 reklamieren')
  })

  it('Fotos: RK1 und RK2 mit je einem Reklamationsfoto (relatedComplaint, Bestellung), RK3/RK4 ohne', async () => {
    const byKey = Object.fromEntries(complaints.map((c) => [key(c), c]))
    for (const k of ['RK1', 'RK2']) {
      const photo = await bySeedKey(payload, 'private-uploads', `${k}:photo-1`)
      expect(photo.purpose).toBe('complaint_photo')
      expect(photo.relatedComplaint).toBe(byKey[k]!.id)
      expect(photo.relatedOrder).toBe(byKey[k]!.order)
      expect(byKey[k]!.photos).toEqual([photo.id])
    }
    for (const k of ['RK3', 'RK4']) expect((byKey[k]!.photos as unknown[]) ?? []).toEqual([])
  })
})

describe('Datenschutz-Anfragen (SEED-SPEC §11a)', () => {
  it('Mengen; je Wert aus PRIVACY_REQUEST_STATUSES genau eine; Nummern DS-2026-900N steigen mit dem Eingang', () => {
    expect(requests).toHaveLength(expectedCount('privacy-requests'))
    expect([...requests.map((r) => r.status)].sort()).toEqual([...PRIVACY_REQUEST_STATUSES].sort())
    const sorted = [...requests].sort((a, b) =>
      String(a.receivedAt).localeCompare(String(b.receivedAt)),
    )
    expect(sorted.map((r) => r.reference)).toEqual([1, 2, 3, 4, 5].map((n) => `DS-2026-900${n}`))
    expect(requests.find((r) => r.locale === 'en')?.reference).toBe('DS-2026-9005')
    expect(new Set(requests.map((r) => r.channel))).toEqual(
      new Set(['email', 'letter', 'instagram_dm']),
    )
  })

  it('DM-PRQ-01: dueAt kalendergenau (+1 Monat), answeredAt bei answered/rejected, resultNote bei rejected; keine Exportdatei', async () => {
    const byKey = Object.fromEntries(requests.map((r) => [key(r), r]))
    for (const r of requests) {
      expect(r.dueAt, key(r)).toBe(
        privacyRequestDueAt(new Date(String(r.receivedAt))).toISOString(),
      )
      expect(r.exportFile ?? null, key(r)).toBeNull()
      expect(r.remindersSent ?? {}, key(r)).toEqual({})
      const closed = r.status === 'answered' || r.status === 'rejected'
      expect(Boolean(r.answeredAt), key(r)).toBe(closed)
      expect(Boolean(r.retainUntil), key(r)).toBe(closed)
    }
    expect(byKey.DS1!.dueAt).toBe(privacyRequestDueAt(new Date(d('D-36'))).toISOString())
    expect(byKey.DS3!.dueAt).toBe(privacyRequestDueAt(new Date(d('D-5'))).toISOString())
    expect(String(byKey.DS2!.resultNote)).toMatch(/^Abgelehnt: /)
    expect(String(byKey.DS2!.resultNote)).toContain('am 20.09.2026 erbeten; bis 04.10.2026')
    expect(byKey.DS1).toMatchObject({
      identityVerified: true,
      identityMethod: 'stored_email',
      identityVerifiedAt: d('D-36@10:00'),
      answeredAt: d('D-33@17:00'),
    })
    expect(byKey.DS1!.matchedOrders).toEqual([(await bySeedKey(payload, 'orders', 'O01')).id])
    expect(byKey.DS4!.matchedWithdrawals).toEqual([
      (await bySeedKey(payload, 'withdrawals', 'W4')).id,
      (await bySeedKey(payload, 'withdrawals', 'W6')).id,
    ])
    for (const r of requests) {
      expect(String(r.contactEmail), key(r)).toMatch(/@example\.(com|org)$/)
    }
  })

  it('„Heute“: offene Datenschutz-Anfragen mit nächster Frist (DS3)', async () => {
    const { getTodaySummary } = await import('@/lib/admin/today')
    const today = await getTodaySummary(SEED_N, payload)
    const hint = today.hints.find((h) => h.id === 'privacy-requests')
    expect(hint?.text).toContain(`${SEED_TODAY_ANCHORS.privacyOpen} offene Datenschutz-Anfragen`)
    expect(hint?.text).toContain(SEED_TODAY_ANCHORS.nextPrivacyReference)
  })
})

describe('Fristen-Jobs und Lebenszyklus', () => {
  it('privacyRequestsDeadlineReminder und withdrawalDeadlines senden nach dem Seed keine Mail (Beispieldaten übersprungen)', async () => {
    const before = await payload.count({ collection: 'email-log', overrideAccess: true })
    const files = await mailFiles()
    for (const at of [SEED_N, new Date(d('D+20')), new Date(d('D+40'))]) {
      expect((await runPrivacyRequestReminders(payload, at)).reminded).toBe(0)
      expect((await runWithdrawalDeadlines(payload, at)).reminded).toBe(0)
    }
    expect((await payload.count({ collection: 'email-log', overrideAccess: true })).totalDocs).toBe(
      before.totalDocs,
    )
    expect(await mailFiles()).toBe(files)
  })

  it(
    'ein zweiter Seed legt nichts doppelt an; seed:remove --yes entfernt Reklamationen, Datenschutz-Anfragen und Reklamationsfotos',
    async () => {
      const { report } = await runCanonicalSeed(payload, 'all')
      for (const c of ['complaints', 'privacy-requests', 'withdrawals', 'inquiries'] as const) {
        expect(report.get(c, 'created'), c).toBe(0)
        expect(await findAll(payload, c, { seed: { equals: true } })).toHaveLength(expectedCount(c))
      }
      await runCanonicalSeed(payload, 'remove', { yes: true })
      expect(await findAll(payload, 'complaints')).toHaveLength(0)
      expect(await findAll(payload, 'privacy-requests')).toHaveLength(0)
      expect(
        await findAll(payload, 'private-uploads', { purpose: { equals: 'complaint_photo' } }),
      ).toHaveLength(0)
    },
    SEED_TIMEOUT,
  )
})
