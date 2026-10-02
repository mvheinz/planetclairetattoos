import { createHash } from 'node:crypto'
import { readdir } from 'node:fs/promises'

import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { __setEmailAdapterForTests } from '@/lib/email'
import { getEnv } from '@/lib/env'
import { EMAIL_TEMPLATES } from '@/lib/enums'
import { LEGAL_SNIPPET_SEED } from '@/lib/legal/snippetSeed'
import { __setPaymentsAdapterForTests } from '@/lib/payments'
import { expectedCount } from '@/lib/seed/expected'
import { loadSeedData } from '@/lib/seed/loader'
import { mailSeedKeys, planSeedMails, seedMailSubject } from '@/lib/seed/logs'
import { resolveSeedDate } from '@/lib/seed/time'
import { __setTranslationAdapterForTests } from '@/lib/translation'

import { getTestPayload } from '../helpers/payload'
import {
  SEED_CLOCK,
  SEED_N,
  SEED_TIMEOUT,
  bySeedKey,
  findAll,
  runCanonicalSeed,
  type SeedDoc,
} from './canonical'

// P8.8: Protokolle des Beispielbestands (SEED-SPEC §16) – Mail-Log aus den Zeitleisten (Anzahl je Bezug wie §16.1),
// Einwilligungen mit gerendertem RECHT-Baustein (§16.2), Audit-Einträge (§16.3); der Seed versendet nichts
// (AK-SEED-05: 0 Mail-Dateien, 0 Jobs, 0 Adapter-Aufrufe).

let payload: Payload
let mails: SeedDoc[]
const calls: string[] = []
const before = { jobs: 0, files: 0 }
const after = { jobs: 0, files: 0 }

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')
const d = (expr: string) => resolveSeedDate(expr, SEED_N).toISOString()

function spyAdapter<T>(name: string, driver: string): T {
  return new Proxy({ driver } as Record<string | symbol, unknown>, {
    get(target, prop) {
      if (prop === 'driver' || prop === 'mode') return driver
      if (prop === 'then' || typeof prop === 'symbol') return undefined
      return (..._args: unknown[]) => {
        calls.push(`${name}.${String(prop)}`)
        return Promise.resolve(undefined)
      }
    },
  }) as T
}

async function mailFiles(): Promise<number> {
  try {
    return (await readdir(getEnv().EMAIL_FILE_DIR)).length
  } catch {
    return 0
  }
}
const jobs = async () =>
  (await payload.count({ collection: 'payload-jobs', overrideAccess: true })).totalDocs

beforeAll(async () => {
  payload = await getTestPayload()
  __setPaymentsAdapterForTests(spyAdapter('payments', 'mock'))
  __setTranslationAdapterForTests(spyAdapter('translation', 'mock'))
  __setEmailAdapterForTests(spyAdapter('email', 'memory'))
  before.jobs = await jobs()
  before.files = await mailFiles()
  await runCanonicalSeed(payload)
  after.jobs = await jobs()
  after.files = await mailFiles()
  __setPaymentsAdapterForTests()
  __setTranslationAdapterForTests()
  __setEmailAdapterForTests()
  mails = await findAll(payload, 'email-log', { seed: { equals: true } })
}, SEED_TIMEOUT)

afterAll(async () => {
  await runCanonicalSeed(payload, 'remove', { yes: true, dropTexts: true })
}, SEED_TIMEOUT)

describe('AK-SEED-05: der Seed versendet nichts', () => {
  it('0 Dateien im EMAIL_FILE_DIR, 0 Jobs in der Queue, 0 Aufrufe an Zahlungs-, Übersetzungs- und Mail-Adapter', () => {
    expect(after.files).toBe(before.files)
    expect(after.jobs).toBe(before.jobs)
    expect(calls).toEqual([])
  })
})

