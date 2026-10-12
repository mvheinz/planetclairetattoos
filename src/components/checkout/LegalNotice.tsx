import { getTranslations } from 'next-intl/server'
import React from 'react'

import { RichTextContent } from '@/components/content/RichTextContent'
import { getLegalText, type LegalTextView } from '@/lib/data/legal'
import type { Locale } from '@/lib/enums'
import { getSnippet } from '@/lib/legal/snippets'
import { localizedPath } from '@/lib/routes/paths'

import styles from './Checkout.module.css'

// Hinweistext über dem Bestellknopf (KONZEPT §4.5 Nr. 6, R-063; PLAN P4.10): Baustein `checkout.legalNotice` mit Links auf
// AGB, Widerrufsbelehrung und Datenschutzerklärung. Mit JavaScript öffnen die Links die aktive Fassung in einem
// `<dialog>` auf der Seite (kein Seitenwechsel, kein neuer Tab; die Kassen-Komponente fängt den Klick ab), ohne
// JavaScript sind es normale Links auf die Rechtsseiten. Darunter der Baustein `withdrawal.returnCostsNote` (E-27).
// Der Dialog „Widerrufsbelehrung“ zeigt wie R24 auch das Muster-Widerrufsformular samt PDF und einen Link auf die ganze
// Seite (P18.5; die Belehrung verweist auf das Formular „im Abschnitt darunter und als PDF-Download“). PDF und Seite
// verlassen die Kasse nicht: das PDF wird heruntergeladen, die Seite öffnet in einem neuen Tab (Eingaben bleiben, R-063).

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

interface FormLabels {
  form: string
  formUnavailable: string
  fullPage: string
  pdfForm: string
}

/** Muster-Widerrufsformular unter der Belehrung im Dialog: Text, PDF-Download (wie LegalPage) und Link auf R24. */
function WithdrawalFormPart({
  view,
  locale,
  labels,
}: {
  view: LegalTextView
  locale: Locale
  labels: FormLabels
}) {
  return (
    <section
      className={styles.dialogForm}
      aria-label={labels.form}
      data-legal-dialog-form="widerrufsformular"
    >
      {view.state === 'ok' ? (
        <>
          <div lang={view.germanOnly ? 'de' : undefined}>
            <RichTextContent data={view.content} />
          </div>
          {view.hasPdf ? (
            <p>
              <a
                href={`/api/legal/widerrufsformular.pdf?locale=${locale}`}
                className={styles.textLink}
                data-legal-pdf="widerrufsformular"
                type="application/pdf"
                download
              >
                {labels.pdfForm}
              </a>
            </p>
          ) : null}
        </>
      ) : (
        <p>{labels.formUnavailable}</p>
      )}
      <p>
        <a
          href={localizedPath('R24', locale)}
          className={styles.textLink}
          target="_blank"
          rel="noopener"
          data-legal-dialog-page="R24"
        >
          {labels.fullPage}
        </a>
      </p>
    </section>
  )
}

export async function LegalNotice({ locale }: { locale: Locale }) {
  const [tLinks, tDialogs, tLegal, views, formView] = await Promise.all([
    getTranslations({ locale, namespace: 'checkout.legalLinks' }),
    getTranslations({ locale, namespace: 'checkout.dialogs' }),
    getTranslations({ locale, namespace: 'legal' }),
    Promise.all(LEGAL_DIALOGS.map((d) => getLegalText(d.type, locale))),
    getLegalText('widerrufsformular', locale),
  ])
  const formLabels: FormLabels = {
    form: tDialogs('form'),
    formUnavailable: tDialogs('formUnavailable'),
    fullPage: tDialogs('fullPage'),
    pdfForm: tLegal('pdfForm'),
  }
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
              {d.type === 'widerrufsbelehrung' ? (
                <WithdrawalFormPart view={formView} locale={locale} labels={formLabels} />
              ) : null}
            </div>
          </dialog>
        )
      })}
    </div>
  )
}
