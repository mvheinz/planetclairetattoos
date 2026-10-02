import path from 'node:path'

import { STATUS_TOKEN_PLACEHOLDER } from '@/lib/email/layout'

// Gemeinsame Prüfungen der Vorlagen-Tests (P4.14/P4.15): Snapshots unter `tests/fixtures/mails/`, unersetzte Tokens.

export function snapshotPath(template: string, locale: string, ext: 'txt' | 'html'): string {
  return path.resolve(
    import.meta.dirname,
    '../../../fixtures/mails',
    `${template}.${locale}.${ext}`,
  )
}

/** Rohe Platzhalter (`{{x}}`, `{x}`, `__X__` außer dem Status-Token-Platzhalter) – müssen leer sein (R-084). */
export function rawTokens(mail: { html: string; text: string }): string[] {
  const all = `${mail.text}\n${mail.html}`.split(STATUS_TOKEN_PLACEHOLDER).join('')
  return [
    ...all.matchAll(/\{\{[^}]*\}\}|\{[A-Za-z_]\w*\}|__[A-Z_]+__|undefined|NaN|\[object Object\]/g),
  ].map((m) => m[0])
}

/** Geschützte Leerzeichen der Betragsformatierung (Intl) für Textvergleiche durch normale ersetzen. */
export function plain<T extends { html: string; text: string; subject: string }>(mail: T): T {
  const n = (s: string) => s.replace(/[\u00a0\u202f]/g, ' ')
  return { ...mail, html: n(mail.html), text: n(mail.text), subject: n(mail.subject) }
}
