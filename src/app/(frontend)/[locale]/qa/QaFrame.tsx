import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import React from 'react'

import type { Locale } from '@/lib/routes/registry'

import styles from './qa.module.css'

export const QA_PAGES = ['coco', 'art', 'motion', 'leash'] as const

/** Rahmen einer QA-Seite: Titel, Hinweis, Navigation zwischen den QA-Seiten. */
export async function QaFrame({
  locale,
  page,
  children,
  wide = false,
}: {
  locale: Locale
  page: (typeof QA_PAGES)[number]
  children: React.ReactNode
  wide?: boolean
}) {
  const t = await getTranslations({ locale, namespace: 'qa' })
  return (
    <div className={wide ? styles.wide : `u-container ${styles.page}`} data-qa-page={page}>
      <h1 className={styles.title}>
        {t('title')} · {t(page)}
      </h1>
      <p className={styles.note}>{t('note')}</p>
      <nav aria-label={t('nav')} className={styles.nav}>
        {QA_PAGES.map((p) => (
          <Link key={p} href={`/${locale}/qa/${p}`} aria-current={p === page ? 'page' : undefined}>
            {t(p)}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  )
}
