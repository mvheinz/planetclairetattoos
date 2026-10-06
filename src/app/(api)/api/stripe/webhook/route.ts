import { getEnv } from '@/lib/env'
import { maintenanceApiResponse } from '@/lib/maintenance'
import { handleWebhookRequest } from '@/lib/payments/webhook'

// Zahlungs-Webhook (ARCHITEKTUR §2.5, DATENMODELL §8.8, PLAN P4.16): Rohkörper per `await req.text()` (Signatur über
// die unveränderten Bytes), ungültige Signatur → 400, verarbeitet → 200, Fehler → 500 (Stripe wiederholt).
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: Request): Promise<Response> {
  // Wartungsmodus (§10.5): 503, Stripe wiederholt die Zustellung.
  if (getEnv().MAINTENANCE_MODE) return maintenanceApiResponse()
  const rawBody = await req.text()
  return handleWebhookRequest(rawBody, req.headers)
}
