import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import { pageRoutes } from '@/lib/routes/paths'
import {
  activeHosts,
  ADMIN_SCRIPT_POLICY,
  buildCsp,
  CSP_CONTEXTS,
  CSP_HOSTS,
  cspDirectives,
  PUBLIC_SCRIPT_POLICY,
  type CspContext,
} from '@/lib/security/csp'
import {
  baseHeaders,
  contextHeaders,
  nonceContextForPath,
  staticHeaderRules,
  withoutPublicClientHints,
} from '@/lib/security/headers'
import { MOTION_SCRIPT, MOTION_SCRIPT_HASH } from '@/lib/security/inlineScripts'

// P2.12 Sicherheits-Header und CSP (ARCHITEKTUR §8.1): T-16 (Header je Kontext), R-131 (CSP-Hosts ⊆ DIENSTE-YAML),
// Hash-Abgleich `pc-motion`.

const ROOT = path.resolve(import.meta.dirname, '../../..')
const PROD = { appEnv: 'production' as const, nodeEnv: 'production' }
const NONCE = 'dGVzdC1ub25jZQ=='

function dienste(): { services: { id: string; csp: Record<string, Record<string, string[]>> }[] } {
  const md = readFileSync(path.join(ROOT, 'docs/recht/DIENSTE.md'), 'utf8')
  const blocks = [...md.matchAll(/```yaml\n([\s\S]*?)```/g)]
  expect(blocks).toHaveLength(1)
  return parse(blocks[0]![1]!)
}

/** Alle Fremd-Hosts (http/https/Wildcard) einer CSP-Zeichenkette je Direktive. */
function hostsIn(csp: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const part of csp.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/)
    const hosts = values.filter((v) => /^https?:\/\//.test(v) || v.includes('*'))
    if (name && hosts.length) out[name] = hosts
  }
  return out
}

