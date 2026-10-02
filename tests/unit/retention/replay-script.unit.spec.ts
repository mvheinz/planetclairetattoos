import { describe, expect, it } from 'vitest'

import { parseReplayArgs, replayBlockedReason } from '../../../scripts/retention-replay'

// P6.15 – `pnpm retention:replay` (ARCHITEKTUR §4.8, §6.10): in Produktion nur mit `--yes-production`.

describe('retention:replay – Argumente und Produktionsschutz', () => {
  it('liest --now und --yes-production, lehnt Unbekanntes ab', () => {
    expect(parseReplayArgs([])).toEqual({ now: undefined, yesProduction: false })
    expect(parseReplayArgs(['--now=2033-02-01T10:00:00Z', '--yes-production'])).toEqual({
      now: new Date('2033-02-01T10:00:00Z'),
      yesProduction: true,
    })
    expect(() => parseReplayArgs(['--now=morgen'])).toThrow(/gültiges Datum/)
    expect(() => parseReplayArgs(['--force'])).toThrow(/Unbekannte Option/)
  })

  it('Produktion (APP_ENV oder Markierung) nur mit --yes-production', () => {
    const base = { databaseName: 'planetclaire', isProductionMarked: false, yesProduction: false }
    expect(replayBlockedReason({ ...base, appEnv: 'development' })).toBeNull()
    expect(replayBlockedReason({ ...base, appEnv: 'production' })).toMatch(/--yes-production/)
    expect(
      replayBlockedReason({ ...base, appEnv: 'development', isProductionMarked: true }),
    ).toMatch(/als Produktion markiert/)
    expect(
      replayBlockedReason({
        ...base,
        appEnv: 'production',
        isProductionMarked: true,
        yesProduction: true,
      }),
    ).toBeNull()
  })
})
