import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import type { Metadata } from 'next'

import { getEnv } from '@/lib/env'

// Fehler-Auslöser für E2E (P2.19, R29): `/<sprache>/__fehler-test` wirft nur bei `APP_ENV=test` einen Fehler, damit die
// 500-Seite (`error.tsx`) geprüft werden kann; in jeder anderen Umgebung 404. Ordner `%5F%5F…`, weil Ordner mit `_`
// sonst privat sind. Nicht in Registry, Sitemap oder Crawl (Ausnahme in `scripts/lib/static-checks/route-registry.ts`).
export const metadata: Metadata = { robots: { index: false, follow: false } }

export default async function ErrorTriggerPage(): Promise<never> {
  await connection()
  if (getEnv().APP_ENV !== 'test') notFound()
  throw new Error('P2.19 Fehler-Auslöser (nur APP_ENV=test)')
}
