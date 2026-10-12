import React from 'react'

import { requestNow } from '@/lib/payload/context'
import { TATTOO_FAQ_CATEGORIES } from '@/lib/tattoo/admin'
import { activeBooking, formatBookingMonth, pickBooking } from '@/lib/tattoo/booking'
import { TATTOO_TEXT_PAGE_KEYS, TATTOO_TEXT_PAGES } from '@/lib/tattoo/textBlocks'
import { translationAvailability } from '@/lib/translation'

import type { AdminViewBodyProps } from '../AdminViewBody'
import {
  TattooBookingForm,
  TattooPricesConfirmForm,
  TattooPricesForm,
  type TattooBookingStatus,
} from '../settings/AreaForms'
import {
  initialTattooBooking,
  initialTattooPrices,
  initialTattooPricesConfirm,
  type Obj,
} from '../settings/settingsAreas'
import { tattooText } from './tattooText'

// Reiter „Texte“ (PLAN P7.9, KONZEPT §7.12, §9.6): Preise (`settings.tattoo.*`, DE/EN, mit „Übersetzen“). Keine
// Eingabefelder für Gesundheitsdaten (V-25). Seit V-37 (P20.6) hat jede Sache genau eine Stelle: Die Texte der Seiten
// „Tattoo“ und „Aftercare“ und die Tattoo-/Aftercare-Fragen bearbeitest du unter „Texte“ → „Seiten und FAQ“ (dieselben
// Warnungen V-24/V-15); hier stehen nur Direktlinks dorthin.
// P20.5: oben der Schalter „Anfragen offen / ausgebucht bis …“ (V-64), unter den Preisen „Preise stimmen – bestätigen“
// (V-28 a, Startklar R210-16).

/** Stand des Schalters auf der Seite (offen, ausgebucht, abgelaufen). */
function bookingStatus(tattoo: Obj, now: Date): TattooBookingStatus {
  const booking = pickBooking(tattoo)
  if (booking.inquiriesOpen) return { kind: 'open' }
  if (!activeBooking(booking, now)) return { kind: 'expired' }
  return {
    kind: 'booked',
    untilLabel: booking.bookedUntil ? formatBookingMonth(booking.bookedUntil, 'de') : null,
  }
}

export async function TextsTab({
  req,
  adminRoute,
}: Pick<AdminViewBodyProps, 'req' | 'adminRoute'>) {
  const availability = translationAvailability()
  const translateDisabled = availability.enabled ? null : (availability.reason ?? null)
  const settings = (locale: 'de' | 'en') =>
    req.payload.findGlobal({
      slug: 'settings',
      locale,
      fallbackLocale: false,
      depth: 0,
      overrideAccess: true,
      req,
    }) as unknown as Promise<Obj>
  const settingsDe = await settings('de')
  const settingsEn = await settings('en')
  const texts = `${adminRoute}/texte`
  const tattooDe = (settingsDe.tattoo ?? {}) as Obj

  return (
    <div className="pc-order pc-texts" data-testid="tattoo-texts">
      <section
        className="pc-order__section"
        aria-labelledby="tattoo-texts-booking"
        data-testid="tattoo-booking"
      >
        <h2 id="tattoo-texts-booking">{tattooText('textsBooking')}</h2>
        <TattooBookingForm
          initial={initialTattooBooking(settingsDe, settingsEn)}
          status={bookingStatus(tattooDe, requestNow(req))}
          translateDisabled={translateDisabled}
        />
      </section>
      <section className="pc-order__section" aria-labelledby="tattoo-texts-prices">
        <h2 id="tattoo-texts-prices">{tattooText('textsPrices')}</h2>
        <TattooPricesForm
          initial={initialTattooPrices(settingsDe, settingsEn)}
          translateDisabled={translateDisabled}
        />
        <h3>{tattooText('textsPricesConfirm')}</h3>
        <TattooPricesConfirmForm state={initialTattooPricesConfirm(settingsDe)} />
      </section>
      <section
        className="pc-order__section"
        aria-labelledby="tattoo-texts-pages"
        data-testid="tattoo-texts-links"
      >
        <h2 id="tattoo-texts-pages">{tattooText('textsPagesElsewhere')}</h2>
        <p className="pc-order__muted">{tattooText('textsPagesElsewhereHint')}</p>
        <ul className="pc-order__items">
          {TATTOO_TEXT_PAGE_KEYS.map((key) => (
            <li key={key} className="pc-order__item">
              <a
                href={`${texts}?seite=${key}#seite`}
                className="pc-admin-link"
                data-testid={`tattoo-texts-link-${key}`}
              >
                {tattooText('textsPageLink', { page: TATTOO_TEXT_PAGES[key].label })}
              </a>
            </li>
          ))}
          {TATTOO_FAQ_CATEGORIES.map((category) => (
            <li key={category} className="pc-order__item">
              <a
                href={`${texts}#texts-faq-${category}`}
                className="pc-admin-link"
                data-testid={`tattoo-texts-link-faq-${category}`}
              >
                {tattooText(category === 'tattoo' ? 'faqTattoo' : 'faqAftercare')}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
