import { getTranslations } from 'next-intl/server'
import React from 'react'

import { Button } from '@/components/ui/Button'
import { instagramDmUrl } from '@/lib/data/contact'
import type { TattooSettings } from '@/lib/data/tattoo'
import type { Locale } from '@/lib/routes/registry'
import { tattooMailto, type TattooMailTopic } from '@/lib/tattoo/mailto'

import styles from './Tattoo.module.css'

// Kontakt-Block des Tattoo-Bereichs (DESIGN KO-20, KONZEPT §9.4, E-51): Knöpfe „Mail schreiben“ (`mailto:` mit Betreff
// und Text-Vorlage des Anlasses) und „Instagram-DM“ (`https://ig.me/m/{handle}`, `rel="noopener noreferrer"`, R-139),
// darunter die E-Mail-Adresse als markierbarer Text mit „Adresse kopieren“ (Modul `copy-button`, Rückmeldung „Kopiert“
// per `aria-live` 2 s; Rückfall: Adresse wird markiert, „Jetzt kopieren“). Ort nur als „Privatstudio in
// Berlin-{Bezirk}“ (E-50). Kein Formular, keine Buchung, keine Zahlung.

export async function TattooContactBlock({
  locale,
  settings,
  topic = { kind: 'general' },
  id = 'tattoo-contact',
  heading,
}: {
  locale: Locale
  settings: TattooSettings
  topic?: TattooMailTopic
  /** Präfix eindeutiger IDs (mehrere Blöcke je Seite). */
  id?: string
  heading?: string | null
}) {
  const [t, tContact] = await Promise.all([
    getTranslations({ locale, namespace: 'tattoo.contact' }),
    getTranslations({ locale, namespace: 'contact' }),
  ])
  const mailto = tattooMailto(settings.email, topic, locale)
  const headingId = `${id}-heading`
  return (
    <section className={styles.contact} aria-labelledby={headingId} data-tattoo-contact="">
      <h2 id={headingId} className={styles.contactHeading}>
        {heading || t('heading')}
      </h2>
      <p className={styles.muted}>{t('intro')}</p>
      <div className={styles.contactButtons}>
        {mailto ? (
          <Button variant="primary" href={mailto} icon="mail" data={{ 'data-tattoo-mail': '' }}>
            {t('mail')}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          href={instagramDmUrl(settings.instagramHandle)}
          rel="noopener noreferrer"
          icon="instagram"
          data={{ 'data-tattoo-dm': '' }}
        >
          {t('dm')}
        </Button>
      </div>
      {settings.email ? (
        <p className={styles.address}>
          <span className={styles.addressLabel}>{t('emailLabel')}:</span>{' '}
          <span id={`${id}-email`} className={styles.addressValue} data-tattoo-email="">
            {settings.email}
          </span>{' '}
          <button
            type="button"
            className={styles.copy}
            data-behavior="copy-button"
            data-copy={settings.email}
            data-copy-select={`${id}-email`}
            data-copied-text={t('copied')}
            data-copy-failed-text={t('copyFailed')}
            data-copy-status-id={`${id}-copy-status`}
            data-tattoo-copy=""
            hidden
          >
            {t('copy')}
          </button>
          <span
            id={`${id}-copy-status`}
            className={styles.copyStatus}
            role="status"
            aria-live="polite"
          />
        </p>
      ) : null}
      {settings.studioDistrict ? (
        <p className={styles.muted} data-tattoo-studio="">
          {tContact('studio', { district: settings.studioDistrict })}
        </p>
      ) : null}
    </section>
  )
}
