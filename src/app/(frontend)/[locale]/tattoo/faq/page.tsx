import { getTranslations, setRequestLocale } from 'next-intl/server'
import React from 'react'

import { RichTextContent } from '@/components/content/RichTextContent'
import styles from '@/components/tattoo/Tattoo.module.css'
import { TattooShell } from '@/components/tattoo/TattooShell'
import { tattooLocale, tattooMetadata } from '@/components/tattoo/tattooRoute'
import { EmptyState } from '@/components/ui/EmptyState'
import { blocksOfType, getTattooPage, getTattooSettings, listFaqs } from '@/lib/data/tattoo'
import type { FaqCategory } from '@/lib/enums'

// R18 FAQ (KONZEPT §9.2): Einträge aus `faqs` (Kategorie aus dem Block `faqList` der Seite `tattoo`, sonst `tattoo`;
// Reihenfolge `sortOrder`) als `<details>` – ohne JavaScript per Tastatur auf- und zuklappbar. Leerzustand „Noch keine
// Fragen“.

export const revalidate = 3600
export const generateMetadata = tattooMetadata('R18')

export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = tattooLocale((await params).locale)
  setRequestLocale(locale)
  const [t, settings, page] = await Promise.all([
    getTranslations({ locale, namespace: 'tattoo.faq' }),
    getTattooSettings(locale),
    getTattooPage(locale),
  ])
  const block = blocksOfType(page, 'faqList')[0]
  const category: FaqCategory = block?.category ?? 'tattoo'
  const faqs = await listFaqs(category, locale)

  return (
    <TattooShell locale={locale} routeId="R18" settings={settings} lead={<p>{t('intro')}</p>}>
      {faqs.length > 0 ? (
        <section aria-labelledby="faq-heading" data-tattoo-faq="">
          <h2 id="faq-heading" className="u-sr-only">
            {block?.heading || 'FAQ'}
          </h2>
          <ul className={styles.faq}>
            {faqs.map((faq) => (
              <li key={faq.id}>
                <details className={styles.faqItem} data-faq={faq.id}>
                  <summary>{faq.question}</summary>
                  <div className={styles.faqAnswer}>
                    <RichTextContent data={faq.answer} />
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState pose="kopfschief" title={t('emptyTitle')} text={t('emptyText')} />
      )}
    </TattooShell>
  )
}
