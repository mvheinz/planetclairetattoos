import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  ROOT,
  composite,
  contrast,
  parseHex,
  readTokens,
  resolveToken,
} from '../../helpers/designLint'

// AK-DS-01 (DESIGN §3.1): Jedes für Text freigegebene Token hat gegen Papier, Papier-2, Raster (#D6DFC2) und das Ende des
// Seitenverlaufs (--paper-deep, §3.5) ≥ 4,50.
const tokensCss = readFileSync(path.join(ROOT, 'src/styles/tokens.css'), 'utf8')
const tokens = readTokens(tokensCss)
const hex = (name: string) => parseHex(resolveToken(tokens, name))

const GRID_MAJOR = '#D6DFC2'
const BACKGROUNDS: [string, ReturnType<typeof parseHex>][] = [
  ['--paper', hex('--paper')],
  ['--paper-2', hex('--paper-2')],
  ['Raster', parseHex(GRID_MAJOR)],
  ['Verlauf-Ende', hex('--paper-deep')],
]

interface DesignRow {
  token: string
  hex: string | null
  ratios: number[]
  release: string
}

/** Liest die Tabelle DESIGN §3.1 (Token, Hex, Kontraste, Freigabe). */
function designRows(): DesignRow[] {
  const md = readFileSync(path.join(ROOT, 'docs/design/DESIGN.md'), 'utf8')
  const start = md.indexOf('### 3.1 ')
  const section = md.slice(start, md.indexOf('Kunst-Farben', start))
  const rows: DesignRow[] = []
  for (const line of section.split('\n')) {
    const cells = line.split('|').map((c) => c.trim())
    const token = /^`(--[\w-]+)`$/.exec(cells[1] ?? '')?.[1]
    if (!token) continue
    rows.push({
      token,
      hex: /`(#[0-9A-Fa-f]{6})`/.exec(cells[2] ?? '')?.[1] ?? null,
      ratios: [cells[4], cells[5], cells[6], cells[7]].map((c) =>
        Number.parseFloat((c ?? '').replace(',', '.')),
      ),
      release: cells[8] ?? '',
    })
  }
  return rows
}

const textTokens = designRows().filter((r) => r.release.startsWith('Text jeder Größe'))

describe('Kontrast der Farb-Tokens (AK-DS-01)', () => {
  it('AK-DS-01 DESIGN §3.1 nennt die freigegebenen Text-Tokens', () => {
    expect(textTokens.map((r) => r.token)).toEqual([
      '--ink',
      '--ink-2',
      '--ink-3',
      '--petrol',
      '--petrol-deep',
      '--fox-text',
      '--stencil',
      '--warn',
      '--error',
      '--ok',
    ])
  })

  it.each(textTokens.map((r) => [r.token, r] as const))(
    'AK-DS-01 %s ≥ 4,50 gegen Papier, Papier-2, Raster und Verlauf-Ende',
    (token, row) => {
      if (row.hex) expect(resolveToken(tokens, token).toUpperCase()).toBe(row.hex.toUpperCase())
      BACKGROUNDS.forEach(([bgName, bg], i) => {
        const ratio = contrast(hex(token), bg)
        expect(ratio, `${token} auf ${bgName}`).toBeGreaterThanOrEqual(4.5)
        // Die in DESIGN §3.1 dokumentierten Werte stimmen mit der Berechnung überein.
        expect(Math.abs(ratio - row.ratios[i]!), `${token} auf ${bgName}`).toBeLessThan(0.02)
      })
    },
  )

  it('AK-DS-01 --fox nur groß (≥ 3:1) bzw. Deko', () => {
    for (const [, bg] of BACKGROUNDS) expect(contrast(hex('--fox'), bg)).toBeGreaterThanOrEqual(3)
  })

  it('Raster-Hauptlinie ergibt auf Papier die geprüfte Farbe #D6DFC2 (§3.4)', () => {
    const paper = hex('--paper')
    const minor = composite(tokens.get('--grid-line')!, paper)
    const major = composite(tokens.get('--grid-line-major')!, minor)
    const expected = parseHex(GRID_MAJOR)
    major.forEach((c, i) => expect(Math.abs(c - expected[i]!)).toBeLessThanOrEqual(1))
    expect(minor.map((c) => c.toString(16).padStart(2, '0')).join('')).toBe('dde4c7')
  })

  it('Papier-Feld ist heller als Papier (Felder mindestens so kontrastreich)', () => {
    expect(contrast(hex('--ink-3'), hex('--paper-field'))).toBeGreaterThan(
      contrast(hex('--ink-3'), hex('--paper')),
    )
  })

  it('tokens.css ist wörtlich DESIGN §7', () => {
    const md = readFileSync(path.join(ROOT, 'docs/design/DESIGN.md'), 'utf8')
    const block = /## 7\. Token-Datei[\s\S]*?```css\n([\s\S]*?)```/.exec(md)?.[1]
    expect(tokensCss).toBe(block)
  })
})
