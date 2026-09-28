import { listFiles, readText } from './files'
import type { CheckResult, StaticCheck } from './types'

// Geldanzeige (ARCHITEKTUR §15.4, DESIGN §4.4): Beträge formatiert ausschließlich `formatMoney` aus `src/lib/money.ts`.
// In Shop-Logik, Komponenten und öffentlichen Seiten gibt es weder `toFixed` noch `Intl.NumberFormat` mit `currency`.

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

export function moneyUsageInput(root: string): SourceFile[] {
  return listFiles(root, 'src').map((p) => ({ path: p, source: readText(root, p) }))
}

export const moneyUsageCheck: StaticCheck = {
  name: 'money-usage',
  run: (root) => checkMoneyFormatting(moneyUsageInput(root)),
}
