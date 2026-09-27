import { describe, expect, it } from 'vitest'

import {
  evaluateGenerated,
  findAnyTypes,
  GENERATED_FILES,
} from '../../../scripts/lib/static-checks/generated'
import { stripAnyTsTypes } from '@/lib/payload/typesSchema'

// P1.32: check:static erzeugt Typen und Import-Map neu und meldet Abweichungen; DM-P1-06: keine `any`-Typen.

describe('check:static generated-files (P1.32)', () => {
  it('prüft payload-types.ts und importMap.js', () => {
    expect(GENERATED_FILES.map((g) => g.file)).toEqual([
      'src/payload-types.ts',
      'src/app/(payload)/admin/importMap.js',
    ])
  })

  it('unveränderte Dateien ohne any sind grün', () => {
    const r = evaluateGenerated([
      { file: 'src/payload-types.ts', before: 'a: string;', after: 'a: string;' },
      { file: 'src/app/(payload)/admin/importMap.js', before: 'x', after: 'x' },
    ])
    expect(r.errors).toEqual([])
  })

  it('abweichender Stand und Erzeugungsfehler sind rot', () => {
    const r = evaluateGenerated([
      { file: 'src/payload-types.ts', before: 'a: string;', after: 'a: number;' },
      { file: 'src/app/(payload)/admin/importMap.js', before: 'x', after: null, error: 'boom' },
    ])
    expect(r.errors).toHaveLength(2)
    expect(r.errors[0]).toMatch(/nicht aktuell/)
    expect(r.errors[1]).toMatch(/boom/)
  })

  it('DM-P1-06 any in den erzeugten Typen ist rot', () => {
    expect(findAnyTypes('type: any;\nlist: any[];\n// any im Kommentar\nname: string;')).toEqual([
      1, 2,
    ])
    const r = evaluateGenerated([
      { file: 'src/payload-types.ts', before: 'type: any;', after: 'type: any;' },
    ])
    expect(r.errors[0]).toMatch(/DM-P1-06/)
  })

  it('DM-P1-06 stripAnyTsTypes entfernt tsType any aus dem JSON-Schema', () => {
    const schema = {
      properties: {
        type: { type: 'string', tsType: 'any' },
        other: { tsType: 'any' },
        keep: { tsType: 'SomeType' },
      },
    }
    expect(stripAnyTsTypes(schema)).toEqual({
      properties: {
        type: { type: 'string' },
        other: { tsType: 'unknown' },
        keep: { tsType: 'SomeType' },
      },
    })
  })
})
