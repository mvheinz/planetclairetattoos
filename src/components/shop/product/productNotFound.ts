import { cache } from 'react'

import type { NotFoundVariant } from '@/components/layout/NotFoundContent'

// Produktseite R04: Welche 404-Variante gilt für die Adresse dieser Anfrage (KONZEPT §2.3)? Das Layout von `[product]`
// kennt die Parameter und trägt das Ergebnis hier ein; die 404 des Segments (`not-found.tsx`, bekommt keine Parameter)
// liest es. React rendert die Kinder eines Layouts (und damit die 404-Grenze darin) erst, nachdem das Layout selbst
// fertig ist – der Wert steht also immer schon fest. `cache()` gilt je Anfrage.
//
// Warum kein Client-Kontext: Die 404-Grenze wird auf jeder Produktseite mitgeliefert. Mit einem Kontext stünden beide
// Varianten in den eingebetteten Seitendaten, und der Kontext bräuchte einen eigenen JS-Chunk vor dem ersten Bild
// (Lighthouse R04, OFFENE-PUNKTE „P5 CI“). So liefert eine öffentliche Produktseite eine leere 404-Grenze.

type ProductNotFoundState = {
  /** `null`: öffentliches Stück (keine 404); sonst die Variante; `undefined`: Layout lief nicht. */
  variant?: NotFoundVariant | null
}

export const productNotFoundState = cache((): ProductNotFoundState => ({}))
