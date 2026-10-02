import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { PHONE_HINT, POSTBOX_MESSAGE } from '@/admin/views/settings/settingsForm'
import { REDACTED } from '@/lib/security/redact'

import { ADMIN, resetAdmin } from '../helpers/admin'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P5.21 – Einstellungen, Teil 1 (KONZEPT §7.14, DATENMODELL §7.1): Speichern je Bereich über
// `POST /api/globals/settings/section`; Postfach-Adressen abgelehnt (R-020), Telefonformat E.164 oder deutsch, Platzhalter
// „[Telefon folgt]“ speicherbar (R-021); IBAN mit Prüfziffer; Audit `settings_changed` mit maskiertem Diff,
// `retention_setting_changed`; neuer Steuermodus nur mit Begründung und Häkchen; Passwort ≥ 12 Zeichen.

let payload: Payload
let token: string
let snapshot: Record<string, unknown>
const PASSWORD = ADMIN.password

const SECTIONS = ['business', 'payment', 'tax', 'retention', 'social', 'tattoo'] as const

beforeAll(async () => {
  payload = await getTestPayload()
  ;({ token } = await resetAdmin(payload, '198.51.100.65'))
  snapshot = (await payload.findGlobal({
    slug: 'settings',
    depth: 0,
    overrideAccess: true,
  })) as never
})

afterAll(async () => {
  await payload.updateGlobal({
    slug: 'settings',
    data: {
      ...Object.fromEntries(SECTIONS.map((k) => [k, snapshot[k]])),
      adminNotificationEmail: snapshot.adminNotificationEmail,
    } as never,
    overrideAccess: true,
    context: { seed: true, skipAudit: true },
  })
})

const auth = () => ({ authorization: `JWT ${token}`, 'idempotency-key': crypto.randomUUID() })

async function save(section: string, values: Record<string, unknown>, withAuth = true) {
  const res = await rest(
    'POST',
    '/globals/settings/section',
    { section, values },
    withAuth ? auth() : {},
  )
  return {
    status: res.status,
    json: (await res.json()) as {
      error?: string
      unchanged?: boolean
      errors?: { path: string; message: string }[]
    },
  }
}

const settings = () =>
  payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true }) as unknown as Promise<
    Record<string, Record<string, unknown>> & { adminNotificationEmail?: string }
  >

const lastAudit = async (action: string) =>
  (
    await payload.find({
      collection: 'audit-log',
      where: { action: { equals: action } },
      sort: '-createdAt',
      limit: 1,
      overrideAccess: true,
    })
  ).docs[0]

