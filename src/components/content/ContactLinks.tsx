import { getTranslations } from 'next-intl/server'
import React from 'react'

import type { ContactInfo } from '@/lib/data/contact'
import type { Locale } from '@/lib/routes/registry'

import styles from './ContactLinks.module.css'

// Block `contactLinks` (KONZEPT §3.13): E-Mail als `mailto:` (optional mit Betreff) und die vollständige Anschrift aus
// den Stammdaten (U-46, P13.7: „Jutta Dollmann, Anklamer Straße 28, 10115 Berlin“ statt nur des Bezirks); solange die
// Anschrift ein Platzhalter ist, „Privatstudio in Berlin-{Bezirk}“. Werte nur aus `getPublicSettings()`; kein
// Formular (E-51). Schalter `showDistrict` (Verwaltung „Anschrift zeigen“) blendet die Zeile aus.
// „Adresse kopieren“ (Modul `copy-button`, ohne JavaScript verborgen – die Adresse steht als markierbarer Text daneben;
// P6.5, R-023).
export interface ContactLinksProps {
  locale: Locale
  contact: ContactInfo
  heading?: string | null
  showEmail?: boolean | null
  showDistrict?: boolean | null
  emailSubject?: string | null
}

export async function ContactLinks({
  locale,
  contact,
  heading,
  showEmail = true,
  showDistrict = true,
  emailSubject,
}: ContactLinksProps) {
  const t = await getTranslations({ locale, namespace: 'contact' })
  const mailto = contact.email
    ? `mailto:${contact.email}${emailSubject ? `?subject=${encodeURIComponent(emailSubject)}` : ''}`
    : null
  return (
    <section className={styles.block} data-contact-links="">
      {heading ? <h2>{heading}</h2> : null}
      <ul className={styles.list}>
        {showEmail !== false && mailto ? (
          <li>
            <span className={styles.label}>{t('emailLabel')}</span>
            <a href={mailto} className={styles.link} data-contact-email="">
              {contact.email}
            </a>
            <button
              type="button"
              className={styles.copy}
              data-behavior="copy-button"
              data-copy={contact.email ?? ''}
              data-copied-text={t('copied')}
              data-copy-failed-text={t('copyFailed')}
              data-copy-status-id="contact-copy-status"
              data-contact-copy=""
              hidden
            >
              {t('copyEmail')}
            </button>
            <span
              id="contact-copy-status"
              className={styles.copyStatus}
              role="status"
              aria-live="polite"
            />
          </li>
        ) : null}
        {showDistrict !== false && contact.address ? (
          <li data-contact-address="">
            <span className={styles.label}>{t('addressLabel')}</span>
            <address className={styles.address}>
              {contact.address.name}
              <br />
              {contact.address.street}
              <br />
              {contact.address.postalCode} {contact.address.city}
            </address>
          </li>
        ) : showDistrict !== false && contact.studioDistrict ? (
          <li data-contact-studio="">{t('studio', { district: contact.studioDistrict })}</li>
        ) : null}
      </ul>
    </section>
  )
}
