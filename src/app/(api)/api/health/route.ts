import { getEnv } from '@/lib/env'

import pkg from '../../../../../package.json'

// Lebenszeichen (ARCHITEKTUR §2.5, AK-A-2-01): ohne Datenbank, ohne Payload – nur Umgebung und Version.
// `?deep=1` (DB- und Speicher-Ping) folgt mit dem Monitoring (P10).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function healthBody(): { status: 'ok'; version: string; appEnv: string } {
  const env = getEnv()
  const sha = env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)
  return { status: 'ok', version: sha ? `${pkg.version}+${sha}` : pkg.version, appEnv: env.APP_ENV }
}

export function GET(): Response {
  return Response.json(healthBody(), { headers: { 'cache-control': 'no-store' } })
}
