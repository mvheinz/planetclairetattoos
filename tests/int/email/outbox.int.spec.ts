import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
} from 'payload'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { issueStatusToken } from '@/lib/commerce/statusToken'
import {
  __setEmailAdapterForTests,
  clearMemoryOutbox,
  createEmailAdapter,
  getMemoryOutbox,
  type EmailAdapter,
} from '@/lib/email'
import { sendAdminAlert } from '@/lib/email/alerts'
import { STATUS_TOKEN_PLACEHOLDER } from '@/lib/email/layout'
import { enqueueEmail, runEmailJobNow } from '@/lib/email/outbox'
import { bodyHash } from '@/lib/email/prepare'
import { __setTemplateForTests } from '@/lib/email/registry'
import { getEnv, parseEnv } from '@/lib/env'
import { createInvoiceForOrder } from '@/lib/invoices/create'
import { runInvoicePdfJob } from '@/lib/invoices/issue'
import { localizedPath } from '@/lib/routes/paths'
import { hashToken } from '@/lib/security/tokens'
import type { Order } from '@/payload-types'

import { fixtureCustomerTemplate } from '../../helpers/mails'
import { createOrder, deleteCommerce, orderData, type ItemInput } from '../helpers/commerce'
import { withBusiness } from '../helpers/invoices'
import { getTestPayload } from '../helpers/payload'
import {
  completeProduct,
  createProduct,
  createProductFixtures,
  deleteProducts,
} from '../helpers/products'

// P4.13 – Outbox, Versand-Job, Wiederholkette, A12-Drosselung, Status-Link aus dem Siegel (DATENMODELL §1.5, §11).

let payload: Payload
let restoreBusiness: () => Promise<void>
let item: ItemInput
let orderNr = 940
let seq = 0

const TO = 'kundin@planetclaire.local'
const T0 = '2026-10-15T08:00:00.000Z'
const memory = () => createEmailAdapter(parseEnv({ ...process.env, EMAIL_DRIVER: 'memory' }))
const at = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * 60_000)

const alertData = (summary: string, kind = `test_${++seq}`) => ({ kind, summary })

async function logOf(id: number) {
  return payload.findByID({ collection: 'email-log', id, depth: 0, overrideAccess: true })
}

async function pendingJobs(emailLogId: number) {
  const res = await payload.find({
    collection: 'payload-jobs',
    where: {
      and: [
        { 'input.emailLogId': { equals: emailLogId } },
        { completedAt: { exists: false } },
        { hasError: { not_equals: true } },
      ],
    },
    sort: 'createdAt',
    depth: 0,
    overrideAccess: true,
  })
  return res.docs
}

/** Führt den wartenden Job einer Zeile mit Uhrzeit `now` aus und prüft die Weckzeit. */
async function runPending(emailLogId: number, now: Date, expectedWaitUntil?: Date) {
  const jobs = await pendingJobs(emailLogId)
  expect(jobs).toHaveLength(1)
  const job = jobs[0]!
  if (expectedWaitUntil) {
    expect(new Date(job.waitUntil as string).toISOString()).toBe(expectedWaitUntil.toISOString())
  }
  const req = await createLocalReq({ context: { now: now.toISOString() } }, payload)
  await payload.jobs.runByID({ id: job.id, req })
}

async function newOrder(overrides: Record<string, unknown> = {}): Promise<Order> {
  return (await createOrder(payload, orderData(++orderNr, [item], overrides))) as Order
}

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteProducts(payload)
  restoreBusiness = await withBusiness(payload)
  const fx = await createProductFixtures(payload)
  const p = await createProduct(payload, completeProduct('keramik', 986, fx))
  item = { id: p.id as number, itemNumber: 986 }
})
afterAll(async () => {
  __setEmailAdapterForTests(undefined)
  await restoreBusiness()
  await deleteCommerce(payload)
  await deleteProducts(payload)
})
beforeEach(() => {
  __setEmailAdapterForTests(memory())
  clearMemoryOutbox()
})
afterEach(() => {
  __setTemplateForTests('order_shipped')
  __setTemplateForTests('prepayment_received')
})