describe('email-log (SEED-SPEC §16.1)', () => {
  it('Anzahl je Bezug exakt wie die Ergebniszeile; Summe = SEED_EXPECTED_COUNTS', async () => {
    expect(mails).toHaveLength(expectedCount('email-log'))
    const keyOf = async (collection: 'orders' | 'withdrawals' | 'inquiries', id: unknown) =>
      id
        ? String(
            (await payload.findByID({ collection, id: id as number, overrideAccess: true }))
              .seedKey,
          ).split(':')[1]!
        : null
    const counts: Record<string, number> = {}
    for (const m of mails) {
      const ref =
        (await keyOf('orders', m.order)) ??
        (await keyOf('withdrawals', m.withdrawal)) ??
        (await keyOf('inquiries', m.inquiry)) ??
        String(m.seedKey).split(':')[1]!
      counts[ref] = (counts[ref] ?? 0) + 1
    }
    expect(counts).toEqual({
      O01: 6,
      O02: 4,
      O03: 4,
      O04: 6,
      O05: 7,
      O06: 6,
      O07: 5,
      O08: 3,
      O09: 4,
      O10: 3,
      O11: 3,
      O12: 2,
      O13: 2,
      O14: 2,
      W4: 2,
      W6: 2,
      W7: 2,
      A1: 2,
      A2: 2,
      A3: 2,
      A4: 2,
      A5: 2,
      A6: 2,
      A7: 2,
      DS1: 1,
    })
  })

  it('Felder: status sent, transport file, attempts 1, messageId §2.5, bodySha256, Vorlagen nur aus EMAIL_TEMPLATES, Admin-Mails an die Verwaltung auf Deutsch', async () => {
    const settings = (await payload.findGlobal({ slug: 'settings', overrideAccess: true })) as {
      adminNotificationEmail?: string | null
    }
    const admin = settings.adminNotificationEmail || getEnv().ADMIN_NOTIFY_EMAIL
    for (const m of mails) {
      const key = String(m.seedKey)
      expect(EMAIL_TEMPLATES).toContain(m.template)
      expect(m).toMatchObject({ status: 'sent', transport: 'file', attempts: 1 })
      expect(m.messageId).toBe(
        `<seed.${key.replace(/[^A-Za-z0-9]/g, '')}@planetclairetattoos.invalid>`,
      )
      expect(m.bodySha256).toBe(sha256(`seed:${key}`))
      expect(m.attachments ?? []).toEqual([])
      expect(m.sentAt).toBe(m.createdAt)
      if (String(m.template).startsWith('admin_')) {
        expect([m.to, m.locale], key).toEqual([admin, 'de'])
      } else {
        expect(String(m.to), key).toMatch(/@example\.(com|org)$/)
      }
    }
    const byKey = Object.fromEntries(mails.map((m) => [String(m.seedKey), m]))
    expect(byKey['email-log:O06:order_confirmation']!.locale).toBe('en')
    expect(byKey['email-log:RK4:dispute_vsbg']).toMatchObject({ locale: 'en' })
    expect(byKey['email-log:O01:order_confirmation']!.subject).toBe(
      'Danke! Deine Bestellung PC-2026-90001',
    )
    expect(byKey['email-log:O06:order_confirmation']!.subject).toContain('PC-2026-90006')
    expect(byKey['email-log:O07:prepayment_cancelled']!.sentAt).toBe(d('D-3@00:05'))
    expect(byKey['email-log:O01:refund_confirmation']!.sentAt).toBe(d('D-37@09:15'))
    expect(byKey['email-log:O03:admin_dispute_opened']!.subject).toContain('PC-2026-90003')
    expect(byKey['email-log:DS1:privacy_access_response']).toMatchObject({
      sentAt: d('D-33@17:00'),
    })
    expect(byKey['email-log:DS1:privacy_access_response']!.order ?? null).toBeNull()
    // L-12: ohne Bezug 90 Tage ab Versand
    const ds1 = byKey['email-log:DS1:privacy_access_response']!
    const days = (Date.parse(String(ds1.retainUntil)) - Date.parse(String(ds1.sentAt))) / 86_400_000
    expect(Math.round(days)).toBe(90)
    // Seed-Kassen ohne Bestellung erzeugen keine Mail
    expect(mails.some((m) => /KS\d/.test(String(m.seedKey)))).toBe(false)
  })

  it('withdrawals.confirmationEmail zeigt auf den withdrawal_receipt-Eintrag; Widerrufs-Mails verweisen auf den Widerruf', async () => {
    const withdrawals = await findAll(payload, 'withdrawals', { seed: { equals: true } })
    for (const w of withdrawals) {
      const key = String(w.seedKey).split(':')[1]!
      const receipt = await bySeedKey(payload, 'email-log', `${key}:withdrawal_receipt`)
      expect(w.confirmationEmail, key).toBe(receipt.id)
      expect(receipt.withdrawal).toBe(w.id)
      expect(receipt.sentAt).toBe(w.receivedAt)
      expect(receipt.order ?? null).toBe(w.order ?? null)
    }
  })

  it('Ableitung rein: Regeln aus logs.json, eindeutige seedKeys, Betreff mit Nummer (Rückfall „<Vorlage> <Nummer>“)', async () => {
    const data = await loadSeedData({ now: SEED_N })
    const planned = planSeedMails(data, data.logs.email, SEED_N)
    expect(planned).toHaveLength(expectedCount('email-log'))
    const keys = mailSeedKeys(planned)
    expect(new Set(keys).size).toBe(keys.length)
    expect(
      seedMailSubject({
        template: 'admin_order_placed',
        locale: 'de',
        number: 'PC-2026-90010',
        vars: {},
      }),
    ).toMatch(/PC-2026-90010$/)
    expect(
      seedMailSubject({
        template: 'inquiry_receipt',
        locale: 'en',
        number: 'AA-2026-9001',
        vars: {},
      }),
    ).toContain('AA-2026-9001')
  })
})

