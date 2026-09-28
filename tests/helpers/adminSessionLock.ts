import pg from 'pg'

// Sitzungen des einen Admin-Kontos (E-03) über parallele Playwright-Worker hinweg schützen.
//
// Payload speichert die Sitzungen als Liste am Konto (`users.sessions`, `auth.useSessions`). Jede Anmeldung liest das
// Konto, hängt eine Sitzung an und schreibt das ganze Konto zurück; ein Passwort-Reset leert die Liste bewusst
// (alle Geräte abmelden). Laufen die Projekte `desktop`, `iphone-15` und `pixel-7` parallel, gehen dadurch Sitzungen
// verloren: zwei gleichzeitige Anmeldungen überschreiben sich, und der Reset-Test meldet Tests anderer Worker mitten
// im Lauf ab (Umleitung zur Login-Seite). Das ist Verhalten der Anwendung, das die Tests respektieren müssen.
//
// Lösung ohne Abstriche an den Prüfungen: Postgres-Advisory-Locks in der Test-DB (werden beim Verbindungsende
// automatisch freigegeben).
// - `holdAdminSessions('shared')`: solange ein Test eine angemeldete Verwaltungsseite nutzt.
// - `holdAdminSessions('exclusive')`: für Vorgänge, die alle Sitzungen beenden (Passwort-Reset) – wartet, bis kein
//   anderer Test mehr angemeldet ist.
// - `withLoginLock(fn)`: Anmeldungen nacheinander, damit keine Sitzung beim Zurückschreiben verloren geht.

const SESSIONS_LOCK = 7_314_001
const LOGIN_LOCK = 7_314_002
const FIXTURE_RANGE_LOCK = 7_314_003
const CONFORMITY_LOCK = 7_314_004
const FIXTURE_BLOCK_LOCK_BASE = 7_314_100

export type ReleaseLock = () => Promise<void>

async function connect(): Promise<pg.Client> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL fehlt – Advisory-Lock nicht möglich.')
  const client = new pg.Client({ connectionString })
  await client.connect()
  return client
}

async function hold(key: number, mode: 'shared' | 'exclusive'): Promise<ReleaseLock> {
  const client = await connect()
  const fn = mode === 'shared' ? 'pg_advisory_lock_shared' : 'pg_advisory_lock'
  await client.query(`SELECT ${fn}($1)`, [key])
  let released = false
  return async () => {
    if (released) return
    released = true
    // Verbindungsende gibt den Session-Lock frei.
    await client.end()
  }
}

/** Hält den Sitzungs-Lock des Admin-Kontos bis zum Aufruf der zurückgegebenen Funktion. */
export const holdAdminSessions = (mode: 'shared' | 'exclusive'): Promise<ReleaseLock> =>
  hold(SESSIONS_LOCK, mode)

/** Führt eine Anmeldung (Formular oder Local API) exklusiv aus. */
export async function withLoginLock<T>(fn: () => Promise<T>): Promise<T> {
  const release = await hold(LOGIN_LOCK, 'exclusive')
  try {
    return await fn()
  } finally {
    await release()
  }
}

/**
 * Nummernbereich der E2E-Stücke (975–999): Projekt-Blöcke (`fixtureProducts`) halten ihn geteilt, Listen-Tests mit dem
 * ganzen Bereich (Paginierung, P3.5) exklusiv – so legen parallele Projekte nie dieselbe Nummer an.
 */
export const holdFixtureRange = (mode: 'shared' | 'exclusive'): Promise<ReleaseLock> =>
  hold(FIXTURE_RANGE_LOCK, mode)

/**
 * Aktive Konformitätserklärungen (R27, Fußlink, Badge „Lebensmittelecht“): Tests, die eine eigene Erklärung anlegen
 * (P3.8), halten den Lock exklusiv; Tests, die den Bestand zählen (Fußlink), geteilt.
 */
export const holdConformityData = (mode: 'shared' | 'exclusive'): Promise<ReleaseLock> =>
  hold(CONFORMITY_LOCK, mode)

/**
 * Ein Projekt-Block der E2E-Stücke (6 Nummern, `fixtureProducts`) exklusiv: Tests desselben Playwright-Projekts laufen in
 * mehreren Workern parallel und würden sonst dieselben Nummern anlegen bzw. die Stücke des anderen Tests löschen.
 */
export const holdFixtureBlock = (block: number): Promise<ReleaseLock> =>
  hold(FIXTURE_BLOCK_LOCK_BASE + block, 'exclusive')
