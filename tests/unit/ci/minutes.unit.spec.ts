import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  countMonthMinutes,
  runMinutes,
  runsEndpoint,
  type MinutesApi,
} from '../../../scripts/ci/minutes'

// AK-A-6-03 (ARCHITEKTUR §6.8, PLAN P1.33a): Minuten-Wächter mit aufgezeichneten API-Antworten, ohne Netz.

const NOW = new Date('2026-09-27T12:00:00Z')
const fixture = (name: string): unknown =>
  JSON.parse(readFileSync(path.resolve('tests/fixtures/github/minutes', name), 'utf8')) as unknown

/** Antworten wie `gh api`; `billable: false` liefert Timing-Antworten ohne `billable`. */
function recordedApi({ billable = true } = {}): MinutesApi & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    get: async (endpoint) => {
      calls.push(endpoint)
      const m = /actions\/runs\/(\d+)\/timing$/.exec(endpoint)
      if (!m) throw new Error(`unerwarteter Endpunkt ${endpoint}`)
      return billable ? fixture(`timing-${m[1]}.json`) : fixture('timing-nobillable.json')
    },
    pages: async (endpoint) => {
      calls.push(endpoint)
      if (endpoint === runsEndpoint(NOW)) return fixture('runs.json') as unknown[]
      const m = /actions\/runs\/(\d+)\/jobs\?per_page=100$/.exec(endpoint)
      if (!m) throw new Error(`unerwarteter Endpunkt ${endpoint}`)
      return fixture(`jobs-${m[1]}.json`) as unknown[]
    },
  }
}

/** Ein Lauf in diesem Monat mit einem Job der angegebenen Minuten. */
function apiWithMinutes(minutes: number): MinutesApi {
  return {
    get: async () => ({ billable: { UBUNTU: { job_runs: [{ duration_ms: minutes * 60_000 }] } } }),
    pages: async () => [{ workflow_runs: [{ id: 1, created_at: '2026-09-02T10:00:00Z' }] }],
  }
}

describe('AK-A-6-03 Minuten-Wächter pnpm ci:minutes', () => {
  it('AK-A-6-03 zählt nur Läufe dieses UTC-Monats, je Job aufgerundet (61 s → 2, 59 s → 1)', async () => {
    const api = recordedApi()
    // Lauf 101: 61 s + 59 s = 2 + 1; Lauf 102: 61 s = 2; Lauf 103 (Vormonat) zählt nicht
    expect(await countMonthMinutes(NOW, api)).toBe(5)
    expect(api.calls[0]).toBe(
      'repos/{owner}/{repo}/actions/runs?created=%3E%3D2026-09-01&per_page=100',
    )
    expect(api.calls.some((c) => c.includes('/runs/103/'))).toBe(false)
  })

  it('AK-A-6-03 ohne billable ergibt sich dieselbe Summe über die Job-Zeiten', async () => {
    const api = recordedApi({ billable: false })
    expect(await countMonthMinutes(NOW, api)).toBe(5)
    expect(api.calls.filter((c) => c.includes('/jobs?'))).toHaveLength(2)
  })

  it('AK-A-6-03 Ausgabe MINUTEN_MONAT und MINUTEN_STATUS=ok', async () => {
    const lines: string[] = []
    const r = await runMinutes(NOW, recordedApi(), (l) => lines.push(l))
    expect(r.status).toBe('ok')
    expect(lines.slice(0, 2)).toEqual(['MINUTEN_MONAT=5', 'MINUTEN_STATUS=ok'])
  })

  it('AK-A-6-03 ab 1.500 Minuten knapp, ab 2.000 erschoepft', async () => {
    const status = async (n: number) => (await runMinutes(NOW, apiWithMinutes(n), () => {})).status
    expect(await status(1499)).toBe('ok')
    expect(await status(1500)).toBe('knapp')
    expect(await status(1999)).toBe('knapp')
    expect(await status(2000)).toBe('erschoepft')
    const lines: string[] = []
    await runMinutes(NOW, apiWithMinutes(1500), (l) => lines.push(l))
    expect(lines).toContain('MINUTEN_STATUS=knapp')
    expect(lines.join('\n')).toMatch(/bis Monatsende nur Phasenende-Läufe/)
  })

  it('AK-A-6-03 API-Fehler → MINUTEN_STATUS=unbekannt mit deutscher Meldung, kein Wurf', async () => {
    const failing: MinutesApi = {
      get: () => Promise.reject(new Error('HTTP 403: Resource not accessible by integration')),
      pages: () => Promise.reject(new Error('`gh` ist nicht installiert')),
    }
    const lines: string[] = []
    const r = await runMinutes(NOW, failing, (l) => lines.push(l))
    expect(r.status).toBe('unbekannt')
    expect(lines).toContain('MINUTEN_STATUS=unbekannt')
    expect(r.message).toMatch(/^Minuten-Stand nicht abrufbar \(`gh` ist nicht installiert\)/)
    expect(r.message).toMatch(/gilt wie „knapp“/)
    // Unerwartete Antwort zählt ebenfalls als Fehler
    const odd: MinutesApi = { get: async () => ({}), pages: async () => [{ message: 'Not Found' }] }
    expect((await runMinutes(NOW, odd, () => {})).status).toBe('unbekannt')
  })

  it('AK-A-6-03 Exit-Code immer 0, nur lesende Aufrufe', () => {
    const src = readFileSync(path.resolve('scripts/ci/minutes.ts'), 'utf8')
    expect(src).toMatch(/finally\(\(\) => process\.exit\(0\)\)/)
    expect(src).not.toMatch(/process\.exit\(1\)/)
    const gh = readFileSync(path.resolve('scripts/ci/gh.ts'), 'utf8')
    expect(gh).toMatch(/'--method', 'GET'/)
    expect(gh).not.toMatch(/'(POST|PATCH|PUT|DELETE)'/)
  })
})
