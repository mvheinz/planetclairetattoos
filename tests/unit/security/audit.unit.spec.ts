import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { LOCALES } from '@/lib/routes/registry'
import { hasSamplePath, pageRoutes, samplePath } from '@/lib/routes/paths'
import { buildCsp, CSP_CONTEXTS, cspDirectives, NONCE_CONTEXTS } from '@/lib/security/csp'
import { baseHeaders, contextHeaders, nonceContextForPath } from '@/lib/security/headers'

// P10.5 Sicherheits-Audit (T-16, AK-A-8-01, AK-A-4-03, ARCHITEKTUR §8.1/§8.10, Spike B-03/B-01).

const ROOT = path.resolve(import.meta.dirname, '../../..')
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf8')
const NONCE = 'dGVzdC1ub25jZQ=='
const ENVS = ['production', 'staging', 'preview', 'development', 'test'] as const

/** Soll-Zuordnung laut ARCHITEKTUR §8.1 (Spalte „Pfade“). */
const DYNAMIC = ['R06', 'R08', 'R09', 'R10', 'R26']
const CHECKOUT = ['R07']

describe('T-16 AK-A-8-01 Kontext je Registry-Route', () => {
  it('jede Seiten-Route hat den Kontext laut §8.1 (dynamic: R06/R08/R09/R10/R26, checkout: R07, sonst public)', () => {
    for (const r of pageRoutes()) {
      const expected = DYNAMIC.includes(r.id)
        ? 'dynamic'
        : CHECKOUT.includes(r.id)
          ? 'checkout'
          : 'public'
      expect(r.headerContext, r.id).toBe(expected)
    }
  })

  it('der Proxy wählt für jeden Beispielpfad (DE/EN) genau den Kontext der Registry', () => {
    let checked = 0
    for (const r of pageRoutes().filter((x) => x.status === 'live' && hasSamplePath(x))) {
      for (const locale of LOCALES) {
        const p = samplePath(r.id, locale)
        const ctx = nonceContextForPath(p)
        if (r.headerContext === 'public') expect(ctx, p).toBeNull()
        else expect(ctx?.context, p).toBe(r.headerContext)
        checked++
      }
    }
    expect(checked).toBeGreaterThanOrEqual(2 * 25)
  })

  it('Kontext public: Seiten der Registry mit Eingabefeldern gibt es dort nicht (Formulare laufen dynamisch)', () => {
    // R10 (Auftragsformular), R26 (Widerruf), R07 (Kasse) und R06 (Korb) tragen Nonce-CSP.
    for (const id of ['R06', 'R07', 'R10', 'R26']) {
      expect(pageRoutes().find((r) => r.id === id)?.headerContext, id).not.toBe('public')
    }
  })
})

