import { describe, expect, it } from 'vitest'

import { HEADER_LINE_PATHS, handLinePath } from '@/art/handLine'
import { previewBannerState } from '@/components/layout/PreviewBanner'
import { parseEnv } from '@/lib/env'
import { matchSegments } from '@/lib/routes/paths'
import { MOTION_SCRIPT, MOTION_SCRIPT_HASH, scriptHash } from '@/lib/security/inlineScripts'
import { variantOf } from '@/lib/stringHash'
import { createHash } from 'node:crypto'

// P2.8 Seitenrahmen: reine Helfer (Preset aus Layout-Segmenten, Kopflinie, Vorschau-Banner, Inline-Skript pc-motion).

const baseEnv = {
  APP_ENV: 'development',
  DATABASE_URL: 'postgres://u:p@127.0.0.1:5432/x',
  PAYLOAD_SECRET: 'x'.repeat(40),
  NEXT_PUBLIC_SITE_URL: 'http://localhost:3000',
}

describe('Layout-Segmente → Registry-Route (body data-preset)', () => {
  it.each([
    [[], 'R01', 'journey'],
    [['legal-notice'], 'R21', 'legal'],
    [['withdraw-from-contract'], 'R26', 'calm'],
    [['contact'], 'R20', 'margin'],
    [['shop'], 'R02', 'shopString'],
    [['shop', 'category', 'keramik'], 'R03', 'shopString'],
    [['shop', '991-blumenvase'], 'R04', 'product'],
    [['thank-you', 'abc123'], 'R08', 'thanks'],
    [['tattoo', 'faq'], 'R18', 'stencil'],
  ] as const)('%j → %s (%s)', (segments, id, preset) => {
    const match = matchSegments(segments)
    expect(match?.route.id).toBe(id)
    expect(match?.route.preset).toBe(preset)
  })

  it('unbekannte Segmente (404) ergeben keine Route', () => {
    expect(matchSegments(['gibt-es-nicht'])).toBeNull()
    expect(matchSegments(['impressum'])).toBeNull() // DE-Pfad ist kein Ordner
  })
})

describe('KO-02 Kopflinie', () => {
  it('drei deterministische Varianten, 2400 px lang, Wahl per Routen-Seed', () => {
    expect(HEADER_LINE_PATHS).toHaveLength(3)
    expect(new Set(HEADER_LINE_PATHS).size).toBe(3)
    expect(handLinePath(11)).toBe(HEADER_LINE_PATHS[0])
    for (const d of HEADER_LINE_PATHS) {
      expect(d.startsWith('M0 ')).toBe(true)
      expect(d.endsWith(` ${d.split(' ').at(-1)}`)).toBe(true)
      const lastX = Number(/Q[\d.]+ [\d.]+ ([\d.]+) [\d.]+$/.exec(d)?.[1])
      expect(lastX).toBe(2400)
      for (const m of d.matchAll(/ ([\d.]+)(?=Q|$)/g)) expect(Number(m[1])).toBeLessThan(8)
    }
    const variants = new Set(['R01', 'R02', 'R11', 'R20', 'R21', 'R26'].map((r) => variantOf(r, 3)))
    expect(variants.size).toBeGreaterThan(1)
  })
})

describe('Vorschau-Banner (KONZEPT §3.0.4, R-002)', () => {
  it('nur bei SEED_PREVIEW_MODE=true und APP_ENV≠production', () => {
    expect(previewBannerState(parseEnv({ ...baseEnv, SEED_PREVIEW_MODE: 'true' })).show).toBe(true)
    expect(previewBannerState(parseEnv({ ...baseEnv, SEED_PREVIEW_MODE: 'false' })).show).toBe(
      false,
    )
    expect(previewBannerState(parseEnv({ ...baseEnv })).show).toBe(false)
    expect(
      previewBannerState(parseEnv({ ...baseEnv, APP_ENV: 'staging', SEED_PREVIEW_MODE: 'true' }))
        .show,
    ).toBe(true)
  })

  it('im Export zusätzlich die Phase', () => {
    const state = previewBannerState(
      parseEnv({
        ...baseEnv,
        APP_ENV: 'preview',
        SEED_PREVIEW_MODE: 'true',
        PREVIEW_EXPORT: 'true',
        PREVIEW_PHASE: 'P2',
      }),
    )
    expect(state).toEqual({ show: true, phase: 'P2' })
    expect(
      previewBannerState(parseEnv({ ...baseEnv, SEED_PREVIEW_MODE: 'true', PREVIEW_PHASE: 'P2' }))
        .phase,
    ).toBeNull()
  })
})

describe('Inline-Skript pc-motion (DESIGN §11.7, ARCHITEKTUR §8.1)', () => {
  it('Hash passt zum Skripttext', () => {
    const expected = `'sha256-${createHash('sha256').update(MOTION_SCRIPT).digest('base64')}'`
    expect(MOTION_SCRIPT_HASH).toBe(expected)
    expect(scriptHash(MOTION_SCRIPT)).toBe(expected)
  })

  it('liest nur pc-motion, schreibt nichts, setzt data-motion nur für reduced/full', () => {
    expect(MOTION_SCRIPT).toContain("getItem('pc-motion')")
    expect(MOTION_SCRIPT).not.toMatch(/setItem|removeItem|cookie|sessionStorage/)
    const attrs: Record<string, string> = {}
    const run = (stored: string | null, throws = false) => {
      for (const k of Object.keys(attrs)) delete attrs[k]
      const window = {
        get localStorage() {
          if (throws) throw new Error('gesperrt')
          return { getItem: (k: string) => (k === 'pc-motion' ? stored : null) }
        },
      }
      const document = {
        documentElement: { setAttribute: (k: string, v: string) => (attrs[k] = v) },
      }
      new Function('window', 'document', MOTION_SCRIPT)(window, document)
      return { ...attrs }
    }
    expect(run(null)).toEqual({})
    expect(run('reduced')).toEqual({ 'data-motion': 'reduced' })
    expect(run('full')).toEqual({ 'data-motion': 'full' })
    expect(run('<script>')).toEqual({})
    expect(run('reduced', true)).toEqual({})
  })
})
