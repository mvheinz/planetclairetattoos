import 'server-only'

import type { ClientBase } from 'pg'

// Schutz der Produktionsdatenbank (ARCHITEKTUR §4.8, KONZEPT AK-11-04). Gemeinsam mit dem Seed-Guard genutzt.
export const PRODUCTION_DB_COMMENT = 'planetclaire:production'

/** Liest den Datenbank-Kommentar; `true`, wenn die aktuelle DB als Produktion markiert ist. */
export async function isProductionDatabase(client: Pick<ClientBase, 'query'>): Promise<boolean> {
  const res = await client.query<{ comment: string | null }>(
    "SELECT shobj_description(oid, 'pg_database') AS comment FROM pg_database WHERE datname = current_database()",
  )
  return res.rows[0]?.comment === PRODUCTION_DB_COMMENT
}

/** Name der Datenbank aus einer Postgres-URL. */
export function databaseNameFromUrl(url: string): string {
  const name = new URL(url).pathname.replace(/^\//, '')
  if (!name) throw new Error('Datenbank-URL ohne Datenbanknamen')
  return decodeURIComponent(name)
}

export interface DestructiveGuardInput {
  appEnv: string
  databaseName: string
  isProductionMarked: boolean
  /** Nur db:reset: Name muss auf _test enden. */
  requireTestSuffix?: boolean
}

/** Liefert eine Ablehnungsmeldung oder `null`, wenn die zerstörerische Aktion erlaubt ist (kein Umgehungsschalter). */
export function destructiveActionBlockedReason(input: DestructiveGuardInput): string | null {
  if (input.appEnv === 'production')
    return 'APP_ENV=production – zerstörerische Aktionen sind gesperrt.'
  if (input.isProductionMarked)
    return `Datenbank ${input.databaseName} ist als Produktion markiert.`
  if (input.requireTestSuffix && !input.databaseName.endsWith('_test')) {
    return `Datenbank ${input.databaseName} endet nicht auf _test – Reset verweigert.`
  }
  return null
}
