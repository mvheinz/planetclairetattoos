import { getTranslations, setRequestLocale } from 'next-intl/server'
import React from 'react'

import { coil } from '@/components/leash/Station'
import { RichTextContent } from '@/components/content/RichTextContent'
import styles from '@/components/tattoo/Tattoo.module.css'
import { TattooShell } from '@/components/tattoo/TattooShell'
import { tattooLocale, tattooMetadata } from '@/components/tattoo/tattooRoute'
import { Callout } from '@/components/ui/Callout'
import { getAftercarePage, getTattooSettings, listFaqs } from '@/lib/data/tattoo'
import { SAFER_TATTOO_URL } from '@/lib/tattoo/links'

// R17 Aftercare (KONZEPT §9.2): Blöcke der Seite `tattoo_aftercare` in ihrer Reihenfolge – Einleitung (`richText`),
// Phasen (`aftercareSteps`), Warnzeichen (`callout`), FAQ (`faqList`). Fehlt der Warnzeichen-Kasten, steht der Entwurf
// aus den Nachrichten da; der Link auf die Safer-Tattoo-Checklisten des Bundesumweltministeriums ist ein einfacher
// externer Link (`rel="noopener noreferrer"`, V-27-Allowlist) und erscheint nur einmal. Druckfreundlich: `@media print`
// blendet Kopf, Navigation, Tuschelinie, Coco und den Kontakt-Block aus (`data-tattoo-print`). Keine Heilversprechen
// (V-15) – Texte sind Entwürfe, die Jutta an ihre Methode anpasst (SE-07).

export const revalidate = 3600
export const generateMetadata = tattooMetadata('R17')

export default async function AftercarePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = tattooLocale((await params).locale)
  setRequestLocale(locale)
  const [t, settings, page] = await Promise.all([
    getTranslations({ locale, namespace: 'tattoo.aftercare' }),
    getTattooSettings(locale),
    getAftercarePage(locale),
  ])
  const blocks = page?.layout ?? []
  const faqBlocks = blocks.filter((b) => b.blockType === 'faqList')
  const faqLists = await Promise.all(faqBlocks.map((b) => listFaqs(b.category, locale)))
  const hasWarn = blocks.some((b) => b.blockType === 'callout')
  const hasSaferLink = JSON.stringify(blocks).includes(SAFER_TATTOO_URL)
  const hasIntro = blocks.some((b) => b.blockType === 'richText')

  return (
    <TattooShell
      locale={locale}
      routeId="R17"
      settings={settings}
      lead={hasIntro ? null : <p>{page ? t('intro') : t('emptyText')}</p>}
      className={styles.aftercare}
    >
      <div className={styles.prose} data-tattoo-print="" data-tattoo-aftercare="">
        {blocks.map((b, i) => {
          const key = b.id ?? `${b.blockType}-${i}`
          switch (b.blockType) {
            case 'richText':
              return (
                <div key={key} className={styles.section}>
                  <RichTextContent data={b.content} />
                </div>
              )
            case 'aftercareSteps':
              return (
                <section key={key} className={styles.section} aria-label={b.heading ?? undefined}>
                  {b.heading ? (
                    <h2 className={styles.sectionHeading} {...coil(key, 1)}>
                      {b.heading}
                    </h2>
                  ) : null}
                  <ol className={styles.steps}>
                    {b.phases.map((p, j) => (
                      <li key={p.id ?? j} className={styles.step} data-aftercare-phase="">
                        <div>
                          <h3>{p.title}</h3>
                          <RichTextContent data={p.content} />
                        </div>
                      </li>
                    ))}
                  </ol>
                </section>
              )
            case 'callout':
              return (
                <div
                  key={key}
                  className={`${styles.section} ${styles.warn}`}
                  data-aftercare-warn=""
                >
                  <Callout variant="warn">
                    <p>{b.text}</p>
                  </Callout>
                </div>
              )
            case 'faqList': {
              const list = faqLists[faqBlocks.indexOf(b)] ?? []
              if (list.length === 0) return null
              return (
                <section key={key} className={styles.section} aria-label={b.heading ?? 'FAQ'}>
                  {b.heading ? (
                    <h2 className={styles.sectionHeading} {...coil(key, 2, 'spiral')}>
                      {b.heading}
                    </h2>
                  ) : null}
                  <ul className={styles.faq}>
                    {list.map((faq) => (
                      <li key={faq.id}>
                        <details className={styles.faqItem}>
                          <summary>{faq.question}</summary>
                          <div className={styles.faqAnswer}>
                            <RichTextContent data={faq.answer} />
                          </div>
                        </details>
                      </li>
                    ))}
                  </ul>
                </section>
              )
            }
            default:
              return null
          }
        })}
        {hasWarn ? null : (
          <section
            className={`${styles.section} ${styles.warn}`}
            aria-labelledby="aftercare-warn"
            data-aftercare-warn=""
            {...coil('warn', 0)}
          >
            <Callout variant="warn">
              <h2 id="aftercare-warn" className={styles.sectionHeading}>
                {t('warnHeading')}
              </h2>
              <p>{t('warnText')}</p>
            </Callout>
          </section>
        )}
        {hasSaferLink ? null : (
          <p data-aftercare-safer="">
            {t('saferHint')}{' '}
            <a href={SAFER_TATTOO_URL} rel="noopener noreferrer">
              {t('saferLink')}
            </a>
          </p>
        )}
      </div>
    </TattooShell>
  )
}
