import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { HEADER_LINE_PATHS, handLinePath } from '@/art/handLine'
import { previewBannerState } from '@/components/layout/PreviewBanner'
import { parseEnv } from '@/lib/env'
import { matchSegments } from '@/lib/routes/paths'
import { MOTION_SCRIPT, MOTION_SCRIPT_HASH, scriptHash } from '@/lib/security/inlineScripts'
import { variantOf } from '@/lib/stringHash'

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

const ROOT = path.resolve(import.meta.dirname, '../../..')

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

  it('P2.20 Schriften-Tor: data-fonts=wait bis 2 Frames nach dem ersten Bild; kein Tor bei Aufruf von derselben Website', () => {
    const run = (
      referrer: string,
      withRaf = true,
      fonts?: { load: (font: string) => Promise<unknown> },
    ) => {
      const attrs: Record<string, string> = {}
      const frames: (() => void)[] = []
      const timers: { fn: () => void; ms: number }[] = []
      const window = {
        localStorage: { getItem: () => null },
        location: { origin: 'https://planetclairetattoos.com' },
        setTimeout: (fn: () => void, ms: number) => timers.push({ fn, ms }),
        ...(withRaf ? { requestAnimationFrame: (fn: () => void) => frames.push(fn) } : {}),
      }
      const document = {
        referrer,
        ...(fonts ? { fonts } : {}),
        documentElement: {
          setAttribute: (k: string, v: string) => (attrs[k] = v),
          removeAttribute: (k: string) => delete attrs[k],
        },
      }
      new Function('window', 'document', MOTION_SCRIPT)(window, document)
      const frame = () => frames.shift()?.()
      const timer = (ms: number) => {
        const i = timers.findIndex((t) => t.ms === ms)
        if (i >= 0) timers.splice(i, 1)[0]!.fn()
      }
      return { attrs, frame, timer, timers }
    }
    const cold = run('')
    expect(cold.attrs).toEqual({ 'data-fonts': 'wait' })
    cold.frame()
    expect(cold.attrs).toEqual({ 'data-fonts': 'wait' })
    cold.frame()
    expect(cold.attrs).toEqual({ 'data-fonts': 'wait' })
    cold.timer(0)
    expect(cold.attrs).toEqual({})
    cold.timer(2000)
    expect(cold.attrs).toEqual({})
    // Sicherung: ohne Frames (z. B. Tab im Hintergrund) spätestens nach 2 s.
    const hidden = run('https://www.instagram.com/')
    expect(hidden.attrs).toEqual({ 'data-fonts': 'wait' })
    hidden.timer(2000)
    expect(hidden.attrs).toEqual({})
    expect(run('https://planetclairetattoos.com/de/shop').attrs).toEqual({})
    expect(run('https://planetclairetattoos.com').attrs).toEqual({})
    expect(run('https://planetclairetattoos.com.evil.example/').attrs).toEqual({
      'data-fonts': 'wait',
    })
    expect(run('', false).attrs).toEqual({})
  })

  it('P2.20 Schriften-Tor: fordert die drei Schriften nach 2 Frames an und öffnet erst, wenn alle da sind (ein Tausch)', async () => {
    const run = (fail = false) => {
      const attrs: Record<string, string> = {}
      const frames: (() => void)[] = []
      const timers: { fn: () => void; ms: number }[] = []
      const requested: string[] = []
      const pending: { resolve: () => void; reject: () => void }[] = []
      const fonts = {
        load: (font: string) => {
          requested.push(font)
          return new Promise<void>((resolve, reject) => pending.push({ resolve, reject }))
        },
      }
      const window = {
        localStorage: { getItem: () => null },
        location: { origin: 'https://planetclairetattoos.com' },
        setTimeout: (fn: () => void, ms: number) => timers.push({ fn, ms }),
        requestAnimationFrame: (fn: () => void) => frames.push(fn),
      }
      const document = {
        referrer: '',
        fonts,
        documentElement: {
          setAttribute: (k: string, v: string) => (attrs[k] = v),
          removeAttribute: (k: string) => delete attrs[k],
        },
      }
      new Function('window', 'document', MOTION_SCRIPT)(window, document)
      const timer = (ms: number) => {
        const i = timers.findIndex((t) => t.ms === ms)
        if (i >= 0) timers.splice(i, 1)[0]!.fn()
      }
      frames.shift()?.()
      frames.shift()?.()
      expect(requested).toEqual([])
      timer(0)
      return { attrs, requested, pending, timer, fail }
    }
    const flush = () => new Promise((r) => setTimeout(r, 0))

    const ok = run()
    // Familiennamen wie in src/styles/fonts.ts (next/font: Name der Konstante = font-family).
    const fontsTs = readFileSync(path.join(ROOT, 'src/styles/fonts.ts'), 'utf8')
    const families = [...fontsTs.matchAll(/export const (\w+) = localFont\(/g)].map((m) =>
      m[1] === 'spectralItalic' ? `italic 1em ${m[1]}` : `1em ${m[1]}`,
    )
    expect(ok.requested).toEqual(families)
    expect(ok.attrs).toEqual({ 'data-fonts': 'wait' })
    ok.pending[0]!.resolve()
    ok.pending[1]!.resolve()
    await flush()
    expect(ok.attrs).toEqual({ 'data-fonts': 'wait' })
    ok.pending[2]!.resolve()
    ok.pending[3]!.resolve()
    await flush()
    expect(ok.attrs).toEqual({})

    // Fehler beim Laden: Tor öffnet trotzdem (Ersatzschriften bleiben, `font-display: swap`).
    const failed = run()
    failed.pending[1]!.reject()
    await flush()
    expect(failed.attrs).toEqual({})

    // Schriften hängen: spätestens nach 2 s offen.
    const slow = run()
    slow.timer(2000)
    expect(slow.attrs).toEqual({})
  })

  it('P2.20 Schriften: kein Preload, Tor-Regel nutzt die Ersatzschriften von next/font', () => {
    const fonts = readFileSync(path.join(ROOT, 'src/styles/fonts.ts'), 'utf8')
    expect(fonts).not.toMatch(/preload:\s*true/)
    const names = [...fonts.matchAll(/export const (\w+) = localFont\(/g)].map((m) => m[1])
    expect(names).toEqual(['spectral', 'spectralItalic', 'bricolage', 'plexMono'])
    const css = readFileSync(path.join(ROOT, 'src/styles/global.css'), 'utf8')
    const gate = /:root\[data-fonts='wait'\]\s*\{([^}]*)\}/.exec(css)?.[1] ?? ''
    const flat = gate.replace(/\s+/g, ' ')
    expect(flat).toContain("--font-display: 'spectral Fallback'")
    expect(flat).toContain("--font-accent: 'spectralItalic Fallback'")
    expect(flat).toContain("--font-body: 'bricolage Fallback'")
    expect(flat).toContain("--font-mono: 'plexMono Fallback'")
  })

  it('P2.20 Schriften: Metrik-Ersatzschriften greifen auch ohne Arial (Liberation Sans/Arimo), TBT §7.7', () => {
    const fonts = readFileSync(path.join(ROOT, 'src/styles/fonts.ts'), 'utf8')
    const css = readFileSync(path.join(ROOT, 'src/styles/global.css'), 'utf8')
    const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) =>
      m[1]!.replace(/\s+/g, ' '),
    )
    for (const name of ['spectral', 'spectralItalic', 'bricolage', 'plexMono']) {
      const block =
        new RegExp(`export const ${name} = localFont\\(\\{([\\s\\S]*?)\\n\\}\\)`).exec(
          fonts,
        )?.[1] ?? ''
      // next/font erzeugt keine eigene Fläche mehr; der Stapel beginnt mit der Fläche aus global.css.
      expect(block).toMatch(/adjustFontFallback:\s*false/)
      expect(block).toMatch(new RegExp(`fallback:\\s*\\[\\s*'${name} Fallback',`))
      const face = faces.find((f) => f.includes(`font-family: '${name} Fallback'`)) ?? ''
      const serif = name.startsWith('spectral')
      expect(face).toMatch(
        serif
          ? /src: local\('Times New Roman[^)]*'\).*local\('Liberation Serif[^)]*'\).*local\('Tinos[^)]*'\)/
          : /src: local\('Arial'\).*local\('Liberation Sans'\).*local\('Arimo'\)/,
      )
      expect(face).toMatch(/size-adjust: \d+(\.\d+)?%/)
      expect(face).toMatch(/ascent-override: \d+(\.\d+)?%/)
    }
  })
})
