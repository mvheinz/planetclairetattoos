// Gemeinsame DB-Helfer für db:*-Skripte (Skripte dürfen process.env vor dem App-Start lesen, ARCHITEKTUR §5.1).
import 'dotenv/config'

import pg from 'pg'

export const devUrl = () => process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || ''
export const testUrl = () => process.env.DATABASE_URL_TEST || ''

export function withDatabase(url: string, database: string): string {
  const u = new URL(url)
  u.pathname = `/${database}`
  return u.toString()
}

export async function withClient<T>(url: string, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}
