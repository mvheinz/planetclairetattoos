import { getPayload, type Payload } from 'payload'
import { vi } from 'vitest'

import config from '@payload-config'
import { fixedClock, type Clock } from '@/lib/time'

// Payload gegen die Test-DB (Local API) – DATABASE_URL zeigt per tests/int/setup/env.ts auf DATABASE_URL_TEST.
let payload: Promise<Payload> | undefined
export function getTestPayload(): Promise<Payload> {
  payload ??= getPayload({ config })
  return payload
}

/** Feste Uhr für einen Test: injizierbare Clock plus vi.setSystemTime (ARCHITEKTUR §7.2). */
export async function withClock<T>(iso: string, fn: (clock: Clock) => Promise<T>): Promise<T> {
  const clock = fixedClock(iso)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(clock.now())
  try {
    return await fn(clock)
  } finally {
    vi.useRealTimers()
  }
}
