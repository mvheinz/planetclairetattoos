'use client'

import React from 'react'

import { Coco } from '@/components/Coco'
import styles from '@/components/errors/ErrorPages.module.css'
import { KnotArt } from '@/components/errors/ErrorArt'
import footerStyles from '@/components/layout/SiteFooter.module.css'
import { Button } from '@/components/ui/Button'
import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'

// Inhalt von `global-error.tsx` (R29 bei Fehlern im Wurzel-Layout): Texte direkt aus den Sprachdateien (kein Layout,
// kein Provider). Wird erst nachgeladen, wenn der Fall eintritt – Next lädt `global-error` mit jeder Seite, die
// Sprachdateien beider Sprachen gehören nicht ins Erstlade-JavaScript (ARCHITEKTUR §7.7, P2.23).

const MESSAGES = { de, en } as const
const LEGAL = ['R21', 'R22', 'R23', 'R24', 'R25', 'R20'] as const

export default function GlobalErrorContent({
  locale,
  onRetry,
}: {
  locale: Locale
  onRetry: () => void
}) {
  const m = MESSAGES[locale]
  return (
    <>
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
            <Button type="button" onClick={onRetry}>
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
    </>
  )
}
