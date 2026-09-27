import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// P1.2: Jede Plan-Hinweis-ID (W-nn) aus PLAN.md steht in docs/OFFENE-PUNKTE.md.
const root = path.resolve(import.meta.dirname, '../../..')
const read = (f: string) => readFileSync(path.join(root, f), 'utf8')

describe('Offene Punkte (PLAN P1.2)', () => {
  it('jede W-ID aus PLAN.md steht in OFFENE-PUNKTE', () => {
    const ids = [...new Set(read('PLAN.md').match(/\bW-\d{2}\b/g) ?? [])]
    expect(ids.length).toBeGreaterThan(0)
    const op = read('docs/OFFENE-PUNKTE.md')
    const missing = ids.filter((id) => !new RegExp(`\\b${id}\\b`).test(op))
    expect(missing).toEqual([])
  })
})
