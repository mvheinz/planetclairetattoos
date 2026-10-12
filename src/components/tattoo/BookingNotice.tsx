import { getTranslations } from 'next-intl/server'
import React from 'react'

import { Callout } from '@/components/ui/Callout'
import type { Locale } from '@/lib/routes/registry'
import { formatBookingMonth, type ActiveBooking } from '@/lib/tattoo/booking'

// Hinweis „Gerade ausgebucht“ (V-64, U-93; DESIGN KO-22 Hinweis-Kasten `info`): ruhig, ohne Warnfarbe, auf allen
// Tattoo-Seiten oben (TattooShell) und bei den Auftragsarbeiten über dem Formular (R10, dort mit dem Satz, dass das
// Formular offen bleibt). Text: Juttas kurzer Hinweis in der Sprache der Seite, sonst der Standardsatz mit dem Monat
// nach „ausgebucht bis“. Ob der Hinweis gilt, entscheidet `activeBooking()` beim Rendern.

type Translate = (key: string, values?: Record<string, string | number>) => string

/** Überschrift und Satz des Hinweises (auch für den Kontakt-Block und die Flash-Karten). */
export function bookingTexts(
  t: Translate,
  booking: ActiveBooking,
  locale: Locale,
): { title: string; text: string } {
  const text =
    booking.note ??
    (booking.resumesFrom
      ? t('textUntil', { month: formatBookingMonth(booking.resumesFrom, locale) })
      : t('textOpenEnd'))
  return { title: t('title'), text }
}

export async function BookingNotice({
  locale,
  booking,
  context = 'tattoo',
  className,
}: {
  locale: Locale
  booking: ActiveBooking
  /** `commission`: zusätzlich der Satz, dass das Formular offen bleibt. */
  context?: 'tattoo' | 'commission'
  className?: string
}) {
  const t = await getTranslations({ locale, namespace: 'tattoo.booking' })
  const { title, text } = bookingTexts(t, booking, locale)
  return (
    <div className={className} data-booking-notice={context}>
      <Callout variant="info" title={title}>
        <p data-booking-text="">{text}</p>
        {context === 'commission' ? <p>{t('commissionForm')}</p> : null}
      </Callout>
    </div>
  )
}
