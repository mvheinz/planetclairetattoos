import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { artQaActive, assertProductionEnv, collectEnvViolations, parseEnv } from '@/lib/env'
import { QA_COCO_SIZES, parseQaCocoQuery, symbolContent } from '@/lib/qa/cocoSheet'
import { COCO_SPRITE_HREF } from '@/leash/cocoSprite'
import { parseLeashQuery } from '@/lib/qa/leashQuery'
import { QA_MICROS, qaMicro } from '@/lib/qa/microInteractions'
import { QA_JANK_MAX_MS, QA_SWITCHES_OFF, parseQaSwitches } from '@/lib/qa/switches'

import { NON_REGISTRY_PAGE_FILES } from '../../../scripts/lib/static-checks/route-registry'
import { DROPPED_VARS } from '../../../scripts/preview-export/env'

// P9.1 QA-Modus (KUNST-QA §3.1/§3.2): Parameter-Auswertung der Query-Schalter, Startregel `ART_QA` in Produktion,
// Inventar der QA-Seiten.

const prod: Record<string, string> = {
  APP_ENV: 'production',
  DATABASE_URL: 'postgres://u:p@db.example.test:5432/app',
  PAYLOAD_SECRET: 'a'.repeat(64),
  CRON_SECRET: 'b'.repeat(40),
  NEXT_PUBLIC_SITE_URL: 'https://planetclairetattoos.com',
  ADMIN_ROUTE: '/atelier-x7',
  STORAGE_DRIVER: 's3',
  S3_ENDPOINT: 'https://abc123.eu.r2.cloudflarestorage.com',
  EMAIL_DRIVER: 'smtp',
  PAYMENTS_DRIVER: 'stripe',
  TRANSLATION_DRIVER: 'deepl',
  STRIPE_SECRET_KEY: 'sk_live_TESTVALUEONLY',
  STRIPE_WEBHOOK_SECRET: 'whsec_TESTVALUEONLY',
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: 'pk_live_TESTVALUEONLY',
  SEED_PREVIEW_MODE: 'false',
}

describe('P9.1 ART_QA: Startregel', () => {
  it('P9.1 ART_QA=1 in Produktion → Start bricht ab', () => {
    expect(collectEnvViolations(parseEnv(prod)).errors).toEqual([])
    const env = parseEnv({ ...prod, ART_QA: '1' })
    expect(collectEnvViolations(env).errors).toEqual([
      'ART_QA ist in Produktion verboten (QA-Seiten, KUNST-QA §3.1).',
    ])
    expect(() => assertProductionEnv(env)).toThrow('ART_QA')
    expect(artQaActive(env)).toBe(false)
  })

  it('P9.1 artQaActive nur außerhalb von Produktion und nur mit ART_QA=1/true', () => {
    const dev = (over: Record<string, string>) =>
      parseEnv({ APP_ENV: 'development', PAYLOAD_SECRET: 'dev', ...over })
    expect(artQaActive(dev({}))).toBe(false)
    expect(artQaActive(dev({ ART_QA: '' }))).toBe(false)
    expect(artQaActive(dev({ ART_QA: '0' }))).toBe(false)
    expect(artQaActive(dev({ ART_QA: '1' }))).toBe(true)
    expect(artQaActive(dev({ ART_QA: 'true' }))).toBe(true)
    expect(artQaActive(dev({ ART_QA: '1', APP_ENV: 'test' }))).toBe(true)
  })

  it('P9.1 Vorschau-Export übernimmt ART_QA nie', () => {
    expect(DROPPED_VARS).toContain('ART_QA')
  })
})

describe('P9.1 Query-Schalter (?leash=off, ?freeze=1, ?qa-jank=30)', () => {
  it('P9.1 ohne QA-Marke wirkt kein Schalter', () => {
    expect(parseQaSwitches('?leash=off&freeze=1&qa-jank=30', false)).toEqual(QA_SWITCHES_OFF)
  })

  it('P9.1 mit QA-Marke werden die Schalter ausgewertet', () => {
    expect(parseQaSwitches('?leash=off&freeze=1&qa-jank=30', true)).toEqual({
      leashOff: true,
      freeze: true,
      jankMs: 30,
    })
    expect(parseQaSwitches('', true)).toEqual(QA_SWITCHES_OFF)
    expect(parseQaSwitches(new URLSearchParams('leash=0&freeze=true'), true)).toMatchObject({
      leashOff: true,
      freeze: true,
    })
  })

  it('P9.1 ungültige Werte schalten nichts; Last ist begrenzt', () => {
    expect(parseQaSwitches('?leash=on&freeze=0&qa-jank=abc', true)).toEqual(QA_SWITCHES_OFF)
    expect(parseQaSwitches('?freeze', true).freeze).toBe(false)
    expect(parseQaSwitches('?qa-jank=-5', true).jankMs).toBe(0)
    expect(parseQaSwitches('?qa-jank=9999', true).jankMs).toBe(QA_JANK_MAX_MS)
  })
})

describe('P9.1 QA-Seiten: Parameter und Inventar', () => {
  it('P9.1 /qa/coco: ?parts=1, ?frame=a|b|c, ?boil=0', () => {
    expect(parseQaCocoQuery({})).toEqual({ parts: false, frame: null, boil: true })
    expect(parseQaCocoQuery({ parts: '1', frame: 'b', boil: '0' })).toEqual({
      parts: true,
      frame: 'b',
      boil: false,
    })
    expect(parseQaCocoQuery({ frame: 'x' }).frame).toBeNull()
    expect(parseQaCocoQuery({ frame: ['c', 'a'] }).frame).toBe('c')
    expect(QA_COCO_SIZES.map((s) => s.w)).toEqual([24, 40, 42, 64, 72, 180, 240])
  })

  it('P9.1 /qa/coco ?parts=1: alle 22 Symbole lassen sich inline einsetzen', () => {
    const sprite = readFileSync(path.join(process.cwd(), 'public', COCO_SPRITE_HREF), 'utf8')
    const ids = [...sprite.matchAll(/<symbol id="([^"]+)"/g)].map((m) => m[1]!)
    expect(ids).toHaveLength(22)
    for (const id of ids) expect(symbolContent(sprite, id)).toMatch(/data-part="/)
    expect(symbolContent(sprite, 'coco-gibt-es-nicht')).toBeNull()
  })

  it('P9.1 /qa/leash: Preset und Stationszahl mit Rückfall', () => {
    expect(parseLeashQuery({})).toEqual({ preset: 'journey', stations: 7 })
    expect(parseLeashQuery({ preset: 'shopString', stations: '3' })).toEqual({
      preset: 'shopString',
      stations: 3,
    })
    expect(parseLeashQuery({ preset: 'nix', stations: '99' })).toEqual({
      preset: 'journey',
      stations: 20,
    })
  })

  it('P9.1 /qa/motion: MI-01 … MI-16 vollständig', () => {
    expect(QA_MICROS.map((m) => m.id)).toEqual(
      Array.from({ length: 16 }, (_, i) => `MI-${String(i + 1).padStart(2, '0')}`),
    )
    expect(qaMicro('MI-05')?.viewport).toBe(true)
    expect(qaMicro('MI-99')).toBeNull()
  })

  it('P9.1 QA-Seiten stehen als Ausnahme neben der Routen-Registry (nicht in Registry/Sitemap)', () => {
    for (const p of ['coco', 'art', 'motion', 'leash', 'error'])
      expect(NON_REGISTRY_PAGE_FILES).toContain(`src/app/(frontend)/[locale]/qa/${p}/page.tsx`)
  })
})
