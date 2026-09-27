import 'server-only'

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

// Kunden-Token (Kasse, Danke, Status): 32 Zufallsbytes base64url = 43 Zeichen (ARCHITEKTUR §8.6, KONZEPT §2.3).
// Nie aus PAYLOAD_SECRET abgeleitet. Siegel (sealToken/unsealToken) folgen in P4.1.
export function randomToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}
