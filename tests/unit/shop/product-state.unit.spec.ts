import { describe, expect, it } from 'vitest'

import {
  activeDeclaration,
  buyState,
  canAddToCart,
  foodContactDisplay,
} from '@/lib/shop/productState'
import type { ConformityDeclaration } from '@/payload-types'

// P3.8 Produktseite: Kaufbereich je Zustand (KONZEPT §3.4 Nr. 6) und Lebensmittelkontakt (R-044, E-15).

const decl = (id: number, status: 'active' | 'revoked') =>
  ({ id, status, name: `Glasur ${id}` }) as unknown as ConformityDeclaration

describe('Kaufbereich (KONZEPT §3.4 Nr. 6)', () => {
  it('Status → Zustand; „In den Korb“ nur available bei geöffnetem Shop', () => {
    expect(buyState('available')).toBe('available')
    expect(buyState('reserved')).toBe('reserved')
    expect(buyState('sold')).toBe('sold')
    expect(canAddToCart('available', true)).toBe(true)
    expect(canAddToCart('available', false)).toBe(false)
    expect(canAddToCart('reserved', true)).toBe(false)
    expect(canAddToCart('sold', true)).toBe(false)
  })
})

describe('R-044 Lebensmittelkontakt', () => {
  it('lebensmittelecht nur mit aktiver Erklärung, sonst Deko; andere Kategorien ohne Angabe', () => {
    expect(
      foodContactDisplay({
        category: 'keramik',
        foodContact: 'lebensmittelecht',
        conformityDeclarations: [decl(3, 'revoked'), decl(4, 'active')],
      }),
    ).toEqual({ kind: 'foodSafe', declaration: decl(4, 'active') })
    for (const conformityDeclarations of [[], [decl(3, 'revoked')], [7], null])
      expect(
        foodContactDisplay({
          category: 'keramik',
          foodContact: 'lebensmittelecht',
          conformityDeclarations,
        }),
      ).toEqual({ kind: 'decorative' })
    expect(
      foodContactDisplay({ category: 'keramik', foodContact: 'deko', conformityDeclarations: [] }),
    ).toEqual({ kind: 'decorative' })
    expect(
      foodContactDisplay({ category: 'schmuck', foodContact: null, conformityDeclarations: [] }),
    ).toBeNull()
    expect(activeDeclaration(undefined)).toBeNull()
  })
})
