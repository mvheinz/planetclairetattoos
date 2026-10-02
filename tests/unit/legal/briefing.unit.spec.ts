import { existsSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { LEGAL_TOKENS } from '@/lib/legal/tokens'

// P6.22 – Kanzlei-Mappe an die Umsetzung angeglichen (KANZLEI-BRIEFING §8, §11.3, §11.4, §12, §16.3, §18): beide Seiten
// werden geparst – Tokens der Mappe = Tokenliste des Renderers (R-012, geschlossen), Cookie-/Speicherliste der Mappe =
// ARCHITEKTUR §8.7, Verarbeitungen §11.4 = VVT, Anlage E verlinkt.

const ROOT = path.resolve(import.meta.dirname, '../../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')
const BRIEFING = read('docs/recht/KANZLEI-BRIEFING.md')
const ARCH = read('docs/ARCHITEKTUR.md')

/** Abschnitt ab Überschrift `start` bis zur nächsten Überschrift derselben oder höheren Ebene. */
function section(md: string, start: string): string {
  const from = md.indexOf(start)
  expect(from, start).toBeGreaterThanOrEqual(0)
  const level = /^#+/.exec(start)![0].length
  const rest = md.slice(from + start.length)
  const next = rest.search(new RegExp(`^#{1,${level}} `, 'm'))
  return next < 0 ? rest : rest.slice(0, next)
}

/** Namen in Backticks aus der ersten Spalte einer Markdown-Tabelle; `localStorage['x']` → `x`. */
function storageNames(table: string): Set<string> {
  const names = new Set<string>()
  for (const line of table.split('\n')) {
    if (!line.startsWith('| ') || /^\|\s*(Name|---)/.test(line)) continue
    const first = line.split('|')[1] ?? ''
    for (const m of first.matchAll(/`([^`]+)`/g)) {
      const raw = m[1]!
      names.add(/^localStorage\['(.+)'\]$/.exec(raw)?.[1] ?? raw)
    }
  }
  return names
}

describe('Kanzlei-Mappe (P6.22)', () => {
  it('R-012 in der Mappe genannte Tokens = Tokenliste des Renderers (geschlossen, ohne weitere Schreibweisen)', () => {
    const named = new Set([...BRIEFING.matchAll(/\{\{\s*([^}]*?)\s*\}\}/g)].map((m) => m[1]!))
    expect([...named].sort()).toEqual([...LEGAL_TOKENS].sort())
    // §16.3 nennt jedes Token genau in seiner kanonischen Schreibweise und kein Token für die Empfänger-Tabelle
    const tokens = section(BRIEFING, '### 16.3 Platzhalter')
    for (const t of LEGAL_TOKENS) expect(tokens).toContain(`{{${t}}}`)
    expect(tokens).toMatch(/kein\*{0,2} Platzhalter/)
    expect(tokens).not.toMatch(/\{\{\s*(processorTable|processors|empfaenger)\s*\}\}/i)
  })

  it('Cookie-/Speicherliste der Mappe §11.3 = ARCHITEKTUR §8.7 (inkl. pc_checkout und pc-motion)', () => {
    const briefing = storageNames(section(BRIEFING, '### 11.3 Cookies'))
    const arch = storageNames(section(ARCH, '### 8.7 Cookies'))
    expect([...briefing].sort()).toEqual([...arch].sort())
    expect(briefing).toContain('pc_checkout')
    expect(briefing).toContain('pc-motion')
  })

  it('R-156 Verarbeitungen §11.4 = VVT (gleiche Nummern)', () => {
    const vvt = read('docs/recht/VVT.md')
    const ids = (md: string) => [...md.matchAll(/^\| (V\d+) \|/gm)].map((m) => m[1]!)
    expect(ids(section(BRIEFING, '### 11.4 Verarbeitungen'))).toEqual(ids(vvt))
  })

  it('Widerrufsablauf §8 und Formulare §12 entsprechen der Umsetzung', () => {
    const w = section(BRIEFING, '## 8. Widerruf').replace(/\s+/g, ' ')
    for (const s of [
      'Schritt 1',
      'Auswahl',
      'Schritt 2',
      'Bestätigungsseite',
      'Eingangsbestätigung',
      'Withdraw from contract here',
      'Widerruf bestätigen',
      'Confirm withdrawal',
      'WR-JJJJ-NNNNN',
    ]) {
      expect(w).toContain(s)
    }
    const forms = section(BRIEFING, '## 12. Formulare').replace(/\s+/g, ' ')
    expect(forms).toContain('Zahlungspflichtig bestellen')
    expect(forms).toContain('höchstens 5 Bilder')
    expect(forms).toContain('keine Einwilligungs-Checkbox')
  })

  it('§18 Anlage E verlinkt sechs Bildschirmfotos E-01 … E-06; Versionseintrag in §19', () => {
    const annex = section(BRIEFING, '## 18. Anlagen')
    for (const n of ['E-01', 'E-02', 'E-03', 'E-04', 'E-05', 'E-06']) {
      expect(annex).toContain(`(anlagen/${n}.png)`)
    }
    expect(BRIEFING).toMatch(/\*\*Version:\*\* 1\.4/)
    expect(section(BRIEFING, '## 19. Entstehung')).toMatch(/\| 1\.4 \|/)
    // Der Block für die Mandantin bleibt unangetastet
    expect(BRIEFING).toContain('**Vor dem Versand von der Mandantin zu ergänzen:**')
  })

  // Die Dateien erzeugt `scripts/legal/briefing-screenshots.ts` (Playwright, Mock-Treiber, 390 px, DE) und werden
  // committet; die Prüfung liest nur die Dateien (ohne Server).
  it('E-01 … E-06 vorhanden, echte PNG und je ≤ 300 KB', () => {
    for (const n of ['E-01', 'E-02', 'E-03', 'E-04', 'E-05', 'E-06']) {
      const file = path.join(ROOT, 'docs/recht/anlagen', `${n}.png`)
      expect(existsSync(file), n).toBe(true)
      const bytes = readFileSync(file)
      expect(bytes.subarray(1, 4).toString('latin1'), n).toBe('PNG')
      expect(statSync(file).size, n).toBeLessThanOrEqual(300 * 1024)
      expect(statSync(file).size, n).toBeGreaterThan(5 * 1024)
    }
  })
})
