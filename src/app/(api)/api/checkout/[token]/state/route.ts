import { getEnv } from '@/lib/env'
import { maintenanceApiResponse } from '@/lib/maintenance'
import { handleCheckoutState } from '@/lib/commerce/tokenPages'
import { systemClock } from '@/lib/time'

// `GET /api/checkout/[token]/state` (ARCHITEKTUR §2.5, KONZEPT §2.7/§4.12, PLAN P4.17): Zustandscode der wartenden
// Danke-Seite (`waiting`, `paid`, `prepayment`, `gone`, `unpaid`), Rate-Limit `token_pages`, `no-store`; unbekannter
// Token → 404. Logik in `src/lib/commerce/tokenPages.ts` (dieselbe Funktion `getThanksState` wie die Seite).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  // Wartungsmodus: Kasse gesperrt.
  if (getEnv().MAINTENANCE_MODE) return maintenanceApiResponse()
  const { token } = await params
  return handleCheckoutState(request, token, systemClock.now())
}
