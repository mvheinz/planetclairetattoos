import config from '@payload-config'
import { getPayload } from 'payload'

import { getEnv } from '@/lib/env'
import { handleClientError } from '@/lib/monitoring/clientErrors'

// Browserfehler (ARCHITEKTUR §2.5, M-02): standardmäßig aus (404 ohne Verarbeitung), siehe `clientErrors.ts`.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function POST(request: Request): Promise<Response> {
  return handleClientError(request, {
    env: getEnv(),
    payload: () => getPayload({ config }),
    now: new Date(),
  })
}
