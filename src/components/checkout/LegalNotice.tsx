import { getTranslations } from 'next-intl/server'
import React from 'react'

import { RichTextContent } from '@/components/content/RichTextContent'
import { getLegalText } from '@/lib/data/legal'
import type { Locale } from '@/lib/enums'
import { getSnippet } from '@/lib/legal/snippets'
import { localizedPath } from '@/lib/routes/paths'

import styles from './Checkout.module.css'

// Hinweistext über dem Bestellknopf (KONZEPT §4.5 Nr. 6, R-063; PLAN P4.10): Baustein `checkout.legalNotice` mit Links auf
// AGB, Widerrufsbelehrung und Datenschutzerklärung. Mit JavaScript öffnen die Links die aktive Fassung in einem
// `<dialog>` auf der Seite (kein Seitenwechsel, kein neuer Tab; die Kassen-Komponente fängt den Klick ab), ohne
// JavaScript sind es normale Links auf die Rechtsseiten. Darunter der Baustein `withdrawal.returnCostsNote` (E-27).

export const LEGAL_DIALOGS = [
  { type: 'agb', route: 'R23' },
  { type: 'widerrufsbelehrung', route: 'R24' },
  { type: 'datenschutz', route: 'R22' },
] as const
export type LegalDialogType = (typeof LEGAL_DIALOGS)[number]['type']

/** Ersetzt das erste Vorkommen je Wort durch einen Link (Reihenfolge wie im Text). */
function linkify(
  text: string,
  links: { word: string; node: (word: string) => React.ReactNode }[],
): React.ReactNode[] {
  const out: React.ReactNode[] = []
  let rest = text
  let key = 0
  for (;;) {
    let best: { index: number; link: (typeof links)[number] } | null = null
    for (const link of links) {
      const index = rest.indexOf(link.word)
      if (index >= 0 && (!best || index < best.index)) best = { index, link }
    }
    if (!best) break
    if (best.index > 0) out.push(rest.slice(0, best.index))
    out.push(<React.Fragment key={key++}>{best.link.node(best.link.word)}</React.Fragment>)
    rest = rest.slice(best.index + best.link.word.length)
    links = links.filter((l) => l !== best!.link)
  }
  if (rest) out.push(rest)
  return out
}

export async function LegalNotice({ locale }: { locale: Locale }) {
  const [tLinks, tDialogs, views] = await Promise.all([
    getTranslations({ locale, namespace: 'checkout.legalLinks' }),
    getTranslations({ locale, namespace: 'checkout.dialogs' }),
    Promise.all(LEGAL_DIALOGS.map((d) => getLegalText(d.type, locale))),
  ])
  const notice = getSnippet('checkout.legalNotice', locale)
  const returnCosts = getSnippet('withdrawal.returnCostsNote', locale)
  const links = LEGAL_DIALOGS.map((d) => ({
    word: tLinks(d.type),
    node: (word: string) => (
      <a
        href={localizedPath(d.route, locale)}
        data-legal-dialog={d.type}
        aria-haspopup="dialog"
        className={styles.inlineLink}
      >
        {word}
      </a>
    ),
  }))

  return (
    <div className={styles.legalNotice} data-legal-notice="">
      <p data-snippet="checkout.legalNotice">{linkify(notice.text, links)}</p>
      <p data-snippet="withdrawal.returnCostsNote" className={styles.small}>
        {returnCosts.text}
      </p>
      {LEGAL_DIALOGS.map((d, i) => {
        const view = views[i]!
        return (
          <dialog
            key={d.type}
            id={`legal-dialog-${d.type}`}
            className={styles.dialog}
            aria-labelledby={`legal-dialog-${d.type}-title`}
            data-legal-dialog-panel={d.type}
          >
            <div className={styles.dialogHead}>
              <h2 id={`legal-dialog-${d.type}-title`} className={styles.dialogTitle}>
                {tDialogs(d.type)}
              </h2>
              <button type="button" className={styles.textButton} data-dialog-close="">
                {tDialogs('close')}
              </button>
            </div>
            <div className={styles.dialogBody}>
              {view.state === 'ok' ? (
                <RichTextContent data={view.content} />
              ) : (
                <p>
                  {tDialogs('unavailable')}{' '}
                  <a href={localizedPath(d.route, locale)}>{tDialogs(d.type)}</a>
                </p>
              )}
            </div>
          </dialog>
        )
      })}
    </div>
  )
}
