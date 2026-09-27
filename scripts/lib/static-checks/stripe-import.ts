import { listFiles, readText } from './files'
import type { CheckResult, StaticCheck } from './types'

// R-062 (vorbereitet): Node-Paket `stripe` nur unter src/lib/payments/stripe/,
// `@stripe/stripe-js` nur als `/pure` und nur in src/components/checkout/ (ARCHITEKTUR §2.2).
const IMPORT_RE = /(?:from\s+|import\s*\(\s*|require\s*\(\s*|import\s+)['"]([^'"]+)['"]/g

export function checkStripeImports(files: { path: string; source: string }[]): CheckResult {
  const errors: string[] = []
  for (const f of files) {
    for (const m of f.source.matchAll(IMPORT_RE)) {
      const spec = m[1] ?? ''
      if (
        (spec === 'stripe' || spec.startsWith('stripe/')) &&
        !f.path.startsWith('src/lib/payments/stripe/')
      ) {
        errors.push(`${f.path}: 'stripe' nur unter src/lib/payments/stripe/ importieren.`)
      }
      if (spec.startsWith('@stripe/stripe-js')) {
        if (spec !== '@stripe/stripe-js/pure')
          errors.push(`${f.path}: @stripe/stripe-js nur als /pure importieren.`)
        if (!f.path.startsWith('src/components/checkout/')) {
          errors.push(`${f.path}: @stripe/stripe-js nur in src/components/checkout/ (R-062).`)
        }
      }
    }
  }
  return { errors, warnings: [] }
}

export const stripeImportCheck: StaticCheck = {
  name: 'stripe-import',
  run: (root) =>
    checkStripeImports(listFiles(root, 'src').map((p) => ({ path: p, source: readText(root, p) }))),
}
