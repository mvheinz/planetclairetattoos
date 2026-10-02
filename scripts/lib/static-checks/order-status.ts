import { ORDER_STATUSES } from '../../../src/lib/enums'

import { listFiles, readText } from './files'
import type { CheckResult, StaticCheck } from './types'
import type { SourceFile } from './order-create'

// P4.25 (KONZEPT §5.2/§5.3 Grundsatz 1, Phasen-Abnahme P4): Bestellstatus kommen im Code nur aus `ORDER_STATUSES`
// (`src/lib/enums.ts`). TypeScript prüft typisierte Stellen; dieser Scan deckt die untypisierten ab – Zeichenketten in
// Status-Übergängen (`transitionOrder(…, '<status>')`, `expectedFrom: [...]`), Casts (`'<x>' as OrderStatus`), SQL auf
// `orders.status` und Status-Erwartungen der Tests an Bestellungen (`order.status … '<x>'`, `ordersOf(…)` mit
// `status: '<x>'`). Kassenstatus (`checkouts.status`, z. B. `completed`) und Stückstatus sind eigene Listen.

export const ORDER_STATUS_SCAN_DIRS = ['src', 'tests', 'scripts']
const KNOWN = new Set<string>(ORDER_STATUSES)
/** Diese Datei selbst und ihr Unit-Test (Gegenproben mit erfundenen Status). */
export const ORDER_STATUS_ALLOWED = [
  'scripts/lib/static-checks/order-status.ts',
  'tests/unit/static/order-status.unit.spec.ts',
]

const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')

const literals = (list: string) => [...list.matchAll(/['"`]([a-z_]+)['"`]/g)].map((m) => m[1]!)

/** Muster, deren Zeichenketten Bestellstatus sind (Gruppe 1 = eine Zeichenkette oder eine Liste davon). */
const ORDER_STATUS_SITES: readonly RegExp[] = [
  // transitionOrder(req, id, '<status>' …)
  /\btransitionOrder\s*\(\s*[^,()]+(?:\([^()]*\))?\s*,\s*[^,()]+(?:\([^()]*\))?\s*,\s*(['"`][a-z_]+['"`])/g,
  // expectedFrom: ['awaiting_prepayment', …] (Optionen von transitionOrder)
  /\bexpectedFrom\s*:\s*\[([^\]]*)\]/g,
  // '<x>' as OrderStatus / satisfies OrderStatus
  /(['"`][a-z_]+['"`])\s+(?:as|satisfies)\s+OrderStatus\b/g,
  // SQL: orders.status / o.status = '<x>' bzw. IN ('<x>', …)
  /\b(?:orders|o)\.status\s*(?:=|<>|!=)\s*('[a-z_]+')/g,
  /\b(?:orders|o)\.status\s+(?:NOT\s+)?IN\s*\(([^)]*)\)/gi,
  // Tests/Code: order.status === '<x>', (order|orders[0]).status).toBe('<x>')
  /\b(?:order|orders\[\d+\]|created\.order|res\.order|result\.order)\??\.status\)?\s*(?:===|!==|==|!=|\)?\.toBe\()\s*(['"`][a-z_]+['"`])/g,
  // ordersOf(…) / Bestell-Zeilen: toMatchObject([{ status: '<x>' … }]) direkt nach ordersOf
  /\bordersOf\([^)]*\)\)?\s*\)?\.toMatchObject\(\s*\[\s*\{[^}]*?\bstatus\s*:\s*(['"`][a-z_]+['"`])/g,
]

/** Unbekannte Bestellstatus einer Datei (Zeile, Wert). */
export function findUnknownOrderStatuses(source: string): { line: number; value: string }[] {
  const code = stripComments(source)
  const lineOf = (index: number) => code.slice(0, index).split('\n').length
  const out: { line: number; value: string }[] = []
  for (const re of ORDER_STATUS_SITES) {
    for (const m of code.matchAll(re)) {
      for (const value of literals(m[1]!)) {
        if (!KNOWN.has(value)) out.push({ line: lineOf(m.index), value })
      }
    }
  }
  return out.sort((a, b) => a.line - b.line)
}

export function checkOrderStatuses(files: readonly SourceFile[]): CheckResult {
  const errors: string[] = []
  for (const f of files) {
    if (ORDER_STATUS_ALLOWED.includes(f.path)) continue
    for (const { line, value } of findUnknownOrderStatuses(f.source)) {
      errors.push(
        `${f.path}:${line}: Bestellstatus „${value}“ steht nicht in ORDER_STATUSES (src/lib/enums.ts, KONZEPT §5.2).`,
      )
    }
  }
  return { errors, warnings: [] }
}

export function orderStatusInput(root: string): SourceFile[] {
  return ORDER_STATUS_SCAN_DIRS.flatMap((d) => listFiles(root, d))
    .filter((p) => /\.(ts|tsx|mts)$/.test(p))
    .map((p) => ({ path: p, source: readText(root, p) }))
}

export const orderStatusCheck: StaticCheck = {
  name: 'order-status',
  run: (root) => checkOrderStatuses(orderStatusInput(root)),
}
