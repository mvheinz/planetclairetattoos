import { getTranslations } from 'next-intl/server'
import React from 'react'

import { Icon } from '@/components/icons/Icon'
import { WITHDRAWAL_LINK_LABEL } from '@/lib/legal/constants'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'

import styles from './SiteFooter.module.css'
import { CONFORMITY_ROUTE, LEGAL_LINKS, WITHDRAWAL_ROUTE } from './navItems'

// Pflichtlink-Block (R-011, R-090, DESIGN KO-04 Punkte 1 und 2): hervorgehobener Knopf-Link „Vertrag widerrufen“
// (Wortlaut als Konstante, § 356a BGB) → R26, darunter Impressum · Datenschutz · AGB · Widerrufsbelehrung · Versand &
// Zahlung · Kontakt und – nur bei mindestens einer aktiven Erklärung – Konformitätserklärungen. Reines Server-HTML:
// ohne JavaScript sichtbar, nie animiert, nie über das CMS entfernbar.
export async function LegalFooter({
  locale,
  hasActiveConformity,
}: {
  locale: Locale
  hasActiveConformity: boolean
}) {
  const [tRoutes, tFooter] = await Promise.all([
    getTranslations({ locale, namespace: 'common.routes' }),
    getTranslations({ locale, namespace: 'footer' }),
  ])
  const links = [...LEGAL_LINKS, ...(hasActiveConformity ? [CONFORMITY_ROUTE] : [])]
  return (
    <div className={styles.legalBlock} data-legal-footer="">
      <a
        href={localizedPath(WITHDRAWAL_ROUTE, locale)}
        className={styles.withdraw}
        data-withdraw-link=""
      >
        <Icon name="withdraw" size={22} className={styles.withdrawIcon} />
        <span>{WITHDRAWAL_LINK_LABEL[locale]}</span>
      </a>
      <nav aria-label={tFooter('legalHeading')} className={styles.column}>
        <h2 className={styles.heading}>{tFooter('legalHeading')}</h2>
        <ul className={styles.list}>
          {links.map((id) => (
            <li key={id}>
              <a href={localizedPath(id, locale)} className={styles.link} data-legal-link={id}>
                {tRoutes(id as 'R21')}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
