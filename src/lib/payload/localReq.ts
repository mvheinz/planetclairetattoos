import type { PayloadRequest } from 'payload'

// Local-API-Aufrufe mit `req` (gleiche Transaktion) verändern `req.locale`, `req.fallbackLocale` und `req.context`
// (Payload `createLocalReq`). Dieser Helfer stellt die Werte danach wieder her, damit der äußere Vorgang (z. B. ein
// Hook in Sprache DE) unverändert weiterläuft.
export async function preservingReq<T>(req: PayloadRequest, fn: () => Promise<T>): Promise<T> {
  const { locale, fallbackLocale, context } = req
  try {
    return await fn()
  } finally {
    req.locale = locale
    req.fallbackLocale = fallbackLocale
    req.context = context
  }
}
