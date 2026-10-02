import 'server-only'

import type { PoolClient } from 'pg'

import { ConfigError } from '@/lib/errors'

import { parseMockState, type MockState, type MockStoredEvent } from './state'

// DB-Speicher des Mock-Treibers: Spalte `checkouts.mock_state` (jsonb). Jede Änderung läuft in einer eigenen
// Transaktion mit Zeilensperre (`FOR UPDATE`), damit zwei Prozesse sich nicht überschreiben. Der Trigger
// `checkouts_keep_mock_state` (Migration p4_mock_state_guard) lässt nur Schreibvorgänge mit
// `pc.mock_state_write = on` an die Spalte – Payload-Updates der Kasse schreiben sie sonst mit altem Stand zurück.
// Wie Netzwerkaufrufe gehören Adapter-Aufrufe nicht in eine Transaktion, die die Kassenzeile schon sperrt
// (`lock_timeout` bricht dann nach 5 s ab, statt zu hängen).

/** Teilmenge von `pg.Pool` (Payloads Pool oder ein eigener, z. B. für einen zweiten Prozess im Test). */
export interface MockDb {
  connect(): Promise<PoolClient>
}
export type MockDbSource = () => Promise<MockDb>

export type MockLocator =
  | { by: 'checkoutRef'; value: string }
  | { by: 'sessionId'; value: string }
  | { by: 'paymentIntentId'; value: string }

export interface MockRow {
  checkoutId: number
  state: MockState | null
}

export interface MockStore {
  /**
   * Sperrt die Kasse, übergibt ihren Zustand an `fn` und schreibt `next`, falls geliefert. Ohne passende Kasse wird
   * `fn` mit `null` aufgerufen (dann wird nichts geschrieben).
   */
  mutate<T>(
    where: MockLocator,
    fn: (row: MockRow | null) => { next?: MockState; result: T },
  ): Promise<T>
  /** Protokollierte Ereignisse aller Kassen ab `since` (aufsteigend nach Zeit, dann ID). */
  eventsSince(since: Date): Promise<MockStoredEvent[]>
}

const LOCK_TIMEOUT = '5s'

function condition(where: MockLocator): { sql: string; param: string } {
  switch (where.by) {
    case 'checkoutRef':
      return { sql: 'reservation_ref = $1', param: where.value }
    case 'sessionId':
      return {
        sql: 'mock_state @> $1::jsonb',
        param: JSON.stringify({ sessions: [{ sessionId: where.value }] }),
      }
    case 'paymentIntentId':
      return {
        sql: 'mock_state @> $1::jsonb',
        param: JSON.stringify({ sessions: [{ paymentIntentId: where.value }] }),
      }
  }
}

/** Standard: der Postgres-Pool der laufenden Payload-Instanz (dynamisch geladen, keine Import-Zyklen). */
export async function payloadMockDb(): Promise<MockDb> {
  const [{ getPayload }, { default: config }] = await Promise.all([
    import('payload'),
    import('@payload-config'),
  ])
  const payload = await getPayload({ config })
  const pool = (payload.db as unknown as { pool?: MockDb }).pool
  if (!pool) throw new ConfigError('Mock-Zahlung: Postgres-Pool von Payload nicht verfügbar.')
  return pool
}

export function createDbMockStore(source: MockDbSource = payloadMockDb): MockStore {
  return {
    async mutate(where, fn) {
      const db = await source()
      const client = await db.connect()
      try {
        await client.query('BEGIN')
        await client.query(`SET LOCAL lock_timeout = '${LOCK_TIMEOUT}'`)
        await client.query(`SELECT set_config('pc.mock_state_write', 'on', true)`)
        const { sql, param } = condition(where)
        const found = await client.query<{ id: number; mock_state: unknown }>(
          `SELECT id, mock_state FROM checkouts WHERE ${sql} ORDER BY id LIMIT 1 FOR UPDATE`,
          [param],
        )
        const row = found.rows[0]
        const { next, result } = fn(
          row ? { checkoutId: Number(row.id), state: parseMockState(row.mock_state) } : null,
        )
        if (row && next) {
          await client.query('UPDATE checkouts SET mock_state = $1::jsonb WHERE id = $2', [
            JSON.stringify(next),
            row.id,
          ])
        }
        await client.query('COMMIT')
        return result
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined)
        throw err
      } finally {
        client.release()
      }
    },

    async eventsSince(since) {
      const db = await source()
      const client = await db.connect()
      try {
        const res = await client.query<{ event: MockStoredEvent }>(
          `SELECT e.value AS event
             FROM checkouts c
             CROSS JOIN LATERAL jsonb_array_elements(
               CASE WHEN jsonb_typeof(c.mock_state -> 'events') = 'array'
                    THEN c.mock_state -> 'events' ELSE '[]'::jsonb END) AS e(value)
            WHERE c.mock_state IS NOT NULL
              AND (e.value ->> 'createdAt')::timestamptz >= $1
            ORDER BY (e.value ->> 'createdAt')::timestamptz, e.value ->> 'id'`,
          [since.toISOString()],
        )
        return res.rows.map((r) => r.event)
      } finally {
        client.release()
      }
    },
  }
}
