import { getTranslations } from 'next-intl/server'
import React from 'react'

import { WORDMARK_HEIGHT, WORDMARK_SRC, WORDMARK_WIDTH } from '@/components/brand/WordmarkLink'
import { Coco } from '@/components/Coco'
import { Icon } from '@/components/icons/Icon'
import { instagramUrl, type SiteNavigation } from '@/lib/data/navigation'
import { WITHDRAWAL_LINK_LABEL } from '@/lib/legal/constants'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'

import { LanguageSwitcher } from './LanguageSwitcher'
import styles from './MenuOverlay.module.css'
import {
  CONFORMITY_ROUTE,
  LEGAL_LINKS,
  MENU_MAIN,
  TATTOO_PAGES,
  WITHDRAWAL_ROUTE,
} from './navItems'
import { NavLink } from './NavLink'

// Menü (DESIGN KO-03, KONZEPT §3.0.2): natives `<dialog id="menu">`, serverseitig gerendert; das Verhaltensmodul
// `menu` öffnet es modal (Fokus, Tab-Falle, `Esc`, MI-05). Hauptliste in Mansalva, unter „Shop“ die Kategorien
// (`showInNavigation`), unter „Tattoo“ die Tattoo-Unterseiten; unten Sprachumschalter, Instagram und die Pflichtlinks
// klein inkl. „Vertrag widerrufen“. Ohne JavaScript bleibt der Dialog zu, der Menü-Knopf führt zur Fußnavigation.
export async function MenuOverlay({ locale, nav }: { locale: Locale; nav: SiteNavigation }) {
  const [tMenu, tRoutes, tFooter] = await Promise.all([
    getTranslations({ locale, namespace: 'menu' }),
    getTranslations({ locale, namespace: 'common.routes' }),
    getTranslations({ locale, namespace: 'footer' }),
  ])
  const route = (id: string) => tRoutes(id as 'R01')
  const legal = [...LEGAL_LINKS, ...(nav.hasActiveConformity ? [CONFORMITY_ROUTE] : [])]

  return (
    <dialog id="menu" aria-label={tMenu('title')} className={styles.menu} data-behavior="menu">
      <div className={styles.inner}>
        <div className={styles.top}>
          {/* eslint-disable-next-line @next/next/no-img-element -- dekorative Wortmarke, kein Link (erster Link = „Start“) */}
          <img
            src={WORDMARK_SRC}
            alt=""
            width={WORDMARK_WIDTH}
            height={WORDMARK_HEIGHT}
            className={styles.wordmark}
          />
          <button type="button" className={styles.close} data-menu-close-button="">
            <span>{tMenu('close')}</span>
            <Icon name="close" size={22} />
          </button>
        </div>

        <nav aria-label={tMenu('title')} className={styles.nav}>
          <ul className={styles.main}>
            {MENU_MAIN.map((id) => (
              <li key={id} className={styles.item} data-menu-item="">
                <NavLink
                  href={localizedPath(id, locale)}
                  routeId={id}
                  className={styles.mainLink}
                  onClickClose
                >
                  {route(id)}
                </NavLink>
                {id === 'R02' && nav.categories.length > 0 ? (
                  <ul className={styles.sub}>
                    {nav.categories.map((c) => (
                      <li key={c.key}>
                        <a
                          href={localizedPath('R03', locale, { slug: c.slug })}
                          className={styles.subLink}
                          data-menu-close=""
                        >
                          {c.name}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {id === 'R11' ? (
                  <ul className={styles.sub}>
                    {TATTOO_PAGES.map((sub) => (
                      <li key={sub}>
                        <a
                          href={localizedPath(sub, locale)}
                          className={styles.subLink}
                          data-menu-close=""
                        >
                          {route(sub)}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.bottom}>
          <LanguageSwitcher
            locale={locale}
            label={tMenu('language')}
            className={styles.languages}
            linkClassName={styles.smallLink}
          />
          <a
            href={instagramUrl(nav.instagramHandle)}
            className={styles.smallLink}
            rel="noopener noreferrer"
            data-menu-close=""
          >
            {tFooter('instagram')}
            <Icon name="external" size={16} className={styles.inlineIcon} />
          </a>
          <ul className={styles.legal} aria-label={tFooter('legalHeading')}>
            {legal.map((id) => (
              <li key={id}>
                <a href={localizedPath(id, locale)} className={styles.smallLink} data-menu-close="">
                  {route(id)}
                </a>
              </li>
            ))}
            <li>
              <a
                href={localizedPath(WITHDRAWAL_ROUTE, locale)}
                className={`${styles.smallLink} ${styles.withdraw}`}
                data-menu-close=""
              >
                {WITHDRAWAL_LINK_LABEL[locale]}
              </a>
            </li>
          </ul>
        </div>
        <div className={styles.coco} data-coco-slot="" aria-hidden="true">
          <Coco pose="kopfschief" size="m" />
        </div>
      </div>
    </dialog>
  )
}
