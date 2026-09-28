import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  MESSAGE_NAMESPACES,
  checkI18nParity,
  loadMessages,
} from '../../../scripts/lib/static-checks/i18n-parity'

const root = path.resolve(import.meta.dirname, '../../..')

// T-06 / EK-09 (ARCHITEKTUR §7.4): i18n-Parität.
describe('i18n-Parität (T-06)', () => {
  it('T-06 de.json und en.json: gleiche Schlüssel, keine leeren Werte, kein lorem', () => {
    const result = checkI18nParity(loadMessages(root))
    expect(result.errors).toEqual([])
  })

  it('T-06 alle Namensräume vorhanden', () => {
    const { de, en } = loadMessages(root) as Record<string, Record<string, unknown>>
    for (const ns of MESSAGE_NAMESPACES) {
      expect(de).toHaveProperty(ns)
      expect(en).toHaveProperty(ns)
    }
  })

  it('T-06 erkennt fehlende Schlüssel, leere Werte und lorem', () => {
    const base = Object.fromEntries(MESSAGE_NAMESPACES.map((ns) => [ns, { a: 'x' }]))
    const r = checkI18nParity({
      de: { ...base, home: { title: 'Hallo', intro: 'Lorem ipsum' } },
      en: { ...base, home: { title: '  ' } },
    })
    expect(r.errors.join('\n')).toMatch(/en\.json: Schlüssel „home\.intro“ fehlt/)
    expect(r.errors.join('\n')).toMatch(/de\.json: „home\.intro“ enthält „lorem“/)
    expect(r.errors.join('\n')).toMatch(/en\.json: „home\.title“ ist leer/)
  })

  it('„Vertrag widerrufen“ exakt vorhanden (R-090)', () => {
    const { de, en } = loadMessages(root) as Record<string, Record<string, Record<string, string>>>
    expect(de!.footer!.withdraw).toBe('Vertrag widerrufen')
    expect(en!.footer!.withdraw).toBe('Withdraw from contract here')
  })
})
