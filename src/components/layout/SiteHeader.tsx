import { getTranslations } from 'next-intl/server'
import React from 'react'

import { WORDMARK_HEIGHT, WORDMARK_SRC, WORDMARK_WIDTH } from '@/components/brand/WordmarkLink'
import { Icon } from '@/components/icons/Icon'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'

import { HeaderLine } from './HeaderLine'
import { NavLink } from './NavLink'
import styles from './SiteHeader.module.css'

// Kopfleiste (DESIGN KO-02, KONZEPT §3.0.1): Wortmarke → Startseite · Shop · Tattoo · Korb mit Anzahl · Menü.
// Unter 375 px nur die Planet-Marke (Text bleibt als zugänglicher Name). Die Korb-Anzahl liest das Modul
// `cart-count` (nur wenn `pc_cart` existiert); ihr Platz ist immer reserviert (kein CLS). Der Menü-Knopf ist ohne
// JavaScript ein Link auf die Fußnavigation; das Modul `menu` (P2.9) macht daraus den Dialog-Knopf.

/** Bereiche für `aria-current="true"` (aktiver Bereich, KO-02). */
export const SHOP_AREA = ['R03', 'R04', 'R05'] as const
export const TATTOO_AREA = ['R12', 'R14', 'R15', 'R16', 'R17', 'R18'] as const

export async function SiteHeader({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'header' })
  return (
    <header className={styles.header} data-site-header="">
      <div className={styles.bar}>
        <a href={localizedPath('R01', locale)} className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element -- SVG vom eigenen Origin (DESIGN §12.6) */}
          <img
            src={WORDMARK_SRC}
            alt=""
            width={WORDMARK_WIDTH}
            height={WORDMARK_HEIGHT}
            className={styles.wordmark}
          />
          <Icon name="planet" size={32} className={styles.planet} />
          <span className="u-sr-only">{t('home')}</span>
        </a>
        <nav aria-label={t('mainNav')} className={styles.nav}>
          <ul className={styles.list}>
            <li>
              <NavLink
                href={localizedPath('R02', locale)}
                routeId="R02"
                area={SHOP_AREA}
                className={styles.link}
              >
                {t('shop')}
              </NavLink>
            </li>
            <li>
              <NavLink
                href={localizedPath('R11', locale)}
                routeId="R11"
                area={TATTOO_AREA}
                className={styles.link}
              >
                {t('tattoo')}
              </NavLink>
            </li>
            <li>
              <a
                href={localizedPath('R06', locale)}
                className={`${styles.link} ${styles.cart}`}
                data-behavior="cart-count"
                data-header-cart=""
              >
                <Icon name="basket" size={22} className={styles.cartIcon} />
                <span>{t('cart')}</span>
                <span className={styles.countSlot}>
                  <span data-cart-count="" className={`${styles.count} t-num`} hidden />
                </span>
              </a>
            </li>
            <li>
              <a
                href="#fussnavigation"
                className={`${styles.link} ${styles.menuButton}`}
                data-menu-trigger=""
                aria-controls="menu"
                aria-haspopup="dialog"
                aria-expanded="false"
              >
                {t('menu')}
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className={styles.lineWrap}>
        <HeaderLine className={styles.line} />
      </div>
    </header>
  )
}
