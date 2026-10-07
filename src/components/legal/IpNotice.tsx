import React from 'react'

import type { Locale, LegalSnippetKey } from '@/lib/enums'
import { getSnippet } from '@/lib/legal/snippets'

import styles from './IpNotice.module.css'

// Schutz des geistigen Eigentums (U-22, P12.11): sichtbare Hinweise aus den Verwaltungs-Bausteinen `ip.*` (Texte pflegt
// Jutta unter Texte → Rechtliche Bausteine). `footer`: Urheberrechtsvermerk und KI-/TDM-Vorbehalt (jede Seite);
// `purchase`: Kaufklausel (Produktseite); `flash`: Nachstech-Genehmigung bei Tattoo-Motiven (Flash, Preise, Ablauf).
// Reines Server-HTML, keine Animation; fehlt ein Baustein, erscheint nichts statt eines Fehlers.

export type IpNoticeKind = 'footer' | 'purchase' | 'flash'

const KEYS: Record<IpNoticeKind, readonly LegalSnippetKey[]> = {
  footer: ['ip.copyrightNotice', 'ip.aiMiningReservation'],
  purchase: ['ip.purchaseClause'],
  flash: ['ip.tattooFlashNotice'],
}

function texts(kind: IpNoticeKind, locale: Locale): string[] {
  return KEYS[kind].flatMap((key) => {
    try {
      return [getSnippet(key, locale).text]
    } catch {
      return []
    }
  })
}

export function IpNotice({
  locale,
  kind,
  className,
}: {
  locale: Locale
  kind: IpNoticeKind
  className?: string
}) {
  const lines = texts(kind, locale)
  if (lines.length === 0) return null
  const classes = [styles.notice, kind === 'footer' ? styles.footer : styles.block, className]
    .filter(Boolean)
    .join(' ')
  return (
    <p className={classes} data-ip-notice={kind} lang={locale}>
      {lines.join(' ')}
    </p>
  )
}
