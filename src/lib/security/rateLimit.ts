import 'server-only'

import { createHash } from 'node:crypto'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

// Rate-Limit (ARCHITEKTUR §3.9, §8.5): feste Zeitfenster je Bucket in der Postgres-Tabelle `rate_limit_hits`
// (eigene SQL-Migration `p1_rate_limit`). Schlüssel ist der IP-Hash (§8.6); gespeichert wird nur dessen SHA-256.
// Zähler werden nach 24 h gelöscht (R-134, L-13a) – `purgeRateLimits` ruft der stündliche Wartungs-Job auf.

export interface RateLimitRule {
  /** Höchstzahl Treffer je Fenster. */
  limit: number
  /** Fensterlänge in Millisekunden. */
  windowMs: number
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

/** Grenzen laut ARCHITEKTUR §8.5 (weitere Buckets kommen mit ihren Aufgaben dazu). */
export const RATE_LIMITS = {
  admin_login: { limit: 10, windowMs: 15 * MINUTE },
  forgot_password: { limit: 3, windowMs: HOUR },
  cart_add: { limit: 60, windowMs: 10 * MINUTE },
  /** „Zur Kasse“: 10 / 10 min und zusätzlich 30 / Tag (zweiter Bucket `checkout_start_day`). */
  checkout_start: { limit: 10, windowMs: 10 * MINUTE },
  checkout_start_day: { limit: 30, windowMs: 24 * HOUR },
  /** „Zahlungspflichtig bestellen“ je Kassen-Token (Schlüssel: Token-Hash). */
  checkout_submit: { limit: 10, windowMs: 30 * MINUTE },
  product_status: { limit: 120, windowMs: MINUTE },
  /** R08, R09, `GET /api/checkout/[token]/state`, Dokument-Downloads (P4.17/P4.23). */
  token_pages: { limit: 60, windowMs: MINUTE },
} as const satisfies Record<string, RateLimitRule>

export type RateLimitBucket = keyof typeof RATE_LIMITS

/** Speicherdauer der Zähler (R-134, L-13a). */
export const RATE_LIMIT_RETENTION_MS = 24 * HOUR

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: Date
  count: number
}

type Db = {
  execute: (query: ReturnType<typeof sql>) => Promise<{ rows: Record<string, unknown>[] }>
}

function drizzleOf(payload: Payload): Db {
  // Bewusst ohne Transaktion des Requests: ein fehlgeschlagener Login rollt seine Transaktion zurück, der Zähler
  // muss trotzdem bleiben.
  return (payload.db as unknown as { drizzle: Db }).drizzle
}

export const hashRateLimitKey = (key: string) => createHash('sha256').update(key).digest('hex')

export function windowStart(now: Date, windowMs: number): Date {
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs)
}

/**
 * Zählt einen Treffer und meldet, ob er innerhalb der Grenze liegt (atomar per `INSERT … ON CONFLICT`).
 * `key` ist der IP-Hash bzw. ein anderer nicht personenbezogener Schlüssel.
 */
export async function hit(
  bucket: RateLimitBucket,
  key: string,
  now: Date,
  payload: Payload,
): Promise<RateLimitResult> {
  const rule: RateLimitRule = RATE_LIMITS[bucket]
  const start = windowStart(now, rule.windowMs)
  const res = await drizzleOf(payload).execute(sql`
    INSERT INTO rate_limit_hits (bucket, key_hash, window_start, count)
    VALUES (${bucket}, ${hashRateLimitKey(key)}, ${start.toISOString()}::timestamptz, 1)
    ON CONFLICT (bucket, key_hash, window_start)
    DO UPDATE SET count = rate_limit_hits.count + 1
    RETURNING count
  `)
  const count = Number(res.rows[0]?.count ?? 1)
  return {
    allowed: count <= rule.limit,
    remaining: Math.max(0, rule.limit - count),
    resetAt: new Date(start.getTime() + rule.windowMs),
    count,
  }
}

/** Löscht Zähler, deren Fenster länger als 24 h zurückliegt. Gibt die Anzahl gelöschter Zeilen zurück. */
export async function purgeRateLimits(now: Date, payload: Payload): Promise<number> {
  const cutoff = new Date(now.getTime() - RATE_LIMIT_RETENTION_MS)
  const res = await drizzleOf(payload).execute(sql`
    DELETE FROM rate_limit_hits WHERE window_start < ${cutoff.toISOString()}::timestamptz RETURNING 1
  `)
  return res.rows.length
}

/** Client-IP laut §8.5: erster Eintrag von `x-forwarded-for`, sonst `x-real-ip`. */
export function clientIp(headers: Pick<Headers, 'get'> | undefined): string | null {
  const forwarded = headers?.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const real = headers?.get('x-real-ip')?.trim()
  return real || null
}

/** Sekunden bis zum Fensterende für `Retry-After`. */
export function retryAfterSeconds(result: RateLimitResult, now: Date): number {
  return Math.max(1, Math.ceil((result.resetAt.getTime() - now.getTime()) / 1000))
}
