import 'server-only'

import { createHash } from 'node:crypto'

import { SEED_KEY_REGEX } from '@/fields/seed'
import { hashToken } from '@/lib/security/tokens'

// Deterministische Kassen-, Danke- und Status-Token nur für den Beispielbestand (SEED-SPEC §2.5, DATENMODELL §6.8.2).
// Eingabe ist immer der `seedKey` (z. B. `orders:O10`, `checkouts:KS2`), nie die Bestellnummer und nie ein Schlüssel
// wie `PAYLOAD_SECRET` (ARCHITEKTUR §8.6). Echte Token bleiben zufällig (`randomToken()`).

export type SeedTokenPurpose = 'checkout' | 'status'

const PREFIX: Record<SeedTokenPurpose, string> = { checkout: 'checkouts:', status: 'orders:' }

/** `base64url(SHA-256("pc-seed-token:v1:" + purpose + ":" + seedKey))`, 43 Zeichen. */
export function seedToken(seedKey: string, purpose: SeedTokenPurpose): string {
  if (!SEED_KEY_REGEX.test(seedKey)) throw new Error(`seedToken: ungültiger seedKey „${seedKey}“`)
  if (!seedKey.startsWith(PREFIX[purpose])) {
    throw new Error(`seedToken: Zweck „${purpose}“ passt nicht zu „${seedKey}“`)
  }
  return createHash('sha256')
    .update(`pc-seed-token:v1:${purpose}:${seedKey}`, 'utf8')
    .digest('base64url')
}

/** Gespeichert wird wie bei echten Token nur der SHA-256-Hash (hex). */
export function seedTokenHash(seedKey: string, purpose: SeedTokenPurpose): string {
  return hashToken(seedToken(seedKey, purpose))
}
