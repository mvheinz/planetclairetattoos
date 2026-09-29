import { test, type TestInfo } from '@playwright/test'
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
//
// Verklemmungsfrei (P3.16): Postgres stellt eine neue geteilte Anforderung hinter eine wartende exklusive. Holte ein Test
// denselben Lock zweimal geteilt über zwei Verbindungen (z. B. `holdListData('shared')` im `beforeEach` und die Fixture
// `fixtureProducts`), während ein anderer Worker exklusiv wartet, warteten beide ewig aufeinander – Postgres sieht den
// Zusammenhang der zwei Verbindungen nicht. Deshalb sind geteilte Locks je Worker-Prozess wiedereintrittsfähig (eine
// Verbindung, Zähler); ein geteilter Lock unter dem eigenen exklusiven ist schon gedeckt; exklusiv unter dem eigenen
// geteilten (Upgrade) bricht sofort mit Fehler ab statt zu hängen. Exklusive Locks bleiben je Aufruf eigene Verbindungen
// (`withLoginLock` serialisiert auch Anmeldungen innerhalb eines Tests). Wartezeit auf einen Lock verlängert die
// Zeitgrenze des laufenden Tests um genau diese Wartezeit (lange Tests anderer Worker lassen Wartende nicht scheitern).

const SESSIONS_LOCK = 7_314_001
const LOGIN_LOCK = 7_314_002
const FIXTURE_RANGE_LOCK = 7_314_003
const CONFORMITY_LOCK = 7_314_004
const SHIPPING_RATES_LOCK = 7_314_005
const FIXTURE_BLOCK_LOCK_BASE = 7_314_100
/** Höchste Wartezeit auf einen Lock, um die die Zeitgrenze des Tests vorübergehend verlängert wird. */
const MAX_LOCK_WAIT_MS = 5 * 60_000

export type ReleaseLock = () => Promise<void>
type Mode = 'shared' | 'exclusive'

async function connect(): Promise<pg.Client> {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL fehlt – Advisory-Lock nicht möglich.')
  const client = new pg.Client({ connectionString })
  await client.connect()
  return client
}

/** Wartet auf `acquire`; im laufenden Playwright-Test zählt die Wartezeit nicht gegen dessen Zeitgrenze. */
async function waitExtendingTimeout<T>(acquire: () => Promise<T>): Promise<T> {
  let info: TestInfo | undefined
  try {
    info = test.info()
  } catch {
    info = undefined
  }
  const base = info?.timeout ?? 0
  if (!info || base === 0) return acquire()
  info.setTimeout(base + MAX_LOCK_WAIT_MS)
  const started = Date.now()
  try {
    return await acquire()
  } finally {
    info.setTimeout(base + (Date.now() - started))
  }
}

async function lockOn(key: number, mode: Mode): Promise<pg.Client> {
  const client = await connect()
  const fn = mode === 'shared' ? 'pg_advisory_lock_shared' : 'pg_advisory_lock'
  try {
    await waitExtendingTimeout(() => client.query(`SELECT ${fn}($1)`, [key]))
  } catch (e) {
    await client.end().catch(() => undefined)
    throw e
  }
  return client
}

interface SharedHold {
  count: number
  client: Promise<pg.Client>
}
/** Geteilte Locks dieses Worker-Prozesses (eine Verbindung je Schlüssel) und Anzahl eigener exklusiver Locks. */
const sharedHolds = new Map<number, SharedHold>()
const exclusiveHolds = new Map<number, number>()

function once(fn: () => Promise<void>): ReleaseLock {
  let released = false
  return async () => {
    if (released) return
    released = true
    await fn()
  }
}

async function hold(key: number, mode: Mode): Promise<ReleaseLock> {
  if (mode === 'shared') {
    // Unter dem eigenen exklusiven Lock ist der geteilte schon gedeckt.
    if ((exclusiveHolds.get(key) ?? 0) > 0) return once(async () => undefined)
    let entry = sharedHolds.get(key)
    if (!entry) {
      entry = { count: 0, client: lockOn(key, 'shared') }
      sharedHolds.set(key, entry)
      const current = entry
      current.client.catch(() => {
        if (sharedHolds.get(key) === current) sharedHolds.delete(key)
      })
    }
    entry.count++
    const current = entry
    try {
      await current.client
    } catch (e) {
      current.count--
      throw e
    }
    return once(async () => {
      current.count--
      if (current.count > 0) return
      if (sharedHolds.get(key) === current) sharedHolds.delete(key)
      // Verbindungsende gibt den Session-Lock frei.
      await (await current.client).end()
    })
  }
  if ((sharedHolds.get(key)?.count ?? 0) > 0)
    throw new Error(
      `Advisory-Lock ${key}: exklusiv angefordert, während dieser Worker ihn geteilt hält (Upgrade – würde sich selbst blockieren).`,
    )
  const client = await lockOn(key, 'exclusive')
  exclusiveHolds.set(key, (exclusiveHolds.get(key) ?? 0) + 1)
  return once(async () => {
    exclusiveHolds.set(key, (exclusiveHolds.get(key) ?? 1) - 1)
    // Verbindungsende gibt den Session-Lock frei.
    await client.end()
  })
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
 * Versandpreise in `settings.shipping.rates` (R-031): Tests, die einen Klassenpreis kurz ändern, halten den Lock
 * exklusiv; Tests, die die Grund-Seed-Preise erwarten (R25, Korb), geteilt.
 */
export const holdShippingRates = (mode: 'shared' | 'exclusive'): Promise<ReleaseLock> =>
  hold(SHIPPING_RATES_LOCK, mode)

/**
 * Ein Projekt-Block der E2E-Stücke (6 Nummern, `fixtureProducts`) exklusiv: Tests desselben Playwright-Projekts laufen in
 * mehreren Workern parallel und würden sonst dieselben Nummern anlegen bzw. die Stücke des anderen Tests löschen.
 */
export const holdFixtureBlock = (block: number): Promise<ReleaseLock> =>
  hold(FIXTURE_BLOCK_LOCK_BASE + block, 'exclusive')
