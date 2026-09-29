import 'server-only'

import type { CSSProperties } from 'react'

// Inline-Stile der Mails (KONZEPT §6.1, DESIGN): einspaltig, höchstens 600 px, Systemschriften (keine Webfonts,
// keine externen Ressourcen). Farben aus der Papier-/Tusche-Palette.

export const MAIL_WIDTH = 600

export const COLORS = {
  paper: '#f7f2ea',
  card: '#ffffff',
  ink: '#1d1a17',
  muted: '#5b5550',
  line: '#e2d9cc',
} as const

const FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"

export const S = {
  body: { margin: 0, padding: 0, backgroundColor: COLORS.paper },
  outer: { width: '100%', backgroundColor: COLORS.paper, padding: '24px 0' },
  container: {
    width: '100%',
    maxWidth: MAIL_WIDTH,
    margin: '0 auto',
    backgroundColor: COLORS.card,
    borderCollapse: 'collapse',
  },
  cell: {
    padding: '24px 28px',
    fontFamily: FONT,
    fontSize: 15,
    lineHeight: '1.55',
    color: COLORS.ink,
  },
  h1: { fontSize: 20, lineHeight: '1.3', margin: '0 0 16px', fontWeight: 700 },
  p: { margin: '0 0 12px' },
  footer: {
    padding: '16px 28px 24px',
    fontFamily: FONT,
    fontSize: 12,
    lineHeight: '1.5',
    color: COLORS.muted,
    borderTop: `1px solid ${COLORS.line}`,
  },
  link: { color: COLORS.ink, textDecoration: 'underline' },
  vignette: { display: 'block', width: 96, height: 72, border: 0, margin: '0 0 12px' },
} as const satisfies Record<string, CSSProperties>
