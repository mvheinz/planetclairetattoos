import 'server-only'

import type { EmailTemplate } from '@/lib/enums'

// Vorlagen-Rendering, Grundfassung P1: nur `admin_alert` (A12) als schlichter Text. Layout, Registry und alle übrigen
// Vorlagen folgen in P4 (`src/lib/email/registry.ts`).

export const P1_TEMPLATE_VERSION = 'p1-plain-1'

export class TemplateNotImplementedError extends Error {
  constructor(template: string) {
    super(`Mail-Vorlage „${template}“ ist noch nicht umgesetzt (Vorlagen folgen in P4).`)
    this.name = 'TemplateNotImplementedError'
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Verwaltungs-Mails sind immer Deutsch (DATENMODELL §1.2). */
const ADMIN_ALERT_FOOTER =
  'Diese Nachricht wurde automatisch von deiner Website erzeugt. Details findest du in der Verwaltung unter „System“.'

export function renderPlainTemplate(
  template: EmailTemplate,
  input: { subject: string },
): { subject: string; text: string; html: string; templateVersion: string } {
  if (template !== 'admin_alert') throw new TemplateNotImplementedError(template)
  const text = `${input.subject}\n\n${ADMIN_ALERT_FOOTER}\n`
  const html = `<p>${escapeHtml(input.subject)}</p><p>${escapeHtml(ADMIN_ALERT_FOOTER)}</p>`
  return { subject: input.subject, text, html, templateVersion: P1_TEMPLATE_VERSION }
}

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
