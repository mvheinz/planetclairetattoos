import { describe, expect, it } from 'vitest'

import { ipHash } from '@/lib/security/ipHash'
import { deriveKey, KEY_LABELS } from '@/lib/security/keys'
import { hashToken, randomToken, safeEqual } from '@/lib/security/tokens'
import { fixedClock } from '@/lib/time'

const secret = 'x'.repeat(64)

describe('Schlüssel und IP-Hash (ARCHITEKTUR §8.6)', () => {
  it('verwendet die festen Bezeichner', () => {
    expect(Object.values(KEY_LABELS)).toEqual([
      'pc:ip-hash:v1',
      'pc:form-token:v1',
      'pc:mock-webhook:v1',
      'pc:status-token-seal:v1',
      'pc:privacy-export:v1',
    ])
  })

  it('abgeleitete Schlüssel sind je Zweck verschieden und stabil', () => {
    expect(deriveKey('ipHash', secret).equals(deriveKey('ipHash', secret))).toBe(true)
    expect(deriveKey('ipHash', secret).equals(deriveKey('formToken', secret))).toBe(false)
    expect(deriveKey('ipHash', secret)).toHaveLength(32)
  })

  it('R-134 ipHash wechselt täglich (Berliner Datum) und enthält keine Klar-IP', () => {
    const day1 = fixedClock('2026-10-15T10:00:00+02:00')
    const day2 = fixedClock('2026-10-16T10:00:00+02:00')
    const sameDayLate = fixedClock('2026-10-15T23:30:00+02:00')
    const a = ipHash('203.0.113.7', day1, secret)
    expect(a).not.toBe(ipHash('203.0.113.7', day2, secret))
    expect(a).toBe(ipHash('203.0.113.7', sameDayLate, secret))
    expect(a).not.toContain('203.0.113.7')
  })

  it('Kunden-Token: 43 Zeichen base64url, zufällig, Vergleich in konstanter Zeit', () => {
    const t = randomToken()
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(randomToken()).not.toBe(t)
    expect(hashToken(t)).toHaveLength(64)
    expect(safeEqual(t, t)).toBe(true)
    expect(safeEqual(t, randomToken())).toBe(false)
  })
})
