import 'server-only'

import type { Locale } from '@/lib/enums'
import { localizedPath } from '@/lib/routes/paths'

// Absolute Links der Mails (KONZEPT §6.1): nur die eigene Domain, ohne Tracking-Parameter (R-080, V-09).

/** Fester Platzhalter an der Stelle des Status-Tokens: Grundlage von `bodySha256` (KONZEPT §6.3, R-081). */
export const STATUS_TOKEN_PLACEHOLDER = '__STATUS_TOKEN__'

export interface MailLinks {
  siteUrl: string
  imprint: string
  privacy: string
  withdraw: string
  /** Status-Link mit Platzhalter (der Versand-Job setzt den Token erst unmittelbar vor dem Senden ein). */
  orderStatus: string | null
  /** Verwaltung (`ADMIN_ROUTE`). */
  admin: string
}

const trim = (url: string) => url.replace(/\/+$/, '')

export function mailLinks(input: {
  siteUrl: string
  adminRoute: string
  locale: Locale
  withStatusLink: boolean
}): MailLinks {
  const base = trim(input.siteUrl)
  const abs = (id: string, params?: Record<string, string>) =>
    `${base}${localizedPath(id, input.locale, params)}`
  return {
    siteUrl: base,
    imprint: abs('R21'),
    privacy: abs('R22'),
    withdraw: abs('R26'),
    orderStatus: input.withStatusLink ? abs('R09', { token: STATUS_TOKEN_PLACEHOLDER }) : null,
    admin: `${base}${input.adminRoute}`,
  }
}
