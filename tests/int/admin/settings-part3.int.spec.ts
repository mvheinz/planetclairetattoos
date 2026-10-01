import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { initialAreaValues, type Obj } from '@/admin/views/settings/settingsAreas'
import { resetEnvCache } from '@/lib/env'
import { REDACTED } from '@/lib/security/redact'
import { STARTKLAR_LATER } from '@/lib/settings/readiness'

import { resetAdmin } from '../helpers/admin'
import { getTestPayload } from '../helpers/payload'
import { deleteProducts } from '../helpers/products'
import { rest } from '../helpers/rest'

// P5.22a – Einstellungen, Teil 3 (KONZEPT §7.14, DATENMODELL §7.1/§13.7) über `POST /api/globals/settings/area`:
// Shop (Schalter, Pausen-Text DE/EN ≤ 300, 1–10 Stücke; „Shop öffnen“ in Produktion abgelehnt, solange die
// Startklar-Prüfung nicht grün ist), Kosten, Vorlagen (genau eine Warnhinweis-Vorlage je Kategorie; wirkt nur auf neue
// Stücke), Steuer-Bestätigung (`tax.confirmedAt`, Audit mit maskiertem Diff), Jahressummen vor dem Shop, Statistik nur
// mit Datum und Notiz (R-132), Rechtstexte (Intervall, Marken-Schalter).

let payload: Payload
let token: string
let userId: number
let snapshot: { de: Obj; en: Obj }

const KEYS = [
  'shop',
  'costs',
  'safetyTemplates',
  'careTemplates',
  'tax',
  'revenueGuard',
  'analytics',
  'legal',
] as const

const load = async (locale: 'de' | 'en') =>
  (await payload.findGlobal({
    slug: 'settings',
    depth: 0,
    locale,
    fallbackLocale: false,
    overrideAccess: true,
  })) as unknown as Obj

const values = async () => initialAreaValues(await load('de'), await load('en'))

async function save(area: string, v: unknown) {
  const res = await rest(
    'POST',
    '/globals/settings/area',
    { area, values: v },
    { authorization: `JWT ${token}`, 'idempotency-key': crypto.randomUUID() },
  )
  return {
    status: res.status,
    json: (await res.json()) as { error?: string; errors?: { path: string; message: string }[] },
  }
}
const paths = (r: Awaited<ReturnType<typeof save>>) => (r.json.errors ?? []).map((e) => e.path)

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

beforeAll(async () => {
  payload = await getTestPayload()
  ;({ token, userId } = await resetAdmin(payload, '198.51.100.67'))
  snapshot = { de: await load('de'), en: await load('en') }
})

afterAll(async () => {
  vi.unstubAllEnvs()
  resetEnvCache()
  for (const locale of ['de', 'en'] as const) {
    await payload.updateGlobal({
      slug: 'settings',
      locale,
      data: Object.fromEntries(KEYS.map((k) => [k, snapshot[locale][k]])) as never,
      overrideAccess: true,
      context: { seed: true, skipAudit: true },
    })
  }
  await deleteProducts(payload)
})

