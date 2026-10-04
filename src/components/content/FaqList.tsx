import { getTranslations } from 'next-intl/server'
import React from 'react'

import tattoo from '@/components/tattoo/Tattoo.module.css'
import { EmptyState } from '@/components/ui/EmptyState'
import { listFaqs } from '@/lib/data/tattoo'
import type { FaqCategory } from '@/lib/enums'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'

import { RichTextContent } from './RichTextContent'

// Block `faqList` einer Seite (DATENMODELL §6.19; Kontakt R20, Auftragsarbeiten R10): Überschrift und die Einträge der
// Kategorie als `<details>` (ohne JavaScript per Tastatur auf- und zuklappbar). Ohne Einträge der Leerzustand KO-17
// „Noch keine Fragen“ (ohne Coco) mit Weiter-Link zur Kontaktseite – auf der Kontaktseite selbst ohne Link (PLAN P8.16).

export async function FaqList({
  id,
  category,
  heading,
  locale,
  withContactLink = true,
  data,
}: {
  /** ID der Überschrift (`aria-labelledby`). */
  id: string
  category: FaqCategory
  heading: string
  locale: Locale
  withContactLink?: boolean
  /** `data-*`-Attribut des Abschnitts (für Tests). */
  data?: Record<`data-${string}`, string>
}) {
  const [t, faqs] = await Promise.all([
    getTranslations({ locale, namespace: 'common.faq' }),
    listFaqs(category, locale),
  ])
  return (
    <section className={tattoo.section} aria-labelledby={id} data-faq-list={category} {...data}>
      <h2 id={id} className={tattoo.sectionHeading}>
        {heading}
      </h2>
      {faqs.length > 0 ? (
        <ul className={tattoo.faq}>
          {faqs.map((faq) => (
            <li key={faq.id}>
              <details className={tattoo.faqItem} data-faq={faq.id}>
                <summary>{faq.question}</summary>
                <div className={tattoo.faqAnswer}>
                  <RichTextContent data={faq.answer} />
                </div>
              </details>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          headingLevel="h3"
          title={t('emptyTitle')}
          text={t('emptyText')}
          action={
            withContactLink
              ? { href: localizedPath('R20', locale), label: t('emptyAction') }
              : undefined
          }
        />
      )}
    </section>
  )
}
