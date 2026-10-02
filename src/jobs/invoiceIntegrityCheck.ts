import type { TaskConfig } from 'payload'

import { withTaskLock } from '@/lib/jobs/lock'
import { jobNow } from '@/lib/jobs/now'
import { poolDb } from '@/lib/jobs/runLog'
import { runOncePer } from '@/lib/jobs/runOnce'

// Task `invoiceIntegrityCheck` (DATENMODELL §11, Queue `maintenance`, R-122, PLAN P5.26): monatlich am 1. ab 04:00
// Berlin (nach `monthlyClose`, der Wecker reiht es danach ein) SHA-256 aller ausgestellten RE/GS-PDFs prüfen;
// Abweichung oder fehlende Datei ⇒ A12 mit Belegnummern. Einmal je Berliner Monat (`runOncePer`).

export const INVOICE_INTEGRITY_BERLIN_HOUR = 4

type IntegrityIO = {
  input: Record<string, never>
  output: {
    skipped: boolean
    period?: string
    checked?: number
    mismatched?: number
    missing?: number
  }
}

export const invoiceIntegrityCheckTask: TaskConfig<IntegrityIO> = {
  slug: 'invoiceIntegrityCheck',
  label: 'Belegprüfung (Prüfsummen)',
  retries: 3,
  outputSchema: [
    { name: 'skipped', type: 'checkbox', required: true },
    { name: 'period', type: 'text' },
    { name: 'checked', type: 'number' },
    { name: 'mismatched', type: 'number' },
    { name: 'missing', type: 'number' },
  ],
  handler: async ({ req }) => {
    const now = jobNow(req)
    const { runInvoiceIntegrityCheck } = await import('@/lib/invoices/integrity')
    const run = await withTaskLock(req.payload, 'invoiceIntegrityCheck', async () => {
      const decision = await runOncePer(
        poolDb(req.payload),
        'invoiceIntegrityCheck',
        'month',
        INVOICE_INTEGRITY_BERLIN_HOUR,
        now,
      )
      if (!decision.due) return null
      const res = await runInvoiceIntegrityCheck(req.payload, now)
      return {
        period: decision.period,
        checked: res.checked,
        mismatched: res.mismatched.length,
        missing: res.missing.length,
      }
    })
    if (run.status === 'locked' || run.result === null) return { output: { skipped: true } }
    return { output: { skipped: false, ...run.result } }
  },
}
