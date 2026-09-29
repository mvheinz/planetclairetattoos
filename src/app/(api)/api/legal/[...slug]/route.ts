import config from '@payload-config'
import { getPayload } from 'payload'

import { legalPdfResponse } from '@/lib/legal/download'
import { systemClock } from '@/lib/time'

// `GET /api/legal/[type].pdf?locale=de` und `/api/legal/[type]/[versionId].pdf` (ARCHITEKTUR §2.5, P4.12): öffentliche
// Rechtstext-PDFs, `Cache-Control: public, max-age=3600`. Logik in `src/lib/legal/download.ts`.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string[] }> },
): Promise<Response> {
  const { slug } = await params
  const payload = await getPayload({ config })
  const locale = new URL(request.url).searchParams.get('locale')
  return legalPdfResponse(payload, slug.map(decodeURIComponent), locale, systemClock.now())
}
