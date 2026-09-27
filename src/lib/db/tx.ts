import 'server-only'

import type { sql } from '@payloadcms/db-postgres'
import type { PayloadRequest } from 'payload'

// Eigenes SQL in derselben Transaktion wie die Local API (DATENMODELL §8): Drizzle-Instanz der Sitzung von `req`,
// ohne Transaktion die des Pools.

export interface SqlExecutor {
  execute(query: ReturnType<typeof sql>): Promise<{ rows: Record<string, unknown>[] }>
}

type Adapter = { drizzle: SqlExecutor; sessions?: Record<string | number, { db: SqlExecutor }> }

export async function dbFor(req: PayloadRequest): Promise<SqlExecutor> {
  const adapter = req.payload.db as unknown as Adapter
  if (!req.transactionID) return adapter.drizzle
  const id = await req.transactionID
  return adapter.sessions?.[id]?.db ?? adapter.drizzle
}
