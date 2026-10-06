import 'server-only'

import { connection } from 'next/server'

import { buildWithoutDb } from '@/lib/env'

/**
 * Docker-Build ohne Datenbank (ARCHITEKTUR §13.2, Spike B-08): Datenfunktionen rufen das vor dem ersten DB-Zugriff auf.
 * Während `next build` mit `BUILD_WITHOUT_DB=1` hält `connection()` das Vorrendern an – die Seite wird zur Laufzeit
 * gerendert; sonst (Vercel, Betrieb, Tests) ist es ein No-op.
 */
export async function dbGate(): Promise<void> {
  if (buildWithoutDb()) await connection()
}
