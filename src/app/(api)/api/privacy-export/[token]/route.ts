import { handlePrivacyExport } from '@/lib/privacy/download'
import { systemClock } from '@/lib/time'

// `GET /api/privacy-export/[token]` (ARCHITEKTUR §2.5, PLAN P6.17, R-137): Download des DSGVO-Exports über den Link aus
// M14 – signierter Token ohne Personendaten, 7 Tage gültig, danach 410. Rate-Limit `token_pages`, `private, no-store`.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params
  return handlePrivacyExport(request, token, systemClock.now())
}
