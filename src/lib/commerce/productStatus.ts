import 'server-only'

import type { Payload } from 'payload'
import { z } from 'zod'

import { ipHash } from '@/lib/security/ipHash'
import { clientIp, hit, retryAfterSeconds } from '@/lib/security/rateLimit'

import { productStates, reservedByYou } from './cart'
import { CHECKOUT_COOKIE } from './checkout'

// `GET /api/public/product-status?ids=1,2` (ARCHITEKTUR §2.5, §8.5, §9.3; PLAN P3.11): höchstens 24 IDs (zod), Antwort
// je ID nur `available | reserved | sold | gone` als JSON-Objekt `{ "12": "available" }`, dazu seit P4.7 das Feld
// `reservedByYou` (`{ "12": true }`): serverseitiger Abgleich mit der laufenden Kasse aus dem Cookie `pc_checkout` (ohne
// dieses Cookie immer `false`). Rate-Limit `product_status` (120/min je IP-Hash) → 429 mit `Retry-After`. Immer
// `Cache-Control: no-store`; setzt kein Cookie, keine Personendaten.

/** Höchstzahl IDs je Abfrage (eine Shop-Seite hat 24 Stücke). */
export const STATUS_MAX_IDS = 24

const MAX_ID = 2_147_483_647

export const StatusQuery = z
  .string()
  .regex(/^\d{1,10}(,\d{1,10})*$/)
  .transform((s) => [...new Set(s.split(',').map(Number))])
  .pipe(z.array(z.number().int().min(1).max(MAX_ID)).min(1).max(STATUS_MAX_IDS))

const NO_STORE = { 'cache-control': 'no-store' } as const

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE, ...headers } })
}

/** IDs aus der Abfrage oder `null` bei ungültiger Eingabe. */
export function parseStatusIds(search: URLSearchParams): number[] | null {
  const parsed = StatusQuery.safeParse(search.get('ids') ?? '')
  return parsed.success ? parsed.data : null
}

export async function handleProductStatus(
  request: Request,
  payload: Payload,
  now: Date,
): Promise<Response> {
  const ip = clientIp(request.headers) ?? 'unknown'
  const limit = await hit('product_status', ipHash(ip, { now: () => now }), now, payload)
  if (!limit.allowed) {
    return json({ error: 'rate_limited' }, 429, {
      'retry-after': String(retryAfterSeconds(limit, now)),
    })
  }
  const ids = parseStatusIds(new URL(request.url).searchParams)
  if (!ids) return json({ error: 'invalid' }, 400)
  const token = checkoutTokenFrom(request.headers.get('cookie'))
  const [states, mine] = await Promise.all([
    productStates(payload, ids),
    reservedByYou(payload, ids, token, now),
  ])
  return json({ ...states, reservedByYou: mine })
}

/** Wert von `pc_checkout` aus dem `Cookie`-Header (oder `null`). */
export function checkoutTokenFrom(cookieHeader: string | null): string | null {
  for (const part of (cookieHeader ?? '').split(';')) {
    const eq = part.indexOf('=')
    if (eq > 0 && part.slice(0, eq).trim() === CHECKOUT_COOKIE)
      return part.slice(eq + 1).trim() || null
  }
  return null
}
