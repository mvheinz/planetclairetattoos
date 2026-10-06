import type { Metadata } from 'next'

import { requireArtQa } from '../guard'

// `/{locale}/qa/error` (KUNST-QA §4.3 SC-10): löst die 500-Seite (R29, `error.tsx`) aus – nur mit `ART_QA=1`, sonst 404.
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function QaErrorPage({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<never> {
  await requireArtQa(params)
  throw new Error('KUNST-QA SC-10: Fehler-Auslöser (nur ART_QA)')
}
