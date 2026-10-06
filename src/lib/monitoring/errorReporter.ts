// Brücke Logger → Sentry (ARCHITEKTUR §11.2 M-01): `logger.error` meldet über den in `instrumentation.ts` eingetragenen
// Melder. Ohne Eintrag (kein DSN) passiert nichts. Kein SDK-Import hier.
export type ErrorReporter = (event: string, fields: Record<string, unknown>) => void

let reporter: ErrorReporter | undefined

export function setErrorReporter(fn: ErrorReporter | undefined): void {
  reporter = fn
}

export function reportError(event: string, fields: Record<string, unknown>): void {
  try {
    reporter?.(event, fields)
  } catch {
    // Melden darf nie selbst einen Fehler auslösen.
  }
}
