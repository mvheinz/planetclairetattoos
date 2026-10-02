import { handleOrderDocument } from '@/lib/commerce/tokenPages'
import { systemClock } from '@/lib/time'

// `GET /api/orders/[token]/documents/[file]` (ARCHITEKTUR §2.5, §8.3, PLAN P4.23): nur die Rechtstext-PDFs der Bestellung
// in ihrer Fassung (AGB, Widerrufsbelehrung inkl. Muster-Formular); keine Rechnungen und Gutschriften
// (`STATUS_PAGE_INVOICE_DOWNLOAD = false`, R-067, C-24). Status-Token, Rate-Limit `token_pages`, `private, no-store`.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; file: string }> },
): Promise<Response> {
  const { token, file } = await params
  return handleOrderDocument(request, token, decodeURIComponent(file), systemClock.now())
}
