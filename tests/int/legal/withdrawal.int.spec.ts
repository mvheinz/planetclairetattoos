import { sql } from '@payloadcms/db-postgres'
import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  __setEmailAdapterForTests,
  clearMemoryOutbox,
  createEmailAdapter,
  getMemoryOutbox,
} from '@/lib/email'
import { adminRecipient } from '@/lib/email/outbox'
import { parseEnv } from '@/lib/env'
import { submitWithdrawal, type WithdrawalInput } from '@/lib/legal/withdrawal'
import { ipHash } from '@/lib/security/ipHash'
import { hit } from '@/lib/security/rateLimit'
import { transitionProduct } from '@/lib/commerce/productTransitions'
import type { EmailLog, Order, Withdrawal } from '@/payload-types'

import { createOrder, dbOf, deleteCommerce, orderData, type ItemInput } from '../helpers/commerce'
import { withBusiness } from '../helpers/invoices'
import { systemReq } from '../helpers/admin'
import { getTestPayload } from '../helpers/payload'
import { prepaymentReserved, type PrepaymentFixture } from '../helpers/pieces'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'

// P6.7 – Widerrufs-Dienst (KONZEPT §5.4 W1, R-093, R-134, DATENMODELL §6.11): speichern, zuordnen, sofort bestätigen.

const NUMBERS = [981, 982, 983, 984]
const CUSTOMER = 'erika@planetclaire.local'
const T_SUMMER = '2026-10-12T12:03:27.000Z' // Mo 12.10.2026 14:03 MESZ
let payload: Payload
let restoreBusiness: () => Promise<void>
let items: ItemInput[] = []
let prepayment: PrepaymentFixture | null = null
let ipSeq = 0
let orderNumber = ''

const memory = () => createEmailAdapter(parseEnv({ ...process.env, EMAIL_DRIVER: 'memory' }))
const nextIp = () => `203.0.113.${++ipSeq}`

const input = (overrides: Partial<WithdrawalInput> & Record<string, unknown> = {}) => ({
  name: 'Erika Beispiel',
  contractIdentification: 'Bestellung ohne Nummer',
  email: CUSTOMER,
  itemsText: 'die Tasse mit Coco',
  reason: 'Passt farblich doch nicht.',
  locale: 'de' as const,
  ...overrides,
})

async function withdrawalsByEmail(email: string): Promise<Withdrawal[]> {
  const res = await payload.find({
    collection: 'withdrawals',
    where: { email: { equals: email } },
    overrideAccess: true,
    depth: 0,
    limit: 50,
  })
  return res.docs
}

async function logsOf(withdrawalId: number): Promise<EmailLog[]> {
  const res = await payload.find({
    collection: 'email-log',
    where: { withdrawal: { equals: withdrawalId } },
    overrideAccess: true,
    depth: 0,
    sort: 'createdAt',
  })
  return res.docs
}

const mailTo = (to: string) => getMemoryOutbox().filter((m) => m.to.includes(to))

beforeAll(async () => {
  payload = await getTestPayload()
  await dbOf(payload).execute(sql`DELETE FROM email_log`)
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
  restoreBusiness = await withBusiness(payload)
  const fx = await createProductFixtures(payload)
  items = []
  for (const nr of NUMBERS) {
    const p = await createProduct(payload, completeProduct('keramik', nr, fx))
    items.push({ id: p.id as number, itemNumber: nr })
  }
  const order = await createOrder(
    payload,
    orderData(981, [items[0]!, items[1]!], {
      customer: { name: 'Erika Beispiel', email: 'Erika@PlanetClaire.Local' },
    }),
  )
  orderNumber = order.orderNumber as string
})

afterAll(async () => {
  __setEmailAdapterForTests(undefined)
  await dbOf(payload).execute(sql`DELETE FROM email_log`)
  if (prepayment) {
    await dbOf(payload).execute(
      sql`DELETE FROM reservations WHERE ref = ${prepayment.reservationRef}`,
    )
  }
  await deleteCommerce(payload)
  await deleteProducts(payload, NUMBERS)
  await restoreBusiness()
})

