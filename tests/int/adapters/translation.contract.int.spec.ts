import { describe, expect, it } from 'vitest'

import { parseEnv } from '@/lib/env'
import { ConfigError } from '@/lib/errors'
import { createLogger } from '@/lib/monitoring/logger'
import {
  __setTranslationAdapterForTests,
  createTranslationAdapter,
  getTranslationAdapter,
} from '@/lib/translation'
import { createDeeplAdapter, deeplEndpoint } from '@/lib/translation/deepl'

// P1.10 – Kontrakttest Übersetzung (ARCHITEKTUR §3.6): Mock deterministisch, ohne Netzwerk; DeepL nur als Gerüst.

const env = (over: Record<string, string>) =>
  parseEnv({ ...process.env, DEEPL_API_KEY: '', ...over })

describe('Übersetzung – Mock', () => {
  it('TRANSLATION_DRIVER=mock übersetzt „Schale“ zu „[EN] Schale“', async () => {
    __setTranslationAdapterForTests(createTranslationAdapter(env({ TRANSLATION_DRIVER: 'mock' })))
    try {
      const t = getTranslationAdapter()
      expect(t.driver).toBe('mock')
      expect(await t.translate({ texts: ['Schale'], source: 'de', target: 'en' })).toEqual([
        '[EN] Schale',
      ])
    } finally {
      __setTranslationAdapterForTests(undefined)
    }
  })

  it('Reihenfolge bleibt, deterministisch, usage zählt Zeichen', async () => {
    const t = createTranslationAdapter(env({ TRANSLATION_DRIVER: 'mock' }))
    const texts = ['Becher', 'Schale mit Glasur', '']
    const a = await t.translate({ texts, source: 'de', target: 'en' })
    const b = await t.translate({ texts, source: 'de', target: 'en' })
    expect(a).toEqual(['[EN] Becher', '[EN] Schale mit Glasur', '[EN] '])
    expect(b).toEqual(a)
    expect(await t.usage()).toEqual({
      characterCount: 2 * texts.join('').length,
      characterLimit: 500_000,
    })
  })
})

describe('Übersetzung – DeepL-Gerüst', () => {
  it('ohne Schlüssel → ConfigError mit deutscher Meldung (kein Aufruf)', () => {
    expect(() =>
      createTranslationAdapter(env({ APP_ENV: 'test', TRANSLATION_DRIVER: 'deepl' })),
    ).toThrow(ConfigError)
    expect(() => createDeeplAdapter(undefined)).toThrow(/DEEPL_API_KEY fehlt/)
  })

  it('development: Warnung und Mock statt Abbruch', async () => {
    const lines: string[] = []
    const t = createTranslationAdapter(
      env({ APP_ENV: 'development', TRANSLATION_DRIVER: 'deepl' }),
      createLogger({ sink: (l) => lines.push(l) }),
    )
    expect(t.driver).toBe('mock')
    expect(lines.some((l) => l.includes('translation.fallback_to_mock'))).toBe(true)
  })

  it('Endpunkt nach Schlüssel: …:fx → API Free; mit Schlüssel noch ohne Aufruf (folgt in P5.4)', async () => {
    expect(deeplEndpoint('abc:fx')).toBe('https://api-free.deepl.com/v2/translate')
    expect(deeplEndpoint('abc')).toBe('https://api.deepl.com/v2/translate')
    const t = createTranslationAdapter(env({ TRANSLATION_DRIVER: 'deepl', DEEPL_API_KEY: 'k:fx' }))
    expect(t.driver).toBe('deepl')
    await expect(t.translate({ texts: ['Schale'], source: 'de', target: 'en' })).rejects.toThrow(
      /P5\.4/,
    )
  })
})
