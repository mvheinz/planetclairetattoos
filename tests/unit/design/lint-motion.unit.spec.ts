import { existsSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  CALM_COMPONENT_DIRS,
  ROOT,
  calmFolders,
  collectFiles,
  designSources,
  lintCalmTransitions,
  lintEasing,
  lintKeyframes,
} from '../../helpers/designLint'

// AK-DS-16 (DESIGN §11.2, §11.6): keine Standard-Easings, keine Layout-Keyframes, keine Transitions auf Ruheseiten.
describe('Bewegungs-Lint (AK-DS-16)', () => {
  it('AK-DS-16 kein ease/ease-in/ease-out/ease-in-out in src/', () => {
    const files = [...designSources(['.css', '.scss', '.tsx']), ...collectFiles('src', ['.ts'])]
    expect(lintEasing(files)).toEqual([])
  })

  it('AK-DS-16 keine @keyframes auf width/height/top/left/margin/box-shadow', () => {
    expect(lintKeyframes(designSources())).toEqual([])
  })

  it('AK-DS-16 keine transition in den Stylesheets der Ruheseiten und unter src/components/checkout/', () => {
    const dirs = [...calmFolders(), ...CALM_COMPONENT_DIRS]
    // Ruheseiten R06, R07, R09, R26, R21–R25, R27 in ihren englischen Routenordnern (ARCHITEKTUR §2.1).
    expect(calmFolders()).toEqual(
      expect.arrayContaining([
        'src/app/(frontend)/[locale]/cart/',
        'src/app/(frontend)/[locale]/checkout/',
        'src/app/(frontend)/[locale]/order/[token]/',
        'src/app/(frontend)/[locale]/withdraw-from-contract/',
        'src/app/(frontend)/[locale]/legal-notice/',
        'src/app/(frontend)/[locale]/declarations-of-conformity/',
      ]),
    )
    expect(calmFolders()).toHaveLength(10)
    expect(lintCalmTransitions(designSources(), dirs)).toEqual([])
  })

  it('AK-DS-16 keine eigene Routengruppe für Ruheseiten', () => {
    expect(existsSync(path.join(ROOT, 'src/app/(frontend)/[locale]/(calm)'))).toBe(false)
    expect(existsSync(path.join(ROOT, 'src/app/(frontend)/(calm)'))).toBe(false)
  })

  it('AK-DS-16 erkennt Verstöße (Negativproben)', () => {
    expect(
      lintEasing([
        { path: 'a.css', source: '.a { transition: opacity 200ms ease-out; }' },
        { path: 'b.css', source: '.b { animation-timing-function: ease; }' },
        { path: 'c.ts', source: "el.animate(frames, { duration: 200, easing: 'ease-in-out' })" },
      ]),
    ).toHaveLength(3)
    expect(
      lintEasing([
        {
          path: 'ok.css',
          source:
            '.a { transition: transform var(--dur-short) var(--ease-ink-out); animation: boil 1s steps(3) infinite; }',
        },
      ]),
    ).toEqual([])
    expect(
      lintKeyframes([
        { path: 'k.css', source: '@keyframes grow { from { width: 0 } to { width: 10px } }' },
        { path: 'm.css', source: '@keyframes m { 50% { margin-left: 4px } }' },
        {
          path: 'ok.css',
          source: '@keyframes ok { from { transform: scale(0) } to { opacity: 1 } }',
        },
      ]).map((v) => v.file),
    ).toEqual(['k.css', 'm.css'])
    expect(
      lintCalmTransitions(
        [
          {
            path: 'src/app/(frontend)/[locale]/checkout/page.module.css',
            source: '.a { transition: opacity 1s; }',
          },
          {
            path: 'src/components/checkout/Pay.tsx',
            source: "style={{ transitionDuration: '1s' }}",
          },
          { path: 'src/components/shop/Card.module.css', source: '.a { transition: opacity 1s; }' },
        ],
        ['src/app/(frontend)/[locale]/checkout/', 'src/components/checkout/'],
      ).map((v) => v.file),
    ).toEqual([
      'src/app/(frontend)/[locale]/checkout/page.module.css',
      'src/components/checkout/Pay.tsx',
    ])
  })
})