describe('Einstellungen, Teil 3 (P5.22a)', () => {
  it('DM-41 maxItemsPerCheckout 0 und 11 abgelehnt, 1 und 10 gespeichert; closedMessage mit 301 Zeichen abgelehnt', async () => {
    const shop = (await values()).shop
    for (const bad of ['0', '11']) {
      const r = await save('shop', { ...shop, maxItemsPerCheckout: bad })
      expect(r.status).toBe(400)
      expect(paths(r)).toContain('shop.maxItemsPerCheckout')
    }
    for (const ok of ['1', '10']) {
      expect((await save('shop', { ...shop, maxItemsPerCheckout: ok })).status).toBe(200)
      expect(((await load('de')).shop as Obj).maxItemsPerCheckout).toBe(Number(ok))
    }
    const long = 'x'.repeat(301)
    let r = await save('shop', { ...shop, closedMessage: { de: long, en: 'Short break.' } })
    expect(r.status).toBe(400)
    expect(paths(r)).toContain('shop.closedMessage.de')
    r = await save('shop', { ...shop, closedMessage: { de: 'Kurze Pause.', en: long } })
    expect(r.status).toBe(400)
    expect(paths(r)).toContain('shop.closedMessage.en')
    // Abgelehnt heißt: auch der deutsche Teil ist nicht gespeichert (eine Transaktion)
    expect(((await load('de')).shop as Obj).closedMessage).not.toBe('Kurze Pause.')

    r = await save('shop', {
      ...shop,
      isOpen: false,
      closedMessage: { de: 'x'.repeat(300), en: 'Back soon.' },
    })
    expect(r.status).toBe(200)
    expect(((await load('de')).shop as Obj).isOpen).toBe(false)
    expect(((await load('en')).shop as Obj).closedMessage).toBe('Back soon.')
  })

  it('DM-41 „Shop öffnen“ mit APP_ENV=production abgelehnt (Startklar-Prüfung kommt in P10), mit APP_ENV=preview gespeichert', async () => {
    const shop = (await values()).shop
    expect((await save('shop', { ...shop, isOpen: false })).status).toBe(200)
    vi.stubEnv('APP_ENV', 'production')
    resetEnvCache()
    try {
      const r = await save('shop', { ...shop, isOpen: true })
      expect(r.status).toBe(400)
      expect(paths(r)).toContain('shop.isOpen')
      expect(r.json.errors?.find((e) => e.path === 'shop.isOpen')?.message).toContain(
        STARTKLAR_LATER,
      )
      expect(((await load('de')).shop as Obj).isOpen).toBe(false)
      // Andere Änderungen bei geschlossenem Shop gehen auch in Produktion
      expect(
        (await save('shop', { ...shop, isOpen: false, maxItemsPerCheckout: '9' })).status,
      ).toBe(200)
    } finally {
      vi.unstubAllEnvs()
      resetEnvCache()
    }
    vi.stubEnv('APP_ENV', 'preview')
    resetEnvCache()
    try {
      expect((await save('shop', { ...shop, isOpen: true })).status).toBe(200)
      expect(((await load('de')).shop as Obj).isOpen).toBe(true)
    } finally {
      vi.unstubAllEnvs()
      resetEnvCache()
    }
  })

  it('Löschen der einzigen safetyTemplates-Zeile einer Kategorie abgelehnt; geänderte Vorlage nur für neue Stücke', async () => {
    const tpl = (await values()).templates
    const without = tpl.safetyTemplates.filter((r) => r.category !== 'keramik')
    let r = await save('templates', { ...tpl, safetyTemplates: without })
    expect(r.status).toBe(400)
    expect(paths(r)).toContain('safetyTemplates')

    const user = await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })
    const create = (itemNumber: number) =>
      payload.create({
        collection: 'products',
        data: {
          itemNumber,
          category: 'keramik',
          title: 'Vorlagen-Test',
          priceCents: 2500,
        } as never,
        user,
        overrideAccess: true,
      })
    await deleteProducts(payload)
    const before = await create(985)

    const changed = tpl.safetyTemplates.map((row) =>
      row.category === 'keramik'
        ? { ...row, text: { de: 'Neue Keramik-Vorlage.', en: 'New ceramics template.' } }
        : row,
    )
    r = await save('templates', { ...tpl, safetyTemplates: changed })
    expect(r.status).toBe(200)
    const en = (await load('en')).safetyTemplates as Obj[]
    expect(en.find((x) => x.category === 'keramik')?.text).toBe('New ceramics template.')
    // Übrige englische Texte bleiben erhalten
    expect(en.every((x) => typeof x.text === 'string' && x.text !== '')).toBe(true)

    const after = await create(986)
    expect(after.safetyWarnings).toContain('Neue Keramik-Vorlage.')
    const old = await payload.findByID({
      collection: 'products',
      id: before.id,
      depth: 0,
      overrideAccess: true,
    })
    expect(old.safetyWarnings).not.toContain('Neue Keramik-Vorlage.')
  })

  it('R-132 analytics.enabled ohne confirmedAt oder ohne Notiz abgelehnt, mit beidem gespeichert', async () => {
    let r = await save('analytics', { enabled: true, confirmedAt: '', note: 'Entschieden.' })
    expect(r.status).toBe(400)
    expect(paths(r)).toContain('analytics.enabled')
    r = await save('analytics', { enabled: true, confirmedAt: '2026-09-30', note: '' })
    expect(r.status).toBe(400)
    r = await save('analytics', { enabled: true, confirmedAt: '2026-09-30', note: 'Mit Kanzlei.' })
    expect(r.status).toBe(200)
    const a = (await load('de')).analytics as Obj
    expect(a.enabled).toBe(true)
    expect(String(a.confirmedAt)).toMatch(/^2026-09-29T22:00:00/)
  })

  it('„Steuerangaben bestätigt“ setzt tax.confirmedAt; Audit settings_changed mit maskiertem Diff', async () => {
    const before = ((await load('de')).tax as Obj).confirmedAt
    const r = await save('taxConfirm', {})
    expect(r.status).toBe(200)
    const confirmedAt = ((await load('de')).tax as Obj).confirmedAt
    expect(typeof confirmedAt).toBe('string')
    expect(confirmedAt).not.toBe(before)
    const audit = await lastAudit('settings_changed')
    const changes = (audit?.changes ?? {}) as Record<string, unknown>
    expect(Object.keys(changes)).toContain('tax.confirmedAt')
    // Maskierung: Bankdaten tauchen nie im Klartext auf (gleiche Regel wie P5.21)
    expect(JSON.stringify(changes)).not.toContain('DE36')
    expect(REDACTED).toBeTruthy()
  })

  it('Kosten, Jahressummen vor dem Shop und Rechtstexte: Beträge als Euro-Text, Grenzen geprüft', async () => {
    let r = await save('costs', {
      budget: '25,00',
      warningThreshold: '30,00',
      monthlyEntries: [{ month: '2026-09', amount: '27,40', note: 'Hosting' }],
    })
    expect(r.status).toBe(200)
    const costs = (await load('de')).costs as Obj
    expect(costs.budgetCents).toBe(2500)
    expect((costs.monthlyEntries as Obj[])[0]).toMatchObject({
      month: '2026-09',
      amountCents: 2740,
    })
    r = await save('costs', {
      budget: '25,00',
      warningThreshold: 'viel',
      monthlyEntries: [{ month: '2026-13', amount: '1', note: '' }],
    })
    expect(r.status).toBe(400)
    expect(paths(r)).toContain('costs.warningThresholdCents')

    r = await save('yearTotals', {
      manualYearTotals: [{ year: '2025', amount: '0', note: 'Vorjahr ohne Umsatz' }],
    })
    expect(r.status).toBe(200)
    expect(((await load('de')).revenueGuard as Obj).manualYearTotals).toMatchObject([
      { year: 2025, amountCents: 0 },
    ])

    r = await save('legal', { reviewIntervalDays: '20', allowVisibleBlankBrands: false })
    expect(r.status).toBe(400)
    expect(paths(r)).toContain('legal.reviewIntervalDays')
    r = await save('legal', { reviewIntervalDays: '365', allowVisibleBlankBrands: true })
    expect(r.status).toBe(200)
    expect(((await load('de')).legal as Obj).allowVisibleBlankBrands).toBe(true)
  })

  it('Nur Verwaltung: ohne Anmeldung 403, unbekannter Bereich 400', async () => {
    const anon = await rest('POST', '/globals/settings/area', { area: 'shop', values: {} })
    expect(anon.status).toBe(403)
    expect((await save('business', {})).status).toBe(400)
  })
})
