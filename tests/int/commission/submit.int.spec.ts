import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  __setEmailAdapterForTests,
  clearMemoryOutbox,
  createEmailAdapter,
  getMemoryOutbox,
} from '@/lib/email'
import { parseEnv } from '@/lib/env'
import { commissionStep, initialCommissionState } from '@/lib/commission/form'
import { createCommissionFormToken } from '@/lib/commission/formToken'
import { submitCommission } from '@/lib/commission/submit'
import { handleCommissionUpload } from '@/lib/commission/upload'
import { inquiryDeleteAfter } from '@/lib/retention/policy'
import type { EmailLog, Inquiry, PrivateUpload } from '@/payload-types'

import { dbOf } from '../helpers/commerce'
import { withBusiness } from '../helpers/invoices'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P7.12 – Anfrage absenden (KONZEPT §10, R-160, R-134, R-137, DATENMODELL §6.17, L-10): Honeypot und Zeitfalle →
// Schein-Erfolg ohne Datensatz und ohne Mail; Rate-Limit 5/h und 20/Tag; Anlage mit Referenz, Frist und Bildern nur mit
// gültigem Ticket; M11 an die Anfragende, A05 an Jutta ohne Name, E-Mail, Freitext und Bilder.

const LOADED = new Date('2026-10-02T10:00:00.000Z')
const NOW = new Date('2026-10-02T10:02:00.000Z')
const EMAIL = 'anfrage-test@planetclaire.local'
const IDEA = 'Eine Cap mit meinem Dackel Bruno, gern in Grün und mit kleinen Sternen drumherum.'
let payload: Payload
let restoreBusiness: () => Promise<void>

const memory = () => createEmailAdapter(parseEnv({ ...process.env, EMAIL_DRIVER: 'memory' }))
const freshIp = () => `2001:db8:7::${randomBytes(4).toString('hex')}`

const form = (overrides: Record<string, unknown> = {}) => ({
  name: 'Erika Beispiel',
  email: EMAIL,
  objectType: 'cap',
  idea: IDEA,
  desiredTimeframe: 'bis Weihnachten',
  budget: 'ca. 80 €',
  locale: 'de',
  formToken: createCommissionFormToken(LOADED),
  ...overrides,
})

async function inquiriesByEmail(): Promise<Inquiry[]> {
  const res = await payload.find({
    collection: 'inquiries',
    where: { email: { equals: EMAIL } },
    overrideAccess: true,
    depth: 0,
    limit: 50,
  })
  return res.docs
}

async function cleanup() {
  for (const q of await inquiriesByEmail()) {
    await dbOf(payload).execute(sql`DELETE FROM email_log WHERE inquiry_id = ${q.id}`)
    await payload.delete({
      collection: 'inquiries',
      id: q.id,
      overrideAccess: true,
      context: { system: true },
    })
  }
}

async function uploadFor(token: string, ip: string): Promise<{ uploadId: number; ticket: string }> {
  const img = await readFile(path.resolve('tests/fixtures/images/landscape-small.jpg'))
  const body = new FormData()
  body.append('file', new Blob([new Uint8Array(img)], { type: 'image/jpeg' }), 'idee.jpg')
  const res = await handleCommissionUpload(
    new Request('http://localhost:3000/api/uploads/commission', {
      method: 'POST',
      headers: { 'x-form-token': token, 'x-forwarded-for': ip },
      body,
    }),
    payload,
    LOADED,
  )
  expect(res.status).toBe(201)
  return (await res.json()) as { uploadId: number; ticket: string }
}

beforeAll(async () => {
  payload = await getTestPayload()
  restoreBusiness = await withBusiness(payload)
  await cleanup()
})

afterAll(async () => {
  __setEmailAdapterForTests(undefined)
  await cleanup()
  await restoreBusiness()
})

beforeEach(() => {
  __setEmailAdapterForTests(memory())
  clearMemoryOutbox()
})

