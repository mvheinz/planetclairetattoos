import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { __setCarrierAdapterForTests } from '@/lib/carrier'
import { __setEmailAdapterForTests } from '@/lib/email'
import { __setPaymentsAdapterForTests } from '@/lib/payments'
import { loadSeedData } from '@/lib/seed/loader'
import { runSeed } from '@/lib/seed/run'
import { CANONICAL_SEED_NOW } from '@/lib/seed/time'
import { fixedClock } from '@/lib/time'
import { __setTranslationAdapterForTests } from '@/lib/translation'

import { getTestPayload } from '../helpers/payload'

// P1.28: Während des Seeds entstehen keine Mails, keine Jobs und keine Aufrufe an Stripe, DeepL oder den
// Versand-Adapter (SEED-SPEC §1.6, AK-SEED-05). Jeder Adapter wird durch einen Spion ersetzt, der jeden Aufruf zählt.

let payload: Payload
const calls: string[] = []

function spyAdapter<T>(name: string, driver: string): T {
  return new Proxy({ driver } as Record<string | symbol, unknown>, {
    get(target, prop) {
      if (prop === 'driver' || prop === 'mode') return driver
      if (prop === 'then' || typeof prop === 'symbol') return undefined
      return (..._args: unknown[]) => {
        calls.push(`${name}.${String(prop)}`)
        return Promise.resolve(undefined)
      }
    },
  }) as T
}

async function counts() {
  const jobs = await payload.count({ collection: 'payload-jobs', overrideAccess: true })
  const mails = await payload.count({ collection: 'email-log', overrideAccess: true })
  return { jobs: jobs.totalDocs, mails: mails.totalDocs }
}

beforeAll(async () => {
  payload = await getTestPayload()
  __setPaymentsAdapterForTests(spyAdapter('payments', 'mock'))
  __setTranslationAdapterForTests(spyAdapter('translation', 'mock'))
  __setEmailAdapterForTests(spyAdapter('email', 'memory'))
  __setCarrierAdapterForTests(spyAdapter('carrier', 'manual'))
})

afterAll(async () => {
  __setPaymentsAdapterForTests()
  __setTranslationAdapterForTests()
  __setEmailAdapterForTests()
  __setCarrierAdapterForTests()
})

describe('Seed ohne Nebenwirkungen (AK-SEED-05)', () => {
  it('AK-SEED-05: seed (Grund-Seed + Beispielbestand) und seed:remove – 0 Mails, 0 Jobs, 0 Adapter-Aufrufe', async () => {
    const now = new Date(CANONICAL_SEED_NOW)
    const clock = fixedClock('2026-10-15T08:00:30Z')
    const data = await loadSeedData({ now })
    const before = await counts()
    await runSeed(payload, {
      command: 'all',
      data,
      now,
      clock,
      appEnv: 'test',
    })
    await runSeed(payload, { command: 'remove', yes: true, data, now, clock, appEnv: 'test' })
    expect(await counts()).toEqual(before)
    expect(calls).toEqual([])
  }, 180_000)
})
