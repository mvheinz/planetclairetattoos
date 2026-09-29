import React from 'react'

import type { Locale } from '@/lib/enums'
import { getSnippet } from '@/lib/legal/snippets'
import { localizedPath } from '@/lib/routes/paths'

// Baustein `price.shippingNote` („zzgl. Versandkosten“) als Link auf Versand & Zahlung (R25, R-030, R-031); Ziel aus
// der Routen-Registry.
export function ShippingNoteLink({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <a href={localizedPath('R25', locale)} className={className} data-shipping-note="">
      {getSnippet('price.shippingNote', locale).text}
    </a>
  )
}
