import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { ROOT, keyframeBlocks } from '../../helpers/designLint'

// U-11 / DESIGN §3.5: Seitengrund Olivgrün → Petrol. Statische Grundfassung auf `html`, Scroll-Verbesserung nur mit
// `animation-timeline` und ohne Bewegungsreduktion, animiert wird nur `opacity` (eigene Ebene, ohne Layout/Repaint).
const css = readFileSync(path.join(ROOT, 'src/styles/global.css'), 'utf8')
const flat = css.replace(/\s+/g, ' ')

describe('U-11 Seitengrund-Verlauf', () => {
  it('statische Grundfassung: html trägt den Verlauf Papier → Papier-Ende, body ist transparent', () => {
    expect(flat).toMatch(
      /html \{ min-height: 100%; background-color: var\(--paper\); background-image: linear-gradient\(180deg, var\(--paper\) 0%, var\(--paper-deep\) 100%\)/,
    )
    const body = /\nbody \{([^}]*)\}/.exec(css)?.[1] ?? ''
    expect(body).toMatch(/background-color:\s*transparent/)
  })

  it('Scroll-Verbesserung nur unter no-preference, @supports und ohne data-motion=reduced', () => {
    const start = flat.indexOf('@media (prefers-reduced-motion: no-preference) { @supports')
    expect(start).toBeGreaterThan(-1)
    const block = flat.slice(start, start + 700)
    expect(block).toContain('@supports (animation-timeline: scroll())')
    expect(block).toContain("html:not([data-motion='reduced'])::before")
    expect(block).toContain('animation-timeline: scroll(root block)')
    expect(block).toContain('position: fixed')
  })

  it('pc-sky animiert ausschließlich opacity (kein Layout, kein Repaint)', () => {
    const sky = keyframeBlocks(css).find((k) => k.name === 'pc-sky')
    expect(sky).toBeDefined()
    const props = [...sky!.body.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1])
    expect(new Set(props)).toEqual(new Set(['opacity']))
  })

  it('Verlauf liegt nicht in der Leine-Engine', () => {
    for (const f of readdirSync(path.join(ROOT, 'src/leash')).filter((n) => n.endsWith('.ts'))) {
      const src = readFileSync(path.join(ROOT, 'src/leash', f), 'utf8')
      expect(src, f).not.toMatch(/paper-deep|pc-sky|animation-timeline/)
    }
  })
})