describe('Outbox (DATENMODELL §1.5)', () => {
  it('AK-A-3-04: eine Mail an erika@example.com wird mit suppressed protokolliert und nicht zugestellt (alle Treiber)', async () => {
    for (const driver of ['memory', 'file', 'log'] as const) {
      const adapter = createEmailAdapter(parseEnv({ ...process.env, EMAIL_DRIVER: driver }))
      __setEmailAdapterForTests(adapter)
      clearMemoryOutbox()
      const req = await createLocalReq({}, payload)
      const res = await enqueueEmail(req, {
        template: 'admin_alert',
        to: 'erika@example.com',
        locale: 'de',
        data: alertData(`unterdrückt ${driver}`),
        idempotencyKey: `admin_alert:suppressed-${driver}@${T0}`,
      })
      expect(res).toMatchObject({ status: 'suppressed', jobId: null })
      expect((await logOf(res.emailLogId)).status).toBe('suppressed')
      // Auch ein direkter Versuch über den Treiber stellt nichts zu
      const sent = await adapter.send({
        to: 'erika@example.com',
        subject: 'x',
        html: '<p>x</p>',
        text: 'x',
        type: 'admin_alert',
        idempotencyKey: `admin_alert:direct-${driver}`,
      })
      expect(sent).toMatchObject({ suppressed: true, accepted: [] })
      expect(getMemoryOutbox()).toHaveLength(0)
    }
  })

  it('Rollback der auslösenden Transaktion → keine Mail', async () => {
    const req = await createLocalReq({}, payload)
    await initTransaction(req)
    const res = await enqueueEmail(req, {
      template: 'admin_alert',
      locale: 'de',
      data: alertData('Rollback'),
      idempotencyKey: `admin_alert:rollback@${T0}`,
    })
    expect(res.status).toBe('queued')
    await killTransaction(req)
    const logs = await payload.count({
      collection: 'email-log',
      where: { id: { equals: res.emailLogId } },
      overrideAccess: true,
    })
    expect(logs.totalDocs).toBe(0)
    expect(await pendingJobs(res.emailLogId)).toHaveLength(0)
    await payload.jobs.run({ queue: 'email', limit: 50 })
    expect(getMemoryOutbox()).toHaveLength(0)
  })

  it('doppeltes Auslösen (nacheinander und parallel) → genau eine Mail', async () => {
    const input = {
      template: 'admin_alert' as const,
      locale: 'de' as const,
      data: alertData('Doppelt'),
      idempotencyKey: `admin_alert:double@${T0}`,
    }
    const first = await enqueueEmail(await createLocalReq({}, payload), input)
    const second = await enqueueEmail(await createLocalReq({}, payload), input)
    expect(first.status).toBe('queued')
    expect(second).toMatchObject({ status: 'duplicate', emailLogId: first.emailLogId, jobId: null })

    const parallel = await Promise.all(
      Array.from({ length: 5 }, async () => {
        const req = await createLocalReq({}, payload)
        await initTransaction(req)
        const r = await enqueueEmail(req, { ...input, idempotencyKey: `admin_alert:par@${T0}` })
        await commitTransaction(req)
        return r
      }),
    )
    expect(parallel.filter((r) => r.status === 'queued')).toHaveLength(1)
    const logs = await payload.count({
      collection: 'email-log',
      where: { idempotencyKey: { equals: `admin_alert:par@${T0}` } },
      overrideAccess: true,
    })
    expect(logs.totalDocs).toBe(1)

    await runEmailJobNow(payload, first.jobId, { now: new Date(T0) })
    await runEmailJobNow(payload, parallel.find((r) => r.jobId)!.jobId, { now: new Date(T0) })
    expect(getMemoryOutbox()).toHaveLength(2)
    expect(
      getMemoryOutbox()
        .map((m) => m.idempotencyKey)
        .sort(),
    ).toEqual([`admin_alert:double@${T0}`, `admin_alert:par@${T0}`])
    const sent = await logOf(first.emailLogId)
    expect(sent).toMatchObject({ status: 'sent', attempts: 1, templateVersion: 'a12-v2' })
    expect(sent.sentAt).toBe(T0)
    expect(sent.bodySha256).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('Task sendEmail – Wiederholkette (T-18)', () => {
  const failing = (): EmailAdapter => {
    const inner = memory()
    return {
      driver: 'memory',
      transport: inner.transport,
      send: async () => {
        throw new Error('SMTP 451 vorübergehend nicht erreichbar')
      },
    }
  }

  it('T-18 Wiederholung nach 1, 5, 15, 60, 240 min, danach failed + A12; A12 höchstens einmal je Stunde', async () => {
    __setEmailAdapterForTests(failing())
    __setTemplateForTests('order_shipped', fixtureCustomerTemplate)
    const order = await newOrder()
    const enqueue = async (event: string) => {
      const req = await createLocalReq({}, payload)
      return enqueueEmail(req, {
        template: 'order_shipped',
        to: TO,
        locale: 'de',
        data: { orderNumber: order.orderNumber },
        idempotencyKey: `order_shipped:${order.id}:${event}`,
        relations: { order: order.id },
      })
    }
    const alerts = async () =>
      (
        await payload.find({
          collection: 'email-log',
          where: { idempotencyKey: { like: 'admin_alert:mail_failed.order_shipped@' } },
          overrideAccess: true,
          limit: 10,
        })
      ).docs

    const a = await enqueue('O7-a')
    await runEmailJobNow(payload, a.jobId, { now: new Date(T0) })
    let entry = await logOf(a.emailLogId)
    expect(entry).toMatchObject({ status: 'queued', attempts: 1 })
    expect(entry.lastError).toContain('SMTP 451')

    let now = new Date(T0)
    for (const [i, delay] of [1, 5, 15, 60, 240].entries()) {
      const next = at(now.toISOString(), delay)
      await runPending(a.emailLogId, next, next)
      now = next
      entry = await logOf(a.emailLogId)
      expect(entry.attempts).toBe(i + 2)
    }
    expect(entry.status).toBe('failed')
    expect(await pendingJobs(a.emailLogId)).toHaveLength(0)
    expect(await alerts()).toHaveLength(1)

    // Zweite Mail derselben Fehlerart
    const b = await enqueue('O7-b')
    const start = at(now.toISOString(), 1)
    await runEmailJobNow(payload, b.jobId, { now: start })
    let t = start
    for (const delay of [1, 5, 15, 60, 240]) {
      t = at(t.toISOString(), delay)
      await runPending(b.emailLogId, t)
    }
    expect((await logOf(b.emailLogId)).status).toBe('failed')
    // b scheitert endgültig mehr als eine Stunde nach dem A12 zu a → zweiter A12; 30 min danach gedrosselt
    expect(await alerts()).toHaveLength(2)
    const throttled = await sendAdminAlert(await createLocalReq({}, payload), {
      kind: 'mail_failed.order_shipped',
      summary: 'Mail M06 konnte nicht versendet werden',
      now: at(t.toISOString(), 30),
    })
    expect(throttled.status).toBe('throttled')
    const later = await sendAdminAlert(await createLocalReq({}, payload), {
      kind: 'mail_failed.order_shipped',
      summary: 'Mail M06 konnte nicht versendet werden',
      now: at(t.toISOString(), 61),
    })
    expect(later.status).toBe('queued')
    // S16/S17 gehen immer
    const s16 = { kind: 's16_payment_after_checkout_closed', summary: 'Zahlung zu beendeter Kasse' }
    const r1 = await sendAdminAlert(await createLocalReq({}, payload), { ...s16, now: at(T0, 1) })
    const r2 = await sendAdminAlert(await createLocalReq({}, payload), { ...s16, now: at(T0, 2) })
    expect([r1.status, r2.status]).toEqual(['queued', 'queued'])
  })

  it('fehlender Pflicht-Anhang (Rechnung pending_pdf): neu eingereiht nach 1 min ohne Fehlversuch, dann mit Anhang versendet', async () => {
    __setTemplateForTests('prepayment_received', fixtureCustomerTemplate)
    const order = await newOrder()
    const invReq = await createLocalReq({}, payload)
    const { jobId: pdfJob } = await createInvoiceForOrder(invReq, order, {
      paidAt: new Date(T0),
      now: new Date(T0),
    })
    const res = await enqueueEmail(await createLocalReq({}, payload), {
      template: 'prepayment_received',
      to: TO,
      locale: 'de',
      data: { orderNumber: order.orderNumber },
      idempotencyKey: `prepayment_received:${order.id}:O3`,
      relations: { order: order.id },
    })
    await runEmailJobNow(payload, res.jobId, { now: new Date(T0) })
    const waiting = await logOf(res.emailLogId)
    expect(waiting).toMatchObject({ status: 'queued', attempts: 0 })
    expect(waiting.lastError).toContain('Rechnung')
    const [job] = await pendingJobs(res.emailLogId)
    expect(job!.input).toMatchObject({ waits: 1 })

    await runInvoicePdfJob(payload, pdfJob, { now: new Date(T0) })
    await runPending(res.emailLogId, at(T0, 1), at(T0, 1))
    const sent = await logOf(res.emailLogId)
    expect(sent).toMatchObject({ status: 'sent', attempts: 1 })
    expect(sent.attachments).toHaveLength(1)
    expect(sent.attachments![0]).toMatchObject({ filename: 'RE-2026-00001.pdf' })
    expect(sent.attachments![0]!.sha256).toMatch(/^[0-9a-f]{64}$/)
    expect(getMemoryOutbox()[0]!.attachments.map((a) => a.filename)).toEqual(['RE-2026-00001.pdf'])
  })
})

describe('Status-Link aus dem Siegel (P4.1, R-081)', () => {
  it('der Status-Link öffnet die Statusseite der Bestellung; das email-log enthält weder Token noch Link', async () => {
    __setTemplateForTests('order_shipped', fixtureCustomerTemplate)
    const issued = issueStatusToken(new Date(T0))
    const order = await newOrder(issued.fields)
    const res = await enqueueEmail(await createLocalReq({}, payload), {
      template: 'order_shipped',
      to: TO,
      locale: 'de',
      data: { orderNumber: order.orderNumber },
      idempotencyKey: `order_shipped:${order.id}:O7`,
      relations: { order: order.id },
    })
    await runEmailJobNow(payload, res.jobId, { now: new Date(T0) })
    const mail = getMemoryOutbox()[0]!
    const path = localizedPath('R09', 'de', { token: issued.token })
    const url = `${getEnv().NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '')}${path}`
    expect(mail.html).toContain(`href="${url}"`)
    expect(mail.text).toContain(url)
    // Der Token im Link gehört zu genau dieser Bestellung (Status-Seite sucht über den Hash)
    const token = new URL(/href="([^"]*\/bestellung\/[^"]+)"/.exec(mail.html!)![1]!).pathname
      .split('/')
      .pop()!
    expect(hashToken(token)).toBe(order.statusTokenHash)
    const found = await payload.find({
      collection: 'orders',
      where: { statusTokenHash: { equals: hashToken(token) } },
      overrideAccess: true,
    })
    expect(found.docs.map((d) => d.id)).toEqual([order.id])

    const entry = await logOf(res.emailLogId)
    const json = JSON.stringify(entry)
    expect(json).not.toContain(issued.token)
    expect(json).not.toContain('/bestellung/')
    // bodySha256 über den Inhalt mit festem Platzhalter an der Token-Stelle
    const withPlaceholder = (s: string) => s.split(issued.token).join(STATUS_TOKEN_PLACEHOLDER)
    expect(entry.bodySha256).toBe(
      bodyHash(withPlaceholder(mail.text!), withPlaceholder(mail.html!)),
    )
    expect(entry.order).toBe(order.id)
  })
})
