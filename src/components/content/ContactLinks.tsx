import { getTranslations } from 'next-intl/server'
import React from 'react'

import { Icon } from '@/components/icons/Icon'
import { instagramDmUrl, type ContactInfo } from '@/lib/data/contact'
import { instagramUrl } from '@/lib/data/navigation'
import type { Locale } from '@/lib/routes/registry'

import styles from './ContactLinks.module.css'

// Block `contactLinks` (KONZEPT §3.13): E-Mail als `mailto:` (optional mit Betreff), Instagram-Profil und
// Direktnachricht, „Privatstudio in Berlin-{Bezirk}“. Werte nur aus `getPublicSettings()`; kein Formular (E-51).
// „Adresse kopieren“ ist ein Verhaltensmodul und folgt mit der vollständigen Kontaktseite (P6).
export interface ContactLinksProps {
  locale: Locale
  contact: ContactInfo
  heading?: string | null
  showEmail?: boolean | null
  showInstagram?: boolean | null
  showDistrict?: boolean | null
  emailSubject?: string | null
}

export async function ContactLinks({
  locale,
  contact,
  heading,
  showEmail = true,
  showInstagram = true,
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
          </li>
        ) : null}
        {showInstagram !== false ? (
          <li>
            <span className={styles.label}>{t('instagramLabel')}</span>
            <a
              href={instagramUrl(contact.instagramHandle)}
              rel="noopener noreferrer"
              className={styles.link}
              data-contact-instagram=""
            >
              <Icon name="instagram" size={22} />
              {t('instagramProfile', { handle: contact.instagramHandle })}
            </a>
            <a
              href={instagramDmUrl(contact.instagramHandle)}
              rel="noopener noreferrer"
              className={styles.link}
              data-contact-dm=""
            >
              {t('instagramDm')}
            </a>
          </li>
        ) : null}
        {showDistrict !== false && contact.studioDistrict ? (
          <li data-contact-studio="">{t('studio', { district: contact.studioDistrict })}</li>
        ) : null}
      </ul>
    </section>
  )
}
