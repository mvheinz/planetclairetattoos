import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

// P10.16 – docs/GO-LIVE.md: ein Abschnitt je P11-Schritt mit Prüfkriterium, DNS-Tabellen wörtlich wie ARCHITEKTUR §12.4,
// keine Geheimniswerte, keine ungeprüften tiefen Anbieter-URLs.

const root = path.resolve(__dirname, '../../..')
const read = (p: string) => readFileSync(path.join(root, p), 'utf8')
const golive = read('docs/GO-LIVE.md')
const arch = read('docs/ARCHITEKTUR.md')

function tableAfter(text: string, marker: string): string[] {
  const rest = text.slice(text.indexOf(marker))
  const out: string[] = []
  let started = false
  for (const l of rest.split('\n')) {
    if (l.startsWith('|')) {
      started = true
      out.push(l.trim())
    } else if (started) break
  }
  return out
}

describe('GO-LIVE (P10.16)', () => {
  it('jeder Schritt P11.1–P11.17 hat einen Abschnitt mit Prüfkriterium', () => {
    for (let i = 1; i <= 17; i++) {
      const re = new RegExp(`^### P11\\.${i} .+$`, 'm')
      expect(golive, `P11.${i}`).toMatch(re)
      const start = golive.search(re)
      const next = golive.slice(start + 5).search(/^#{2,3} /m)
      const body = golive.slice(start, next < 0 ? undefined : start + 5 + next)
      expect(body, `Prüfkriterium P11.${i}`).toContain('**Prüfkriterium:**')
    }
  })

  it('DNS-Tabellen (Ist und Soll) sind wörtlich identisch mit ARCHITEKTUR §12.4', () => {
    const sec = arch.slice(arch.indexOf('### 12.4 DNS-Umstellung'), arch.indexOf('## 13. Docker-Exit-Pfad'))
    const ist = tableAfter(sec, '**Ist-Stand**')
    const soll = tableAfter(sec, '**Soll-Stand:**')
    expect(ist.length).toBeGreaterThan(8)
    expect(soll.length).toBeGreaterThan(8)
    const ours = (m: string) => tableAfter(golive.slice(golive.indexOf('## 4. DNS-Umstellung')), m)
    expect(ours('**Ist-Stand**')).toEqual(ist)
    expect(ours('**Soll-Stand:**')).toEqual(soll)
    for (const k of ['AAAA', 'CNAME', '`staging`', '`_vercel`', 'unverändert', 'T−1', 'T+7', 'dig +short']) {
      expect(golive, k).toContain(k)
    }
  })

  it('verknüpft AUFGABEN A23–A41 und die ANLEITUNGEN', () => {
    for (let n = 23; n <= 41; n++) expect(golive, `A${n}`).toContain(`A${n}`)
    for (const k of ['A33a', 'A36a', 'S3', 'S4', 'P2', 'D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'N1', 'I3', 'T3', 'Z1'])
      expect(golive, k).toContain(k)
    for (const k of ['AK-A-12-01', 'AK-A-12-02', 'AK-A-12-03', 'EK-08', 'RECHT §7 Teil B', 'KUNST-QA §10 Nr. 4', 'db:mark-production', 'B-01'])
      expect(golive, k).toContain(k)
  })

  it('B-01 steht mit dem Stand aus ARCHITEKTUR Anhang B (Ergebnis erfüllt, Rückfall nicht nötig)', () => {
    const row = arch.split('\n').find((l) => l.startsWith('| B-01 |'))!
    expect(row).toContain('Soll erfüllt')
    expect(golive).toContain('Soll erfüllt')
    expect(golive).toContain('ADR 0002')
  })

  it('keine Geheimniswerte und keine tiefen Anbieter-URLs', () => {
    for (const re of [
      /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9]{10,}/,
      /\bwhsec_[A-Za-z0-9]{10,}/,
      /AGE-SECRET-KEY-1[A-Z0-9]{20,}/,
      /postgres(?:ql)?:\/\/[^\s/:]+:[^\s@]+@/,
    ])
      expect(golive).not.toMatch(re)
    const urls = [...golive.matchAll(/https?:\/\/[^\s)`'"|]+/g)].map((m) => m[0])
    for (const u of urls) {
      expect(
        /^https?:\/\/(planetclairetattoos\.com(\/(impressum|api\/stripe\/webhook))?|<projekt>\.vercel\.app(\/api\/stripe\/webhook|\/api\/health)?|www\.planetclairetattoos\.com\/x|planetclairetattoos\.com\/x?)/.test(
          u,
        ),
        u,
      ).toBe(true)
    }
  })
})
