import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { ROOT, designSources, lintColors, readTokens } from '../../helpers/designLint'

// AK-DS-02 (DESIGN §3.2): kein Fuchs als Textfarbe außer SoldStamp/CartLine; keine Deko-/Kunstfarben und kein Weiß
// als Textfarbe.
const tokens = readTokens(readFileSync(path.join(ROOT, 'src/styles/tokens.css'), 'utf8'))

describe('Farb-Lint (AK-DS-02)', () => {
  it('AK-DS-02 src/**/*.{css,scss,tsx} hält die Farbregeln ein', () => {
    const files = designSources()
    expect(files.some((f) => f.path === 'src/styles/global.css')).toBe(true)
    expect(lintColors(files, tokens)).toEqual([])
  })

  it('AK-DS-02 erkennt Verstöße (Negativproben)', () => {
    const bad = lintColors(
      [
        { path: 'src/components/ProductCard.module.css', source: '.a { color: var(--fox); }' },
        { path: 'src/components/Y.tsx', source: "<p style={{ color: 'var(--pink)' }} />" },
        {
          path: 'src/components/Z.css',
          source: '.c { color: var(--wash-sky) }\n.d { color: #FFF; }',
        },
        { path: 'src/components/W.css', source: '.e { color: white; }\n.f{color:var(--clay)}' },
        { path: 'src/components/V.css', source: '.g { color: var(--coco-fur); }' },
      ],
      tokens,
    )
    expect(bad).toHaveLength(7) // `--color-sold` ist seit U-12 Petrol, kein Fuchs-Alias mehr
  })

  it('AK-DS-02 erlaubt Fuchs in SoldStamp/CartLine und Hintergrund-/Randfarben', () => {
    const ok = lintColors(
      [
        { path: 'src/components/shop/SoldStamp.module.css', source: '.s { color: var(--fox); }' },
        { path: 'src/components/cart/CartLine.tsx', source: "style={{ color: 'var(--fox)' }}" },
        {
          path: 'src/components/A.css',
          source:
            '.a { background-color: var(--pink); border-color: var(--clay); outline-color: #fff; color: var(--fox-text); }',
        },
      ],
      tokens,
    )
    expect(ok).toEqual([])
  })
})