describe('T-16 Header je Kontext', () => {
  it('alle Antworten: nosniff, Referrer, DENY, COOP, Permissions-Policy; HSTS nur production/staging', () => {
    const prod = baseHeaders('production')
    expect(prod).toEqual({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Frame-Options': 'DENY',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Permissions-Policy':
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      // P12.11 (U-22 c): TDMRep-Vorbehalt und KI-Ausschluss, Indexierung bleibt erlaubt
      'tdm-reservation': '1',
      'X-Robots-Tag': 'noai, noimageai',
    })
    expect(baseHeaders('staging')['Strict-Transport-Security']).toBe(
      'max-age=31536000; includeSubDomains',
    )
    expect(baseHeaders('staging')['X-Robots-Tag']).toBe('noindex, nofollow')
    for (const env of ['development', 'test', 'preview'] as const) {
      expect(baseHeaders(env)['Strict-Transport-Security']).toBeUndefined()
      expect(baseHeaders(env)['X-Robots-Tag']).toBe('noindex, nofollow')
    }
  })

  it('CSP-Kern public laut Tabelle §8.1 (Rückfall B-03: unsafe-inline, nur self)', () => {
    expect(PUBLIC_SCRIPT_POLICY).toBe('unsafe-inline')
    expect(buildCsp('public', PROD)).toBe(
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
        "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self'; frame-src 'none'; " +
        "worker-src 'none'; manifest-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; " +
        "frame-ancestors 'none'; upgrade-insecure-requests",
    )
  })

  it('dynamic/checkout: Nonce + strict-dynamic (+ Hash pc-motion), ohne unsafe-inline', () => {
    for (const context of ['dynamic', 'checkout'] as const) {
      const d = cspDirectives(context, { ...PROD, nonce: NONCE })
      expect(d['script-src']).toEqual([
        "'self'",
        `'nonce-${NONCE}'`,
        "'strict-dynamic'",
        MOTION_SCRIPT_HASH,
      ])
      expect(buildCsp(context, { ...PROD, nonce: NONCE })).not.toContain("'unsafe-inline' ")
    }
    expect(() => buildCsp('dynamic', PROD)).toThrow(/Nonce/)
  })

  it('checkout: Stripe-Hosts nur bei PAYMENTS_DRIVER=stripe; Zusatz-Header', () => {
    const mock = cspDirectives('checkout', { ...PROD, nonce: NONCE, paymentsDriver: 'mock' })
    expect(buildCsp('checkout', { ...PROD, nonce: NONCE, paymentsDriver: 'mock' })).not.toMatch(
      /stripe/,
    )
    expect(mock['frame-src']).toEqual(["'none'"])
    const stripe = cspDirectives('checkout', { ...PROD, nonce: NONCE, paymentsDriver: 'stripe' })
    expect(stripe['script-src']).toEqual(
      expect.arrayContaining(['https://js.stripe.com', 'https://*.js.stripe.com']),
    )
    expect(stripe['frame-src']).toEqual([
      'https://js.stripe.com',
      'https://*.js.stripe.com',
      'https://hooks.stripe.com',
    ])
    expect(stripe['connect-src']).toEqual(["'self'", 'https://api.stripe.com'])
    const h = contextHeaders('checkout', { ...PROD, nonce: NONCE, paymentsDriver: 'stripe' })
    expect(h['Permissions-Policy']).toContain('payment=(self "https://js.stripe.com")')
    expect(h['Cross-Origin-Opener-Policy']).toBe('same-origin-allow-popups')
    expect(h['Cache-Control']).toBe('private, no-store')
  })

  it('Token-Seiten R08/R09: no-referrer, private no-store, noindex', () => {
    expect(nonceContextForPath('/de/vertrag-widerrufen')).toEqual({
      context: 'dynamic',
      tokenPage: false,
    })
    // R08/R09 sind seit P4.17/P4.23 `live` → Nonce-Kontext `dynamic` als Token-Seite:
    expect(nonceContextForPath('/de/danke/abc')).toEqual({ context: 'dynamic', tokenPage: true })
    expect(nonceContextForPath('/en/order/abc')).toEqual({ context: 'dynamic', tokenPage: true })
    const h = contextHeaders('dynamic', { ...PROD, nonce: NONCE, tokenPage: true })
    expect(h).toMatchObject({
      'Referrer-Policy': 'no-referrer',
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    })
    // Alle dynamischen Seiten (z. B. R06 Korb, R26): `private, no-store`, aber ohne Token-Zusätze (§9.1, P4.8).
    const plain = contextHeaders('dynamic', { ...PROD, nonce: NONCE })
    expect(plain['Cache-Control']).toBe('private, no-store')
    expect(plain['Referrer-Policy']).toBeUndefined()
    expect(plain['X-Robots-Tag']).toBeUndefined()
    expect(nonceContextForPath('/de/impressum')).toBeNull()
    expect(nonceContextForPath('/de/gibt-es-nicht')).toBeNull()
  })

  it('admin: Nonce (B-01 Soll), camera=(self), noindex, no-store; api: default-src none', () => {
    expect(ADMIN_SCRIPT_POLICY).toBe('nonce')
    const h = contextHeaders('admin', { ...PROD, nonce: NONCE })
    expect(h['Content-Security-Policy']).toBe(
      `default-src 'self'; script-src 'self' 'nonce-${NONCE}' 'strict-dynamic' ${MOTION_SCRIPT_HASH}; style-src 'self' 'unsafe-inline'; ` +
        "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; " +
        "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    )
    expect(h['Permissions-Policy']).toContain('camera=(self)')
    expect(h['X-Robots-Tag']).toBe('noindex, nofollow')
    expect(h['Cache-Control']).toBe('no-store')
    expect(buildCsp('api', PROD)).toBe("default-src 'none'; frame-ancestors 'none'")
  })

  it('development: unsafe-eval, kein upgrade-insecure-requests', () => {
    const csp = buildCsp('public', { appEnv: 'development', nodeEnv: 'development' })
    expect(csp).toContain("'unsafe-eval'")
    expect(csp).not.toContain('upgrade-insecure-requests')
    expect(buildCsp('public', { appEnv: 'test' })).not.toContain('upgrade-insecure-requests')
  })

  it('next.config-Regeln: alle Pfade public, /api/* api (spätere Regel gewinnt)', () => {
    const rules = staticHeaderRules(PROD)
    expect(rules.map((r) => r.source)).toEqual([
      '/:path*',
      '/api/:path*',
      '/art/:file((?:coco-sprite|coco-extra)\.v\d+\.svg|(?:koko|fitness-still)\.v\d+\.webp|fitness-coco\.v\d+\.json)',
    ])
    expect(rules[2]!.headers).toEqual([
      { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
    ])
    const all = Object.fromEntries(rules[0]!.headers.map((h) => [h.key, h.value]))
    expect(all['Content-Security-Policy']).toBe(buildCsp('public', PROD))
    expect(all['X-Content-Type-Options']).toBe('nosniff')
    expect(rules[1]!.headers).toEqual([
      { key: 'Content-Security-Policy', value: "default-src 'none'; frame-ancestors 'none'" },
    ])
  })

  it('P2.20 Client-Hints von Payload nur für die Verwaltung (kein Critical-CH-Neustart öffentlicher Seiten)', async () => {
    const hint = 'Sec-CH-Prefers-Color-Scheme'
    const payloadRule = {
      source: '/:path*',
      headers: [
        { key: 'Accept-CH', value: hint },
        { key: 'Vary', value: hint },
        { key: 'Critical-CH', value: hint },
        { key: 'X-Powered-By', value: 'Next.js, Payload' },
      ],
    }
    const onlyHints = { source: '/x', headers: [{ key: 'Critical-CH', value: hint }] }
    const own = { source: '/y', headers: [{ key: 'Vary', value: 'Accept-Language' }] }
    const config = withoutPublicClientHints({ headers: () => [own, payloadRule, onlyHints] })
    const rules = await config.headers!()
    expect(rules).toEqual([own, { source: '/:path*', headers: [payloadRule.headers[3]] }])
    expect(withoutPublicClientHints({})).toEqual({})
    const admin = contextHeaders('admin', { ...PROD, nonce: NONCE })
    expect(admin['Critical-CH']).toBe(hint)
    expect(admin['Accept-CH']).toBe(hint)
    expect(admin.Vary).toBe(hint)
    for (const ctx of ['public', 'dynamic', 'checkout'] as const) {
      const h = contextHeaders(ctx, { ...PROD, nonce: NONCE })
      expect(Object.keys(h)).not.toContain('Critical-CH')
    }
    expect(readFileSync(path.join(ROOT, 'next.config.ts'), 'utf8')).toMatch(
      /withoutPublicClientHints\(\s*withPayload\(/,
    )
  })

  it('jede Registry-Route hat einen Kontext; R26 ist dynamic, R07 checkout', () => {
    const byId = Object.fromEntries(pageRoutes().map((r) => [r.id, r.headerContext]))
    expect(byId.R26).toBe('dynamic')
    expect(byId.R07).toBe('checkout')
    for (const id of ['R06', 'R08', 'R09', 'R10']) expect(byId[id]).toBe('dynamic')
  })
})

describe('R-131 CSP-Hosts ⊆ DIENSTE-YAML je Kontext', () => {
  it('CSP_HOSTS entspricht der DIENSTE-YAML (keine zusätzlichen Hosts, kein anderer Kontext)', () => {
    const allowed: Record<string, Record<string, string[]>> = {}
    for (const s of dienste().services) {
      for (const [ctx, directives] of Object.entries(s.csp ?? {})) {
        for (const [directive, hosts] of Object.entries(directives)) {
          allowed[ctx] ??= {}
          allowed[ctx][directive] = [...(allowed[ctx][directive] ?? []), ...hosts]
        }
      }
    }
    for (const context of CSP_CONTEXTS) {
      for (const entry of CSP_HOSTS[context]) {
        for (const [directive, hosts] of Object.entries(entry.directives)) {
          for (const host of hosts) {
            expect(
              allowed[context]?.[directive] ?? [],
              `${context} ${directive} ${host}`,
            ).toContain(host)
          }
        }
      }
    }
  })

  it('erzeugte CSP aller Kontexte (alle Treiber) enthält nur Hosts der YAML für diesen Kontext', () => {
    const yaml = dienste()
    for (const context of CSP_CONTEXTS as readonly CspContext[]) {
      for (const paymentsDriver of ['mock', 'stripe']) {
        const csp = buildCsp(context, { ...PROD, nonce: NONCE, paymentsDriver })
        for (const [directive, hosts] of Object.entries(hostsIn(csp))) {
          const allowed = yaml.services.flatMap((s) => s.csp?.[context]?.[directive] ?? [])
          for (const host of hosts)
            expect(allowed, `${context} ${directive} ${host}`).toContain(host)
        }
      }
    }
    expect(activeHosts('public', { paymentsDriver: 'stripe' })).toEqual({})
  })
})

describe('Inline-Skript pc-motion', () => {
  it('Hash in der CSP passt zum Skripttext in inlineScripts.ts', () => {
    const expected = `'sha256-${createHash('sha256').update(MOTION_SCRIPT, 'utf8').digest('base64')}'`
    expect(MOTION_SCRIPT_HASH).toBe(expected)
    expect(buildCsp('dynamic', { ...PROD, nonce: NONCE })).toContain(expected)
    // Der ausgelieferte Text ist exakt die Konstante (SiteDocument rendert sie unverändert).
    const doc = readFileSync(path.join(ROOT, 'src/components/layout/SiteDocument.tsx'), 'utf8')
    expect(doc).toContain('dangerouslySetInnerHTML={{ __html: MOTION_SCRIPT }}')
  })
})
