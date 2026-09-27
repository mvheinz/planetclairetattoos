import { describe, expect, it } from 'vitest'

import * as E from '@/lib/enums'
import { ENUM_LABELS, PUBLIC_ENUMS, type EnumName } from '@/lib/enumLabels'

const enumArrays = Object.entries(E).filter(([, v]) => Array.isArray(v)) as [
  string,
  readonly (string | number)[],
][]

describe('Enums und Labels (DATENMODELL §4, DM-P1-05)', () => {
  it('jedes Enum-Array hat eine Label-Tabelle', () => {
    const missing = enumArrays.map(([k]) => k).filter((k) => !(k in ENUM_LABELS))
    expect(missing).toEqual([])
  })

  it('jeder Enum-Wert hat ein DE-Label', () => {
    const missing: string[] = []
    for (const [name, values] of enumArrays) {
      const labels = ENUM_LABELS[name as EnumName] as Record<string, { de?: string }>
      for (const v of values) if (!labels[String(v)]?.de) missing.push(`${name}.${v}`)
    }
    expect(missing).toEqual([])
  })

  it('öffentliche Enums haben zusätzlich ein EN-Label', () => {
    const missing: string[] = []
    for (const name of PUBLIC_ENUMS) {
      const values = (E as unknown as Record<string, readonly string[]>)[name]!
      const labels = ENUM_LABELS[name] as Record<string, { en?: string }>
      for (const v of values) if (!labels[v]?.en) missing.push(`${name}.${v}`)
    }
    expect(missing).toEqual([])
  })

  it('Label-Tabellen enthalten keine fremden Werte', () => {
    for (const [name, values] of enumArrays) {
      const keys = Object.keys(ENUM_LABELS[name as EnumName])
      expect(keys.sort()).toEqual(values.map(String).sort())
    }
  })

  it('TEXTILE_FIBERS hat 64 Werte, ORDER_STATUSES 13, keine GB/US', () => {
    expect(E.TEXTILE_FIBERS).toHaveLength(64)
    expect(E.ORDER_STATUSES).toHaveLength(13)
    expect(E.COUNTRY_CODES).not.toContain('GB' as never)
    expect(E.COUNTRY_CODES).not.toContain('US' as never)
  })
})
