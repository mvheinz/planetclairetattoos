import http from 'node:http'
import { describe, expect, it } from 'vitest'

import { isAllowedHost, STRIPE_TEST_API_ENV } from '../../setup/network-guard'

describe('Netzwerk-Wächter (ARCHITEKTUR §7.2, AK-A-3-01)', () => {
  it('AK-A-3-01 fetch auf https://example.org scheitert mit klarer Meldung', async () => {
    await expect(fetch('https://example.org')).rejects.toThrow(/Netzwerk-Wächter.*example\.org/)
  })

  it('AK-A-3-01 Socket-Verbindung zu fremdem Host scheitert', async () => {
    const result = await new Promise<string>((resolve) => {
      try {
        const req = http.get('http://example.org/', () => resolve('verbunden'))
        req.on('error', (e) => resolve(e.message))
      } catch (e) {
        resolve((e as Error).message)
      }
    })
    expect(result).toMatch(/Netzwerk-Wächter/)
  })

  it('localhost, 127.0.0.1 und ::1 sind erlaubt', () => {
    expect(isAllowedHost('localhost')).toBe(true)
    expect(isAllowedHost('127.0.0.1')).toBe(true)
    expect(isAllowedHost('::1')).toBe(true)
    expect(isAllowedHost('example.org')).toBe(false)
  })

  it('P4.5 api.stripe.com nur mit ausdrücklicher Freigabe (Stripe-Testmodus), sonst blockiert', () => {
    const before = process.env[STRIPE_TEST_API_ENV]
    try {
      delete process.env[STRIPE_TEST_API_ENV]
      expect(isAllowedHost('api.stripe.com')).toBe(false)
      process.env[STRIPE_TEST_API_ENV] = '1'
      expect(isAllowedHost('api.stripe.com')).toBe(true)
      expect(isAllowedHost('js.stripe.com')).toBe(false)
      expect(isAllowedHost('example.org')).toBe(false)
    } finally {
      if (before === undefined) delete process.env[STRIPE_TEST_API_ENV]
      else process.env[STRIPE_TEST_API_ENV] = before
    }
  })
})
