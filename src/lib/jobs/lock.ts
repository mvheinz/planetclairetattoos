import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
} from 'payload'

import { dbFor } from '@/lib/db/tx'

// Parallelschutz je Task (DATENMODELL §11, ARCHITEKTUR §9.6 Nr. 8): `pg_try_advisory_xact_lock(hashtext('<task>'))` in
// einer eigenen Sperr-Transaktion, die bis zum Ende des Laufs offen bleibt. Die Arbeitsschritte laufen in eigenen
// Transaktionen (jede Aktion für sich), damit ein Fehler bei einem Datensatz die anderen nicht zurückrollt. Keine
// Sitzungs-Locks (PgBouncer im Transaktionsmodus, §9.7).

/** Advisory-Lock-Schlüssel des Ticks (ARCHITEKTUR §9.6 Nr. 8). */
export const TICK_LOCK = 'tick'

export type LockedRun<T> = { status: 'ran'; result: T } | { status: 'locked' }

export async function withTaskLock<T>(
  payload: Payload,
  task: string,
  fn: () => Promise<T>,
): Promise<LockedRun<T>> {
  const req = await createLocalReq({ context: { system: true } }, payload)
  await initTransaction(req)
  try {
    const db = await dbFor(req)
    const res = await db.execute(sql`SELECT pg_try_advisory_xact_lock(hashtext(${task})) AS ok`)
    if (res.rows[0]?.ok !== true) {
      await killTransaction(req)
      return { status: 'locked' }
    }
    const result = await fn()
    await commitTransaction(req)
    return { status: 'ran', result }
  } catch (err) {
    await killTransaction(req)
    throw err
  }
}

/**
 * Läuft `fn` neben, aber nie gleichzeitig mit einem Tick: geteilte Sperre auf `TICK_LOCK` (Sofortläufe untereinander
 * parallel, der Tick nimmt die Sperre exklusiv). Läuft gerade ein Tick, `{ status: 'locked' }` – er bzw. der nächste
 * Tick übernimmt die Arbeit.
 */
export async function besideTick<T>(payload: Payload, fn: () => Promise<T>): Promise<LockedRun<T>> {
  const req = await createLocalReq({ context: { system: true } }, payload)
  await initTransaction(req)
  try {
    const db = await dbFor(req)
    const res = await db.execute(
      sql`SELECT pg_try_advisory_xact_lock_shared(hashtext(${TICK_LOCK})) AS ok`,
    )
    if (res.rows[0]?.ok !== true) {
      await killTransaction(req)
      return { status: 'locked' }
    }
    const result = await fn()
    await commitTransaction(req)
    return { status: 'ran', result }
  } catch (err) {
    await killTransaction(req)
    throw err
  }
}
