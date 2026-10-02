import { getTranslations } from 'next-intl/server'
import React from 'react'

import { startCheckoutAction } from '@/app/(frontend)/[locale]/cart/actions'
import { formatRemaining } from '@/behaviors/reservation-countdown'
import { Coco } from '@/components/Coco'
import { Button } from '@/components/ui/Button'
import type { Locale } from '@/lib/enums'
import { localizedPath } from '@/lib/routes/paths'

import styles from './ReservationCountdown.module.css'

// Countdown mit Coco (DESIGN KO-15, KONZEPT §4.6; PLAN P4.9) für Kasse R07 und Korb R06. Server-HTML mit der Restzeit
// zum Zeitpunkt des Renderns; das Verhaltensmodul `reservation-countdown` zählt im Browser weiter (Zeitbasis
// `displayExpiresAt` minus Client-Offset aus `data-server-now`). Nur Text- und Farbwechsel, keine Animation. Bei 0:
// „Deine Reservierung ist abgelaufen.“ + „Nochmal reservieren“ (POST Kassenstart) + „Zum Korb“. Die kompakte
// Wiederholung unter dem Bestellknopf („Noch 24:12 reserviert“) hat keine Ansage-Region und keinen Ablaufblock.

const levelOf = (ms: number) =>
  ms <= 0 ? 'expired' : ms <= 60_000 ? 'last' : ms <= 5 * 60_000 ? 'warn' : 'normal'

export async function ReservationCountdown({
  locale,
  displayExpiresAt,
  now,
  variant = 'full',
}: {
  locale: Locale
  displayExpiresAt: Date
  now: Date
  variant?: 'full' | 'compact'
}) {
  const t = await getTranslations({ locale, namespace: 'checkout.countdown' })
  const remaining = displayExpiresAt.getTime() - now.getTime()
  const level = levelOf(remaining)
  const time = formatRemaining(remaining)
  const common = {
    'data-behavior': 'reservation-countdown',
    'data-expires-at': displayExpiresAt.toISOString(),
    'data-server-now': now.toISOString(),
    'data-level': level,
    'data-countdown': variant,
  }

  if (variant === 'compact') {
    const template = t('compact', { time: '{time}' })
    return (
      <div {...common} data-time-template={template} className={styles.compact}>
        <p role="timer" aria-live="off" data-countdown-time className={styles.compactTime}>
          {template.replace('{time}', time)}
        </p>
      </div>
    )
  }

  const text =
    level === 'warn'
      ? t('warn')
      : level === 'last'
        ? t('last')
        : level === 'expired'
          ? ''
          : t('reserved')
  return (
    <section
      {...common}
      aria-label={t('label')}
      className={styles.box}
      data-text-warn={t('warn')}
      data-text-last={t('last')}
      data-announce-10={t('announce10')}
      data-announce-5={t('announce5')}
      data-announce-1={t('announce1')}
      data-announce-expired={t('announceExpired')}
    >
      <div className={styles.coco} aria-hidden="true">
        <Coco pose="sitzen" size="m" />
      </div>
      <div className={styles.note}>
        <p role="timer" aria-live="off" data-countdown-time className={styles.time}>
          {time}
        </p>
        <p data-countdown-text hidden={level === 'expired'} className={styles.text}>
          {level === 'expired' ? '' : text || t('reserved')}
        </p>
        <p className="u-sr-only" aria-live="polite" data-countdown-announce />
        <div data-countdown-expired hidden={level !== 'expired'} className={styles.expired}>
          <p className={styles.expiredText}>{t('expired')}</p>
          <form action={startCheckoutAction} className={styles.again}>
            <input type="hidden" name="locale" value={locale} />
            <Button variant="primary" type="submit">
              {t('again')}
            </Button>
          </form>
          <a href={localizedPath('R06', locale)} className={styles.toCart}>
            {t('toCart')}
          </a>
        </div>
      </div>
    </section>
  )
}
