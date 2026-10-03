import 'server-only'

import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import { setRequestLocale } from 'next-intl/server'

import { artQaActive } from '@/lib/env'
import { isLocale } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'

// QA-Seiten der Kunst-Abnahme (KUNST-QA §3.2, P9.1): immer dynamisch (Umgebung zur Laufzeit), ohne `ART_QA=1` 404.
// Nicht in Routen-Registry, Sitemap, robots oder Vorschau-Export (Ausnahme in
// `scripts/lib/static-checks/route-registry.ts`).
export async function requireArtQa(params: Promise<{ locale: string }>): Promise<Locale> {
  await connection()
  const { locale } = await params
  if (!artQaActive() || !isLocale(locale)) notFound()
  setRequestLocale(locale)
  return locale
}
