import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

import { berlinYear } from '@/lib/time'

import { dbFor } from './tx'

// Nummern mit erlaubten Lücken aus Postgres-Sequenzen (DATENMODELL §8.7, §9.1). Die Sequenzen laufen
// jahresübergreifend weiter; das Jahr im Präfix ist das Anlagejahr in Europe/Berlin. Seed-Daten nutzen feste Nummern
// ab 90001 bzw. 9001 und ziehen keine Sequenzwerte (§13.3). Ein Wert aus einer abgebrochenen Transaktion bleibt als
// Lücke (erlaubt); lückenlose Belegnummern laufen dagegen über `invoice_counters` (§8.6).

export const NUMBER_SEQUENCES = {
  order: { sequence: 'order_number_seq', prefix: 'PC', digits: 5 },
  withdrawal: { sequence: 'withdrawal_number_seq', prefix: 'WR', digits: 5 },
  inquiry: { sequence: 'inquiry_number_seq', prefix: 'AA', digits: 4 },
  privacyRequest: { sequence: 'privacy_request_number_seq', prefix: 'DS', digits: 4 },
} as const

export type NumberKind = keyof typeof NUMBER_SEQUENCES

/** `PC-2026-00042` usw.; mehr Stellen als vorgesehen werden nicht abgeschnitten (`PC-2031-100000`). */
export function formatSequenceNumber(kind: NumberKind, value: number | bigint, at: Date): string {
  const { prefix, digits } = NUMBER_SEQUENCES[kind]
  const n = BigInt(value)
  if (n < 1n) throw new Error(`Ungültiger Sequenzwert ${n} für ${kind}`)
  return `${prefix}-${berlinYear(at)}-${n.toString().padStart(digits, '0')}`
}

/** Zieht den nächsten Wert der Sequenz in der Transaktion von `req` und formatiert ihn. */
export async function nextSequenceNumber(
  req: PayloadRequest,
  kind: NumberKind,
  at: Date,
): Promise<string> {
  const db = await dbFor(req)
  const { rows } = await db.execute(
    sql`SELECT nextval(${NUMBER_SEQUENCES[kind].sequence}::regclass)::text AS n`,
  )
  const n = rows[0]?.n
  if (typeof n !== 'string') throw new Error(`Sequenz ${NUMBER_SEQUENCES[kind].sequence} fehlt`)
  return formatSequenceNumber(kind, BigInt(n), at)
}
