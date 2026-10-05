import { describe, expect, it } from 'vitest'

import { allowedOrigins, originListsApply } from '../../../src/lib/security/origins'

// P10.13 – Origins für Payloads `cors`/`csrf` (ARCHITEKTUR §8.2, C-26).

const base = {
  NEXT_PUBLIC_SITE_URL: 'https://planetclairetattoos.com',
  VERCEL_PROJECT_PRODUCTION_URL: 'planetclaire.vercel.app',
}

describe('allowedOrigins', () => {
  it('Produktion: Apex + Vercel-Produktions-Domain', () => {
    expect(allowedOrigins({ ...base, APP_ENV: 'production' })).toEqual([
      'https://planetclairetattoos.com',
      'https://planetclaire.vercel.app',
    ])
  })

  it('außerhalb von Produktion nur die kanonische Adresse', () => {
    for (const APP_ENV of ['staging', 'preview', 'development', 'test'] as const) {
      expect(allowedOrigins({ ...base, APP_ENV })).toEqual(['https://planetclairetattoos.com'])
    }
  })

  it('ohne Vercel-Variable nur der Apex; Wert mit Schema und Pfad wird zum Origin; keine Doppelten', () => {
    expect(
      allowedOrigins({ ...base, APP_ENV: 'production', VERCEL_PROJECT_PRODUCTION_URL: undefined }),
    ).toEqual(['https://planetclairetattoos.com'])
    expect(
      allowedOrigins({
        ...base,
        APP_ENV: 'production',
        VERCEL_PROJECT_PRODUCTION_URL: 'https://planetclairetattoos.com/x',
      }),
    ).toEqual(['https://planetclairetattoos.com'])
  })

  it('Listen gelten nur in production/staging/preview', () => {
    expect(
      (['production', 'staging', 'preview'] as const).every((APP_ENV) =>
        originListsApply({ APP_ENV }),
      ),
    ).toBe(true)
    expect(
      (['development', 'test'] as const).some((APP_ENV) => originListsApply({ APP_ENV })),
    ).toBe(false)
  })
})
