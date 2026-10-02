import type { TaskConfig } from 'payload'

import { jobNow } from '@/lib/jobs/now'
import { issueLegalTextPdfs } from '@/lib/legal/pdf'

// Task `renderLegalTextPdf` (DATENMODELL §11, Queue `documents`; Grundfassung P4.12, Ausbau P6.3): PDFs DE/EN einer
// veröffentlichten bzw. abgelösten Fassung → `documents`, Hash setzen. Idempotent (vorhandene PDFs bleiben);
// ein Render-Fehler (unbekanntes Token) lässt den Job fehlschlagen – es entsteht kein PDF.

type RenderLegalTextPdfIO = {
  input: { legalTextId: number }
  output: { created: string }
}

export const renderLegalTextPdfTask: TaskConfig<RenderLegalTextPdfIO> = {
  slug: 'renderLegalTextPdf',
  label: 'Rechtstext-PDF erzeugen',
  retries: 5,
  inputSchema: [{ name: 'legalTextId', type: 'number', required: true }],
  outputSchema: [{ name: 'created', type: 'text', required: true }],
  handler: async ({ input, req }) => {
    req.context = { ...req.context, system: true, now: jobNow(req).toISOString() }
    const res = await issueLegalTextPdfs(req, input.legalTextId)
    return { output: { created: res.created.join(',') } }
  },
}
