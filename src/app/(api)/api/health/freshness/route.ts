import { getEnv } from '@/lib/env'
import { cachedFreshness, freshnessStatus } from '@/lib/monitoring/freshness'
import { systemClock } from '@/lib/time'

// Frische-Prüfung (ARCHITEKTUR §2.5, §11.3): ohne Datenbank, öffentlich, nur `jobs`/`backup` = ok|late|off.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(): Promise<Response> {
  const body = await cachedFreshness(getEnv(), systemClock.now())
  return Response.json(body, {
    status: freshnessStatus(body),
    headers: { 'cache-control': 'no-store' },
  })
}
