import { listFiles, readText } from './files'
import type { CheckResult, StaticCheck } from './types'

// Geldanzeige (ARCHITEKTUR §15.4, DESIGN §4.4): Beträge formatiert ausschließlich `formatMoney` aus `src/lib/money.ts`.
// In Shop-Logik, Komponenten und öffentlichen Seiten gibt es weder `toFixed` noch `Intl.NumberFormat` mit `currency`.
// R-030: Jede Preisausgabe läuft über die Preis-Komponenten – `formatMoney` erscheint außerhalb von `src/lib/` nur in
// `PriceTag`, `PriceNote` und `MoneyAmount`, innerhalb von `src/lib/` nur in Mail, PDF, Belegen und Shop-Logik.

/** Ordner, in denen eigene Geld-Formatierung verboten ist (P3.1). */
export const MONEY_FORMAT_SCAN_DIRS = ['src/lib/shop', 'src/components', 'src/app/(frontend)']

const TO_FIXED = /\.toFixed\s*\(/
/** `Intl.NumberFormat(…, { … currency … })` – auch über mehrere Zeilen (bis zur schließenden Klammer). */
const CURRENCY_FORMAT = /(?:Intl\.)?NumberFormat\s*\([^)]*\bcurrency\b/s

export interface SourceFile {
  path: string
  source: string
}

export function checkMoneyFormatting(files: readonly SourceFile[]): CheckResult {
  const errors: string[] = []
  for (const f of files) {
    if (!MONEY_FORMAT_SCAN_DIRS.some((d) => f.path.startsWith(`${d}/`))) continue
    if (TO_FIXED.test(f.source))
      errors.push(`${f.path}: toFixed verboten – Beträge nur mit formatMoney.`)
    if (CURRENCY_FORMAT.test(f.source))
      errors.push(
        `${f.path}: Intl.NumberFormat mit currency verboten – nur formatMoney (src/lib/money.ts).`,
      )
  }
  return { errors, warnings: [] }
}

/** Einzige Dateien außerhalb von `src/lib/`, die `formatMoney` verwenden dürfen (R-030). */
export const FORMAT_MONEY_COMPONENTS = [
  'src/components/shop/PriceTag.tsx',
  'src/components/shop/PriceNote.tsx',
  'src/components/shop/MoneyAmount.tsx',
]
/** Bereiche in `src/lib/`, die `formatMoney` verwenden dürfen (plus die Definition in `src/lib/money.ts`). */
export const FORMAT_MONEY_LIB_DIRS = [
  'src/lib/email/',
  'src/lib/pdf/',
  'src/lib/invoices/',
  'src/lib/shop/',
  // Umsatz-Wächter: Meldungstexte der Verwaltung (A09, KONZEPT §8.4)
  'src/lib/revenue/',
  // Vorlagen fürs Mailprogramm (P5.27, KONZEPT §7.13) – Mailtexte wie unter `src/lib/email/`
  'src/lib/legal/templates.ts',
]

/** Quelltext ohne Kommentare (Zeilen- und Blockkommentare), damit Erwähnungen in Doku-Kommentaren nicht zählen. */
const stripComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')

export function isFormatMoneyAllowed(path: string): boolean {
  if (path === 'src/lib/money.ts') return true
  if (path.startsWith('src/lib/')) return FORMAT_MONEY_LIB_DIRS.some((d) => path.startsWith(d))
  return FORMAT_MONEY_COMPONENTS.includes(path)
}

/** R-030: Aufrufstellen von `formatMoney` (jede Verwendung des Bezeichners zählt, auch Import und Umbenennung). */
export function checkFormatMoneyUsage(files: readonly SourceFile[]): CheckResult {
  const errors: string[] = []
  for (const f of files) {
    if (!f.path.startsWith('src/') || isFormatMoneyAllowed(f.path)) continue
    if (/\bformatMoney\b/.test(stripComments(f.source))) {
      errors.push(
        `${f.path}: formatMoney nur in PriceTag, PriceNote, MoneyAmount bzw. src/lib/{email,pdf,invoices,shop} (R-030).`,
      )
    }
  }
  return { errors, warnings: [] }
}

export function moneyUsageInput(root: string): SourceFile[] {
  return listFiles(root, 'src').map((p) => ({ path: p, source: readText(root, p) }))
}

export const moneyUsageCheck: StaticCheck = {
  name: 'money-usage',
  run: (root) => {
    const files = moneyUsageInput(root)
    const a = checkMoneyFormatting(files)
    const b = checkFormatMoneyUsage(files)
    return { errors: [...a.errors, ...b.errors], warnings: [...a.warnings, ...b.warnings] }
  },
}
