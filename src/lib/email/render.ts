import 'server-only'

// Passwort-Reset A17 (P1.9): verschickt Payload selbst; alle übrigen Vorlagen stehen in `src/lib/email/registry.ts`
// (Layout `src/lib/email/layout/`, P4.13).

export const P1_TEMPLATE_VERSION = 'p1-plain-1'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Platzhalter an der Token-Stelle für `bodySha256` (der Token selbst wird nie gespeichert, A17). */
export const RESET_TOKEN_PLACEHOLDER = '{token}'

/** Reset-Link unter dem Verwaltungspfad (ADMIN_ROUTE), 1 Stunde gültig (DATENMODELL §6.1). */
export function adminResetUrl(siteUrl: string, adminRoute: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, '')}${adminRoute}/reset/${token}`
}

/** A17 „Passwort vergessen“ (Schlüssel `admin_password_reset`) – Verwaltungs-Mail, immer Deutsch. */
export function renderAdminPasswordReset(input: { resetUrl: string }): {
  subject: string
  text: string
  html: string
  templateVersion: string
} {
  const subject = 'Neues Passwort für deine Verwaltung'
  const lines = [
    'Hallo,',
    '',
    'jemand hat für deine Website ein neues Passwort angefordert. Über diesen Link legst du es fest:',
    '',
    input.resetUrl,
    '',
    'Der Link ist 1 Stunde gültig.',
    '',
    'Wenn du das nicht warst, kannst du diese Mail einfach ignorieren – dein Passwort bleibt dann unverändert.',
  ]
  const text = `${lines.join('\n')}\n`
  const url = escapeHtml(input.resetUrl)
  const html = [
    '<p>Hallo,</p>',
    '<p>jemand hat für deine Website ein neues Passwort angefordert. Über diesen Link legst du es fest:</p>',
    `<p><a href="${url}">${url}</a></p>`,
    '<p>Der Link ist 1 Stunde gültig.</p>',
    '<p>Wenn du das nicht warst, kannst du diese Mail einfach ignorieren – dein Passwort bleibt dann unverändert.</p>',
  ].join('\n')
  return { subject, text, html, templateVersion: P1_TEMPLATE_VERSION }
}
