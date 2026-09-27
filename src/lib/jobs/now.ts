import 'server-only'

import type { PayloadRequest } from 'payload'

import { getAppContext } from '@/lib/payload/context'
import { systemClock } from '@/lib/time'

/** Zeit eines Job-Laufs: injiziert über `req.context.now` (jobs:run --now, Tests), sonst Systemuhr (A-08). */
export function jobNow(req: Pick<PayloadRequest, 'context'> | undefined): Date {
  const iso = getAppContext(req as PayloadRequest).now
  if (iso) {
    const d = new Date(iso)
    if (!Number.isNaN(d.getTime())) return d
  }
  return systemClock.now()
}
