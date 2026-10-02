import 'server-only'

import { createHmac, randomBytes } from 'node:crypto'

import { z } from 'zod'

import { deriveKey } from '@/lib/security/keys'
import { safeEqual } from '@/lib/security/tokens'

// Formular-Token des Auftragsarbeiten-Formulars R10 (ARCHITEKTUR §8.6, KONZEPT §10.2/§10.3, PLAN P7.11/P7.12):
// signiertes `{ iat, purpose: 'commission', nonce }` (HMAC-SHA256 mit dem HKDF-Schlüssel `pc:form-token:v1`), beim
// Rendern der Seite erzeugt, 2 h gültig. Es dient als Zeitfalle (Absenden < 3 s nach dem Laden → Schein-Erfolg) und als
// Upload-Berechtigung: Jeder Upload bekommt ein `ticket` = HMAC(uploadId + Nonce); nur Uploads mit passendem Ticket
// werden beim Absenden an die Anfrage gehängt. Das Token enthält keine Personendaten und landet nie in der URL.

export const COMMISSION_FORM_TOKEN_TTL_MS = 2 * 60 * 60 * 1000
/** Mindest-Ausfüllzeit (R-134, KONZEPT §10.2). */
export const COMMISSION_MIN_FILL_MS = 3000
const PURPOSE = 'commission'

export interface CommissionFormToken {
  iat: number
  purpose: typeof PURPOSE
  nonce: string
}

const bodySchema = z.strictObject({
  iat: z.number().int().nonnegative(),
  purpose: z.literal(PURPOSE),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{16,64}$/),
})

const key = (k?: Buffer) => k ?? deriveKey('formToken')
const mac = (data: string, k?: Buffer) =>
  createHmac('sha256', key(k)).update(data, 'utf8').digest('base64url')

/** Neues Formular-Token (beim Rendern von R10 bzw. nach Ablauf). */
export function createCommissionFormToken(now: Date, k?: Buffer): string {
  const body: CommissionFormToken = {
    iat: now.getTime(),
    purpose: PURPOSE,
    nonce: randomBytes(18).toString('base64url'),
  }
  const encoded = Buffer.from(JSON.stringify(body), 'utf8').toString('base64url')
  return `${encoded}.${mac(`form:${encoded}`, k)}`
}

/** Prüft Signatur, Zweck und Alter (≤ 2 h); `null` bei fremdem, manipuliertem oder abgelaufenem Token. */
export function verifyCommissionFormToken(
  token: unknown,
  now: Date,
  k?: Buffer,
): CommissionFormToken | null {
  if (typeof token !== 'string' || token.length > 400) return null
  const [encoded, sig, rest] = token.split('.')
  if (!encoded || !sig || rest !== undefined) return null
  if (!safeEqual(sig, mac(`form:${encoded}`, k))) return null
  try {
    const parsed = bodySchema.safeParse(
      JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')),
    )
    if (!parsed.success) return null
    const age = now.getTime() - parsed.data.iat
    if (age < -60_000 || age > COMMISSION_FORM_TOKEN_TTL_MS) return null
    return parsed.data
  } catch {
    return null
  }
}

/** `true`, wenn das Formular schneller als in 3 s abgeschickt wurde (Zeitfalle, Schein-Erfolg). */
export function submittedTooFast(token: CommissionFormToken, now: Date): boolean {
  return now.getTime() - token.iat < COMMISSION_MIN_FILL_MS
}

/** Upload-Ticket: HMAC(uploadId + Formular-Nonce) – bindet einen Upload an genau ein Formular. */
export function uploadTicket(uploadId: number | string, nonce: string, k?: Buffer): string {
  return mac(`ticket:${uploadId}:${nonce}`, k)
}

export function verifyUploadTicket(
  uploadId: number | string,
  nonce: string,
  ticket: unknown,
  k?: Buffer,
): boolean {
  return (
    typeof ticket === 'string' &&
    ticket.length <= 100 &&
    safeEqual(ticket, uploadTicket(uploadId, nonce, k))
  )
}
