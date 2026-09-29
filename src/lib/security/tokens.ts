import 'server-only'

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

import { deriveKey, KEY_LABELS } from './keys'

// Kunden-Token (Kasse, Danke, Status): 32 Zufallsbytes base64url = 43 Zeichen (ARCHITEKTUR §8.6, KONZEPT §2.3,
// DATENMODELL §6.8.2/§6.25.2). Nie aus PAYLOAD_SECRET abgeleitet; gespeichert und gesucht wird nur der SHA-256-Hash
// (hex), verglichen in konstanter Zeit. Der Status-Token liegt zusätzlich versiegelt vor (AES-256-GCM mit dem
// HKDF-Schlüssel `pc:status-token-seal:v1`), damit spätere Mails denselben Link enthalten (R-067). Token nie loggen.

export const TOKEN_BYTES = 32
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/
const SHA256_HEX = /^[0-9a-f]{64}$/

/** Neuer zufälliger Kunden-Token (43 Zeichen base64url). */
export function createToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

/** Alias aus P1 für bestehende Aufrufer; neue Stellen nutzen `createToken()`. */
export const randomToken = createToken

/** SHA-256 (hex) – dieselbe Funktion für echte Token und die Seed-Token aus `seedToken()`. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

/** Vergleicht zwei Zeichenketten in konstanter Zeit (bei gleicher Länge). */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

/** `true`, wenn `hash` der SHA-256 (hex) von `token` ist; Vergleich der Digests in konstanter Zeit. */
export function matchesHash(token: string, hash: string | null | undefined): boolean {
  if (typeof hash !== 'string' || !SHA256_HEX.test(hash)) return false
  const actual = createHash('sha256').update(token, 'utf8').digest()
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'))
}

// Siegel: `v1.` + base64url(IV 12 Byte ‖ Chiffrat ‖ Tag 16 Byte); zusätzliche Daten (AAD) = Schlüssel-Bezeichner.
const SEAL_PREFIX = 'v1.'
const IV_BYTES = 12
const TAG_BYTES = 16
const AAD = Buffer.from(KEY_LABELS.statusTokenSeal, 'utf8')

/** Siegel lässt sich nicht öffnen (anderer Schlüssel, beschädigt, unbekanntes Format). Enthält nie den Token. */
export class TokenSealError extends Error {
  constructor(message = 'Das Siegel des Status-Tokens lässt sich nicht öffnen.') {
    super(message)
    this.name = 'TokenSealError'
  }
}

const sealKey = (key?: Buffer) => key ?? deriveKey('statusTokenSeal')

/** Versiegelt einen Token (AES-256-GCM, zufälliger IV). `key` nur für Tests, sonst HKDF `pc:status-token-seal:v1`. */
export function sealToken(token: string, key?: Buffer): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv('aes-256-gcm', sealKey(key), iv, { authTagLength: TAG_BYTES })
  cipher.setAAD(AAD)
  const body = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return SEAL_PREFIX + Buffer.concat([iv, body, cipher.getAuthTag()]).toString('base64url')
}

/** Öffnet ein Siegel aus `sealToken`; wirft `TokenSealError` bei falschem Schlüssel oder beschädigtem Siegel. */
export function unsealToken(sealed: string, key?: Buffer): string {
  if (typeof sealed !== 'string' || !sealed.startsWith(SEAL_PREFIX)) {
    throw new TokenSealError('Unbekanntes Format des Status-Token-Siegels.')
  }
  const raw = Buffer.from(sealed.slice(SEAL_PREFIX.length), 'base64url')
  if (raw.length <= IV_BYTES + TAG_BYTES) throw new TokenSealError()
  const iv = raw.subarray(0, IV_BYTES)
  const tag = raw.subarray(raw.length - TAG_BYTES)
  const body = raw.subarray(IV_BYTES, raw.length - TAG_BYTES)
  try {
    const decipher = createDecipheriv('aes-256-gcm', sealKey(key), iv, {
      authTagLength: TAG_BYTES,
    })
    decipher.setAAD(AAD)
    decipher.setAuthTag(tag)
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')
  } catch {
    throw new TokenSealError()
  }
}
