import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { QA_MICROS } from '../../../src/lib/qa/microInteractions'

// P9.16: Dauer-/Easing-Tabelle gegen DESIGN §11.2/§11.3 und Mikro-Interaktionen gegen den Katalog §11.5.
const ROOT = path.resolve(__dirname, '../../..')
const design = readFileSync(path.join(ROOT, 'docs/design/DESIGN.md'), 'utf8')
const tokens = readFileSync(path.join(ROOT, 'src/styles/tokens.css'), 'utf8')

const section = (from: string, to: string): string => {
  const a = design.indexOf(from)
  const b = design.indexOf(to, a)
  expect(a).toBeGreaterThan(-1)
  return design.slice(a, b)
}

const cssVar = (name: string): string | undefined =>
  new RegExp(`${name}:\\s*([^;]+);`).exec(tokens)?.[1]?.trim()

describe('Bewegungs-Tokens (DESIGN §11.2/§11.3)', () => {
  it('P9.16 Easing-Tokens in tokens.css = DESIGN §11.2', () => {
    const rows = [
      ...section('### 11.2 Easing-Tokens', '### 11.3').matchAll(
        /\| `(--ease-[a-z-]+)` \| `\(([^)]+)\)`/g,
      ),
    ]
    expect(rows.length).toBe(8)
    for (const [, name, args] of rows) {
      const want = `cubic-bezier(${args!
        .split(',')
        .map((s) => s.trim())
        .join(', ')})`
      expect(cssVar(name!), name).toBe(want)
    }
  })

  it('P9.16 Dauer-Tokens in tokens.css = DESIGN §11.3', () => {
    const body = section('### 11.3 Dauer-Tokens', '### 11.4')
    const rows = [...body.matchAll(/\| ((?:`--[a-z-]+`(?: \/ )?)+) \| ([^|]+) \|/g)]
    expect(rows.length).toBeGreaterThanOrEqual(13)
    let checked = 0
    for (const [, names, value] of rows) {
      const toks = [...names!.matchAll(/`(--[a-z-]+)`/g)].map((m) => m[1]!)
      const vals = [...value!.split('(')[0]!.matchAll(/\d+/g)].map((m) => `${m[0]}ms`)
      if (toks.length !== vals.length || toks[0]!.startsWith('--boil')) continue
      toks.forEach((t, i) => {
        expect(cssVar(t), t).toBe(vals[i])
        checked++
      })
    }
    expect(checked).toBeGreaterThanOrEqual(14)
  })

  it('P9.16 Boil-/Lauf-/Schlaf-Takt (10/12/8 fps)', () => {
    expect(cssVar('--boil-frame')).toBe('100ms')
    expect(cssVar('--run-frame')).toBe('83ms')
    expect(cssVar('--sleep-frame')).toBe('125ms')
  })

  it('P9.16 Katalog MI-01…MI-19 vollständig und eindeutig (SC-14)', () => {
    const ids = [...section('### 11.5 Katalog', '### 11.6').matchAll(/^\| (MI-\d\d) \|/gm)].map(
      (m) => m[1],
    )
    expect(ids).toHaveLength(19)
    expect(QA_MICROS.map((m) => m.id)).toEqual(ids)
  })
})
