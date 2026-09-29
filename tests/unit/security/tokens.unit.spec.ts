import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { deriveKey } from '@/lib/security/keys'
import {
  createToken,
  hashToken,
  matchesHash,
  sealToken,
  TOKEN_RE,
  TokenSealError,
  unsealToken,
} from '@/lib/security/tokens'
import { seedToken, seedTokenHash } from '@/lib/seed/tokens'

// P4.1 (ARCHITEKTUR §8.6, DATENMODELL §6.8.2/§6.25.2, R-067): Kunden-Token, Hash, Vergleich, Siegel.

const key = deriveKey('statusTokenSeal', 'a'.repeat(64))
const otherKey = deriveKey('statusTokenSeal', 'b'.repeat(64))

describe('Kunden-Token (DM-CHK-01, R-067)', () => {
  it('createToken: 32 Zufallsbytes als base64url, genau 43 Zeichen, jedes Mal neu', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const t = createToken()
      expect(t).toMatch(TOKEN_RE)
      expect(t).toHaveLength(43)
      expect(Buffer.from(t, 'base64url')).toHaveLength(32)
      seen.add(t)
    }
    expect(seen.size).toBe(200)
  })

  it('hashToken: SHA-256 hex (64 Zeichen), stabil; derselbe Hash wie beim Seed-Token', () => {
    const t = createToken()
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken(t)).toBe(createHash('sha256').update(t, 'utf8').digest('hex'))
    expect(hashToken(t)).toBe(hashToken(t))
    const seed = seedToken('orders:O10', 'status')
    expect(seedTokenHash('orders:O10', 'status')).toBe(hashToken(seed))
  })

  it('matchesHash: richtiger Token passt, anderer Token, fremder oder kaputter Hash nicht', () => {
    const t = createToken()
    const h = hashToken(t)
    expect(matchesHash(t, h)).toBe(true)
    expect(matchesHash(createToken(), h)).toBe(false)
    expect(matchesHash(t, hashToken(createToken()))).toBe(false)
    for (const bad of [null, undefined, '', 'zz', h.toUpperCase(), `${h}0`, h.slice(1)]) {
      expect(matchesHash(t, bad), String(bad)).toBe(false)
    }
  })

  it('matchesHash vergleicht in konstanter Zeit (timingSafeEqual über die Digests)', async () => {
    const src = (await import('node:fs')).readFileSync('src/lib/security/tokens.ts', 'utf8')
    const body = src.slice(src.indexOf('export function matchesHash'))
    const fn = body.slice(0, body.indexOf('\n}\n'))
    expect(fn).toMatch(/timingSafeEqual\(/)
    expect(fn).not.toMatch(/===\s*hash|hash\s*===/)
  })
})

describe('Versiegelter Status-Token (DM-36, DM-ORD-11)', () => {
  it('Siegeln/Entsiegeln ergibt den Token; das Siegel enthält ihn nicht im Klartext', () => {
    const t = createToken()
    const sealed = sealToken(t, key)
    expect(sealed.startsWith('v1.')).toBe(true)
    expect(sealed).not.toContain(t)
    expect(unsealToken(sealed, key)).toBe(t)
    expect(matchesHash(unsealToken(sealed, key), hashToken(t))).toBe(true)
  })

  it('jedes Siegel ist anders (zufälliger IV), öffnet aber denselben Token', () => {
    const t = createToken()
    const a = sealToken(t, key)
    const b = sealToken(t, key)
    expect(a).not.toBe(b)
    expect(unsealToken(a, key)).toBe(unsealToken(b, key))
  })

  it('falscher Schlüssel → Fehler (z. B. nach Tausch von PAYLOAD_SECRET), ohne Token in der Meldung', () => {
    const t = createToken()
    const sealed = sealToken(t, key)
    let err: unknown
    try {
      unsealToken(sealed, otherKey)
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(TokenSealError)
    expect(String((err as Error).message)).not.toContain(t)
  })

  it('beschädigtes oder fremdes Siegel → Fehler', () => {
    const sealed = sealToken(createToken(), key)
    const body = Buffer.from(sealed.slice(3), 'base64url')
    body[20] = body[20]! ^ 0xff
    for (const bad of [
      `v1.${body.toString('base64url')}`,
      sealed.slice(0, -4),
      `v2.${sealed.slice(3)}`,
      'v1.',
      'v1.AAAA',
      createToken(),
      '',
    ]) {
      expect(() => unsealToken(bad, key), bad).toThrow(TokenSealError)
    }
  })

  it('der Siegel-Schlüssel ist der HKDF-Schlüssel pc:status-token-seal:v1, nicht der Token-Hash', () => {
    const t = createToken()
    expect(() => unsealToken(sealToken(t, key), deriveKey('ipHash', 'a'.repeat(64)))).toThrow(
      TokenSealError,
    )
  })
})
