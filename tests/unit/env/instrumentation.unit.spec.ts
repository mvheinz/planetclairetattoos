import { afterEach, describe, expect, it, vi } from 'vitest'

import { register } from '../../../src/instrumentation'

// AK-A-4-02 (ARCHITEKTUR §4.2): Ohne `APP_ENV` bricht ein Produktions-Start ab (Start-Prüfung in `register()`);
// der Produktions-Build selbst und die Entwicklung (`pnpm dev` = `development`) sind davon nicht betroffen.

afterEach(() => vi.unstubAllEnvs())

describe('Start-Prüfung ohne APP_ENV (AK-A-4-02)', () => {
  it('AK-A-4-02 pnpm start (NODE_ENV=production) ohne APP_ENV → Abbruch mit deutscher Meldung', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_ENV', '')
    vi.stubEnv('NEXT_PHASE', '')
    await expect(register()).rejects.toThrow(/APP_ENV fehlt/)
  })

  it('AK-A-4-02 während des Produktions-Builds kein Abbruch; Edge-Laufzeit prüft nichts', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge')
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_ENV', '')
    await expect(register()).resolves.toBeUndefined()
    vi.stubEnv('NEXT_RUNTIME', 'nodejs')
    vi.stubEnv('NEXT_PHASE', 'phase-production-build')
    vi.stubEnv('APP_ENV', 'development')
    vi.stubEnv('SENTRY_DSN', '')
    await expect(register()).resolves.toBeUndefined()
  })

  it('AK-A-4-02 pnpm dev ohne APP_ENV startet als development', async () => {
    const { parseEnv } = await import('../../../src/lib/env')
    expect(parseEnv({ PAYLOAD_SECRET: 'dev' }).APP_ENV).toBe('development')
  })
})
