import 'server-only'

import { createLocalReq, type Payload } from 'payload'

import { notifyAdmin, type NotifyAdminResult } from '@/lib/email/notifyAdmin'
import { readStoredFile } from '@/lib/storage/read'
import { sha256Hex } from '@/lib/uploads/files'
import type { Invoice, PrivateUpload } from '@/payload-types'

// Belegprüfung (R-122, DATENMODELL §11 `invoiceIntegrityCheck`, PLAN P5.26): SHA-256 aller ausgestellten RE/GS-PDFs neu
// berechnen und mit `invoices.sha256` vergleichen. Abweichung oder fehlende Datei ⇒ A12 mit den Belegnummern (Fehlerart
// `invoice_integrity`). Beispielbelege (BSP-…) werden nicht geprüft. Nur lesen – nie reparieren oder überschreiben.

export interface IntegrityResult {
  checked: number
  mismatched: string[]
  missing: string[]
  alert: NotifyAdminResult['status'] | null
}

const idOf = (v: unknown): number | null =>
  v === null || v === undefined
    ? null
    : typeof v === 'object'
      ? Number((v as { id: number }).id)
      : Number(v)

export async function runInvoiceIntegrityCheck(
  payload: Payload,
  now: Date,
): Promise<IntegrityResult> {
  const res = await payload.find({
    collection: 'invoices',
    where: {
      and: [
        { status: { equals: 'issued' } },
        { series: { in: ['RE', 'GS'] } },
        { seed: { not_equals: true } },
      ],
    },
    sort: 'number',
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { number: true, sha256: true, pdf: true },
  })
  const invoices = res.docs as Pick<Invoice, 'id' | 'number' | 'sha256' | 'pdf'>[]
  const mismatched: string[] = []
  const missing: string[] = []
  for (const inv of invoices) {
    const uploadId = idOf(inv.pdf)
    const upload = uploadId
      ? ((await payload.findByID({
          collection: 'private-uploads',
          id: uploadId,
          depth: 0,
          overrideAccess: true,
          disableErrors: true,
        })) as PrivateUpload | null)
      : null
    const bytes = upload
      ? await readStoredFile('private', upload.filename ?? '', upload.prefix ?? null)
      : null
    if (!bytes) missing.push(inv.number)
    else if (!inv.sha256 || sha256Hex(bytes) !== inv.sha256) mismatched.push(inv.number)
  }

  let alert: IntegrityResult['alert'] = null
  if (mismatched.length > 0 || missing.length > 0) {
    const req = await createLocalReq({ context: { system: true, now: now.toISOString() } }, payload)
    const list = (label: string, nums: string[]) =>
      nums.length > 0
        ? `${label}: ${nums.slice(0, 40).join(', ')}${nums.length > 40 ? ' …' : ''}`
        : ''
    const r = await notifyAdmin(
      req,
      'admin_alert',
      {
        kind: 'invoice_integrity',
        summary: `Belegprüfung: ${mismatched.length + missing.length} Beleg-PDF(s) auffällig`,
        affected: [list('Prüfsumme weicht ab', mismatched), list('Datei fehlt', missing)]
          .filter(Boolean)
          .join(' · ')
          .slice(0, 1000),
        automatic: 'Nichts – die Dateien wurden nicht verändert.',
        todo: 'Bitte die Beleg-PDFs aus der Sicherung prüfen und die Steuerberatung informieren.',
        adminPath: '/collections/invoices',
      },
      { now },
    )
    alert = r.status
  }
  return { checked: invoices.length, mismatched, missing, alert }
}
