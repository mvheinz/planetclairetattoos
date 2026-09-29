import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  checkStripeImports,
  stripeImportCheck,
} from '../../../scripts/lib/static-checks/stripe-import'

// P4.5 – statischer Scan R-062 (ARCHITEKTUR §2.2, §3.5; CLAUDE.md §6 „Stripe-Skripte nur auf der Kasse“): das
// Node-Paket `stripe` nur unter src/lib/payments/stripe/, `@stripe/stripe-js` nur als `/pure` und nur unter
// src/components/checkout/.

const ROOT = path.resolve(import.meta.dirname, '../../..')
const check = (p: string, source: string) => checkStripeImports([{ path: p, source }]).errors

describe('R-062 Stripe-Importe (check:static stripe-import)', () => {
  it('R-062 das Repository besteht die Prüfung', async () => {
    expect((await stripeImportCheck.run(ROOT, new Date())).errors).toEqual([])
  })

  it('R-062 stripe (Node) nur unter src/lib/payments/stripe/', () => {
    expect(check('src/lib/payments/stripe/client.ts', "import Stripe from 'stripe'")).toEqual([])
    expect(check('src/lib/payments/stripe/index.ts', "import type Stripe from 'stripe'")).toEqual(
      [],
    )
    for (const [file, source] of [
      ['src/lib/payments/index.ts', "import Stripe from 'stripe'"],
      ['src/lib/commerce/checkout.ts', "const s = await import('stripe')"],
      [
        'src/app/api/stripe/webhook/route.ts',
        "import { Stripe } from 'stripe/esm/stripe.esm.node.js'",
      ],
      ['src/components/checkout/Pay.tsx', "const S = require('stripe')"],
    ]) {
      expect(check(file!, source!), file).toEqual([
        `${file}: 'stripe' nur unter src/lib/payments/stripe/ importieren.`,
      ])
    }
  })

  it('R-062 @stripe/stripe-js nur als /pure und nur unter src/components/checkout/', () => {
    const field = 'src/components/checkout/StripePaymentField.tsx'
    expect(check(field, "const { loadStripe } = await import('@stripe/stripe-js/pure')")).toEqual(
      [],
    )
    expect(check(field, "import { loadStripe } from '@stripe/stripe-js'")).toEqual([
      `${field}: @stripe/stripe-js nur als /pure importieren.`,
    ])
    expect(check(field, "import '@stripe/stripe-js'")).toEqual([
      `${field}: @stripe/stripe-js nur als /pure importieren.`,
    ])
    for (const file of [
      'src/components/cart/CartButton.tsx',
      'src/app/(frontend)/[locale]/layout.tsx',
      'src/lib/payments/stripe/client.ts',
    ]) {
      expect(check(file, "import { loadStripe } from '@stripe/stripe-js/pure'"), file).toEqual([
        `${file}: @stripe/stripe-js nur in src/components/checkout/ (R-062).`,
      ])
    }
  })
})