describe('AK-A-8-01/AK-A-4-03 Header je Umgebung und Kontext', () => {
  it('jede Kombination Umgebung x Kontext: Grundheader, HSTS nur production/staging, noindex außer production', () => {
    for (const appEnv of ENVS) {
      const base = baseHeaders(appEnv)
      expect(base['X-Content-Type-Options'], appEnv).toBe('nosniff')
      expect(base['X-Frame-Options'], appEnv).toBe('DENY')
      expect(base['Referrer-Policy'], appEnv).toBe('strict-origin-when-cross-origin')
      expect(base['Cross-Origin-Opener-Policy'], appEnv).toBe('same-origin')
      expect(base['Permissions-Policy'], appEnv).toContain('camera=()')
      const hsts = appEnv === 'production' || appEnv === 'staging'
      expect(base['Strict-Transport-Security'] !== undefined, appEnv).toBe(hsts)
      if (hsts) expect(base['Strict-Transport-Security']).not.toMatch(/preload/)
      // Produktion ist indexierbar (Seiten steuern robots selbst), alles andere nie.
      expect(base['X-Robots-Tag'], appEnv).toBe(
        appEnv === 'production' ? undefined : 'noindex, nofollow',
      )
      for (const context of CSP_CONTEXTS) {
        const csp = buildCsp(context, {
          appEnv,
          nonce: NONCE,
          nodeEnv: appEnv === 'development' ? 'development' : 'production',
        })
        expect(csp, `${appEnv}/${context}`).toContain('frame-ancestors')
        expect(csp, `${appEnv}/${context}`).not.toMatch(/\*\.?\s|\s\*\s|\s\*;/) // kein nacktes `*`
        expect(csp, `${appEnv}/${context}`).not.toContain('data:;') // data: nur für Bilder
      }
    }
  })

  it('Nonce-Kontexte (dynamic, checkout, admin) erlauben nie unsafe-inline in script-src; Nonce bei jedem Aufruf neu', () => {
    for (const context of NONCE_CONTEXTS) {
      const d = cspDirectives(context, {
        appEnv: 'production',
        nodeEnv: 'production',
        nonce: NONCE,
      })
      expect(d['script-src'], context).not.toContain("'unsafe-inline'")
      expect(d['script-src'], context).not.toContain("'unsafe-eval'")
      expect(d['script-src'], context).toContain(`'nonce-${NONCE}'`)
      expect(d['object-src'], context).toEqual(["'none'"])
      expect(d['base-uri'], context).toEqual(["'self'"])
    }
  })

  it('B-03 B-01: Rückfall `unsafe-inline` ausschließlich im Kontext public und ohne fremde Hosts; ADR und Anhang B nennen die Entscheidung', () => {
    const pub = cspDirectives('public', { appEnv: 'production', nodeEnv: 'production' })
    expect(pub['script-src']).toEqual(["'self'", "'unsafe-inline'"])
    const adr = read('docs/adr/0002-csp-script-src.md')
    expect(adr).toMatch(/Entscheidung B-03/)
    expect(adr).toMatch(/P10\.5/)
    const arch = read('docs/ARCHITEKTUR.md')
    const row = arch.split('\n').find((l) => l.startsWith('| B-03 |')) ?? ''
    expect(row).toMatch(/P10\.5/)
  })

  it('Kontext api und Token-Seiten: strengste Werte', () => {
    expect(buildCsp('api', { appEnv: 'production' })).toBe(
      "default-src 'none'; frame-ancestors 'none'",
    )
    const t = contextHeaders('dynamic', { appEnv: 'production', nonce: NONCE, tokenPage: true })
    expect(t['Referrer-Policy']).toBe('no-referrer')
    expect(t['Cache-Control']).toBe('private, no-store')
  })
})

describe('§8.10 Abhängigkeiten: Ausnahmen in pnpm.auditConfig.ignoreCves', () => {
  const pkg = JSON.parse(read('package.json')) as {
    pnpm?: {
      auditConfig?: { ignoreCves?: string[]; ignoreGhsas?: string[] }
      overrides?: Record<string, string>
    }
  }
  const open = read('docs/OFFENE-PUNKTE.md')

  it('nur CVE-IDs (keine anderen Ausnahmen), jede mit Zeile in OFFENE-PUNKTE', () => {
    const cfg = pkg.pnpm?.auditConfig ?? {}
    expect(Object.keys(cfg).filter((k) => k !== 'ignoreCves')).toEqual([])
    for (const id of cfg.ignoreCves ?? []) {
      expect(id).toMatch(/^CVE-\d{4}-\d{4,}$/)
      expect(open, id).toContain(id)
    }
    expect(JSON.stringify(pkg)).not.toMatch(/audit-level/)
  })

  it('Overrides für Sicherheitsfixes sind begründet (OFFENE-PUNKTE nennt jedes überschriebene Paket)', () => {
    for (const name of Object.keys(pkg.pnpm?.overrides ?? {})) {
      expect(open, name).toMatch(new RegExp(`\\b${name}\\b[^\\n]*(override|Override)`))
    }
  })
})
