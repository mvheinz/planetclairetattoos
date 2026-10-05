import 'server-only'

import config from '@payload-config'
import { getPayload } from 'payload'

/** Pool, der `query` kann (so viel braucht der Test-Ersatz). */
export interface PingPool {
  query: (text: string) => Promise<unknown>
}

/**
 * Ist die Datenbank erreichbar? Ein `SELECT 1` mit Zeitlimit (Standard 2 s); jede Ausnahme = nicht erreichbar.
 * Grundlage für R26 im Wartungsmodus (R-090): ohne Datenbank zeigt R26 den Widerruf per E-Mail.
 */
export async function isDatabaseReachable(
  getPool: () => Promise<PingPool> = async () =>
    (await getPayload({ config })).db.pool as unknown as PingPool,
  timeoutMs = 2000,
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const ping = (async () => {
      const pool = await getPool()
      await pool.query('SELECT 1')
      return true
    })()
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs)
    })
    return await Promise.race([ping, timeout])
  } catch {
    return false
  } finally {
    if (timer) clearTimeout(timer)
  }
}
