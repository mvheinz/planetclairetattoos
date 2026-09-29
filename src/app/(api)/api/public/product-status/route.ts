import config from '@payload-config'
import { getPayload } from 'payload'

import { handleProductStatus } from '@/lib/commerce/productStatus'

// Live-Zustand der Stücke (ARCHITEKTUR §2.5, §9.3; PLAN P3.11): `GET /api/public/product-status?ids=1,2` – öffentlich,
// Rate-Limit `product_status`, `Cache-Control: no-store`, setzt kein Cookie.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request): Promise<Response> {
  return handleProductStatus(request, await getPayload({ config }), new Date())
}
