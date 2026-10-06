import 'server-only'

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'

import { INVOICE_NUMBER_RE } from '@/lib/commerce/invoiceNumber'
import type { InvoiceSeries } from '@/lib/enums'
import { getEnv, type Env } from '@/lib/env'
import { poolDb } from '@/lib/jobs/runLog'
import { createLogger } from '@/lib/monitoring/logger'
import { getPaymentsAdapter } from '@/lib/payments'
import { processPaymentEvent } from '@/lib/payments/processPaymentEvent'
import type { PaymentsAdapter } from '@/lib/payments/types'
import { replayDeletionLog, type ReplayResult } from '@/lib/retention/replay'
import { localStorageRoot } from '@/lib/storage'
import { META_SUFFIX } from '@/lib/storage/putIfAbsent'
import { getS3Client } from '@/lib/storage/s3'

// Nacharbeiten nach einer Wiederherstellung (ARCHITEKTUR §10.5 Schritt 6 a–d): Löschprotokoll erneut anwenden,
// Zahlungsabgleich ab Backup-Zeitpunkt − 1 h, Belegnummern aus den PDFs im Bucket (nie doppelt vergeben), Bericht.
// Aufruf: Verwaltung → System → „Nach Wiederherstellung abgleichen“ (nur im Wartungsmodus) bzw. `pnpm retention:replay`
// und `pnpm payments:reconcile`.

const log = createLogger()
export const RECONCILE_MARGIN_MS = 60 * 60 * 1000

export interface InvoiceFile {
  key: string
  number: string
}

export interface PostRestoreReport {
  gap: { from: string; to: string }
  replay: ReplayResult
  payments: { events: number; counts: Record<string, number>; failed: number }
  invoices: {
    checked: number
    missing: string[]
    counters: { series: string; year: number; lastNumber: number }[]
  }
  /** Hinweis für Jutta (Schritt 6 d). */
  notes: string[]
}

const numberFromName = (name: string): string | null => {
  const base = name.replace(/\.pdf$/i, '')
  return INVOICE_NUMBER_RE.test(base) ? base : null
}

async function walkFiles(dir: string): Promise<string[]> {
  const out: string[] = []
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walkFiles(full)))
    else if (e.isFile()) out.push(full)
  }
  return out
}

/** Rechnungs- und Gutschrift-PDFs im Speicher mit ihrer Belegnummer (Metadaten `invoice-number`, sonst Dateiname). */
export async function listInvoiceFiles(env: Env = getEnv()): Promise<InvoiceFile[]> {
  const out: InvoiceFile[] = []
  if (env.STORAGE_DRIVER === 'local') {
    const root = path.join(localStorageRoot(env), 'private')
    for (const file of await walkFiles(root)) {
      if (!file.toLowerCase().endsWith('.pdf')) continue
      let number: string | null = null
      try {
        const meta = JSON.parse(await readFile(`${file}${META_SUFFIX}`, 'utf8')) as Record<
          string,
          string
        >
        number = meta['invoice-number'] ?? null
      } catch {
        // keine Nebendatei
      }
      number ??= numberFromName(path.basename(file))
      if (number) out.push({ key: path.relative(root, file), number })
    }
    return out
  }
  const client = getS3Client(env)
  const Bucket = env.S3_PRIVATE_BUCKET as string
  let token: string | undefined
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket, Prefix: 'private/invoices/', ContinuationToken: token }),
    )
    for (const o of res.Contents ?? []) {
      if (!o.Key?.toLowerCase().endsWith('.pdf')) continue
      const head = await client.send(new HeadObjectCommand({ Bucket, Key: o.Key }))
      const number = head.Metadata?.['invoice-number'] ?? numberFromName(path.posix.basename(o.Key))
      if (number) out.push({ key: o.Key, number })
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (token)
  return out
}

/** Zerlegt `RE-2026-00012` bzw. `BSP-RE-2026-00012` in Serie, Jahr und laufende Nummer. */
export function parseInvoiceNumber(
  number: string,
): { series: InvoiceSeries; year: number; n: number } | null {
  const m = /^((?:BSP-)?(?:RE|GS))-(\d{4})-(\d{5})$/.exec(number)
  return m ? { series: m[1] as InvoiceSeries, year: Number(m[2]), n: Number(m[3]) } : null
}

