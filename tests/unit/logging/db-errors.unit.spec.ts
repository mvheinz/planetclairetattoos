import { describe, expect, it } from 'vitest'

import { createLogger, errorSummary } from '@/lib/monitoring/logger'
import { redactSentryBreadcrumb, redactSentryEvent } from '@/lib/monitoring/sentry'
import { redact, redactText } from '@/lib/security/redact'

// P18.5 (Prüfung Datenschutz, R-137, R-133): Datenbank-Fehler tragen die Werte der Anfrage in der Meldung –
// `DrizzleQueryError` hängt `\nparams: …` an, Postgres nennt Werte in `detail` (`Failing row contains (…)`,
// `Key (…)=(…)`). Weder Logger noch Sentry dürfen Name, Adresse oder Freitext weitergeben.

/** Nachbau von drizzle-orm `DrizzleQueryError` (0.45): kein eigener `name`, Meldung mit `params`, Ursache in `cause`. */
class DrizzleQueryError extends Error {
  constructor(
    public query: string,
    public params: unknown[],
    cause?: unknown,
  ) {
    super(`Failed query: ${query}\nparams: ${params}`)
    this.cause = cause
  }
}

/** Nachbau von pg `DatabaseError` (`name = 'error'`, SQLSTATE in `code`, Werte in `detail`). */
function pgError(message: string, code: string, detail: string, constraint?: string) {
  const e = new Error(message) as Error & Record<string, unknown>
  e.name = 'error'
  e.code = code
  e.detail = detail
  if (constraint) e.constraint = constraint
  return e
}

const PERSON = [
  'Erika Beispiel',
  'Musterstraße 1',
  '10115 Berlin',
  'Einen Drachen auf der Schulter',
]
const QUERY =
  'insert into "inquiries" ("name", "email", "street", "city", "idea") values ($1, $2, $3, $4, $5) returning "id"'

function drizzleError() {
  const cause = pgError(
    'duplicate key value violates unique constraint "inquiries_reference_idx"',
    '23505',
    'Key (email)=(erika.beispiel@web.de) already exists.',
    'inquiries_reference_idx',
  )
  return new DrizzleQueryError(
    QUERY,
    ['Erika Beispiel', 'erika.beispiel@web.de', 'Musterstraße 1', '10115 Berlin', PERSON[3]],
    cause,
  )
}

function capture() {
  const lines: string[] = []
  const logger = createLogger({
    level: 'debug',
    sink: (l) => lines.push(l),
    now: () => new Date('2026-10-15T08:00:00Z'),
  })
  return { lines, logger }
}

const expectNoPerson = (out: string) => {
  for (const secret of [...PERSON, 'erika.beispiel@web.de'])
    expect(out, secret).not.toContain(secret)
}

