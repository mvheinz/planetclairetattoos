import http from 'node:http'
import { describe, expect, it } from 'vitest'

import { isAllowedHost } from '../../setup/network-guard'

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
})
