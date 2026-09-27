import 'server-only'

import { hkdfSync } from 'node:crypto'

import { getEnv } from '../env'

// Einzige Stelle für abgeleitete Schlüssel (ARCHITEKTUR §8.6): HKDF-SHA256 aus PAYLOAD_SECRET.
export const KEY_LABELS = {
  ipHash: 'pc:ip-hash:v1',
  formToken: 'pc:form-token:v1',
  mockWebhook: 'pc:mock-webhook:v1',
  statusTokenSeal: 'pc:status-token-seal:v1',
  privacyExport: 'pc:privacy-export:v1',
} as const
export type KeyPurpose = keyof typeof KEY_LABELS

const SALT = Buffer.from('planetclaire', 'utf8')

export function deriveKey(purpose: KeyPurpose, secret: string = getEnv().PAYLOAD_SECRET): Buffer {
  return Buffer.from(hkdfSync('sha256', Buffer.from(secret, 'utf8'), SALT, KEY_LABELS[purpose], 32))
}
