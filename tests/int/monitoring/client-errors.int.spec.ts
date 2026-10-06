import { afterEach, describe, expect, it, vi } from 'vitest'

import { handleClientError } from '@/lib/monitoring/clientErrors'
import { setErrorReporter } from '@/lib/monitoring/errorReporter'
import { parseEnv } from '@/lib/env'
import { sql } from '@payloadcms/db-postgres'

import { dbOf } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'

// P10.10 – `POST /api/client-errors` (ARCHITEKTUR §2.5, AK-A-2-05, M-02, R-133/R-137): aus → 404; an → Schwärzung,
// kein IP-Speicher, Rate-Limit mit stillem Verwerfen.

const NOW = new Date('2026-10-15T08:00:00.000Z')
const envOf = (over: Record<string, string>) => parseEnv({ ...process.env, ...over })
const post = (body: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost:3000/api/client-errors', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
afterEach(() => setErrorReporter(undefined))

describe('POST /api/client-errors', () => {
  it('AK-A-2-05 Schalter aus (oder nicht Produktion) → 404 ohne Verarbeitung und ohne DB', async () => {
    const reported = vi.fn()
    setErrorReporter(reported)
    const payload = vi.fn()
    for (const env of [
      envOf({ NEXT_PUBLIC_CLIENT_ERRORS_ENABLED: 'false', APP_ENV: 'production' }),
      envOf({ NEXT_PUBLIC_CLIENT_ERRORS_ENABLED: 'true', APP_ENV: 'development' }),
    ]) {
      const res = await handleClientError(post({ message: 'x' }), {
        env,
        payload: payload as never,
        now: NOW,
      })
      expect(res.status).toBe(404)
    }
    expect(reported).not.toHaveBeenCalled()
    expect(payload).not.toHaveBeenCalled()
  })

  it('R-133 an: Schwärzung, keine Cookies, keine IP im Zähler, Rate-Limit → stilles Verwerfen (204)', async () => {
    const env = envOf({ NEXT_PUBLIC_CLIENT_ERRORS_ENABLED: 'true', APP_ENV: 'production' })
    const payload = await getTestPayload()
    await dbOf(payload).execute(sql`DELETE FROM rate_limit_hits WHERE bucket = 'client_errors'`)
    const seen: [string, Record<string, unknown>][] = []
    setErrorReporter((e, f) => seen.push([e, f]))
    const headers = { 'x-forwarded-for': '203.0.113.7' }
    const body = {
      message: 'Fehler bei erika@example.com',
      stack: 'at x (erika@example.com)',
      path: '/de/bestellung/' + 'T'.repeat(43),
    }
    const res = await handleClientError(post(body, headers), {
      env,
      payload: async () => payload,
      now: NOW,
    })
    expect(res.status).toBe(204)
    expect(res.headers.get('set-cookie')).toBeNull()
    expect(seen).toHaveLength(1)
    expect(JSON.stringify(seen[0])).not.toContain('erika@example.com')
    expect(JSON.stringify(seen[0])).not.toContain('T'.repeat(43))
    const rows = (
      await dbOf(payload).execute(sql`SELECT * FROM rate_limit_hits WHERE bucket = 'client_errors'`)
    ).rows
    expect(JSON.stringify(rows)).not.toContain('203.0.113.7')
    // 11. Meldung innerhalb der Minute wird still verworfen
    for (let i = 0; i < 12; i++) {
      const r = await handleClientError(post(body, headers), {
        env,
        payload: async () => payload,
        now: NOW,
      })
      expect(r.status).toBe(204)
    }
    expect(seen.length).toBe(10)
  })

  it('ungültige oder zu große Eingabe wird abgelehnt', async () => {
    const env = envOf({ NEXT_PUBLIC_CLIENT_ERRORS_ENABLED: 'true', APP_ENV: 'production' })
    const payload = await getTestPayload()
    const deps = { env, payload: async () => payload, now: NOW }
    expect((await handleClientError(post('kaputt'), deps)).status).toBe(400)
    expect((await handleClientError(post({ nope: 1 }), deps)).status).toBe(400)
    expect((await handleClientError(post({ message: 'x'.repeat(6000) }), deps)).status).toBe(413)
  })
})
