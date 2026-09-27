import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

import * as E from '@/lib/enums'

// DM-P1-05 (DATENMODELL §15, ARCHITEKTUR §2.2): `src/lib/enums.ts` ist die einzige Quelle für Enum-Werte. In
// `src/collections/*` und `src/globals/*` dürfen Auswahlfelder (`select`/`radio`) ihre Optionen nicht als
// String-Literale von Enum-Werten aufzählen, und keine Liste darf ein Enum nachbauen. Vergleiche und Voreinstellungen
// mit einzelnen Werten sind erlaubt – sie prüft TypeScript gegen die aus den Enums erzeugten Typen (DM-P1-06).
// Auslegung und Änderungsweg: docs/OFFENE-PUNKTE.md §5 (P1.32).

const ROOT = path.resolve(__dirname, '../../..')
const SCANNED_DIRS = ['src/collections', 'src/globals']

const enumSets = Object.entries(E)
  .filter(([, v]) => Array.isArray(v))
  .map(([name, v]) => ({ name, values: new Set((v as readonly unknown[]).map(String)) }))

function listTs(dir: string): string[] {
  const abs = path.join(ROOT, dir)
  return readdirSync(abs).flatMap((name) => {
    const rel = `${dir}/${name}`
    if (statSync(path.join(ROOT, rel)).isDirectory()) return listTs(rel)
    return /\.tsx?$/.test(name) ? [rel] : []
  })
}

const propName = (p: ts.ObjectLiteralElementLike): string | undefined =>
  p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : undefined

function prop(obj: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
  const p = obj.properties.find((x) => propName(x) === name)
  return p && ts.isPropertyAssignment(p) ? p.initializer : undefined
}

const stringValue = (e: ts.Expression): string | undefined =>
  ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e) ? e.text : undefined

/** Verstöße gegen DM-P1-05 in einer Quelldatei (`datei:zeile Meldung`). */
export function findEnumLiteralViolations(file: string, source: string): string[] {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const out: string[] = []
  const at = (node: ts.Node, msg: string) =>
    out.push(`${file}:${sf.getLineAndCharacterOfPosition(node.getStart()).line + 1} ${msg}`)

  const visit = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const type = prop(node, 'type')
      const options = prop(node, 'options')
      if (
        type &&
        ['select', 'radio'].includes(stringValue(type) ?? '') &&
        options &&
        ts.isArrayLiteralExpression(options)
      ) {
        const values = options.elements.map((el) => {
          const direct = stringValue(el as ts.Expression)
          if (direct !== undefined) return direct
          const v = ts.isObjectLiteralExpression(el) ? prop(el, 'value') : undefined
          return v ? stringValue(v) : undefined
        })
        const literal = values.filter((v): v is string => v !== undefined)
        // Eine Optionsliste aus Werten eines Enums (≥ 2 Werte oder das ganze Enum) gehört nach src/lib/enums.ts.
        // Eigene Einzel-Listen laut DATENMODELL (z. B. `role: admin`, `enhance: auto|off`) bleiben erlaubt.
        const source = enumSets.find(
          (e) =>
            literal.length > 0 &&
            literal.every((v) => e.values.has(v)) &&
            (literal.length >= 2 || e.values.size === literal.length),
        )
        if (source) {
          at(
            options,
            `Optionen ${literal.map((v) => `„${v}“`).join(', ')} als Literale – aus ${source.name} (src/lib/enums.ts) nehmen`,
          )
        }
      }
    }
    if (ts.isArrayLiteralExpression(node) && node.elements.length >= 2) {
      const values = node.elements.map((el) => stringValue(el as ts.Expression))
      if (values.every((v): v is string => v !== undefined)) {
        const set = new Set(values)
        const copy = enumSets.find(
          (e) => e.values.size === set.size && [...set].every((v) => e.values.has(v)),
        )
        if (copy)
          at(node, `Liste wiederholt das Enum ${copy.name} – aus src/lib/enums.ts importieren`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

describe('DM-P1-05 Enum-Werte nur aus src/lib/enums.ts', () => {
  it('DM-P1-05 Collections und Globals zählen keine Enum-Werte als Literale auf', () => {
    const files = SCANNED_DIRS.flatMap(listTs)
    expect(files.length).toBeGreaterThan(20)
    const violations = files.flatMap((f) =>
      findEnumLiteralViolations(f, readFileSync(path.join(ROOT, f), 'utf8')),
    )
    expect(violations).toEqual([])
  })

  it('DM-P1-05 Gegenprobe: Literal-Optionen und nachgebaute Enums werden erkannt', () => {
    const bad = `
      export const a = { name: 'status', type: 'select', options: ['draft', { label: 'x', value: 'available' }] }
      export const b = ['keramik', 'textil', 'cap', 'zeichnung', 'schmuck', 'sonstiges']
    `
    const found = findEnumLiteralViolations('bad.ts', bad)
    expect(found).toHaveLength(2)
    expect(found[0]).toMatch(/„draft“, „available“ als Literale – aus PRODUCT_STATUSES/)
    expect(found[1]).toMatch(/wiederholt das Enum PRODUCT_CATEGORIES/)
    const good = `
      import { PRODUCT_STATUSES } from '@/lib/enums'
      export const a = { name: 'status', type: 'select', defaultValue: 'draft',
        options: enumOptions(PRODUCT_STATUSES, ENUM_LABELS.PRODUCT_STATUSES) }
      export const role = { name: 'role', type: 'select', options: [{ label: 'Verwaltung', value: 'admin' }] }
      export const enhance = { type: 'select', options: [{ label: 'an', value: 'auto' }, { label: 'aus', value: 'off' }] }
      export const b = data.status === 'draft' ? ['textil', 'cap'] : []
    `
    expect(findEnumLiteralViolations('good.ts', good)).toEqual([])
  })
})
