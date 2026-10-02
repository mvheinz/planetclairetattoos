import type { TaskConfig } from 'payload'

import { issueInvoicePdf } from '@/lib/invoices/issue'
import { jobNow } from '@/lib/jobs/now'

// Task `renderInvoicePdf` (DATENMODELL §11, Queue `documents`): PDF eines Belegs erzeugen und festschreiben.
// Idempotent: ein bereits ausgestellter Beleg bleibt unverändert (DM-JOB-01). Direkt nach dem Commit ausgeführt
// (`runInvoicePdfJob`), sonst vom Job-Wecker; 5 Wiederholungen.

type RenderInvoicePdfIO = {
  input: { invoiceId: number }
  output: { status: string }
}

export const renderInvoicePdfTask: TaskConfig<RenderInvoicePdfIO> = {
  slug: 'renderInvoicePdf',
  label: 'Beleg-PDF erzeugen',
  retries: 5,
  inputSchema: [{ name: 'invoiceId', type: 'number', required: true }],
  outputSchema: [{ name: 'status', type: 'text', required: true }],
  handler: async ({ input, req }) => {
    req.context = { ...req.context, system: true, now: jobNow(req).toISOString() }
    const res = await issueInvoicePdf(req, input.invoiceId)
    return { output: { status: res.status } }
  },
}
