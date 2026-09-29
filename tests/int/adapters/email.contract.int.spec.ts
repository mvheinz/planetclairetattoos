import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { createLocalReq, type Payload } from 'payload'
import { SMTPServer } from 'smtp-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { parseEnv, type Env } from '@/lib/env'
import {
  clearMemoryOutbox,
  createEmailAdapter,
  createMailTransport,
  getMemoryOutbox,
  parseMailFrom,
  type MailMessage,
} from '@/lib/email'
import { enqueueEmail } from '@/lib/email/outbox'
import { isSuppressedRecipient } from '@/lib/email/recipients'
import { createLogger } from '@/lib/monitoring/logger'

import { readOutbox } from '../../helpers/outbox'
import { getTestPayload } from '../helpers/payload'

// P1.9 – Kontrakttest E-Mail (ARCHITEKTUR §3.1 Nr. 3, §3.4): dieselbe Testreihe gegen alle Treiber; SMTP gegen einen
// lokalen Fake-Server (smtp-server auf 127.0.0.1, keine fremden Hosts). AK-A-3-04, R-180.

interface FakeSmtp {
  port: number
  connections: number
  messages: { to: string[]; raw: string }[]
  close(): Promise<void>
}

async function startFakeSmtp(): Promise<FakeSmtp> {
  const state = { connections: 0, messages: [] as { to: string[]; raw: string }[] }
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ['STARTTLS'],
    logger: false,
    onConnect(_session, cb) {
      state.connections++
      cb()
    },
    onData(stream, session, cb) {
      const chunks: Buffer[] = []
      stream.on('data', (c: Buffer) => chunks.push(c))
      stream.on('end', () => {
        state.messages.push({
          to: session.envelope.rcptTo.map((r) => r.address),
          raw: Buffer.concat(chunks).toString('utf8'),
        })
        cb()
      })
    },
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.server.address() as AddressInfo).port
  return {
    port,
    get connections() {
      return state.connections
    },
    messages: state.messages,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  }
}

const message = (to: string, extra: Partial<MailMessage> = {}): MailMessage => ({
  to,
  subject: 'Testmail',
  text: 'Hallo',
  html: '<p>Hallo</p>',
  type: 'admin_alert',
  idempotencyKey: `admin_alert:test:${to}`,
  ...extra,
})

const SUPPRESSED = [
  'erika@example.com',
  'max@example.org',
  'a@example.net',
  'b@shop.invalid',
  'c@foo.test',
]

let smtp: FakeSmtp
let fileDir: string
const logLines: string[] = []

function envFor(
  driver: 'file' | 'smtp' | 'memory' | 'log',
  extra: Record<string, string> = {},
): Env {
  return parseEnv({
    ...process.env,
    APP_ENV: 'test',
    EMAIL_DRIVER: driver,
    EMAIL_FILE_DIR: fileDir,
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(smtp.port),
    SMTP_SECURE: 'false',
    MAIL_FROM: 'Planet Claire <shop@planetclairetattoos.com>',
    MAIL_REDIRECT_ALL_TO: '',
    ...extra,
  })
}

async function delivered(driver: string): Promise<number> {
  switch (driver) {
    case 'file':
      return (await readdir(fileDir).catch(() => [] as string[])).filter((f) => f.endsWith('.eml'))
        .length
    case 'memory':
      return getMemoryOutbox().length
    case 'smtp':
      return smtp.messages.length
    default:
      return 0
  }
}

beforeAll(async () => {
  smtp = await startFakeSmtp()
  fileDir = await mkdtemp(path.join(os.tmpdir(), 'pc-mail-'))
})
afterAll(async () => {
  await smtp?.close()
  await rm(fileDir, { recursive: true, force: true })
})
beforeEach(async () => {
  clearMemoryOutbox()
  smtp.messages.length = 0
  await rm(fileDir, { recursive: true, force: true })
  logLines.length = 0
})

describe('Empfänger-Unterdrückung (R-180)', () => {
  it('reservierte Domains und Endungen', () => {
    for (const a of SUPPRESSED) expect(isSuppressedRecipient(a)).toBe(true)
    expect(isSuppressedRecipient('Erika@EXAMPLE.COM')).toBe(true)
    expect(isSuppressedRecipient('kundin@example.de')).toBe(false)
    expect(isSuppressedRecipient('jutta@planetclairetattoos.com')).toBe(false)
  })

  it('MAIL_FROM wird in Name und Adresse zerlegt', () => {
    expect(parseMailFrom('Planet Claire <shop@planetclairetattoos.com>')).toEqual({
      name: 'Planet Claire',
      address: 'shop@planetclairetattoos.com',
    })
  })
})

