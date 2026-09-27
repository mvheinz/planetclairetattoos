import { describe, expect, it } from 'vitest'

import { checkVersions } from '../../../scripts/check-versions'

const base = {
  dependencies: {
    payload: '3.90.2',
    '@payloadcms/next': '3.90.2',
    '@payloadcms/ui': '3.90.2',
    next: '16.3.6',
    react: '19.2.6',
    'react-dom': '19.2.6',
  },
  devDependencies: { 'eslint-config-next': '16.3.6' },
}
const before = new Date('2026-09-27T10:00:00+02:00')
const after = new Date('2026-09-30T08:00:00+02:00')

describe('check:versions (ARCHITEKTUR §1.3)', () => {
  it('AK-A-1-01 gültiger Stand ergibt keine Fehler', () => {
    expect(checkVersions(base, before)).toEqual({ errors: [], warnings: [] })
  })

  it('AK-A-1-01 abweichendes @payloadcms/*-Paket ist ein Fehler', () => {
    const pkg = { ...base, dependencies: { ...base.dependencies, '@payloadcms/ui': '3.90.1' } }
    expect(checkVersions(pkg, before).errors.join()).toContain('@payloadcms/ui')
  })

  it('AK-A-1-01 ^ oder ~ bei Laufzeit-Abhängigkeiten ist ein Fehler', () => {
    const pkg = {
      ...base,
      dependencies: { ...base.dependencies, graphql: '^16.8.1', zod: '~4.0.0' },
    }
    expect(checkVersions(pkg, before).errors).toHaveLength(2)
  })

  it('AK-A-1-01 eslint-config-next ≠ next und react ≠ react-dom sind Fehler', () => {
    const pkg = {
      dependencies: { ...base.dependencies, 'react-dom': '19.2.5' },
      devDependencies: { 'eslint-config-next': '16.3.5' },
    }
    expect(checkVersions(pkg, before).errors).toHaveLength(2)
  })

  it('AK-A-1-02 vor dem Stichtag keine Warnung für next < 16.3.7', () => {
    expect(checkVersions(base, before).warnings).toEqual([])
  })

  it('AK-A-1-02 ab dem 30.09.2026 Warnung (kein Fehler) für next < 16.3.7', () => {
    const r = checkVersions(base, after)
    expect(r.errors).toEqual([])
    expect(r.warnings.join()).toContain('16.3.7')
  })

  it('AK-A-1-02 mit next ≥ 16.3.7 keine Warnung', () => {
    const pkg = {
      dependencies: { ...base.dependencies, next: '16.3.8' },
      devDependencies: { 'eslint-config-next': '16.3.8' },
    }
    expect(checkVersions(pkg, after)).toEqual({ errors: [], warnings: [] })
  })
})
