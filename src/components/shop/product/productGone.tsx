'use client'

import React, { createContext, useContext } from 'react'

// Produktseite R04: Ist das Stück der Adresse verkauft und ausgeblendet (KONZEPT §2.3)? Das Layout von `[product]`
// kennt die Parameter und setzt den Wert; die 404 des Segments (`not-found.tsx`, bekommt keine Parameter) wählt damit
// die Variante „Dieses Stück hat schon ein Zuhause gefunden“, sonst „Coco hat sich losgerissen“.

const ProductGoneContext = createContext(false)

export function ProductGoneProvider({
  gone,
  children,
}: {
  gone: boolean
  children: React.ReactNode
}) {
  return <ProductGoneContext.Provider value={gone}>{children}</ProductGoneContext.Provider>
}

/** Zeigt `home` (verkauft + ausgeblendet) oder `lost` (unbekannt, Entwurf, archiviert). */
export function ProductNotFoundSwitch({
  lost,
  home,
}: {
  lost: React.ReactNode
  home: React.ReactNode
}) {
  return <>{useContext(ProductGoneContext) ? home : lost}</>
}
