import * as Sentry from '@sentry/nextjs'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { setErrorReporter } from '@/lib/monitoring/errorReporter'
import { createLogger } from '@/lib/monitoring/logger'
import { buildSentryOptions, redactSentryEvent, sentryActive } from '@/lib/monitoring/sentry'

// P10.10 – Sentry (ARCHITEKTUR §11.4, AK-A-11-01, R-133): Test-Transport, kein Netz.

const TOKEN = 'A'.repeat(20) + 'b'.repeat(23) // 43 Zeichen
const events: Record<string, unknown>[] = []

beforeAll(() => {
  Sentry.init({
    ...buildSentryOptions({
      SENTRY_DSN: 'https://key@o0.ingest.de.sentry.io/1',
      APP_ENV: 'test',
      VERCEL_GIT_COMMIT_SHA: 'abcdef1',
    }),
    // Test-Transport: fängt Ereignisse ab (kein Netz).
    transport: () => ({
      send: async (envelope: [unknown, [unknown, unknown][]]) => {
        for (const item of envelope[1]) {
          const payload = item[1] as Record<string, unknown>
          if (payload && typeof payload === 'object' && 'exception' in payload) events.push(payload)
        }
        return {}
      },
      flush: async () => true,
    }),
    integrations: [],
    defaultIntegrations: false,
  })
})
afterAll(async () => {
  await Sentry.close()
  setErrorReporter(undefined)
})

describe('Sentry (nur Server, geschwärzt)', () => {
  it('ohne DSN oder außerhalb von nodejs keine Initialisierung', () => {
    expect(sentryActive({ SENTRY_DSN: '' }, 'nodejs')).toBe(false)
    expect(sentryActive({ SENTRY_DSN: undefined }, 'nodejs')).toBe(false)
    expect(sentryActive({ SENTRY_DSN: 'https://k@o0.ingest.de.sentry.io/1' }, 'edge')).toBe(false)
    expect(sentryActive({ SENTRY_DSN: 'https://k@o0.ingest.de.sentry.io/1' }, 'nodejs')).toBe(true)
  })

  it('Optionen nach §11.4', () => {
    const o = buildSentryOptions({
      SENTRY_DSN: 'x',
      APP_ENV: 'production',
      VERCEL_GIT_COMMIT_SHA: 'abc',
    })
    expect(o).toMatchObject({
      environment: 'production',
      release: 'abc',
      sendDefaultPii: false,
      tracesSampleRate: 0,
      maxBreadcrumbs: 20,
    })
    expect(o.ignoreErrors).toEqual(['NEXT_NOT_FOUND', 'NEXT_REDIRECT'])
    expect(
      buildSentryOptions({ SENTRY_DSN: 'x', APP_ENV: 'production', SENTRY_ENVIRONMENT: 'staging' })
        .environment,
    ).toBe('staging')
  })

  it('AK-A-11-01 ein Fehler mit E-Mail-Adresse und Token erzeugt ein Ereignis ohne diese Zeichenketten', async () => {
    events.length = 0
    Sentry.captureException(
      new Error(`Zahlung für erika@example.com fehlgeschlagen, Token ${TOKEN}`),
    )
    await Sentry.flush(2000)
    expect(events.length).toBe(1)
    const json = JSON.stringify(events[0])
    expect(json).not.toContain('erika@example.com')
    expect(json).not.toContain(TOKEN)
    expect(json).toContain('Zahlung')
  })

  it('redactSentryEvent entfernt Cookies, Daten, Header außer user-agent und normalisiert Token-Pfade', () => {
    const e = redactSentryEvent({
      request: {
        url: `https://planetclairetattoos.com/de/bestellung/${TOKEN}?x=erika@example.com`,
        cookies: { pc_cart: '1' },
        data: { email: 'erika@example.com' },
        query_string: 'x=1',
        headers: { cookie: 'a=b', 'user-agent': 'UA', authorization: 'Bearer x' },
      },
      user: { email: 'erika@example.com', ip_address: '1.2.3.4' },
      extra: { email: 'erika@example.com', note: 'ok' },
    }) as unknown as { request: Record<string, unknown>; user?: unknown; extra: unknown }
    expect(e.request.cookies).toBeUndefined()
    expect(e.request.data).toBeUndefined()
    expect(e.request.headers).toEqual({ 'user-agent': 'UA' })
    expect(e.request.url).not.toContain(TOKEN)
    expect(e.request.url).not.toContain('?')
    expect(e.user).toBeUndefined()
    expect(JSON.stringify(e.extra)).not.toContain('erika@example.com')
  })

  it('M-01: logger.error meldet über den Melder, geschwärzt; ohne Melder passiert nichts', () => {
    const seen: [string, Record<string, unknown>][] = []
    const sink = () => undefined
    const log = createLogger({ sink })
    expect(() => log.error('x.failed', { email: 'a@b.de' })).not.toThrow()
    setErrorReporter((ev, f) => seen.push([ev, f]))
    log.error('x.failed', { email: 'erika@example.com', code: 'E1' })
    log.warn('nur.warn')
    expect(seen).toHaveLength(1)
    expect(JSON.stringify(seen[0])).not.toContain('erika@example.com')
    expect(seen[0]![1]).toMatchObject({ code: 'E1' })
  })
})
