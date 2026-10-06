import pg from 'pg'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { GET } from '@/app/(api)/api/health/route'
import { parseEnv } from '@/lib/env'
import { handleDeepHealth } from '@/lib/monitoring/deepHealth'

import { getTestPayload } from '../helpers/payload'

// P10.13 – `GET /api/health?deep=1` (ARCHITEKTUR §2.5, §10.5 Schritt 8): Bearer Pflicht, DB- und Speicher-Ping.

const SECRET = 'deep-health-secret-0123456789abcdefghijk'
const env = parseEnv({ ...process.env, CRON_SECRET: SECRET })
const base = { version: '1.0.0', appEnv: 'test' }
const req = (auth?: string) =>
  new Request('http://localhost:3000/api/health?deep=1', {
    headers: auth ? { authorization: auth } : {},
  })

afterEach(() => vi.restoreAllMocks())

describe('GET /api/health?deep=1', () => {
  it('ohne Bearer 401 und ohne Datenbank-Verbindung', async () => {
    const connect = vi.spyOn(pg.Pool.prototype, 'connect')
    const res = await GET(req())
    expect(res.status).toBe(401)
    const res2 = await handleDeepHealth(req('Bearer falsch'), base, { env })
    expect(res2.status).toBe(401)
    expect(connect).not.toHaveBeenCalled()
  })

  it('mit Bearer: Datenbank und Speicher ok → 200 ohne Details', async () => {
    const payload = await getTestPayload()
    const res = await handleDeepHealth(req(`Bearer ${SECRET}`), base, {
      env,
      payload: async () => payload,
    })
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ status: 'ok', db: 'ok', storage: 'ok', ...base })
  })

  it('Datenbank oder Speicher fehlerhaft → 503 mit Teilergebnis', async () => {
    const res = await handleDeepHealth(req(`Bearer ${SECRET}`), base, {
      env,
      payload: async () => {
        throw new Error('db down')
      },
      storagePing: async () => {
        throw new Error('s3 down')
      },
    })
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ status: 'error', db: 'error', storage: 'error' })
  })

  it('ohne deep=1 bleibt es das Lebenszeichen ohne DB', async () => {
    const res = GET(new Request('http://localhost:3000/api/health'))
    expect((res as Response).status).toBe(200)
  })
})
