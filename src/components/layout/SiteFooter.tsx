import { getTranslations } from 'next-intl/server'
import React from 'react'

import { FOOTER_LINE_PATH, HAND_LINE_HEIGHT, HAND_LINE_LENGTH } from '@/art/handLine'
import { Icon } from '@/components/icons/Icon'
import { IpNotice } from '@/components/legal/IpNotice'
import { StaticHtml } from '@/components/StaticHtml'
import { instagramUrl, type SiteNavigation } from '@/lib/data/navigation'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { berlinYear, systemClock, type Clock } from '@/lib/time'

import { LanguageSwitcher } from './LanguageSwitcher'
import { LegalFooter } from './LegalFooter'
import { MENU_MAIN } from './navItems'
import styles from './SiteFooter.module.css'

// Fußbereich (DESIGN KO-04, KONZEPT §3.0.3) auf jeder öffentlichen Seite, auch 404/500. DOM-Reihenfolge:
// 1.+2. LegalFooter („Vertrag widerrufen“ + Pflichtlinks) · 3. `<nav id="fussnavigation">` (Menüliste als Ersatz ohne
// JavaScript, Instagram als einfacher Link) · 4. Sprachumschalter · 5. Schalter „Animationen“ (Modul `motion-toggle`,
// ohne JavaScript verborgen) · 6. Platz für die Preis-Fußnote (ab P3) · 7. Urheberrechtsvermerk und KI-/TDM-Vorbehalt (Bausteine `ip.*`, P12.11), 8. „© {Berliner Jahr} Planet Claire · Berlin“.
// Nie animiert; liegt über Dekor-Ebenen (z-index), die keine Zeigerereignisse annehmen. Linie, Pflichtlinks und
// Fußnavigation sind statisches HTML (`StaticHtml`, nicht hydriert, TBT P7); der Sprachumschalter hängt an der Route.
export async function SiteFooter({
  locale,
  nav,
  priceNote,
  clock = systemClock,
}: {
  locale: Locale
  nav: SiteNavigation
  /** Preis-Fußnote nur auf Seiten mit Preisen (KONZEPT §3.4, ab P3). */
  priceNote?: React.ReactNode
  clock?: Clock
}) {
  const [t, tRoutes] = await Promise.all([
    getTranslations({ locale, namespace: 'footer' }),
    getTranslations({ locale, namespace: 'common.routes' }),
  ])
  return (
    <footer className={styles.footer} data-site-footer="">
      <StaticHtml as="div" className={styles.edgeWrap} aria-hidden="true">
        <svg
          className={styles.edge}
          width={HAND_LINE_LENGTH}
          height={HAND_LINE_HEIGHT}
          viewBox={`0 0 ${HAND_LINE_LENGTH} ${HAND_LINE_HEIGHT}`}
          focusable="false"
        >
          <path d={FOOTER_LINE_PATH} />
        </svg>
      </StaticHtml>
      <div className={styles.inner}>
        <LegalFooter locale={locale} hasActiveConformity={nav.hasActiveConformity} />

        <StaticHtml
          as="nav"
          id="fussnavigation"
          aria-label={t('siteNav')}
          className={styles.column}
        >
          <h2 className={styles.heading}>{t('siteNav')}</h2>
          <ul className={styles.list}>
            {MENU_MAIN.map((id) => (
              <li key={id}>
                <a href={localizedPath(id, locale)} className={styles.link}>
                  {tRoutes(id as 'R01')}
                </a>
              </li>
            ))}
            <li>
              <a
                href={instagramUrl(nav.instagramHandle)}
                className={styles.link}
                rel="noopener noreferrer"
              >
                {t('instagram')}
                <Icon name="external" size={16} className={styles.inlineIcon} />
              </a>
            </li>
          </ul>
        </StaticHtml>

        <div className={styles.column}>
          <h2 className={styles.heading}>{t('settingsHeading')}</h2>
          <LanguageSwitcher
            locale={locale}
            label={t('language')}
            className={styles.languages}
            linkClassName={styles.link}
          />
          <button
            type="button"
            className={styles.motion}
            data-behavior="motion-toggle"
            data-label-on={t('motionOn')}
            data-label-off={t('motionOff')}
            data-label-off-system={t('motionOffSystem')}
            aria-pressed="true"
            hidden
          >
            {t('motionLabel')} <span data-motion-state="">{t('motionOn')}</span>
          </button>
        </div>

        {priceNote ? <div className={styles.priceNote}>{priceNote}</div> : null}

        <div className={styles.ipNotice}>
          <IpNotice locale={locale} kind="footer" />
        </div>

        <p className={styles.copyright}>{t('copyright', { year: berlinYear(clock.now()) })}</p>
      </div>
    </footer>
  )
}