describe('Anfrage absenden (P7.12)', () => {
  it('R-160 Anlage mit Referenz, Frist L-10, Bildern mit Ticket; M11 an die Anfragende, A05 ohne Personendaten', async () => {
    const ip = freshIp()
    const token = createCommissionFormToken(LOADED)
    const a = await uploadFor(token, ip)
    const b = await uploadFor(token, ip)
    const foreign = await uploadFor(createCommissionFormToken(LOADED), ip)
    const result = await submitCommission(
      form({
        formToken: token,
        images: [
          `${a.uploadId}.${a.ticket}`,
          `${b.uploadId}.${b.ticket}`,
          // fremdes Formular und falsches Ticket werden ignoriert
          `${foreign.uploadId}.${foreign.ticket}`,
          `${a.uploadId}.falsch`,
        ],
      }),
      { now: NOW, ip, payload },
    )
    expect(result).toMatchObject({ ok: true, status: 201, spam: false, imageCount: 2 })
    if (!result.ok || result.spam) throw new Error('unreachable')
    expect(result.reference).toMatch(/^AA-2026-\d{4}$/)

    const q = (await payload.findByID({
      collection: 'inquiries',
      id: result.inquiryId!,
      overrideAccess: true,
      depth: 0,
    })) as Inquiry
    expect(q.status).toBe('new')
    expect(q.locale).toBe('de')
    expect(q.privacyNoticeVersion).toBeTruthy()
    expect(new Date(q.lastActivityAt).toISOString()).toBe(NOW.toISOString())
    const due = inquiryDeleteAfter(NOW).toISOString()
    expect(new Date(q.deleteAfter).toISOString()).toBe(due)
    expect((q.referenceImages ?? []).map((i) => (typeof i === 'object' ? i.id : i)).sort()).toEqual(
      [a.uploadId, b.uploadId].sort(),
    )
    for (const id of [a.uploadId, b.uploadId]) {
      const u = (await payload.findByID({
        collection: 'private-uploads',
        id,
        overrideAccess: true,
        depth: 0,
      })) as PrivateUpload
      expect(u.status).toBe('attached')
      expect(typeof u.relatedInquiry === 'object' ? u.relatedInquiry?.id : u.relatedInquiry).toBe(
        q.id,
      )
      expect(new Date(u.deleteAfter!).toISOString()).toBe(due)
    }
    const other = (await payload.findByID({
      collection: 'private-uploads',
      id: foreign.uploadId,
      overrideAccess: true,
      depth: 0,
    })) as PrivateUpload
    expect(other.status).toBe('pending')

    // Mails: M11 an die Anfragende (Zusammenfassung mit Anzahl der Bilder), A05 nur Referenz/Gegenstand/Anzahl/Link
    const logs = (
      await payload.find({
        collection: 'email-log',
        where: { inquiry: { equals: q.id } },
        overrideAccess: true,
        depth: 0,
      })
    ).docs as EmailLog[]
    expect(logs.map((l) => l.template).sort()).toEqual([
      'admin_inquiry_received',
      'inquiry_receipt',
    ])
    const m11 = getMemoryOutbox().find((m) => m.type === 'inquiry_receipt')!
    expect(m11.to).toContain(EMAIL)
    expect(m11.subject).toBe(`Deine Anfrage ${q.reference} ist angekommen`)
    for (const part of [q.reference, 'Cap', IDEA, 'bis Weihnachten', 'ca. 80 €', 'Bilder: 2']) {
      expect(m11.text, part).toContain(part)
    }
    expect(m11.text).toContain('6 Monate nach Eingang')
    expect(m11.text).toContain('Ich melde mich meist innerhalb einer Woche.')
    expect(m11.html).toContain('#auftragsarbeiten')

    const a05 = getMemoryOutbox().find((m) => m.type === 'admin_inquiry_received')!
    expect(a05).toBeDefined()
    expect(a05.to).not.toContain(EMAIL)
    const adminMail = `${a05.subject}\n${a05.text}\n${a05.html}`
    expect(adminMail).toContain(q.reference)
    expect(adminMail).toContain('Bilder')
    for (const secret of [EMAIL, 'Erika', 'Dackel', 'Weihnachten', 'ca. 80']) {
      expect(adminMail, secret).not.toContain(secret)
    }
    expect(a05.attachments ?? []).toEqual([])
  })

  it('R-160 GET /api/inquiries ohne Admin → 403 (auch Einzelabruf und Anlegen)', async () => {
    expect([401, 403]).toContain((await rest('GET', '/inquiries')).status)
    const [q] = await inquiriesByEmail()
    expect(q).toBeDefined()
    expect([401, 403]).toContain((await rest('GET', `/inquiries/${q!.id}`)).status)
    expect([401, 403]).toContain(
      (await rest('POST', '/inquiries', { name: 'X', email: 'x@example.com' })).status,
    )
  })

  it('AK-10-02 Honeypot gefüllt → Erfolgsanzeige, kein Datensatz, keine Mail', async () => {
    const before = (await inquiriesByEmail()).length
    const result = await submitCommission(form({ website: 'https://spam.example' }), {
      now: NOW,
      ip: freshIp(),
      payload,
    })
    expect(result).toEqual({ ok: true, status: 200, spam: true })
    expect((await inquiriesByEmail()).length).toBe(before)
    expect(getMemoryOutbox()).toHaveLength(0)
  })

  it('R-134 Anfrage nach < 3 s → Schein-Erfolg ohne Datensatz und Mail; die Formular-Ansicht zeigt Erfolg', async () => {
    const before = (await inquiriesByEmail()).length
    const fast = new Date(LOADED.getTime() + 2000)
    const result = await submitCommission(form(), { now: fast, ip: freshIp(), payload })
    expect(result).toEqual({ ok: true, status: 200, spam: true })
    // dieselbe Prüfung über den Formular-Schritt der Server Action
    const fd = new FormData()
    for (const [k, v] of Object.entries(form())) fd.append(k, String(v))
    const state = await commissionStep(initialCommissionState(LOADED), fd, {
      now: fast,
      ip: freshIp(),
      payload,
    })
    expect(state).toMatchObject({ step: 'done', reference: null })
    expect((await inquiriesByEmail()).length).toBe(before)
    expect(getMemoryOutbox()).toHaveLength(0)
  })

  it('AK-10-03 6. Absenden innerhalb einer Stunde vom selben IP-Hash → 429 mit Text', async () => {
    const ip = freshIp()
    for (let i = 0; i < 5; i++) {
      // ungültige Eingaben zählen ebenfalls (kein Datensatz)
      const r = await submitCommission(form({ idea: 'zu kurz' }), { now: NOW, ip, payload })
      expect(r).toMatchObject({ ok: false, status: 400, code: 'invalid' })
    }
    const sixth = await submitCommission(form(), { now: NOW, ip, payload })
    expect(sixth).toMatchObject({ ok: false, status: 429, code: 'rate_limited' })
    const fd = new FormData()
    for (const [k, v] of Object.entries(form())) fd.append(k, String(v))
    const state = await commissionStep(initialCommissionState(LOADED), fd, {
      now: NOW,
      ip,
      payload,
    })
    expect(state).toMatchObject({ step: 'form', notice: 'rate_limited', values: { idea: IDEA } })
  })

  it('Grenzen laut DATENMODELL §6.17 und doppeltes Absenden desselben Formulars → ein Datensatz', async () => {
    const ip = freshIp()
    const bad = await submitCommission(
      form({
        name: 'E',
        email: 'keine-mail',
        objectType: 'sonstiges',
        objectTypeOther: '',
        idea: 'x'.repeat(3001),
        desiredTimeframe: 'x'.repeat(121),
        budget: 'x'.repeat(61),
      }),
      { now: NOW, ip, payload },
    )
    expect(bad).toMatchObject({
      ok: false,
      code: 'invalid',
      errors: {
        name: 'invalid',
        email: 'invalid',
        objectTypeOther: 'required',
        idea: 'invalid',
        desiredTimeframe: 'invalid',
        budget: 'invalid',
      },
    })
    const before = (await inquiriesByEmail()).length
    const token = createCommissionFormToken(LOADED)
    const input = form({ formToken: token, objectType: 'sonstiges', objectTypeOther: 'Spiegel' })
    const [first, second] = await Promise.all([
      submitCommission(input, { now: NOW, ip, payload }),
      submitCommission(input, { now: NOW, ip, payload }),
    ])
    const created = [first, second].filter((r) => r.ok && !r.spam && !r.duplicate)
    expect(created).toHaveLength(1)
    expect((await inquiriesByEmail()).length).toBe(before + 1)
    // abgelaufenes Token → Hinweis, Eingaben bleiben
    const expired = await submitCommission(form(), {
      now: new Date(LOADED.getTime() + 2 * 3_600_000 + 60_000),
      ip,
      payload,
    })
    expect(expired).toEqual({ ok: false, status: 400, code: 'expired' })
  })
})
