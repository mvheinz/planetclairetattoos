import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  checkFormatMoneyUsage,
  checkMoneyFormatting,
  isFormatMoneyAllowed,
  moneyUsageInput,
} from '../../../scripts/lib/static-checks/money-usage'

// P3.3 R-030 (ARCHITEKTUR §15.4): Aufrufstellen von `formatMoney` – außerhalb von `src/lib/` nur in PriceTag,
// PriceNote, MoneyAmount; innerhalb nur in src/lib/{email,pdf,invoices,shop} (Regel `money-usage` in check:static).

const ROOT = path.resolve(import.meta.dirname, '../../..')

describe('formatMoney-Aufrufstellen (R-030)', () => {
  it('R-030 der aktuelle Quellbaum hält die Regel ein', () => {
    const files = moneyUsageInput(ROOT)
    expect(checkFormatMoneyUsage(files).errors).toEqual([])
    expect(checkMoneyFormatting(files).errors).toEqual([])
    // Die Preis-Komponenten nutzen formatMoney tatsächlich (die Regel ist nicht leer).
    const users = files.filter((f) => /\bformatMoney\s*\(/.test(f.source)).map((f) => f.path)
    expect(users).toEqual(
      expect.arrayContaining([
        'src/components/shop/PriceNote.tsx',
        'src/components/shop/MoneyAmount.tsx',
      ]),
    )
  })

  it('R-030 erlaubte und verbotene Stellen', () => {
    for (const p of [
      'src/components/shop/PriceTag.tsx',
      'src/components/shop/PriceNote.tsx',
      'src/components/shop/MoneyAmount.tsx',
      'src/lib/email/templates/M01.tsx',
      'src/lib/pdf/invoice.tsx',
      'src/lib/invoices/create.ts',
      'src/lib/shop/shippingTable.ts',
      'src/lib/money.ts',
    ]) {
      expect(isFormatMoneyAllowed(p), p).toBe(true)
    }
    for (const p of [
      'src/components/shop/ProductCard.tsx',
      'src/components/checkout/Summary.tsx',
      'src/app/(frontend)/[locale]/shop/page.tsx',
      'src/lib/commerce/cart.ts',
      'src/collections/hooks/products.ts',
      'src/admin/views/Today.tsx',
    ]) {
      expect(isFormatMoneyAllowed(p), p).toBe(false)
    }
  })

  it('R-030 Verstöße werden erkannt (Aufruf, Import, Umbenennung) – Kommentare zählen nicht', () => {
    const res = checkFormatMoneyUsage([
      { path: 'src/components/shop/ProductCard.tsx', source: 'const p = formatMoney(4500, "de")' },
      {
        path: 'src/lib/commerce/cart.ts',
        source: "import { formatMoney as fm } from '@/lib/money'",
      },
      {
        path: 'src/components/shop/Other.tsx',
        source: '// Preise nur über formatMoney(…) in PriceNote',
      },
      { path: 'src/components/shop/Doc.tsx', source: '/* formatMoney(1) */ export const x = 1' },
      { path: 'src/components/shop/PriceNote.tsx', source: 'formatMoney(1, "de")' },
      { path: 'tests/unit/x.ts', source: 'formatMoney(1, "de")' },
    ])
    expect(res.errors).toHaveLength(2)
    expect(res.errors[0]).toMatch(/^src\/components\/shop\/ProductCard\.tsx: /)
    expect(res.errors[1]).toMatch(/^src\/lib\/commerce\/cart\.ts: /)
  })
})
