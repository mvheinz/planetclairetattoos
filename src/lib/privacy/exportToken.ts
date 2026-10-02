import 'server-only'

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

import { deriveKey } from '@/lib/security/keys'

// Download-Link des DSGVO-Exports (ARCHITEKTUR §2.5, §8.6, R-137, PLAN P6.17): signierter Token `{ requestId, exp,
// nonce }` mit HMAC-SHA256 aus dem HKDF-Schlüssel `pc:privacy-export:v1`, 7 Tage gültig, Prüfung in konstanter Zeit.
// Der Token enthält nur die interne ID der Anfrage – keine Nummer, keinen Namen, keine E-Mail-Adresse.

export const PRIVACY_EXPORT_LINK_DAYS = 7
const TOKEN_RE = /^[A-Za-z0-9_-]{10,200}\.[A-Za-z0-9_-]{43}$/

interface Claims {
  /** Interne ID der Datenschutz-Anfrage. */
  r: number
  /** Ablauf (Unix-Sekunden). */
  e: number
  /** Zufall, damit jeder Link anders aussieht. */
  n: string
}

const mac = (body: string, key: Buffer) =>
  createHmac('sha256', key).update(body, 'utf8').digest('base64url')

export function signPrivacyExportToken(
  input: { requestId: number; expiresAt: Date },
  key: Buffer = deriveKey('privacyExport'),
): string {
  const claims: Claims = {
    r: input.requestId,
    e: Math.floor(input.expiresAt.getTime() / 1000),
    n: randomBytes(9).toString('base64url'),
  }
  const body = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url')
  return `${body}.${mac(body, key)}`
}

export type PrivacyExportTokenCheck =
  | { ok: true; requestId: number; expiresAt: Date }
  | { ok: false; reason: 'invalid' | 'expired'; requestId?: number }

export function verifyPrivacyExportToken(
  token: string,
  now: Date,
  key: Buffer = deriveKey('privacyExport'),
): PrivacyExportTokenCheck {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return { ok: false, reason: 'invalid' }
  const [body, sig] = token.split('.') as [string, string]
  const expected = Buffer.from(mac(body, key), 'utf8')
  const given = Buffer.from(sig, 'utf8')
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: 'invalid' }
  }
  let claims: Claims
  try {
    claims = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Claims
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (!Number.isSafeInteger(claims.r) || claims.r < 1 || !Number.isSafeInteger(claims.e)) {
    return { ok: false, reason: 'invalid' }
  }
  const expiresAt = new Date(claims.e * 1000)
  if (now.getTime() >= expiresAt.getTime()) {
    return { ok: false, reason: 'expired', requestId: claims.r }
  }
  return { ok: true, requestId: claims.r, expiresAt }
}