describe('Einstellungen, Teil 1 (P5.21)', () => {
  beforeEach(async () => {
    await save('business', {
      'business.street': 'Musterstraße 1',
      'business.phone': '[Telefon folgt]',
    })
  })

  it('R-020 Postfach: „Postfach 1234“ wird mit Hinweis abgelehnt, ladungsfähige Anschrift gespeichert', async () => {
    for (const street of ['Postfach 1234', 'PF 1234', 'pf.1234']) {
      const res = await save('business', { 'business.street': street })
      expect(res.status, street).toBe(400)
      expect(res.json.errors, street).toContainEqual({
        path: 'business.street',
        message: POSTBOX_MESSAGE,
      })
    }
    expect((await settings()).business!.street).toBe('Musterstraße 1')
    const ok = await save('business', { 'business.street': 'Pfefferstraße 12' })
    expect(ok.status).toBe(200)
    expect((await settings()).business!.street).toBe('Pfefferstraße 12')
    // anonym kein Zugriff
    expect((await save('business', { 'business.street': 'X-Straße 1' }, false)).status).toBe(403)
  })

  it('R-021 Telefonformat: +49 30 1234567 und 030 1234567 ok, „abc“ und „12“ abgelehnt, „[Telefon folgt]“ speicherbar', async () => {
    for (const phone of ['+49 30 1234567', '030 1234567', '+493012345678', '[Telefon folgt]']) {
      const res = await save('business', { 'business.phone': phone })
      expect(res.status, phone).toBe(200)
      expect((await settings()).business!.phone, phone).toBe(phone)
    }
    for (const phone of ['abc', '12']) {
      const res = await save('business', { 'business.phone': phone })
      expect(res.status, phone).toBe(400)
      expect(res.json.errors?.[0]?.path, phone).toBe('business.phone')
    }
    expect((await settings()).business!.phone).toBe('[Telefon folgt]')
    expect(PHONE_HINT).toContain('Impressum, Widerrufsbelehrung')
  })

  it('IBAN: Beispiel-IBAN akzeptiert, falsche Prüfziffer abgelehnt; Audit settings_changed maskiert', async () => {
    const bad = await save('payment', { 'payment.iban': 'DE00 0000 0000 0000 0000 00' })
    expect(bad.status).toBe(400)
    expect(bad.json.errors?.[0]?.path).toBe('payment.iban')
    const ok = await save('payment', {
      'payment.iban': 'DE89 3704 0044 0532 0130 00',
      'payment.bic': 'cobadeffxxx',
    })
    expect(ok.status).toBe(200)
    const s = await settings()
    expect(s.payment).toMatchObject({ iban: 'DE89370400440532013000', bic: 'COBADEFFXXX' })
    const audit = await lastAudit('settings_changed')
    expect(audit?.changes).toMatchObject({ 'payment.iban': [REDACTED, REDACTED] })
    expect(JSON.stringify(audit)).not.toContain('DE89370400440532013000')
    expect(audit?.actorType).toBe('admin')
    const back = await save('payment', { 'payment.iban': 'DE36 0000 0000 0000 0000 00' })
    expect(back.status).toBe(200)
    expect((await settings()).payment!.iban).toBe('DE36000000000000000000')
    // nur Felder des Bereichs
    const foreign = await save('payment', { 'shop.isOpen': true })
    expect(foreign.status).toBe(400)
  })

  it('Benachrichtigungen und Aufbewahrung (Audit retention_setting_changed)', async () => {
    expect((await save('notifications', { adminNotificationEmail: 'kein-mail' })).status).toBe(400)
    expect(
      (await save('notifications', { adminNotificationEmail: 'hinweise@planetclairetattoos.com' }))
        .status,
    ).toBe(200)
    expect((await settings()).adminNotificationEmail).toBe('hinweise@planetclairetattoos.com')
    expect((await save('retention', { 'retention.invoiceYears': '9' })).status).toBe(400)
    expect((await save('retention', { 'retention.invoiceYears': '8' })).status).toBe(200)
    const audit = await lastAudit('retention_setting_changed')
    expect(audit?.changes).toMatchObject({ 'retention.invoiceYears': ['10', '8'] })
    expect((await save('retention', { 'retention.invoiceYears': '10' })).status).toBe(200)
  })

  it('Steuer: neuer Modus nur mit Begründung und Häkchen, gilt frühestens ab heute', async () => {
    const before = ((await settings()).tax!.modes as unknown[]).length
    const post = (body: Record<string, unknown>) =>
      rest('POST', '/globals/settings/tax-mode', body, auth())
    const missing = await post({ mode: 'regelbesteuert', validFrom: '2099-01-01', reason: '' })
    expect(missing.status).toBe(400)
    const paths = ((await missing.json()) as { errors: { path: string }[] }).errors.map(
      (e) => e.path,
    )
    expect(paths).toEqual(expect.arrayContaining(['reason', 'confirmedWithTaxAdvisor']))
    const ok = await post({
      mode: 'regelbesteuert',
      validFrom: '2099-01-01',
      reason: 'Umsatzgrenze voraussichtlich überschritten.',
      confirmedWithTaxAdvisor: true,
    })
    expect(ok.status).toBe(200)
    expect(((await settings()).tax!.modes as unknown[]).length).toBe(before + 1)
    expect((await lastAudit('tax_mode_changed'))?.summary).toContain('regelbesteuert ab 01.01.2099')
  })

  it('Konto: Passwort ≥ 12 Zeichen, bisheriges Passwort muss stimmen', async () => {
    const post = (body: Record<string, unknown>) =>
      rest('POST', '/globals/settings/password', body, auth())
    expect((await post({ currentPassword: PASSWORD, newPassword: 'kurz' })).status).toBe(400)
    expect(
      (await post({ currentPassword: 'falsch-falsch-1', newPassword: 'ein-neues-passwort-26' }))
        .status,
    ).toBe(400)
    expect(
      (await post({ currentPassword: PASSWORD, newPassword: 'ein-neues-passwort-26' })).status,
    ).toBe(200)
    const login = await rest('POST', '/users/login', {
      email: ADMIN.email,
      password: 'ein-neues-passwort-26',
    })
    expect(login.status).toBe(200)
  })
})
