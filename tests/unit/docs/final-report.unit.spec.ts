import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// P10.22 – Abschlussbericht für Jutta (CLAUDE.md §8 Nr. 2) in docs/FORTSCHRITT.md.

const root = path.resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(path.join(root, p), 'utf8')

const progress = read('docs/FORTSCHRITT.md')
const start = progress.indexOf('P10 Abschlussbericht')
const rest = progress.slice(start)
const next = rest.indexOf('\n## ', 4)
const report = next === -1 ? rest : rest.slice(0, next)

describe('Abschlussbericht (P10.22)', () => {
  it('ist vorhanden und der neueste Eintrag', () => {
    expect(start).toBeGreaterThan(0)
    const firstHeading = progress.match(/^## .+$/m)?.[0] ?? ''
    expect(firstHeading).toContain('P10 Abschlussbericht')
  })

  it('enthält den Release-Link vorschau-p10', () => {
    expect(report).toContain('https://github.com/mvheinz/planetclairetattoos/releases/tag/vorschau-p10')
  })

  it('enthält die Pflichtteile als Überschriften', () => {
    for (const re of [
      /^### Was fertig ist$/m,
      /^### So öffnest du die Vorschau-Datei$/m,
      /^### Diese Punkte aus `docs\/OFFENE-PUNKTE\.md` solltest du entscheiden/m,
      /^### Das kannst du vor dem Start erledigen/m,
      /^### Das passiert in P11 gemeinsam/m,
      /^### Nach dem Start/m,
    ]) {
      expect(report).toMatch(re)
    }
  })

  it('nennt A23 bis A50 und verweist auf GO-LIVE', () => {
    for (let i = 23; i <= 50; i++) expect(report).toMatch(new RegExp(`\\bA${i}\\b`))
    expect(report).toContain('docs/GO-LIVE.md')
  })

  it('erwähnt das Video-Bündel der Kunst-Prüfung', () => {
    expect(report).toContain('art-qa-20261006-iter01-b093408')
    expect(report).toContain('art-qa.yml')
  })
})
