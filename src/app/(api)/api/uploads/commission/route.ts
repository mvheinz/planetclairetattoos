import { getEnv } from '@/lib/env'
import { maintenanceApiResponse } from '@/lib/maintenance'
import config from '@payload-config'
import { getPayload } from 'payload'

import { handleCommissionUpload } from '@/lib/commission/upload'

// Referenzbild des Auftragsarbeiten-Formulars (ARCHITEKTUR §2.5, §8.8; PLAN P7.11): `POST /api/uploads/commission`
// mit Formular-Token (Kopf `x-form-token`), Rate-Limit `commission_upload`, ≤ 4,5 MB, nur JPEG/PNG/WebP; Ablage privat.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request): Promise<Response> {
  // Wartungsmodus: Formulare gesperrt.
  if (getEnv().MAINTENANCE_MODE) return maintenanceApiResponse()
  return handleCommissionUpload(request, await getPayload({ config }), new Date())
}
