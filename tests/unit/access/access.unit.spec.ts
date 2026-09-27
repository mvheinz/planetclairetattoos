import type { PayloadRequest, Where } from 'payload'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { adminField, isAdmin, none, NOT_SEED, publicRead } from '@/access'
import { resetEnvCache } from '@/lib/env'
import { getAppContext, withSystem } from '@/lib/payload/context'
import { pickPublicSettings, PUBLIC_SETTINGS_PATHS } from '@/lib/payload/public'

// Fake-Requests: nur die Felder, die die Zugriffsfunktionen lesen.
const adminReq = { user: { id: 1, collection: 'users' }, context: {} } as unknown as PayloadRequest
const anonReq = { user: null, context: {} } as unknown as PayloadRequest
const call = (fn: typeof isAdmin, req: PayloadRequest) =>
  fn({ req } as Parameters<typeof isAdmin>[0])

function setEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v)
  resetEnvCache()
}

afterEach(() => {
  vi.unstubAllEnvs()
  resetEnvCache()
})

describe('Zugriffsschicht (DATENMODELL §1.4)', () => {
  const where: Where = { status: { in: ['available', 'reserved', 'sold'] } }

  it('isAdmin: nur angemeldete users; none: immer false', () => {
    expect(call(isAdmin, adminReq)).toBe(true)
    expect(call(isAdmin, anonReq)).toBe(false)
    expect(call(none, adminReq)).toBe(false)
  })

  it('AK-P1.6-01 publicRead: Admin → true', () => {
    setEnv({ SEED_PREVIEW_MODE: 'false' })
    expect(call(publicRead(where), adminReq)).toBe(true)
  })

  it('AK-P1.6-01 publicRead: ohne Vorschau-Modus Where-Query + Seed-Filter', () => {
    setEnv({ SEED_PREVIEW_MODE: 'false', APP_ENV: 'development' })
    expect(call(publicRead(where), anonReq)).toEqual({ and: [where, NOT_SEED] })
    expect(call(publicRead(), anonReq)).toEqual({ seed: { equals: false } })
  })

  it('AK-P1.6-01 publicRead: mit SEED_PREVIEW_MODE=true nur die Where-Query', () => {
    setEnv({ SEED_PREVIEW_MODE: 'true', APP_ENV: 'development' })
    expect(call(publicRead(where), anonReq)).toEqual(where)
    expect(call(publicRead(), anonReq)).toBe(true)
  })

  it('AK-P1.6-01 publicRead: SEED_PREVIEW_MODE wirkt nie in Produktion (R-181)', () => {
    setEnv({ SEED_PREVIEW_MODE: 'true', APP_ENV: 'production' })
    expect(call(publicRead(where), anonReq)).toEqual({ and: [where, NOT_SEED] })
  })

  it('adminField: lesen/ändern nur Admin', () => {
    const args = (req: PayloadRequest) => ({ req }) as Parameters<typeof adminField.read>[0]
    expect(adminField.read(args(adminReq))).toBe(true)
    expect(adminField.read(args(anonReq))).toBe(false)
    expect(adminField.update(args(anonReq))).toBe(false)
  })
})

describe('Kontext-Flags (DATENMODELL §1.5)', () => {
  it('withSystem setzt system + transition, ohne andere Flags zu verlieren', () => {
    const req = { context: { seed: true } } as unknown as PayloadRequest
    const opts = withSystem(req, 'P3')
    expect(opts.overrideAccess).toBe(true)
    expect(opts.req).toBe(req)
    expect(opts.context).toEqual({ seed: true, system: true, transition: 'P3' })
    expect(getAppContext(undefined)).toEqual({})
  })
})

describe('getPublicSettings-Whitelist (DATENMODELL §7.1)', () => {
  it('gibt nur Felder der Spalte „Öff.“ heraus, Steuermodus als aktueller Modus', () => {
    const raw = {
      shop: { isOpen: true, maxItemsPerCheckout: 10 },
      business: { legalName: 'X', taxNumber: '12/345/67890', email: 'a@example.com' },
      payment: { iban: 'DE36000000000000000000', reservationMinutes: 30 },
      tax: {
        modes: [
          { mode: 'kleinunternehmer', validFrom: '2026-01-01T00:00:00.000Z' },
          { mode: 'regelbesteuert', validFrom: '2027-01-01T00:00:00.000Z' },
        ],
        standardRate: 19,
      },
    }
    const out = pickPublicSettings(raw, new Date('2026-06-01T00:00:00Z'))
    expect(out).toEqual({
      shop: { isOpen: true },
      business: { legalName: 'X', email: 'a@example.com' },
      payment: { reservationMinutes: 30 },
      tax: { currentMode: 'kleinunternehmer' },
    })
    expect(PUBLIC_SETTINGS_PATHS).not.toContain('business.taxNumber')
    expect(PUBLIC_SETTINGS_PATHS).not.toContain('payment.iban')
  })
})