beforeEach(() => {
  __setEmailAdapterForTests(memory())
  clearMemoryOutbox()
})

describe('Widerruf annehmen (R-093)', () => {
  it('R-093 Datensatz unveränderlich, ohne IP; Bestellung O11; M08 mit Zeitstempel und allen Eingaben; A04 an die Admin-Adresse', async () => {
    const res = await submitWithdrawal(
      input({ contractIdentification: `Bestellung ${orderNumber.toLowerCase()}, Tasse` }),
      { now: new Date(T_SUMMER), ip: nextIp(), payload },
    )
    expect(res.ok && res.status === 201).toBe(true)
    if (!res.ok || res.spam) throw new Error('kein Datensatz')
    const r = res.receipt
    expect(r.reference).toMatch(/^WR-2026-\d{5}$/)
    expect(r.receivedAt).toBe(T_SUMMER)
    expect(r.receivedAtText).toBe('12.10.2026, 14:03 Uhr (MESZ)')
    expect(r.matchStatus).toBe('auto_matched')

    const doc = await payload.findByID({
      collection: 'withdrawals',
      id: r.id,
      overrideAccess: true,
    })
    expect(doc).toMatchObject({
      channel: 'online_form',
      status: 'received',
      receivedAt: T_SUMMER,
      refundDueAt: '2026-10-26T12:03:27.000Z',
      locale: 'de',
    })
    expect(doc.submissionSnapshot).toMatchObject({
      name: 'Erika Beispiel',
      email: CUSTOMER,
      reason: 'Passt farblich doch nicht.',
      receivedAt: T_SUMMER,
    })
    // keine IP, kein IP-Hash, kein User-Agent (R-093)
    const cols = await dbOf(payload).execute(
      sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'withdrawals'`,
    )
    const names = cols.rows.map((c) => String(c.column_name))
    expect(names.filter((n) => /ip|agent/i.test(n))).toEqual([])
    expect(JSON.stringify(doc)).not.toContain('203.0.113.')

    // Bestellung O11 mit statusBeforeWithdrawal, alle aktiven Positionen widerrufen (keine Auswahl = ganzer Vertrag)
    const order = (await payload.findByID({
      collection: 'orders',
      id: typeof doc.order === 'object' ? doc.order!.id : (doc.order as number),
      overrideAccess: true,
    })) as Order
    expect(order.status).toBe('withdrawal_received')
    expect(order.statusBeforeWithdrawal).toBe('paid')
    expect(order.items.map((i) => i.status)).toEqual(['withdrawn', 'withdrawn'])

    // M08: Zeitstempel-Text und alle Eingaben
    const m08 = mailTo(CUSTOMER)
    expect(m08).toHaveLength(1)
    const text = m08[0]!.text ?? ''
    expect(m08[0]!.subject).toBe(
      `Eingangsbestätigung deines Widerrufs ${r.reference} vom 12.10.2026, 14:03 Uhr`,
    )
    for (const part of [
      '12.10.2026, 14:03 Uhr (MESZ)',
      r.reference,
      'Erika Beispiel',
      `Bestellung ${orderNumber.toLowerCase()}, Tasse`,
      'die Tasse mit Coco',
      'Passt farblich doch nicht.',
      CUSTOMER,
      'Diese E-Mail bestätigt den Eingang deiner Widerrufserklärung',
      'Werkstattweg 7',
      'Kosten der Rücksendung trägst du',
      '26.10.2026',
    ]) {
      expect(text, part).toContain(part)
    }
    const logs = await logsOf(r.id)
    const receipt = logs.find((l) => l.template === 'withdrawal_receipt')!
    expect(receipt).toMatchObject({ status: 'sent', to: CUSTOMER })
    const after = await payload.findByID({
      collection: 'withdrawals',
      id: r.id,
      overrideAccess: true,
    })
    expect(after.confirmationSentAt).toBe(T_SUMMER)
    expect((after.confirmationEmail as number | { id: number } | null) ?? null).toBeTruthy()

    // A04 an die Admin-Adresse mit Kopie der Erklärung
    const req = await createLocalReq({}, payload)
    const admin = await adminRecipient(req)
    const a04 = logs.find((l) => l.template === 'admin_withdrawal_received')!
    expect(a04.to).toBe(admin)
    expect(a04.subject).toBe(`Widerruf eingegangen: ${r.reference} (${orderNumber})`)

    // DM-WDR-03: Update am Datensatz → Fehler
    await expect(
      payload.update({
        collection: 'withdrawals',
        id: r.id,
        data: { name: 'Jemand anderes' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
    await expect(
      payload.update({
        collection: 'withdrawals',
        id: r.id,
        data: { receivedAt: '2026-10-01T10:00:00.000Z' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it('AK-6-04 unbekannte Bestellnummer: needs_manual_match, M08 trotzdem mit Datum und Uhrzeit', async () => {
    const email = 'rudi@planetclaire.local'
    const res = await submitWithdrawal(
      input({
        email,
        name: 'Rudi Beispiel',
        contractIdentification: 'Tasse vom Flohmarkt im September',
        itemsText: null,
        reason: '',
      }),
      { now: new Date('2026-11-02T13:03:00.000Z'), ip: nextIp(), payload },
    )
    if (!res.ok || res.spam) throw new Error('kein Datensatz')
    expect(res.receipt.matchStatus).toBe('needs_manual_match')
    expect(res.receipt.reason).toBeNull()
    const doc = await payload.findByID({
      collection: 'withdrawals',
      id: res.receipt.id,
      overrideAccess: true,
    })
    expect(doc.order ?? null).toBeNull()
    const m08 = mailTo(email)
    expect(m08).toHaveLength(1)
    expect(m08[0]!.text).toContain('02.11.2026, 14:03 Uhr (MEZ)')
    expect(m08[0]!.text).toContain('der ganze Vertrag')
    const a04 = (await logsOf(res.receipt.id)).find(
      (l) => l.template === 'admin_withdrawal_received',
    )
    expect(a04?.subject).toContain('nicht zugeordnet')
  })

  it('AK-3-12 nach dem Bestätigen genau ein unveränderlicher Datensatz, M08 im Mail-Log', async () => {
    const email = 'mia@planetclaire.local'
    const res = await submitWithdrawal(input({ email, contractIdentification: 'PC-2026-09999' }), {
      now: new Date(T_SUMMER),
      ip: nextIp(),
      payload,
    })
    if (!res.ok || res.spam) throw new Error('kein Datensatz')
    const docs = await withdrawalsByEmail(email)
    expect(docs).toHaveLength(1)
    const logs = await logsOf(docs[0]!.id)
    expect(logs.filter((l) => l.template === 'withdrawal_receipt')).toHaveLength(1)
    expect(logs.find((l) => l.template === 'withdrawal_receipt')?.status).toBe('sent')
  })

  it('R-134 Widerruf: Honeypot gefüllt → 200, nichts gespeichert, keine Mail', async () => {
    const email = 'bot@planetclaire.local'
    const before = await payload.count({ collection: 'withdrawals', overrideAccess: true })
    const res = await submitWithdrawal(
      { ...input({ email }), website: 'https://spam.example' },
      { now: new Date(T_SUMMER), ip: nextIp(), payload },
    )
    expect(res).toEqual({ ok: true, status: 200, spam: true })
    const after = await payload.count({ collection: 'withdrawals', overrideAccess: true })
    expect(after.totalDocs).toBe(before.totalDocs)
    expect(mailTo(email)).toHaveLength(0)
  })

  it('R-134 Widerruf: Rate-Limit 30 je Stunde und IP-Hash (nur rate_limit_hits)', async () => {
    const ip = nextIp()
    const now = new Date(T_SUMMER)
    for (let i = 0; i < 30; i++) {
      await hit('withdrawal_submit', ipHash(ip, { now: () => now }), now, payload)
    }
    const res = await submitWithdrawal(input({ email: 'viel@planetclaire.local' }), {
      now,
      ip,
      payload,
    })
    expect(res).toMatchObject({ ok: false, status: 429, code: 'rate_limited' })
    expect(await withdrawalsByEmail('viel@planetclaire.local')).toHaveLength(0)
  })

  it('R-093 ungültige Eingaben → 400 ohne Datensatz; Grund ist nie Pflicht', async () => {
    const res = await submitWithdrawal(input({ name: '', email: 'kein-mail', reason: undefined }), {
      now: new Date(T_SUMMER),
      ip: nextIp(),
      payload,
    })
    expect(res).toMatchObject({ ok: false, status: 400, code: 'invalid' })
    if (res.ok || res.status !== 400) throw new Error('400 erwartet')
    expect(Object.keys(res.errors).sort()).toEqual(['email', 'name'])
  })

  it('R-093 Zeitstempel über die Zeitumstellung korrekt (MESZ/MEZ)', async () => {
    const cases: [string, string][] = [
      ['2026-10-25T00:30:00.000Z', '25.10.2026, 02:30 Uhr (MESZ)'],
      ['2026-10-25T01:30:00.000Z', '25.10.2026, 02:30 Uhr (MEZ)'],
      ['2027-03-28T00:59:00.000Z', '28.03.2027, 01:59 Uhr (MEZ)'],
      ['2027-03-28T01:00:00.000Z', '28.03.2027, 03:00 Uhr (MESZ)'],
    ]
    for (const [i, [at, expected]] of cases.entries()) {
      const email = `dst${i}@planetclaire.local`
      const res = await submitWithdrawal(input({ email, contractIdentification: 'ohne Nummer' }), {
        now: new Date(at),
        ip: nextIp(),
        payload,
      })
      if (!res.ok || res.spam) throw new Error('kein Datensatz')
      expect(res.receipt.receivedAtText).toBe(expected)
      expect(mailTo(email)[0]?.text).toContain(expected)
    }
  })

  it('R-093 unbezahlte Vorkasse: O4 (withdrawn), Widerruf closed (unpaid_order_cancelled), Stück frei, keine M04', async () => {
    const now = new Date('2026-10-14T08:00:00.000Z')
    await transitionProduct(await systemReq(payload), items[2]!.id, 'publish')
    prepayment = await prepaymentReserved(payload, items[2]!, 983, { now })
    // wie placePrepaymentOrder: Reservierung gehört zur Bestellung
    await dbOf(payload).execute(
      sql`UPDATE reservations SET order_id = ${prepayment.orderId} WHERE ref = ${prepayment.reservationRef}`,
    )
    await payload.update({
      collection: 'orders',
      id: prepayment.orderId,
      data: { customer: { name: 'Erika Beispiel', email: CUSTOMER } } as never,
      overrideAccess: true,
      context: { system: true },
    })
    const res = await submitWithdrawal(
      input({ contractIdentification: prepayment.orderNumber, reason: null }),
      { now: new Date('2026-10-15T09:00:00.000Z'), ip: nextIp(), payload },
    )
    if (!res.ok || res.spam) throw new Error('kein Datensatz')
    expect(res.receipt.unpaidOrderCancelled).toBe(true)
    const doc = await payload.findByID({
      collection: 'withdrawals',
      id: res.receipt.id,
      overrideAccess: true,
    })
    expect(doc).toMatchObject({
      matchStatus: 'auto_matched',
      status: 'closed',
      closeReason: 'unpaid_order_cancelled',
    })
    const order = (await payload.findByID({
      collection: 'orders',
      id: prepayment.orderId,
      overrideAccess: true,
    })) as Order
    expect(order).toMatchObject({ status: 'cancelled', cancelReason: 'withdrawn' })
    const product = await payload.findByID({
      collection: 'products',
      id: items[2]!.id,
      overrideAccess: true,
    })
    expect(product.status).toBe('available')
    const m04 = await payload.find({
      collection: 'email-log',
      where: { template: { equals: 'prepayment_cancelled' } },
      overrideAccess: true,
    })
    expect(m04.totalDocs).toBe(0)
    const mail = getMemoryOutbox().find((m) => m.type === 'withdrawal_receipt')
    expect(mail?.text).toContain('Deine Bestellung ist damit storniert. Bitte nichts überweisen.')
    expect(mail?.text).not.toContain('Bitte sende die Ware an')
  })
})
