import { NextRequest } from 'next/server'
import type { Payload } from 'payload'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { POST as webhookPost } from '@/app/(api)/api/stripe/webhook/route'
import { POST as uploadPost } from '@/app/(api)/api/uploads/commission/route'
import { GET as stateGet } from '@/app/(api)/api/checkout/[token]/state/route'
import {
  __setEmailAdapterForTests,
  clearMemoryOutbox,
  createEmailAdapter,
  getMemoryOutbox,
} from '@/lib/email'
import { parseEnv, resetEnvCache } from '@/lib/env'
import { submitWithdrawal } from '@/lib/legal/withdrawal'
import { isBlockedInMaintenance, MAINTENANCE_OPEN_ROUTES } from '@/lib/maintenance'
import { isDatabaseReachable } from '@/lib/maintenance/db'
import { computeFreshness } from '@/lib/monitoring/freshness'
import { handleTick } from '@/lib/jobs/tick'
import { proxy } from '@/proxy'

import { getTestPayload } from './helpers/payload'

// P10.7 Wartungsmodus (ARCHITEKTUR §10.5, KONZEPT R26, R-090, KA-30): jede Regel einzeln.

const setMaintenance = (on: boolean) => {
  vi.stubEnv('MAINTENANCE_MODE', on ? 'true' : 'false')
  resetEnvCache()
}
const req = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  new NextRequest(`http://localhost:3000${path}`, init)

beforeEach(() => setMaintenance(true))
afterEach(() => {
  vi.unstubAllEnvs()
  resetEnvCache()
})

describe('Öffentliche Seiten im Wartungsmodus', () => {
  it('R-090 gesperrte Seiten antworten 503 mit Hinweis, Retry-After und Pflichtlink „Vertrag widerrufen“', async () => {
    for (const path of [
      '/de',
      '/de/shop',
      '/en/cart',
      '/de/kasse',
      '/de/kontakt',
      '/de/auftragsarbeiten',
    ]) {
      const res = proxy(req(path))
      expect(res.status, path).toBe(503)
      expect(res.headers.get('retry-after')).toBeTruthy()
      const html = await res.text()
      expect(html).toContain('data-withdraw-link')
      expect(html).toContain(
        path.startsWith('/en') ? '/withdraw-from-contract' : '/vertrag-widerrufen',
      )
      expect(html).not.toMatch(/https?:\/\/(?!localhost)/)
    }
    const en = await proxy(req('/en/shop')).text()
    expect(en).toContain('/withdraw-from-contract')
    expect(en).toContain('Withdraw from contract here')
  })

  it('AK-3-11 Impressum, Datenschutz, AGB, Widerrufsbelehrung und R26 bleiben erreichbar (DE und EN)', () => {
    for (const path of [
      '/de/impressum',
      '/de/datenschutz',
      '/de/agb',
      '/de/widerrufsbelehrung',
      '/de/vertrag-widerrufen',
      '/en/legal-notice',
      '/en/privacy',
      '/en/terms',
      '/en/right-of-withdrawal',
      '/en/withdraw-from-contract',
    ]) {
      expect(proxy(req(path)).status, path).not.toBe(503)
      expect(isBlockedInMaintenance(path), path).toBe(false)
    }
    expect(MAINTENANCE_OPEN_ROUTES).toEqual(['R21', 'R22', 'R23', 'R24', 'R26'])
  })

  it('Server-Action-POSTs auf gesperrte Seiten (Kasse, Formulare) sind ebenfalls 503', () => {
    expect(
      proxy(req('/de/kasse', { method: 'POST', headers: { 'next-action': 'x' } })).status,
    ).toBe(503)
  })

  it('Verwaltung bleibt erreichbar (Umschreibung, kein 503)', () => {
    vi.stubEnv('ADMIN_ROUTE', '/werkstatt')
    resetEnvCache()
    expect(proxy(req('/werkstatt/login')).status).not.toBe(503)
  })

  it('ohne Wartungsmodus keine 503', () => {
    setMaintenance(false)
    expect(proxy(req('/de/shop')).status).not.toBe(503)
  })
})

describe('Schnittstellen im Wartungsmodus', () => {
  it('Stripe-Webhook 503 (Stripe wiederholt), Kasse-Zustand 503, Upload 503', async () => {
    expect(
      (
        await webhookPost(
          new Request('http://localhost/api/stripe/webhook', { method: 'POST', body: '{}' }),
        )
      ).status,
    ).toBe(503)
    expect(
      (
        await stateGet(new Request('http://localhost/api/checkout/x/state'), {
          params: Promise.resolve({ token: 'x' }),
        })
      ).status,
    ).toBe(503)
    expect(
      (await uploadPost(new Request('http://localhost/api/uploads/commission', { method: 'POST' })))
        .status,
    ).toBe(503)
  })

  it('Tick 204 (mit gültigem Bearer)', async () => {
    const env = parseEnv({ ...process.env, MAINTENANCE_MODE: 'true', CRON_SECRET: 'x'.repeat(32) })
    const res = await handleTick(
      new Request('http://localhost/api/cron/tick', {
        headers: { authorization: `Bearer ${'x'.repeat(32)}` },
      }),
      { env },
    )
    expect(res.status).toBe(204)
  })

  it('/api/health/freshness: 200 mit { maintenance: true }', async () => {
    const env = parseEnv({ ...process.env, MAINTENANCE_MODE: 'true' })
    expect(await computeFreshness(env, new Date('2026-10-10T08:00:00Z'))).toEqual({
      maintenance: true,
    })
  })
})

describe('R26 Widerruf im Wartungsmodus (R-090, R-091 bis R-093)', () => {
  let payload: Payload
  beforeAll(async () => {
    payload = await getTestPayload()
  })
  beforeEach(() => {
    __setEmailAdapterForTests(
      createEmailAdapter(parseEnv({ ...process.env, EMAIL_DRIVER: 'memory' })),
    )
    clearMemoryOutbox()
  })
  afterAll(() => __setEmailAdapterForTests(undefined))

  it('R-090 mit erreichbarer Datenbank: Datensatz + Eingangsbestätigung M08', async () => {
    expect(await isDatabaseReachable()).toBe(true)
    const email = 'wartung@planetclaire.local'
    const res = await submitWithdrawal(
      {
        name: 'Wartung Beispiel',
        contractIdentification: 'Bestellung im Wartungsmodus',
        email,
        locale: 'de',
      },
      { now: new Date('2026-10-12T12:03:27.000Z'), ip: '203.0.113.77', payload },
    )
    expect(res.ok).toBe(true)
    if (!res.ok || res.spam) throw new Error('kein Datensatz')
    const doc = await payload.findByID({
      collection: 'withdrawals',
      id: res.receipt.id,
      overrideAccess: true,
    })
    expect(doc.email).toBe(email)
    expect(getMemoryOutbox().filter((m) => m.to.includes(email))).toHaveLength(1)
    await payload
      .delete({
        collection: 'withdrawals',
        id: res.receipt.id,
        overrideAccess: true,
        context: { system: true },
      })
      .catch(() => undefined)
  })

  it('R-090 simuliert unerreichbare Datenbank: Probe liefert false ohne Ausnahme (R26 zeigt dann mailto)', async () => {
    expect(
      await isDatabaseReachable(async () => ({
        query: () => Promise.reject(new Error('ECONNREFUSED')),
      })),
    ).toBe(false)
    expect(
      await isDatabaseReachable(async () => {
        throw new Error('init failed')
      }),
    ).toBe(false)
    expect(
      await isDatabaseReachable(async () => ({ query: () => new Promise(() => undefined) }), 50),
    ).toBe(false)
  })
})
