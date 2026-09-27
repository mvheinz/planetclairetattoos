import pg from 'pg'
import { afterEach, describe, expect, it, vi } from 'vitest'

import pkg from '../../../package.json'

// AK-A-2-01 (ARCHITEKTUR §2.5): GET /api/health antwortet schnell und ohne Datenbank.
describe('GET /api/health', () => {
  afterEach(() => vi.restoreAllMocks())

  it('AK-A-2-01 200 { status, version, appEnv } in < 100 ms ohne Pool-Verbindung', async () => {
    const poolConnect = vi.spyOn(pg.Pool.prototype, 'connect')
    const poolQuery = vi.spyOn(pg.Pool.prototype, 'query')
    const clientConnect = vi.spyOn(pg.Client.prototype, 'connect')
    const { GET, dynamic } = await import('@/app/(api)/api/health/route')
    expect(dynamic).toBe('force-dynamic')

    const started = performance.now()
    const res = GET()
    const elapsed = performance.now() - started
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    const body = (await res.json()) as { status: string; version: string; appEnv: string }
    expect(body.status).toBe('ok')
    expect(body.version.startsWith(pkg.version)).toBe(true)
    expect(['development', 'test', 'preview', 'staging', 'production']).toContain(body.appEnv)
    expect(elapsed).toBeLessThan(100)

    expect(poolConnect).not.toHaveBeenCalled()
    expect(poolQuery).not.toHaveBeenCalled()
    expect(clientConnect).not.toHaveBeenCalled()
  })

  it('AK-A-2-01 Route importiert weder Payload noch die Datenbank', async () => {
    const { readFile } = await import('node:fs/promises')
    const src = await readFile('src/app/(api)/api/health/route.ts', 'utf8')
    expect(src).not.toMatch(/from ['"](payload|@payload-config|pg|@payloadcms\/)/)
  })
})
