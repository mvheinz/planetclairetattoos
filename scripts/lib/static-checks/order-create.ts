import { listFiles, readText } from './files'
import type { CheckResult, StaticCheck } from './types'

// P4.1 (DATENMODELL §6.8, KONZEPT §5.3 O1/O2/O19): Bestellungen entstehen nur in `createOrderFromCheckout()`.
// Außerhalb dieser Datei und des Seeds legt kein Code `orders` an – weder über die Local API
// (`payload.create({ collection: 'orders' … })`, auch `payload.db.create`) noch per SQL (`INSERT INTO orders`).

export const ORDER_CREATE_SCAN_DIRS = ['src', 'scripts']
export const ORDER_CREATE_ALLOWED = ['src/lib/commerce/createOrderFromCheckout.ts']
export const ORDER_CREATE_ALLOWED_DIRS = ['src/lib/seed/']

export interface SourceFile {
  path: string
  source: string
}

/** Quelltext ohne Kommentare, damit Erwähnungen in Doku-Kommentaren nicht zählen. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')

const CREATE_CALL = /\.create\s*\(/g
const ORDERS_COLLECTION = /\bcollection\s*:\s*['"`]orders['"`]/
const SQL_INSERT = /\binsert\s+into\s+(?:"?public"?\s*\.\s*)?"?orders"?(?![\w"])/i
const DRIZZLE_INSERT = /\.insert\s*\(\s*orders\s*\)/

/** Argumente eines Aufrufs ab der öffnenden Klammer (ausgeglichene Klammern, Zeichenketten grob übersprungen). */
function callArguments(source: string, open: number): string {
  let depth = 0
  let quote: string | null = null
  for (let i = open; i < source.length; i++) {
    const c = source[i]!
    if (quote) {
      if (c === '\\') i++
      else if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') quote = c
    else if (c === '(') depth++
    else if (c === ')' && --depth === 0) return source.slice(open, i + 1)
  }
  return source.slice(open)
}

export function isOrderCreateAllowed(path: string): boolean {
  return (
    ORDER_CREATE_ALLOWED.includes(path) || ORDER_CREATE_ALLOWED_DIRS.some((d) => path.startsWith(d))
  )
}

/** Stellen, an denen `orders` angelegt werden (Zeilennummern 1-basiert). */
export function findOrderCreates(source: string): number[] {
  const code = stripComments(source)
  const lines: number[] = []
  const lineOf = (index: number) => code.slice(0, index).split('\n').length
  for (const m of code.matchAll(CREATE_CALL)) {
    const open = m.index + m[0].length - 1
    // Streng: jede Angabe `collection: 'orders'` in den Argumenten eines `.create(…)` zählt.
    if (ORDERS_COLLECTION.test(callArguments(code, open))) lines.push(lineOf(m.index))
  }
  for (const re of [SQL_INSERT, DRIZZLE_INSERT]) {
    const global = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
    for (const m of code.matchAll(global)) lines.push(lineOf(m.index))
  }
  return [...new Set(lines)].sort((a, b) => a - b)
}

export function checkOrderCreates(files: readonly SourceFile[]): CheckResult {
  const errors: string[] = []
  for (const f of files) {
    if (isOrderCreateAllowed(f.path)) continue
    for (const line of findOrderCreates(f.source)) {
      errors.push(
        `${f.path}:${line}: Bestellungen nur über createOrderFromCheckout() anlegen (P4.1, KONZEPT §5.3).`,
      )
    }
  }
  return { errors, warnings: [] }
}

export function orderCreateInput(root: string): SourceFile[] {
  return ORDER_CREATE_SCAN_DIRS.flatMap((d) => listFiles(root, d)).map((p) => ({
    path: p,
    source: readText(root, p),
  }))
}

export const orderCreateCheck: StaticCheck = {
  name: 'order-create',
  run: (root) => checkOrderCreates(orderCreateInput(root)),
}