describe.each(['file', 'smtp', 'memory', 'log'] as const)('Treiber %s', (driver) => {
  it('AK-A-3-04: Mail an erika@example.com → suppressed: true, nicht zugestellt', async () => {
    const connectionsBefore = smtp.connections
    const adapter = createEmailAdapter(
      envFor(driver),
      createLogger({ sink: (l) => logLines.push(l) }),
    )
    expect(adapter.driver).toBe(driver)
    for (const to of SUPPRESSED) {
      const res = await adapter.send(message(to))
      expect(res).toMatchObject({ suppressed: true, accepted: [], messageId: '' })
    }
    expect(await delivered(driver)).toBe(0)
    expect(smtp.connections).toBe(connectionsBefore) // keine Verbindung aufgebaut
    expect(logLines.filter((l) => l.includes('mail.log_driver'))).toHaveLength(0)
  })

  it('Payloads eigene Mails laufen über denselben Transport und dieselbe Unterdrückung', async () => {
    const transport = createMailTransport(envFor(driver))
    const info = (await transport.sendMail({
      from: 'shop@planetclairetattoos.com',
      to: 'erika@example.com',
      subject: 'Passwort',
      text: 'x',
    })) as { suppressed?: boolean }
    expect(info.suppressed).toBe(true)
    expect(await delivered(driver)).toBe(0)
  })

  it('zulässige Empfänger werden über den Treiber versendet', async () => {
    const adapter = createEmailAdapter(
      envFor(driver),
      createLogger({ sink: (l) => logLines.push(l) }),
    )
    const res = await adapter.send(message('kundin@planetclaire.local'))
    expect(res.suppressed).toBe(false)
    if (driver === 'log') {
      expect(await delivered(driver)).toBe(0)
      const line = logLines.find((l) => l.includes('mail.log_driver'))
      expect(line).toBeDefined()
      expect(line).not.toContain('kundin@') // keine Empfänger-Adresse im Klartext
      expect(line).toContain('planetclaire.local')
      return
    }
    expect(res.messageId).toMatch(/@/)
    expect(res.accepted).toEqual(['kundin@planetclaire.local'])
    expect(await delivered(driver)).toBe(1)
  })
})

describe('Treiber file: .eml + .json und readOutbox', () => {
  it('schreibt <ISO-Zeit>__<type>__<idempotencyKey>.eml/.json', async () => {
    const adapter = createEmailAdapter(envFor('file'))
    await adapter.send(
      message('kundin@planetclaire.local', {
        idempotencyKey: 'admin_alert:email-log:42',
        attachments: [
          {
            filename: 'AGB_v1.pdf',
            content: Buffer.from('%PDF-1.4'),
            contentType: 'application/pdf',
          },
        ],
      }),
    )
    const files = (await readdir(fileDir)).sort()
    expect(files).toHaveLength(2)
    expect(files[0]).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z__admin_alert__admin_alert_email-log_42\.eml$/,
    )
    expect(files[1]).toBe(files[0]!.replace(/\.eml$/, '.json'))
    const eml = await readFile(path.join(fileDir, files[0]!), 'utf8')
    expect(eml).toContain('Subject: Testmail')
    const [rec] = await readOutbox(
      { to: 'kundin@planetclaire.local', type: 'admin_alert' },
      fileDir,
    )
    expect(rec).toMatchObject({
      type: 'admin_alert',
      idempotencyKey: 'admin_alert:email-log:42',
      subject: 'Testmail',
      text: 'Hallo',
      attachments: [{ filename: 'AGB_v1.pdf', contentType: 'application/pdf', size: 8 }],
    })
    expect(await readOutbox({ type: 'order_confirmation' }, fileDir)).toHaveLength(0)
  })
})

describe('Umleitung MAIL_REDIRECT_ALL_TO', () => {
  it('außerhalb von Produktion: an die Umleitungsadresse, Betreff mit [APP_ENV], X-Original-To', async () => {
    const adapter = createEmailAdapter(
      envFor('memory', { APP_ENV: 'staging', MAIL_REDIRECT_ALL_TO: 'jutta@planetclaire.local' }),
    )
    await adapter.send(message('kundin@planetclaire.local'))
    const [mail] = getMemoryOutbox()
    expect(mail?.to).toEqual(['jutta@planetclaire.local'])
    expect(mail?.subject).toBe('[staging] Testmail')
    expect(mail?.headers['X-Original-To']).toBe('kundin@planetclaire.local')
    // Unterdrückte Empfänger werden auch mit Umleitung nie versendet.
    expect((await adapter.send(message('erika@example.com'))).suppressed).toBe(true)
    expect(getMemoryOutbox()).toHaveLength(1)
  })

  it('in Produktion ignoriert und als Fehler protokolliert', async () => {
    const lines: string[] = []
    const env = parseEnv({
      ...process.env,
      APP_ENV: 'production',
      EMAIL_DRIVER: 'memory',
      MAIL_REDIRECT_ALL_TO: 'jutta@planetclaire.local',
    })
    const adapter = createEmailAdapter(env, createLogger({ sink: (l) => lines.push(l) }))
    await adapter.send(message('kundin@planetclaire.local'))
    expect(getMemoryOutbox()[0]?.to).toEqual(['kundin@planetclaire.local'])
    expect(lines.some((l) => l.includes('mail.redirect_ignored'))).toBe(true)
  })
})

describe('Protokoll: email-log mit suppressed (AK-A-3-04)', () => {
  let payload: Payload
  beforeAll(async () => {
    payload = await getTestPayload()
  })

  it('Outbox legt für erika@example.com eine Zeile mit status suppressed und keinen Job an', async () => {
    const req = await createLocalReq({}, payload)
    const res = await enqueueEmail(req, {
      template: 'admin_alert',
      to: 'erika@example.com',
      locale: 'de',
      data: { kind: 'contract_test', summary: 'Test unterdrückt' },
      idempotencyKey: 'admin_alert:contract_test@suppressed',
    })
    expect(res).toMatchObject({ status: 'suppressed', jobId: null })
    const log = await payload.findByID({ collection: 'email-log', id: res.emailLogId })
    expect(log.status).toBe('suppressed')
    const jobs = await payload.find({
      collection: 'payload-jobs',
      where: { 'input.emailLogId': { equals: res.emailLogId } },
      overrideAccess: true,
    })
    expect(jobs.totalDocs).toBe(0)
  })
})
