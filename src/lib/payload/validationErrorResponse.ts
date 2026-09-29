import type { AfterErrorHook } from 'payload'

// Feldfehler in REST-Antworten erhalten (PLAN P5.6). Payloads `formatErrors` erkennt einen `ValidationError` per
// `instanceof`; im Produktions-Build stammen Fehler und Formatierer aus verschiedenen Modul-Instanzen, dann fehlt
// `data.errors` (Feldpfad + Text) in der Antwort und die Verwaltung sähe nur „The following field is invalid: …“.
// Dieser Hook erkennt den Fehler am Namen und gibt die Feldliste wie Payload selbst aus.

interface FieldErrorLike {
  path?: unknown
  message?: unknown
  label?: unknown
}

export const keepValidationErrorData: AfterErrorHook = ({ error, result }) => {
  const err = error as Error & { data?: { errors?: FieldErrorLike[] } & Record<string, unknown> }
  if (!result || err?.name !== 'ValidationError') return
  const fieldErrors = err.data?.errors
  if (!Array.isArray(fieldErrors) || fieldErrors.length === 0) return
  const first = result.errors?.[0] as { data?: unknown } | undefined
  if (first?.data) return
  return {
    response: {
      ...result,
      errors: [{ name: err.name, message: err.message, data: err.data }],
    },
  }
}