describe('Datenbank-Fehler ohne Werte (R-137)', () => {
  it('redactText: `params:` (echter und JSON-kodierter Umbruch) und Postgres-Details', () => {
    const msg = `Failed query: ${QUERY}\nparams: Erika Beispiel,Musterstraße 1,10115 Berlin`
    expect(redactText(msg)).toBe(`Failed query: ${QUERY}\nparams: [redacted]`)
    expect(redactText(JSON.stringify(msg))).not.toContain('Erika')
    expect(redactText(JSON.stringify(msg))).toContain('\\nparams: [redacted]')
    expect(redactText('Failing row contains (17, Erika Beispiel, (Musterstraße 1), null).')).toBe(
      'Failing row contains ([redacted])',
    )
    expect(redactText('Key (email, name)=(erika@web.de, Erika Beispiel) already exists.')).toBe(
      'Key (email, name)=([redacted])',
    )
    expect(redactText('invalid input syntax for type integer: "Erika Beispiel"')).toBe(
      'invalid input syntax for type integer: "[redacted]"',
    )
    // ohne Werte bleibt alles lesbar
    expect(redactText('null value in column "name" of relation "orders"')).toBe(
      'null value in column "name" of relation "orders"',
    )
  })

  it('Logger: Fehler-Objekt mit `cause` und errorSummary – SQL, Code und Constraint lesbar, keine Personendaten', () => {
    const { lines, logger } = capture()
    const err = drizzleError()
    logger.error('commission.submit_failed', { reason: errorSummary(err), err })
    const out = lines[0]!
    expectNoPerson(out)
    const parsed = JSON.parse(out) as { reason: string; err: Record<string, unknown> }
    expect(parsed.reason).toBe(
      `DrizzleQueryError: Failed query: ${QUERY} params: [redacted] ← error [23505]: duplicate key value violates unique constraint "inquiries_reference_idx"`,
    )
    expect(parsed.err).toEqual({
      name: 'Error',
      message: `Failed query: ${QUERY}\nparams: [redacted]`,
      cause: {
        name: 'error',
        code: '23505',
        constraint: 'inquiries_reference_idx',
        message: 'duplicate key value violates unique constraint "inquiries_reference_idx"',
      },
    })
    // weder `query`/`params` noch Postgres-`detail` werden übernommen
    expect(out).not.toContain('"detail"')
    expect(out).not.toContain('"params"')
  })

  it('redact: verschachtelte und zyklische `cause`-Ketten', () => {
    const inner = pgError('x', '23514', 'Failing row contains (Erika Beispiel).')
    const outer = new Error('outer', { cause: inner })
    inner.cause = outer
    const r = redact({ error: outer }) as { error: { cause: { cause: unknown } } }
    expect(r.error.cause.cause).toBe('[circular]')
    expect(JSON.stringify(r)).not.toContain('Erika')
  })

  it('errorSummary: schlichte Fehler unverändert, Name und Code bei anderen, kurze Teile, höchstens drei Ebenen', () => {
    expect(errorSummary(new Error('boom'))).toBe('boom')
    expect(errorSummary(new TypeError('x is undefined'))).toBe('TypeError: x is undefined')
    expect(errorSummary('nur Text an erika@web.de')).toBe('nur Text an [redacted]')
    expect(errorSummary({ message: 'Objekt' })).toBe('Objekt')
    expect(errorSummary(undefined)).toBe('')
    const conn = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    })
    expect(errorSummary(conn)).toBe('[ECONNREFUSED]: connect ECONNREFUSED 127.0.0.1:5432')
    const long = errorSummary(new Error('a'.repeat(1000)))
    expect(long.length).toBe(240)
    expect(long.endsWith('…')).toBe(true)
    let chain: Error = new Error('e0')
    for (let i = 1; i < 6; i++) chain = new Error(`e${i}`, { cause: chain })
    expect(errorSummary(chain)).toBe('e5 ← e4 ← e3')
    // fremde `code`-Werte mit Leerzeichen/Personendaten werden nicht übernommen
    expect(errorSummary(Object.assign(new Error('m'), { code: 'Erika Beispiel' }))).toBe('m')
  })
})

describe('Sentry ohne Werte aus Datenbank-Fehlern (R-133)', () => {
  it('alle Ausnahmen der Kette (auch `cause`), lokale Variablen und Mechanismus-Daten', () => {
    const err = drizzleError()
    const event = {
      exception: {
        values: [
          {
            type: 'error',
            value: 'duplicate key value violates unique constraint "inquiries_reference_idx"',
            mechanism: { type: 'chained', data: { detail: 'Key (email)=(erika.beispiel@web.de)' } },
          },
          {
            type: 'Error',
            value: err.message,
            stacktrace: {
              frames: [{ function: 'submitCommission', vars: { name: 'Erika Beispiel' } }],
            },
          },
        ],
      },
      message: `Error: ${err.message}`,
      contexts: { error: { query: QUERY, params: err.params, detail: 'Failing row contains (x)' } },
    }
    const out = redactSentryEvent(event)
    expectNoPerson(JSON.stringify(out))
    expect(out.exception.values[1]!.value).toBe(`Failed query: ${QUERY}\nparams: [redacted]`)
    expect(out.exception.values[1]!.stacktrace!.frames[0]).toEqual({ function: 'submitCommission' })
    // Eigenschaften des Fehlers im Kontext (z. B. über eine Integration): ohne `params` und `detail`
    expect(out.contexts).toEqual({ error: { query: QUERY } })
  })

  it('Konsolen-Breadcrumb mit Fehlertext und Fehler-Objekt', () => {
    const err = drizzleError()
    const crumb = redactSentryBreadcrumb({
      category: 'console',
      message: `Error: ${err.message}\n    at submitCommission (form.ts:97)`,
      data: { arguments: [err, `${err.message}`] },
    })
    expectNoPerson(JSON.stringify(crumb))
    expect(crumb.message).toContain('params: [redacted]')
  })
})
