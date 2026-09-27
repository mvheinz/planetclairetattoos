import 'server-only'

import { timingSafeEqual } from 'node:crypto'

import type { Env } from '@/lib/env'

/** `Authorization: Bearer <CRON_SECRET>` (ARCHITEKTUR §2.5); ohne gesetztes Geheimnis ist nichts erlaubt. */
export function isCronAuthorized(
  headers: Pick<Headers, 'get'> | undefined,
  env: Pick<Env, 'CRON_SECRET'>,
): boolean {
  const secret = env.CRON_SECRET
  if (!secret || !headers) return false
  const value = headers.get('authorization') ?? ''
  const m = /^Bearer\s+(.+)$/i.exec(value.trim())
  if (!m) return false
  const a = Buffer.from(m[1]!)
  const b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}
