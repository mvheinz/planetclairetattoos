import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

import { buildCsp, CSP_CONTEXTS, CSP_HOSTS, cspDirectives } from '@/lib/security/csp'
import { contextHeaders } from '@/lib/security/headers'

// P4.5 – Kassen-CSP (ARCHITEKTUR §8.1, §3.5; R-131, CLAUDE.md §6): Stripe-Hosts stehen exakt wie in der DIENSTE-YAML
// und nur im Kontext `checkout` bei `PAYMENTS_DRIVER=stripe`; mit `mock` enthält die Kassen-CSP keinen Stripe-Host.
// Allgemeine Header je Kontext prüft `headers.unit.spec.ts` (P2.12).

const ROOT = path.resolve(import.meta.dirname, '../../..')
const PROD = { appEnv: 'production' as const, nodeEnv: 'production', nonce: 'dGVzdC1ub25jZQ==' }

interface Service {
  id: string
  driverEnv?: string
  csp: Record<string, Record<string, string[]>>
}
function services(): Service[] {
  const md = readFileSync(path.join(ROOT, 'docs/recht/DIENSTE.md'), 'utf8')
  const blocks = [...md.matchAll(/```yaml\n([\s\S]*?)```/g)]
  expect(blocks).toHaveLength(1)
  return (parse(blocks[0]![1]!) as { services: Service[] }).services
}

/** Fremd-Hosts je Direktive einer erzeugten CSP. */
function hostsOf(csp: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const part of csp.split(';')) {
    const [name, ...values] = part.trim().split(/\s+/)
    const hosts = values.filter((v) => /^https?:\/\//.test(v) || v.includes('*.'))
    if (name && hosts.length) out[name] = hosts
  }
  return out
}

describe('T-16 Kassen-CSP (P4.5)', () => {
  it('T-16 R-131 checkout mit stripe: Hosts je Direktive exakt die der DIENSTE-YAML (Dienst stripe)', () => {
    const stripe = services().find((s) => s.id === 'stripe')!
    expect(stripe.driverEnv).toBe('PAYMENTS_DRIVER')
    expect(Object.keys(stripe.csp)).toEqual(['checkout'])
    const csp = buildCsp('checkout', { ...PROD, paymentsDriver: 'stripe' })
    expect(hostsOf(csp)).toEqual(stripe.csp.checkout)
    const entry = CSP_HOSTS.checkout.find((e) => e.service === 'stripe')!
    expect(entry.driver).toEqual({ env: 'PAYMENTS_DRIVER', value: 'stripe' })
    expect(entry.directives).toEqual(stripe.csp.checkout)
  })

  it('T-16 checkout mit mock: kein Stripe-Host, frame-src none, connect-src nur self', () => {
    for (const paymentsDriver of ['mock', undefined]) {
      const csp = buildCsp('checkout', { ...PROD, paymentsDriver })
      expect(csp).not.toMatch(/stripe/i)
      expect(hostsOf(csp)).toEqual({})
      const d = cspDirectives('checkout', { ...PROD, paymentsDriver })
      expect(d['frame-src']).toEqual(["'none'"])
      expect(d['connect-src']).toEqual(["'self'"])
    }
  })

  it('T-16 R-131 Stripe nur auf der Kasse: kein anderer Kontext enthält einen Stripe-Host (auch mit stripe)', () => {
    for (const context of CSP_CONTEXTS.filter((c) => c !== 'checkout')) {
      expect(buildCsp(context, { ...PROD, paymentsDriver: 'stripe' }), context).not.toMatch(
        /stripe/i,
      )
      expect(CSP_HOSTS[context], context).toEqual([])
    }
    // Kein Dienst der YAML darf einen Stripe-Host für einen anderen Kontext freigeben.
    for (const s of services()) {
      for (const [ctx, directives] of Object.entries(s.csp ?? {})) {
        if (ctx !== 'checkout')
          expect(JSON.stringify(directives), `${s.id} ${ctx}`).not.toMatch(/stripe/)
      }
    }
  })

  it('Kasse: Permissions-Policy payment=(self "https://js.stripe.com") nur mit stripe; COOP same-origin-allow-popups', () => {
    const withStripe = contextHeaders('checkout', { ...PROD, paymentsDriver: 'stripe' })
    expect(withStripe['Permissions-Policy']).toContain('payment=(self "https://js.stripe.com")')
    expect(withStripe['Cross-Origin-Opener-Policy']).toBe('same-origin-allow-popups')
    const withMock = contextHeaders('checkout', { ...PROD, paymentsDriver: 'mock' })
    expect(withMock['Permissions-Policy']).toContain('payment=(self)')
    expect(withMock['Permissions-Policy']).not.toMatch(/stripe/)
    expect(withMock['Cross-Origin-Opener-Policy']).toBe('same-origin-allow-popups')
    for (const context of ['dynamic', 'admin'] as const) {
      const h = contextHeaders(context, { ...PROD, paymentsDriver: 'stripe' })
      expect(h['Permissions-Policy'] ?? 'payment=()', context).not.toMatch(/stripe/)
      expect(h['Cross-Origin-Opener-Policy'], context).toBeUndefined()
    }
  })
})
