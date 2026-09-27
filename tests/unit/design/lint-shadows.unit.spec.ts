import { describe, expect, it } from 'vitest'

import { blurOf, designSources, lintShadows } from '../../helpers/designLint'

// AK-DS-06 (DESIGN §6.3): keine Schatten mit Unschärfe ≠ 0 (nur „gedruckt“ oder „schraffiert“).
describe('Schatten-Lint (AK-DS-06)', () => {
  it('AK-DS-06 src/**/*.{css,scss,tsx} ohne unscharfe Schatten', () => {
    expect(lintShadows(designSources())).toEqual([])
  })

  it('blurOf liest den dritten Längenwert', () => {
    expect(blurOf('3px 3px 0 0 var(--ink)')).toBe(0)
    expect(blurOf('0 1px 0 0 var(--clay)')).toBe(0)
    expect(blurOf('2px 2px 4px rgba(0, 0, 0, 0.3)')).toBe(4)
    expect(blurOf('inset 0 0 0 2px var(--paper)')).toBe(0)
    expect(blurOf('1px 1px var(--ink)')).toBeNull()
  })

  it('AK-DS-06 erkennt Verstöße (Negativproben)', () => {
    const bad = lintShadows([
      { path: 'a.css', source: '.a { box-shadow: 0 2px 8px rgb(0 0 0 / 0.2); }' },
      { path: 'b.css', source: '.b { text-shadow: 1px 1px 2px var(--ink); }' },
      { path: 'c.css', source: '.c { filter: drop-shadow(0 0 3px var(--ink)); }' },
      { path: 'd.tsx', source: "style={{ boxShadow: '0 0 0 0 red, 0 4px 12px black' }}" },
      { path: 'e.css', source: ':root { --shadow-soft: 0 2px 6px var(--ink); }' },
    ])
    expect(bad.map((v) => v.file)).toEqual(['a.css', 'b.css', 'c.css', 'd.tsx', 'e.css'])
  })

  it('AK-DS-06 erlaubt gedruckte Schatten', () => {
    expect(
      lintShadows([
        {
          path: 'ok.css',
          source:
            '.a { box-shadow: var(--shadow-press); } .b { box-shadow: 3px 2px 0 0 var(--stencil), 0 0 0 2px var(--paper); } .c { box-shadow: none; }',
        },
      ]),
    ).toEqual([])
  })
})
