import { describe, expect, it } from 'vitest'

import { BUILD_PLACEHOLDER_SECRET, parseEnv, withBuildPlaceholders } from '../../../src/lib/env'

// P10.12 – Docker-Build ohne Zugangsdaten (AK-A-13-01, Spike B-08): nur in der Build-Phase mit BUILD_WITHOUT_DB.

describe('withBuildPlaceholders (AK-A-13-01)', () => {
  const build = { NEXT_PHASE: 'phase-production-build', BUILD_WITHOUT_DB: '1' }

  it('ergänzt in der Build-Phase ohne DB ein Platzhalter-Geheimnis; parseEnv gelingt', () => {
    const src = withBuildPlaceholders(build)
    expect(src.PAYLOAD_SECRET).toBe(BUILD_PLACEHOLDER_SECRET)
    expect(() => parseEnv(src)).not.toThrow()
  })

  it('überschreibt ein vorhandenes Geheimnis nie', () => {
    expect(withBuildPlaceholders({ ...build, PAYLOAD_SECRET: 'echt' }).PAYLOAD_SECRET).toBe('echt')
  })

  it('wirkt weder zur Laufzeit noch ohne BUILD_WITHOUT_DB', () => {
    expect(withBuildPlaceholders({ BUILD_WITHOUT_DB: '1' }).PAYLOAD_SECRET).toBeUndefined()
    expect(
      withBuildPlaceholders({ NEXT_PHASE: 'phase-production-build' }).PAYLOAD_SECRET,
    ).toBeUndefined()
    expect(() => parseEnv({ BUILD_WITHOUT_DB: '1' })).toThrow()
  })
})
