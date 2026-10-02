import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { parseEnv } from '@/lib/env'
import { ConfigError } from '@/lib/errors'
import { createLogger } from '@/lib/monitoring/logger'
import {
  __setTranslationAdapterForTests,
  createTranslationAdapter,
  getTranslationAdapter,
  TRANSLATION_NOT_CONFIGURED,
  translationAvailability,
} from '@/lib/translation'
import {
  createDeeplAdapter,
  DEEPL_MAX_TEXTS_PER_REQUEST,
  deeplEndpoint,
} from '@/lib/translation/deepl'

// P1.10/P5.4 – Kontrakttest Übersetzung (ARCHITEKTUR §3.6): Mock deterministisch, DeepL gegen HTTP-Stub; ohne Netzwerk.

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
      expect(await t.translate({ texts: ['Schale mit Hund'], source: 'de', target: 'en' })).toEqual(
        ['[EN] Schale mit Hund'],
      )
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

describe('Übersetzung – DeepL-Konfiguration', () => {
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

  it('Endpunkt nach Schlüssel: …:fx → API Free, sonst Pro', () => {
    expect(deeplEndpoint('abc:fx')).toBe('https://api-free.deepl.com/v2/translate')
    expect(deeplEndpoint('abc')).toBe('https://api.deepl.com/v2/translate')
    const t = createTranslationAdapter(env({ TRANSLATION_DRIVER: 'deepl', DEEPL_API_KEY: 'k:fx' }))
    expect(t.driver).toBe('deepl')
  })
})

// P5.4 – DeepL-Treiber gegen einen HTTP-Stub auf 127.0.0.1 (der Netzwerk-Wächter blockiert alles andere).
describe('Übersetzung – DeepL gegen HTTP-Stub', () => {
  type Seen = { method: string; url: string; auth?: string; body: Record<string, unknown> | null }
  let server: Server
  let base: string
  const seen: Seen[] = []
  let status = 200

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = ''
      req.on('data', (c) => (raw += c))
      req.on('end', () => {
        const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : null
        seen.push({ method: req.method!, url: req.url!, auth: req.headers.authorization, body })
        res.setHeader('content-type', 'application/json')
        if (status !== 200) {
          res.statusCode = status
          return res.end('{"message":"stub"}')
        }
        if (req.url === '/v2/usage') {
          return res.end(JSON.stringify({ character_count: 1234, character_limit: 500000 }))
        }
        const texts = (body?.text ?? []) as string[]
        res.end(
          JSON.stringify({
            translations: texts.map((t) => ({ detected_source_language: 'DE', text: `EN:${t}` })),
          }),
        )
      })
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterAll(() => new Promise<void>((r) => server.close(() => r())))

  it('übersetzt mit EN-GB, preserve_formatting, Auth-Header; Reihenfolge bleibt, leere Texte ohne Anfrage', async () => {
    seen.length = 0
    const t = createDeeplAdapter('k:fx', { baseUrl: base })
    expect(
      await t.translate({ texts: ['Schale mit Hund', '', 'Becher'], source: 'de', target: 'en' }),
    ).toEqual(['EN:Schale mit Hund', '', 'EN:Becher'])
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({
      method: 'POST',
      url: '/v2/translate',
      auth: 'DeepL-Auth-Key k:fx',
      body: {
        text: ['Schale mit Hund', 'Becher'],
        source_lang: 'DE',
        target_lang: 'EN-GB',
        preserve_formatting: true,
      },
    })
    expect(await t.translate({ texts: ['', ' '], source: 'de', target: 'en' })).toEqual(['', ''])
    expect(seen).toHaveLength(1)
  })

  it(`höchstens ${DEEPL_MAX_TEXTS_PER_REQUEST} Texte je Anfrage`, async () => {
    seen.length = 0
    const t = createDeeplAdapter('k', { baseUrl: base })
    const texts = Array.from({ length: 120 }, (_, i) => `Text ${i}`)
    const out = await t.translate({ texts, source: 'de', target: 'en' })
    expect(out).toEqual(texts.map((x) => `EN:${x}`))
    expect(seen.map((s) => (s.body?.text as string[]).length)).toEqual([50, 50, 20])
  })

  it('usage liest Kontingent; Fehler 456 → deutsche Meldung', async () => {
    const t = createDeeplAdapter('k:fx', { baseUrl: base })
    expect(await t.usage()).toEqual({ characterCount: 1234, characterLimit: 500000 })
    status = 456
    try {
      await expect(t.translate({ texts: ['Schale'], source: 'de', target: 'en' })).rejects.toThrow(
        /Kontingent/,
      )
    } finally {
      status = 200
    }
  })

  it('ohne Stub-Adresse würde DeepL erreicht – der Netzwerk-Wächter blockiert das', async () => {
    const t = createDeeplAdapter('k:fx')
    await expect(t.translate({ texts: ['Schale'], source: 'de', target: 'en' })).rejects.toThrow()
  })
})

describe('Übersetzen-Knopf in Produktion (ARCHITEKTUR §3.6)', () => {
  it('APP_ENV=production mit mock → deaktiviert mit Hinweis; mit DeepL-Schlüssel aktiv', () => {
    expect(
      translationAvailability(env({ APP_ENV: 'production', TRANSLATION_DRIVER: 'mock' })),
    ).toEqual({ enabled: false, driver: 'mock', reason: TRANSLATION_NOT_CONFIGURED })
    expect(TRANSLATION_NOT_CONFIGURED).toBe('Übersetzen ist noch nicht eingerichtet')
    expect(
      translationAvailability(
        env({ APP_ENV: 'production', TRANSLATION_DRIVER: 'deepl', DEEPL_API_KEY: 'k:fx' }),
      ).enabled,
    ).toBe(true)
    expect(
      translationAvailability(env({ APP_ENV: 'test', TRANSLATION_DRIVER: 'mock' })).enabled,
    ).toBe(true)
  })
})
