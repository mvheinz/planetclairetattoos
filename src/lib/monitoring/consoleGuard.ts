import 'server-only'

import { errorSummary, redact, redactText } from '@/lib/security/redact'

// Fehlerausgaben außerhalb unseres Loggers (R-137, ARCHITEKTUR §8.11, Prüfung P18.5 Nr. 2): Next.js schreibt
// unbehandelte Fehler aus Server-Actions und Routen mit `console.error` nach stdout, Payload seine Fehler über pino.
// Bei Datenbank-Fehlern stehen in der Meldung (und in der ersten Zeile des Stacks) die Werte der Abfrage
// (`params: …` mit Namen, Adressen, Freitext). Beides läuft deshalb durch dieselbe Schwärzung wie unser Logger.

const FRAMES = /\n\s+at [\s\S]*$/

/** Fehler als Kurzform (ohne Abfragewerte) plus Stack-Zeilen ohne die Meldung. */
function errorText(e: Error): string {
  const frames = typeof e.stack === 'string' ? (e.stack.match(FRAMES)?.[0] ?? '') : ''
  return `${errorSummary(e)}${frames}`
}

/** Ein Argument von `console.error`/`console.warn` geschwärzt. */
export function sanitizeConsoleArg(arg: unknown): unknown {
  if (arg instanceof Error) return errorText(arg)
  if (typeof arg === 'string') return redactText(arg)
  if (arg !== null && typeof arg === 'object') return redact(arg)
  return arg
}

const INSTALLED = Symbol.for('planetclaire.consoleGuard')

/** Hüllt `console.error` und `console.warn` einmalig ein (nur Server, siehe `src/instrumentation.ts`). */
export function installConsoleGuard(target: Console = console): void {
  const flagged = target as Console & { [INSTALLED]?: true }
  if (flagged[INSTALLED]) return
  for (const level of ['error', 'warn'] as const) {
    const original = target[level].bind(target)
    target[level] = (...args: unknown[]) => original(...args.map(sanitizeConsoleArg))
  }
  flagged[INSTALLED] = true
}

/** pino-Serializer für `err` (Payload-Logger): Typ, Code und Kurzform statt roher Meldung mit Abfragewerten. */
export function serializeLogError(e: unknown): Record<string, unknown> {
  if (!(e instanceof Error)) return { message: errorSummary(e) }
  const code = (e as { code?: unknown }).code
  return {
    type: e.constructor?.name ?? e.name,
    ...(typeof code === 'string' || typeof code === 'number' ? { code } : {}),
    message: errorSummary(e),
    stack: errorText(e),
  }
}
