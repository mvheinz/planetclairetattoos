import React from 'react'

import { serializeJsonLd } from '@/lib/seo/jsonld'

// JSON-LD-Datenblock (KONZEPT §3.0.5): wird nicht ausgeführt (kein CSP-Nonce nötig), `<` ist maskiert.
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  )
}
