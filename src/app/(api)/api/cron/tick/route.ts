import { handleTick } from '@/lib/jobs/tick'

// Job-Wecker (ARCHITEKTUR §9.6): Vercel Cron ruft jede Minute auf; ohne Fälliges 204 ohne Datenbank.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET(request: Request): Promise<Response> {
  return handleTick(request)
}
