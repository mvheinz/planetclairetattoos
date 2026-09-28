'use client'

import { usePathname } from 'next/navigation'
import React from 'react'

import { Coco } from '@/components/Coco'
import { KnotArt } from '@/components/errors/ErrorArt'
import styles from '@/components/errors/ErrorPages.module.css'
import footerStyles from '@/components/layout/SiteFooter.module.css'
import { Button } from '@/components/ui/Button'
import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import { localizedPath } from '@/lib/routes/paths'
import { DEFAULT_LOCALE, type Locale } from '@/lib/routes/registry'
import { fontVariables } from '@/styles/fonts'

import '@/styles/tokens.css'
import '@/styles/global.css'
import '@/styles/coco.css'

// R29 für Fehler im Wurzel-Layout selbst (Next `global-error`): ersetzt das ganze Dokument, daher eigenes `<html>`/
// `<body>`, eigene Stile und Texte direkt aus den Sprachdateien (kein Layout, kein Provider). Gleiche Gestaltung wie
// `[locale]/error.tsx` (Knäuel, Coco `kopfschief`, „Nochmal versuchen“, keine Animation) plus schlichter Fußbereich mit
// „Vertrag widerrufen“ und den Pflichtlinks (R-011, R-090).

const MESSAGES = { de, en } as const
const LEGAL = ['R21', 'R22', 'R23', 'R24', 'R25', 'R20'] as const

function localeOf(pathname: string | null): Locale {
  return pathname && /^\/en(\/|$)/.test(pathname) ? 'en' : DEFAULT_LOCALE
}

export default function GlobalError({
  reset,
  retry,
}: {
  error: Error & { digest?: string }
  reset: () => void
  retry?: () => void
}) {
  const locale = localeOf(usePathname())
  const m = MESSAGES[locale]
  return (
    <html lang={locale} className={fontVariables}>
      <body data-route="R29" data-page-error="">
        <main id="inhalt" style={{ paddingBlock: 'var(--space-7)' }}>
          <div className={`u-container ${styles.page}`} data-server-error="">
            <div className={styles.tangle} aria-hidden="true">
              <KnotArt className={styles.knot} />
              <div className={styles.cocoSlot}>
                <Coco pose="kopfschief" size="xl" />
              </div>
            </div>
            <h1 className={styles.title}>{m.errors.serverErrorTitle}</h1>
            <p className={styles.text}>{m.errors.serverErrorText}</p>
            <div className={styles.actions}>
              <Button type="button" onClick={() => (retry ?? reset)()}>
                {m.errors.retry}
              </Button>
              <Button variant="link" href={localizedPath('R01', locale)}>
                {m.errors.toHome}
              </Button>
            </div>
          </div>
        </main>
        <footer className={footerStyles.footer} data-site-footer="">
          <div className={footerStyles.inner}>
            <div className={footerStyles.legalBlock} data-legal-footer="">
              <a
                href={localizedPath('R26', locale)}
                className={footerStyles.withdraw}
                data-withdraw-link=""
              >
                <span>{m.footer.withdraw}</span>
              </a>
              <nav aria-label={m.footer.legalHeading} className={footerStyles.column}>
                <ul className={footerStyles.list}>
                  {LEGAL.map((id) => (
                    <li key={id}>
                      <a href={localizedPath(id, locale)} className={footerStyles.link}>
                        {m.common.routes[id]}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
