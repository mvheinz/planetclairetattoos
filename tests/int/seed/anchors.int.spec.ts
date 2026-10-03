import { randomUUID } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import { strFromU8, unzipSync } from 'fflate'
import { createLocalReq, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { loadPickupList } from '@/admin/views/orders/fulfillmentQuery'
import { loadPackingList } from '@/admin/views/orders/orderQuery'
import { parsePiecesQuery, queryPieces } from '@/admin/views/pieces/piecesQuery'
import {
  evaluateProductTransition,
  loadProductTransitionFacts,
} from '@/lib/commerce/productTransitions'
import { prepareMail } from '@/lib/email/prepare'
import { legalTextOrderCounts } from '@/lib/legal/admin'
import { ADMIN_TEMPLATE_KEYS, renderAdminTemplate, templateFitsOrder } from '@/lib/legal/templates'
import { inTransaction } from '@/lib/payload/transaction'
import { createPrivacyExport, type PrivacyExportData } from '@/lib/privacy/export'
import { readStoredFile } from '@/lib/storage/read'
import { daysUntilStart, offerState } from '@/lib/tattoo/offers'
import type { EmailLog, Order } from '@/payload-types'

import { FORBIDDEN_CONTENT_PATTERNS } from '../../helpers/forbiddenPatterns'
import { V09_PATTERNS } from '../../helpers/mails'
import { adminReq, resetAdmin } from '../helpers/admin'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'
import {
  bySeedKey,
  findAll,
  runCanonicalSeed,
  SEED_N,
  SEED_TIMEOUT,
  type SeedDoc,
} from './canonical'

// P8.21 – Kriterien aus P1–P7 mit dem Vermerk „mit dem echten Anker prüft P8.21“, die dort gegen gleichartige
// Fixtures liefen, hier gegen den Beispielbestand (kanonisches `SEED_NOW`, SEED-SPEC §17). Testnamen nennen Anker und
// Aufgabe. Die Zuordnung Kriterium → Test steht in docs/FORTSCHRITT.md (P8.21).

vi.setConfig({ testTimeout: SEED_TIMEOUT, hookTimeout: SEED_TIMEOUT * 2 })

let payload: Payload
let token: string
let userId: number
const auth = () => ({ authorization: `JWT ${token}` })
const admin = (): Promise<PayloadRequest> => adminReq(payload, userId)
const order = (key: string) => bySeedKey(payload, 'orders', key) as Promise<SeedDoc & Order>
const V11 =
  /(innerhalb|binnen|within)\s+(von\s+)?\d+\s+(Tag(en)?|days?).{0,60}(sonst|andernfalls|ausgeschlossen|erlischt|verfällt|otherwise|excluded|expires?)/i
const V01 = FORBIDDEN_CONTENT_PATTERNS.filter((p) => p.id === 'V-01').map((p) => p.re)

async function mailCount(orderId: number, template: string): Promise<number> {
  return (
    await payload.count({
      collection: 'email-log',
      where: { and: [{ order: { equals: orderId } }, { template: { equals: template } }] },
      overrideAccess: true,
    })
  ).totalDocs
}

beforeAll(async () => {
  payload = await getTestPayload()
  await runCanonicalSeed(payload, 'reset')
  const acc = await resetAdmin(payload, '198.51.100.88')
  token = acc.token
  userId = acc.userId
})

afterAll(async () => {
  await runCanonicalSeed(payload, 'remove', { yes: true, dropTexts: true })
  for (const collection of ['pages', 'faqs'] as const) {
    await payload.delete({
      collection,
      where: { seedKey: { exists: true } },
      overrideAccess: true,
      context: { seed: true, skipAudit: true },
    })
  }
})

describe('P8.21 Anker aus P5 (Verwaltung)', () => {
  it('P8.21 S09/O08 (P1.19, P5.6): nach Erstattung wegen Bruch ist P13 erlaubt, P11 nicht; S09 steht archiviert', async () => {
    const s09 = await bySeedKey(payload, 'products', 'S09')
    expect(s09.status).toBe('archived')
    const o08 = await order('O08')
    expect((o08.refunds ?? []).some((r) => r.reason === 'breakage')).toBe(true)
    const req = await admin()
    const facts = await loadProductTransitionFacts(
      req,
      { ...s09, status: 'sold', soldChannel: 'online', currentOrder: o08.id },
      'admin',
    )
    expect(evaluateProductTransition('sold', 'archiveAfterReturn', facts).ok).toBe(true)
    expect(evaluateProductTransition('sold', 'returnToStock', facts).ok).toBe(false)
  })

  it('P8.21 S14/O13 Meine Stücke (P5.8): Filter „reserviert“ zeigt S14 mit Vorkasse-Hinweis zu O13', async () => {
    const res = await queryPieces(await admin(), parsePiecesQuery({ status: 'reserved' }))
    const s14 = res.cards.find((c) => c.itemNumber === 914)
    expect(s14?.status).toBe('reserved')
    expect(s14?.reservationSource).toBe('prepayment')
    expect(s14?.reservationText).toContain('PC-2026-90013')
  })

  it('P8.21 O14/O12 Zu packen (P5.10): genau die Versand-Bestellungen O14 (paid) und O12 (packed), älteste zuerst', async () => {
    const list = await loadPackingList(await admin())
    expect(list.map((c) => c.orderNumber).sort()).toEqual(['PC-2026-90012', 'PC-2026-90014'])
    const o12 = await order('O12')
    const o14 = await order('O14')
    const older =
      new Date(o12.timestamps!.placedAt!).getTime() <= new Date(o14.timestamps!.placedAt!).getTime()
        ? 'PC-2026-90012'
        : 'PC-2026-90014'
    expect(list[0]!.orderNumber).toBe(older)
  })

  it('P8.21 O09 Abholung (P5.17): mit Wartetagen; „Erneut senden“ von M07 erzeugt genau einen neuen email-log-Eintrag', async () => {
    const o09 = await order('O09')
    const cards = await loadPickupList(await admin(), SEED_N)
    const card = cards.find((c) => c.orderNumber === 'PC-2026-90009')
    expect(card?.status).toBe('ready_for_pickup')
    expect(card!.waitingDays).toBeGreaterThanOrEqual(0)
    const before = await mailCount(o09.id, 'pickup_ready')
    const dialogKey = randomUUID()
    const res = await rest(
      'POST',
      `/orders/${o09.id}/resend-email`,
      { template: 'pickup_ready', dialogKey },
      auth(),
    )
    expect(res.status, await res.clone().text()).toBe(200)
    expect(await mailCount(o09.id, 'pickup_ready')).toBe(before + 1)
    // gleicher Dialog-Schlüssel → keine zweite Mail
    await rest(
      'POST',
      `/orders/${o09.id}/resend-email`,
      { template: 'pickup_ready', dialogKey },
      auth(),
    )
    expect(await mailCount(o09.id, 'pickup_ready')).toBe(before + 1)
  })

  it('P8.21 O13 Vorkasse offen (P5.18, R-071, R-120): „Zahlung erhalten“ → paid, Rechnung, M05 genau einmal', async () => {
    const o13 = await order('O13')
    expect(o13.status).toBe('awaiting_prepayment')
    const invoicesBefore = (
      await payload.count({
        collection: 'invoices',
        where: { order: { equals: o13.id } },
        overrideAccess: true,
      })
    ).totalDocs
    const first = await rest(
      'POST',
      `/orders/${o13.id}/prepayment-received`,
      { amountCents: o13.totalCents },
      auth(),
    )
    expect(first.status, await first.clone().text()).toBe(200)
    const second = await rest(
      'POST',
      `/orders/${o13.id}/prepayment-received`,
      { amountCents: o13.totalCents },
      auth(),
    )
    expect(((await second.json()) as { unchanged: boolean }).unchanged).toBe(true)
    expect((await order('O13')).status).toBe('paid')
    expect(
      (
        await payload.count({
          collection: 'invoices',
          where: { order: { equals: o13.id } },
          overrideAccess: true,
        })
      ).totalDocs,
    ).toBe(invoicesBefore + 1)
    expect(await mailCount(o13.id, 'prepayment_received')).toBe(1)
  })

  it('P8.21 O10/O07 Vorlagen fürs Mailprogramm (P5.27, R-084): jede Vorlage ohne offene Platzhalter, ohne V-01/V-09/V-11', async () => {
    const o10 = await order('O10')
    const o07 = await order('O07')
    for (const key of ADMIN_TEMPLATE_KEYS) {
      const o = (key === 'prepayment_refund_iban' ? o07 : o10) as unknown as Parameters<
        typeof renderAdminTemplate
      >[1]['order']
      expect(templateFitsOrder(key, o), key).toBe(true)
      const r = renderAdminTemplate(key, { order: o, signature: 'Liebe Grüße\nJutta' })
      const all = [r.subject, r.body, r.ownerNote ?? ''].join('\n')
      expect(all, key).not.toMatch(/\{\{|\}\}/)
      for (const re of [...V01, ...V09_PATTERNS, V11]) expect(all, key).not.toMatch(re)
    }
  })
})

describe('P8.21 Anker aus P6 (Recht)', () => {
  it('P8.21 Bestellungen je Rechtstext-Fassung (P6.4): Zähler der aktiven Fassungen = Seed-Bestellungen mit dieser Fassung', async () => {
    const counts = await legalTextOrderCounts(await admin())
    const active = await findAll(payload, 'legal-texts', { status: { equals: 'active' } })
    const db = payload.db as unknown as {
      drizzle: { execute: (q: ReturnType<typeof sql>) => Promise<{ rows: { n: number }[] }> }
    }
    const agb = active.find((t) => t.type === 'agb')!
    const res = await db.drizzle.execute(
      sql`SELECT count(*)::int AS n FROM orders WHERE legal_text_versions_agb_id = ${agb.id}`,
    )
    expect(res.rows[0]!.n).toBeGreaterThan(0)
    expect(counts.get(agb.id)).toBe(res.rows[0]!.n)
  })

  it('P8.21 W5/O05/RK1 Mails M08, M09, M12, M13 (P6.8–P6.11, R-084) rendern mit Seed-Daten ohne offene Platzhalter', async () => {
    const req = await admin()
    const w5 = await bySeedKey(payload, 'withdrawals', 'W5')
    const o05 = await order('O05')
    const o10 = await order('O10')
    const rk1 = await bySeedKey(payload, 'complaints', 'RK1')
    const credit = await bySeedKey(payload, 'invoices', 'O05:credit_note:1')
    const refund = (o05.refunds ?? [])[0]!
    const cases: {
      template: EmailLog['template']
      locale: 'de' | 'en'
      order?: number
      data: Record<string, unknown>
    }[] = [
      {
        template: 'withdrawal_receipt',
        locale: (w5.locale as 'de' | 'en') ?? 'en',
        data: {
          withdrawalId: w5.id,
          reference: w5.reference,
          receivedAt: w5.receivedAt,
          refundDueAt: w5.refundDueAt,
          name: w5.name,
          contractIdentification: w5.contractIdentification,
          email: w5.email,
          itemsText: w5.itemsText ?? null,
          items: [],
          reason: w5.reason ?? null,
        },
      },
      {
        template: 'refund_confirmation',
        locale: o05.locale,
        order: o05.id,
        data: {
          orderId: o05.id,
          orderNumber: o05.orderNumber,
          customerName: o05.customer?.name ?? null,
          amountCents: refund.amountCents,
          shippingCents: 0,
          paymentMethod: o05.paymentMethod,
          items: [],
          creditNoteId: credit.id,
          creditNoteNumber: credit.number,
        },
      },
      {
        template: 'complaint_repair_choice',
        locale: o10.locale,
        order: o10.id,
        data: {
          orderId: o10.id,
          orderNumber: o10.orderNumber,
          complaintId: rk1.id,
          customerName: o10.customer?.name ?? null,
          kind: rk1.kind,
          receivedAt: new Date(String(rk1.receivedAt)).toISOString(),
          items: [],
        },
      },
      {
        template: 'dispute_vsbg',
        locale: o10.locale,
        order: o10.id,
        data: {
          orderId: o10.id,
          orderNumber: o10.orderNumber,
          complaintId: rk1.id,
          customerName: o10.customer?.name ?? null,
          receivedAt: new Date(String(rk1.receivedAt)).toISOString(),
        },
      },
    ]
    for (const c of cases) {
      const log = {
        id: 0,
        template: c.template,
        locale: c.locale,
        order: c.order ?? null,
      } as unknown as EmailLog
      const mail = await prepareMail(req, log, c.data, SEED_N)
      expect(mail.subject, c.template).not.toMatch(/\{\{|\}\}/)
      expect(mail.text, c.template).not.toMatch(/\{\{|\}\}|undefined/)
      expect(mail.text.length, c.template).toBeGreaterThan(100)
      for (const re of V01) expect(mail.text, c.template).not.toMatch(re)
    }
  })

  it('P8.21 DS3 Auskunft-Export (P6.13, R-150): Seed-Kundin – Export enthält jeden Datensatz (Zählvergleich), JSON valide', async () => {
    const ds3 = await bySeedKey(payload, 'privacy-requests', 'DS3')
    const email = String(ds3.contactEmail).toLowerCase()
    const req = await createLocalReq({ user: (await admin()).user! }, payload)
    const created = await inTransaction(req, () =>
      createPrivacyExport(req, ds3.id, { email }, SEED_N),
    )
    const bytes = await readStoredFile('private', created.upload.filename!, created.upload.prefix)
    const zip = unzipSync(new Uint8Array(bytes!))
    const data = JSON.parse(strFromU8(zip['daten.json']!)) as PrivacyExportData
    const db = payload.db as unknown as {
      drizzle: { execute: (q: ReturnType<typeof sql>) => Promise<{ rows: { n: number }[] }> }
    }
    const n = async (q: ReturnType<typeof sql>) => Number((await db.drizzle.execute(q)).rows[0]!.n)
    const orders = await n(
      sql`SELECT count(*)::int AS n FROM orders WHERE lower(customer_email) = ${email}`,
    )
    expect(orders).toBeGreaterThan(0)
    expect(data.counts.orders).toBe(orders)
    expect(data.data.orders).toHaveLength(orders)
    expect(data.counts.withdrawals).toBe(
      await n(sql`SELECT count(*)::int AS n FROM withdrawals WHERE lower(email) = ${email}`),
    )
    expect(data.counts.inquiries).toBe(
      await n(sql`SELECT count(*)::int AS n FROM inquiries WHERE lower(email) = ${email}`),
    )
    expect(data.counts.emailLog).toBe(
      await n(sql`SELECT count(*)::int AS n FROM email_log WHERE lower("to") = ${email}`),
    )
  })
})

describe('P8.21 Anker aus P7 (Tattoo)', () => {
  it('P8.21 TO1–TO3 (P7.3, SEED-SPEC §12.2): bei kanonischem N kommt TO1 (in Tagen), TO2 läuft, TO3 ist vorbei', async () => {
    const to = async (k: string) => {
      const d = await bySeedKey(payload, 'tattoo-offers', k)
      return { startsAt: String(d.startsAt), endsAt: String(d.endsAt) }
    }
    const to1 = await to('TO1')
    expect(offerState(to1, SEED_N)).toBe('upcoming')
    expect(daysUntilStart(to1, SEED_N)).toBeGreaterThan(0)
    expect(offerState(await to('TO2'), SEED_N)).toBe('running')
    expect(offerState(await to('TO3'), SEED_N)).toBe('ended')
  })
})