/** Schritt 6 c: Belege im Speicher, die im Datenstand fehlen; Zähler auf die höchste gefundene Nummer anheben. */
export async function reconcileInvoiceCounters(
  payload: Payload,
  now: Date,
  env: Env = getEnv(),
  files?: InvoiceFile[],
): Promise<PostRestoreReport['invoices']> {
  const found = files ?? (await listInvoiceFiles(env))
  const db = poolDb(payload)
  const known = new Set(
    (await db.execute(sql`SELECT number FROM invoices`)).rows.map((r) => String(r.number)),
  )
  const missing = found.map((f) => f.number).filter((n) => !known.has(n))
  const highest = new Map<string, { series: InvoiceSeries; year: number; n: number }>()
  for (const number of found.map((f) => f.number)) {
    const p = parseInvoiceNumber(number)
    if (!p) continue
    const k = `${p.series}/${p.year}`
    if ((highest.get(k)?.n ?? 0) < p.n) highest.set(k, p)
  }
  const counters: PostRestoreReport['invoices']['counters'] = []
  const at = now.toISOString()
  for (const p of highest.values()) {
    const res = await db.execute(sql`
      INSERT INTO invoice_counters (series, year, last_number, created_at, updated_at)
      VALUES (${p.series}, ${p.year}, ${p.n}, ${at}::timestamptz, ${at}::timestamptz)
      ON CONFLICT (series, year)
      DO UPDATE SET last_number = GREATEST(invoice_counters.last_number, EXCLUDED.last_number),
        updated_at = ${at}::timestamptz
      RETURNING last_number`)
    counters.push({ series: p.series, year: p.year, lastNumber: Number(res.rows[0]?.last_number) })
  }
  return { checked: found.length, missing: [...new Set(missing)].sort(), counters }
}

export interface PostRestoreOptions {
  /** `createdAt` des eingespielten Backups (Kopfzeile). */
  backupCreatedAt: Date
  now: Date
  env?: Env
  payments?: PaymentsAdapter
  invoiceFiles?: InvoiceFile[]
}

export async function runPostRestore(
  payload: Payload,
  opts: PostRestoreOptions,
): Promise<PostRestoreReport> {
  const env = opts.env ?? getEnv()
  // a) Löschprotokoll
  const replay = await replayDeletionLog(payload, { now: opts.now })
  // b) Zahlungsabgleich
  const since = new Date(opts.backupCreatedAt.getTime() - RECONCILE_MARGIN_MS)
  const payments = opts.payments ?? getPaymentsAdapter()
  const counts: Record<string, number> = {}
  let failed = 0
  const events = await payments.listEventsSince(since)
  for (const event of events) {
    try {
      const r = await processPaymentEvent(event, { payload, payments })
      counts[r.status] = (counts[r.status] ?? 0) + 1
    } catch (e) {
      failed++
      log.error('postRestore.payment_event_failed', { reason: (e as Error).name })
    }
  }
  // c) Belegnummern
  const invoices = await reconcileInvoiceCounters(payload, opts.now, env, opts.invoiceFiles)
  // d) Bericht
  const notes = [
    'Vorkasse-Bestellungen, Anfragen und Widerrufe aus der Lücke findest du als Benachrichtigungen im Postfach.',
    'Widerrufe, die seit dem Wartungsmodus in der alten Datenbank eingegangen sind, vor dem Öffnen übernehmen.',
  ]
  if (invoices.missing.length > 0)
    notes.push(`Belege im Speicher, die im Datenstand fehlen: ${invoices.missing.join(', ')}.`)
  if (failed > 0)
    notes.push(
      `${failed} Zahlungs-Ereignis(se) konnten nicht verarbeitet werden – erneut ausführen.`,
    )
  return {
    gap: { from: since.toISOString(), to: opts.now.toISOString() },
    replay,
    payments: { events: events.length, counts, failed },
    invoices,
    notes,
  }
}
