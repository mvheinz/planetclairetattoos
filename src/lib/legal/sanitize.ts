import 'server-only'

import sanitizeHtml from 'sanitize-html'

// Bereinigung eingefügter Rechtstexte (R-012, KANZLEI-BRIEFING §1.2 und §16): nur die vereinbarten HTML-Elemente,
// keine Inline-Styles, Klassen, Skripte oder Einbettungen; Überschriften beginnen mit `h2` (die Seite setzt `h1`).
// Links nur mit `href` (https, mailto, tel oder relativ – Platzhalter wie `{{withdrawalUrl}}` bleiben erhalten).

/** Erlaubte Elemente (KANZLEI-BRIEFING §1.2). */
export const LEGAL_HTML_TAGS = [
  'h2',
  'h3',
  'h4',
  'p',
  'ul',
  'ol',
  'li',
  'strong',
  'em',
  'a',
  'br',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
] as const

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [...LEGAL_HTML_TAGS],
  allowedAttributes: { a: ['href'] },
  allowedSchemes: ['https', 'mailto', 'tel'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  nonTextTags: [
    'script',
    'style',
    'textarea',
    'option',
    'noscript',
    'iframe',
    'object',
    'template',
  ],
  // Gleichwertige Auszeichnungen übernehmen statt verwerfen.
  transformTags: { h1: 'h2', b: 'strong', i: 'em', h5: 'h4', h6: 'h4' },
}

/** Bereinigt ein HTML-Fragment auf die Allowlist (idempotent). */
export function sanitizeLegalHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim()
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Reiner Text (`.txt`, KANZLEI-BRIEFING §1.2) → Absätze; Leerzeilen trennen Absätze, Zeilenumbrüche bleiben. */
export function legalPlainTextToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('')
}
