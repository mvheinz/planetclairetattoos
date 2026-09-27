import { connection } from 'next/server'

import { ScaffoldPage } from '@/components/layout/ScaffoldPage'
import { routeMetadata } from '@/lib/seo/metadata'

export const generateMetadata = routeMetadata('R26')

// R26 (KONZEPT §2.2) – Gerüst P2. Dynamisch gerendert (Registry `rendering: dynamic`), damit Next die Nonce des
// CSP-Kontexts `dynamic` an seine Skripte hängt (ARCHITEKTUR §8.1).
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  await connection()
  return <ScaffoldPage params={params} routeId="R26" />
}
