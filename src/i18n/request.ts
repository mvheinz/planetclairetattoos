// Nachrichten und Zeitzone je Anfrage (next-intl). Anzeige immer Europe/Berlin (CLAUDE.md §6).
import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'

import { routing } from './routing'

export const TIME_ZONE = 'Europe/Berlin'

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
  const messages = (await import(`./messages/${locale}.json`)) as {
    default: Record<string, unknown>
  }
  return { locale, timeZone: TIME_ZONE, messages: messages.default }
})
