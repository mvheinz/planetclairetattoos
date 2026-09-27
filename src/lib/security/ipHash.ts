import 'server-only'

import { createHmac } from 'node:crypto'

import { berlinDateKey, type Clock } from '../time'
import { deriveKey } from './keys'

/** R-134: HMAC-SHA256(key = HMAC(ipKey, Berliner Datum), ip) – täglich wechselnd, keine Klar-IP (ARCHITEKTUR §8.6). */
export function ipHash(ip: string, clock: Clock, secret?: string): string {
  const dayKey = createHmac('sha256', deriveKey('ipHash', secret))
    .update(berlinDateKey(clock.now()))
    .digest()
  return createHmac('sha256', dayKey).update(ip.trim().toLowerCase()).digest('hex')
}
