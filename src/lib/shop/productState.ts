import type { ConformityDeclaration, Product } from '@/payload-types'

// Zustände der Produktseite (KONZEPT §3.4 Nr. 5 und 6) als reine Regeln – testbar ohne Server.

export type BuyState = 'available' | 'reserved' | 'sold'

/** Kaufbereich je Status; alles außer `reserved`/`sold` gilt als verfügbar (öffentlich sind nur diese drei). */
export function buyState(status: string): BuyState {
  return status === 'reserved' || status === 'sold' ? status : 'available'
}

/** Erste aktive Konformitätserklärung (nur dann darf „lebensmittelecht“ erscheinen, R-044). */
export function activeDeclaration(
  declarations: Product['conformityDeclarations'],
): ConformityDeclaration | null {
  return (
    (declarations ?? []).find(
      (d): d is ConformityDeclaration =>
        typeof d === 'object' && d !== null && d.status === 'active',
    ) ?? null
  )
}

/** Keramik: „lebensmittelecht“ nur mit aktiver Erklärung; sonst gilt die Deko-Kennzeichnung (E-15, konservativ). */
export function foodContactDisplay(
  product: Pick<Product, 'category' | 'foodContact' | 'conformityDeclarations'>,
): { kind: 'foodSafe'; declaration: ConformityDeclaration } | { kind: 'decorative' } | null {
  if (product.category !== 'keramik') return null
  const declaration = activeDeclaration(product.conformityDeclarations)
  return product.foodContact === 'lebensmittelecht' && declaration
    ? { kind: 'foodSafe', declaration }
    : { kind: 'decorative' }
}

/** Kaufknopf bedienbar? Nur `available` bei geöffnetem Shop (KONZEPT §3.4 Nr. 6, §4.2). */
export function canAddToCart(state: BuyState, shopOpen: boolean): boolean {
  return state === 'available' && shopOpen
}