describe('consent-log (SEED-SPEC §16.2)', () => {
  it('14 Einträge; Snapshots aus checkout.dhlEmailConsent, checkout.deviationAgreement (Titel, Nr. 914, Abweichung) und inquiry.privacyNotice; textSha256 daraus', async () => {
    const consents = await findAll(payload, 'consent-log', { seed: { equals: true } })
    expect(consents).toHaveLength(expectedCount('consent-log'))
    const byPurpose = (p: string) => consents.filter((c) => c.purpose === p)
    expect(byPurpose('carrier_email_forwarding')).toHaveLength(6)
    expect(byPurpose('deviation_agreement')).toHaveLength(1)
    expect(byPurpose('inquiry_privacy_notice')).toHaveLength(7)
    for (const c of consents) {
      expect(c.textSha256).toBe(sha256(String(c.textSnapshot)))
      expect(c.granted).toBe(true)
      expect(String(c.email)).toMatch(/@example\.(com|org)$/)
    }
    const dhl = byPurpose('carrier_email_forwarding').find((c) => c.locale === 'en')!
    expect(dhl.textSnapshot).toBe(LEGAL_SNIPPET_SEED['checkout.dhlEmailConsent'].en)
    expect(dhl.snippetKey).toBe('checkout.dhlEmailConsent')
    const [deviation] = byPurpose('deviation_agreement')
    const s14 = await bySeedKey(payload, 'products', 'S14', { locale: 'de' })
    const o13 = await bySeedKey(payload, 'orders', 'O13')
    expect(deviation).toMatchObject({ product: s14.id, order: o13.id, locale: 'de' })
    expect(deviation!.checkout).toBe((await bySeedKey(payload, 'checkouts', 'O13')).id)
    expect(String(deviation!.textSnapshot)).toContain(String(s14.title))
    expect(String(deviation!.textSnapshot)).toContain('914')
    expect(String(deviation!.textSnapshot)).toContain(String(s14.deviationDescription))
    expect(deviation!.createdAt).toBe((o13.timestamps as { placedAt: string }).placedAt)
    const a1 = await bySeedKey(payload, 'consent-log', 'A1:inquiry_privacy_notice')
    expect(a1).toMatchObject({
      locale: 'en',
      textSnapshot: LEGAL_SNIPPET_SEED['inquiry.privacyNotice'].en,
      inquiry: (await bySeedKey(payload, 'inquiries', 'A1')).id,
    })
    // O01 ist älter als 30 Tage: Kasse gelöscht (L-03) → kein Kassen-Bezug
    const o01 = await bySeedKey(payload, 'consent-log', 'O01:carrier_email_forwarding')
    expect(o01.checkout ?? null).toBeNull()
  })
})

describe('audit-log (SEED-SPEC §16.3)', () => {
  it('8 Einträge mit Aktion, Akteur, Bezug und Zeitpunkt; seed_imported mit den Mengen', async () => {
    const audits = await findAll(payload, 'audit-log', { seed: { equals: true } })
    expect(audits).toHaveLength(expectedCount('audit-log'))
    const imported = await bySeedKey(payload, 'audit-log', 'seed_imported')
    expect(imported).toMatchObject({ action: 'seed_imported', actorType: 'seed' })
    expect(imported.summary).toBe(
      'Beispielbestand importiert: 30 Stücke, 14 Kassen, 14 Bestellungen, 15 Belege, 7 Widerrufe, 4 Reklamationen, 7 Anfragen, 5 Datenschutz-Anfragen.',
    )
    expect(imported.createdAt).toBe(SEED_CLOCK.now().toISOString())
    const disputed = await bySeedKey(payload, 'audit-log', 'O03:disputed')
    expect(disputed).toMatchObject({
      action: 'order_status_changed',
      actorType: 'webhook',
      entityCollection: 'orders',
      entityId: String((await bySeedKey(payload, 'orders', 'O03')).id),
      createdAt: d('D-5@08:12'),
    })
    const refund = await bySeedKey(payload, 'audit-log', 'O05:refund')
    expect(refund.summary).toBe('PC-2026-90005: Teil-Erstattung 40,40 € (Widerruf).')
    // Belege erzeugen über den Seed-Kontext keine eigenen Audit-Einträge
    expect(audits.some((a) => a.action === 'invoice_issued')).toBe(false)
  })
})
