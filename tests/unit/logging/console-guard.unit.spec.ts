import { describe, expect, it } from 'vitest'

import { isDeployedEnv } from '@/lib/env'
import {
  installConsoleGuard,
  sanitizeConsoleArg,
  serializeLogError,
} from '@/lib/monitoring/consoleGuard'

// P18.5 (Prüfung Datenschutz Nr. 2, R-137): Auch was nicht über unseren Logger läuft – `console.error` von Next.js für
// unbehandelte Fehler und Payloads pino-Logger – darf keine Abfragewerte (Name, Adresse, Freitext) ausgeben.

/** Nachbau von drizzle-orm `DrizzleQueryError` (0.45): Meldung mit `params`, Ursache in `cause`. */
class DrizzleQueryError extends Error {
  constructor(query: string, params: unknown[], cause?: unknown) {
    super(`Failed query: ${query}\nparams: ${params}`)
    this.cause = cause
  }
}

const PERSONAL = [
  'Erika Beispiel',
  'erika.beispiel@web.de',
  'Musterstraße 1',
  'Drachen auf der Schulter',
]

function dbError() {
  const cause = Object.assign(new Error('duplicate key value violates unique constraint "x_idx"'), {
    code: '23505',
    detail: 'Key (email)=(erika.beispiel@web.de) already exists.',
  })
  return new DrizzleQueryError(
    'insert into "inquiries" ("name", "email", "street", "idea") values ($1, $2, $3, $4)',
    PERSONAL,
    cause,
  )
}

const leaks = (text: string) => PERSONAL.filter((p) => text.includes(p))

describe('P18.5 Fehlerausgaben außerhalb des Loggers', () => {
  it('sanitizeConsoleArg: Fehler ohne params, mit Stack-Zeilen; Texte und Objekte geschwärzt', () => {
    const e = dbError()
    const out = String(sanitizeConsoleArg(e))
    expect(leaks(out)).toEqual([])
    expect(out).toContain('DrizzleQueryError')
    expect(out).toContain('[23505]')
    expect(out).toMatch(/\n\s+at /)
    expect(sanitizeConsoleArg(`Fehler bei ${PERSONAL[1]}`)).not.toContain(PERSONAL[1])
    expect(leaks(JSON.stringify(sanitizeConsoleArg({ err: e, email: PERSONAL[1] })))).toEqual([])
    expect(sanitizeConsoleArg(42)).toBe(42)
  })

  it('installConsoleGuard: error und warn geschwärzt, nur einmal eingehüllt', () => {
    const seen: unknown[][] = []
    const fake = {
      error: (...args: unknown[]) => seen.push(args),
      warn: (...args: unknown[]) => seen.push(args),
    } as unknown as Console
    installConsoleGuard(fake)
    installConsoleGuard(fake)
    fake.error('⨯', dbError())
    fake.warn(`an ${PERSONAL[1]}`)
    expect(seen).toHaveLength(2)
    expect(leaks(JSON.stringify(seen))).toEqual([])
    expect(seen[0]![0]).toBe('⨯')
  })

  it('serializeLogError (pino `err`): Typ, Code, Kurzform – keine Werte', () => {
    const out = serializeLogError(dbError())
    expect(out.type).toBe('DrizzleQueryError')
    expect(leaks(JSON.stringify(out))).toEqual([])
    expect(serializeLogError('kaputt')).toEqual({ message: 'kaputt' })
  })

  it('nur in ausgerollten Umgebungen eingeschaltet (Vorschau, Staging, Produktion)', () => {
    expect(['development', 'test'].map((e) => isDeployedEnv(e as never))).toEqual([false, false])
    expect(['preview', 'staging', 'production'].every((e) => isDeployedEnv(e as never))).toBe(true)
  })
})
