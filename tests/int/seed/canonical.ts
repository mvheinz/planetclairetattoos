import type { CollectionSlug, Payload, Where } from 'payload'

import { loadSeedData } from '@/lib/seed/loader'
import { runSeed, type RunSeedOptions } from '@/lib/seed/run'
import { CANONICAL_SEED_NOW } from '@/lib/seed/time'
import { fixedClock } from '@/lib/time'

// Gemeinsamer Aufbau der P8-Seed-Tests: vollständiger Beispielbestand wie `pnpm seed:reset` mit kanonischem
// `SEED_NOW` (SEED-SPEC §2.2). Jede Int-Datei startet von der Baseline (setup/restore.ts) und baut ihn neu auf.

export const SEED_N = new Date(CANONICAL_SEED_NOW)
export const SEED_CLOCK = fixedClock('2026-10-15T08:00:30Z')
/** Zeitlimit für `beforeAll` mit vollständigem Seed (Medien-Pipeline, Beleg-PDFs). */
export const SEED_TIMEOUT = 240_000

export async function runCanonicalSeed(
  payload: Payload,
  command: RunSeedOptions['command'] = 'reset',
  extra: Partial<RunSeedOptions> = {},
) {
  const data = await loadSeedData({ now: SEED_N, requireBase: command !== 'example' })
  return runSeed(payload, {
    command,
    data,
    now: SEED_N,
    clock: SEED_CLOCK,
    appEnv: 'test',
    ...extra,
  })
}

export type SeedDoc = Record<string, unknown> & { id: number }

export async function findAll(
  payload: Payload,
  collection: CollectionSlug,
  where: Where = {},
  extra: { depth?: number; locale?: 'de' | 'en' | 'all' } = {},
): Promise<SeedDoc[]> {
  return (
    await payload.find({
      collection,
      where,
      limit: 0,
      pagination: false,
      depth: extra.depth ?? 0,
      ...(extra.locale ? { locale: extra.locale } : {}),
      overrideAccess: true,
    })
  ).docs as unknown as SeedDoc[]
}

export async function bySeedKey(
  payload: Payload,
  collection: CollectionSlug,
  key: string,
  extra: { depth?: number; locale?: 'de' | 'en' | 'all' } = {},
): Promise<SeedDoc> {
  const [doc] = await findAll(
    payload,
    collection,
    { seedKey: { equals: `${collection}:${key}` } },
    extra,
  )
  if (!doc) throw new Error(`${collection}:${key} fehlt`)
  return doc
}
