import { readFileSync } from 'node:fs'
import path from 'node:path'

import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  parseServicesYaml,
  renderServicesModule,
  SERVICES_OUT,
} from '../../../scripts/legal/gen-services'
import { initialProcessorAgreements } from '@/admin/views/settings/settingsAreas'
import { ProcessorTableView } from '@/components/legal/ProcessorTableView'
import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import { SERVICES } from '@/lib/legal/services.generated'
import {
  isKnownServiceId,
  processorAgreementServices,
  processorTableRows,
  requiredProductionAgreements,
  yamlCspHosts,
} from '@/lib/legal/services'
import { CSP_CONTEXTS, CSP_HOSTS } from '@/lib/security/csp'

// P6.21 – Dienste-Daten (DIENSTE §6/§7, R-155, R-131/T-16): generierte Liste aus der YAML, Admin-Liste
// „Auftragsverarbeitung“, Auftragsverarbeiter-Tabelle unter der Datenschutzerklärung (kein Token), CSP-Abgleich.

const ROOT = path.resolve(import.meta.dirname, '../../..')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf8')
const DIENSTE = read('docs/recht/DIENSTE.md')
const yaml = parseServicesYaml(DIENSTE)

type Messages = Record<string, unknown>
const translator = (messages: Messages) => (key: string) => {
  const value = key
    .split('.')
    .reduce<unknown>(
      (o, k) => (o as Messages)?.[k],
      ((messages.legal as Messages).processors as Messages) ?? {},
    )
  if (typeof value !== 'string') throw new Error(`fehlender Text legal.processors.${key}`)
  return value
}

describe('Dienste-Daten (P6.21)', () => {
  it('R-155 Liste: generierte Datei ist aktuell (gleich dem Generator-Ergebnis aus DIENSTE.md)', async () => {
    expect(read(SERVICES_OUT)).toBe(await renderServicesModule(DIENSTE))
    expect(SERVICES.map((s) => s.id)).toEqual(yaml.services.map((s) => s.id))
  })

  it('R-155 Liste: jeder Dienst mit avv: required erscheint in der Admin-Liste „Auftragsverarbeitung“', () => {
    const required = yaml.services.filter((s) => s.avv === 'required').map((s) => s.id)
    expect(required.length).toBeGreaterThan(0)
    expect(processorAgreementServices().map((s) => s.id)).toEqual(required)
    // Formular: eine feste Zeile je Dienst, gespeicherte Werte werden über die serviceId zugeordnet
    const form = initialProcessorAgreements(
      processorAgreementServices().map((s) => ({ id: s.id, name: s.name })),
      [{ id: 'row1', serviceId: 'stripe', signedAt: '2026-11-02T11:00:00.000Z', file: 7 }],
    )
    expect(form.rows.map((r) => r.serviceId)).toEqual(required)
    expect(form.rows.find((r) => r.serviceId === 'stripe')).toMatchObject({
      id: 'row1',
      signedAt: '2026-11-02',
      file: '7',
    })
    // Gate R-210 (P10): Teilmenge mit production: true
    for (const s of requiredProductionAgreements()) expect(required).toContain(s.id)
    expect(isKnownServiceId('stripe')).toBe(true)
    expect(isKnownServiceId('mailchimp')).toBe(false)
  })

  it('R-155 Tabelle: jeder Dienst mit production: true, unabhängig von Token und AVV-Stand', () => {
    const rows = processorTableRows([])
    const production = yaml.services.filter((s) => s.production)
    expect(rows.map((r) => r.id)).toEqual(production.map((s) => s.id))
    for (const s of yaml.services.filter(
      (x) => x.role === 'processor' || x.role === 'processorAndController',
    )) {
      if (s.production) expect(rows.map((r) => r.id)).toContain(s.id)
    }
    expect(rows.every((r) => !r.agreementSigned)).toBe(true)
    const signed = processorTableRows([
      { serviceId: 'vercel', signedAt: '2026-11-01T00:00:00.000Z' },
      { serviceId: 'neon', signedAt: null },
    ])
    expect(signed.find((r) => r.id === 'vercel')!.agreementSigned).toBe(true)
    expect(signed.find((r) => r.id === 'neon')!.agreementSigned).toBe(false)
  })

  it('R-155 Tabelle DE/EN: Spalten Name, Rolle, Sitz, Drittland; jede Zeile mit Sitz in der Sprache', () => {
    const rows = processorTableRows([])
    for (const [locale, messages] of [
      ['de', de],
      ['en', en],
    ] as const) {
      const html = renderToStaticMarkup(
        React.createElement(ProcessorTableView, {
          rows,
          t: translator(messages as unknown as Messages),
          locale,
        }),
      )
      expect(html.match(/<th scope="col">/g)).toHaveLength(4)
      for (const r of rows) {
        expect(html).toContain(`data-service="${r.id}"`)
        expect(html).toContain(r.seat[locale].replace(/&/g, '&amp;'))
      }
      expect(html).not.toMatch(/\{\{/)
    }
  })

  it('T-16 R-131 CSP-Hosts je Kontext ⊆ Hosts der YAML (über die generierte Liste)', () => {
    for (const context of CSP_CONTEXTS) {
      const allowed = yamlCspHosts(context)
      for (const entry of CSP_HOSTS[context]) {
        for (const hosts of Object.values(entry.directives)) {
          for (const h of hosts) expect(allowed.has(h), `${context} ${h}`).toBe(true)
        }
      }
    }
  })

  it('DIENSTE vermerkt pc-motion und den Versand ohne Dienstleister-Schnittstelle', () => {
    expect(DIENSTE).toContain("localStorage['pc-motion']")
    expect(DIENSTE).toContain('CARRIER_DRIVER=manual')
    expect(yaml.services.find((s) => s.id === 'dhl')?.driverEnv).toBe('CARRIER_DRIVER')
  })

  it('R-156 VVT deckt alle Verarbeitungen aus KANZLEI-BRIEFING §11.4 und alle Dienste mit production: true ab', () => {
    const vvt = read('docs/recht/VVT.md')
    const briefing = read('docs/recht/KANZLEI-BRIEFING.md')
    const section = briefing.slice(
      briefing.indexOf('### 11.4 Verarbeitungen'),
      briefing.indexOf('### 11.5'),
    )
    const numbers = [...section.matchAll(/^\| (V\d+) \|/gm)].map((m) => m[1]!)
    expect(numbers.length).toBeGreaterThanOrEqual(19)
    for (const n of numbers) expect(vvt, n).toMatch(new RegExp(`^\\| ${n} \\|`, 'm'))
    for (const s of yaml.services.filter((x) => x.production)) {
      expect(vvt, s.id).toContain(`\`${s.id}\``)
    }
    for (const L of ['L-01', 'L-03', 'L-05', 'L-06', 'L-08', 'L-10', 'L-17', 'L-23']) {
      expect(vvt).toContain(L)
    }
    expect(vvt).toContain('R-136')
  })

  it('Generator lehnt fehlerhafte YAML ab (unbekannte Rolle, doppelte id)', () => {
    const bad = DIENSTE.replace('role: processorAndController', 'role: partner')
    expect(() => parseServicesYaml(bad)).toThrow()
    const dup = DIENSTE.replace('  - id: neon', '  - id: vercel')
    expect(() => parseServicesYaml(dup)).toThrow(/doppelte id/)
  })
})
