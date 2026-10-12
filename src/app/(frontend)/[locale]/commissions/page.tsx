import { getTranslations, setRequestLocale } from 'next-intl/server'
import { connection } from 'next/server'
import React from 'react'

import { CommissionFormBlock } from '@/components/commission/CommissionFormBlock'
import styles from '@/components/commission/Commission.module.css'
import { ContactLinks } from '@/components/content/ContactLinks'
import { FaqList } from '@/components/content/FaqList'
import { RichTextContent } from '@/components/content/RichTextContent'
import { ResponsiveImage } from '@/components/media/ResponsiveImage'
import { BookingNotice } from '@/components/tattoo/BookingNotice'
import tattoo from '@/components/tattoo/Tattoo.module.css'
import { Callout } from '@/components/ui/Callout'
import { objectTypeForProduct, parseCommissionParams } from '@/lib/commission/link'
import { getContactInfo } from '@/lib/data/contact'
import { loadPublicPage } from '@/lib/data/pages'
import { getPublicProductByItemNumber } from '@/lib/data/products'
import { blocksOfType, getTattooSettings, listFaqs } from '@/lib/data/tattoo'
import type { FaqCategory } from '@/lib/enums'
import type { Locale } from '@/lib/routes/registry'
import { routeMetadata } from '@/lib/seo/metadata'
import { formatItemNumber } from '@/lib/shop/format'
import { activeBooking } from '@/lib/tattoo/booking'
import { isMediaPubliclyVisible } from '@/lib/tattoo/visibility'
import { systemClock } from '@/lib/time'
import type { Media } from '@/payload-types'

export const generateMetadata = routeMetadata('R10')

// R10 Auftragsarbeiten (KONZEPT §3.10, §10; PLAN P7.10; DESIGN §9.7 Preset `frame`): H1, „So läuft’s“ (`processSteps`),
// Beispiele (`imageGallery`, 3–9 Bilder mit Bildunterschrift), Hinweis „individuell vereinbart, Bezahlung nicht im Shop,
// kein Online-Vertrag“, Formular (`commissionForm`, Kontur der Tuschelinie um das Formular, Coco `sitzen` an der
// Formular-Überschrift), FAQ (`faqList` `commissions`) und Kontaktalternative (Mail, DM). Dynamisch gerendert (CSP-Kontext
// `dynamic` mit Nonce, ARCHITEKTUR §8.1) – das Formular-Token entsteht je Aufruf. Die Seite liest `pages`
// (`key = commissions`) ungecacht; fehlt sie (vor dem Seed P8.7), rendern H1, Hinweis, Formular und Kontaktalternative
// mit Leerzustand statt 500 (DM-PAGE-01). Kein Kauf-Knopf, kein Preisschild (E-11). Ist der Schalter „Anfragen offen“
// aus (V-64, `settings.tattoo.inquiriesOpen`), steht über dem Formular der Hinweis „Gerade ausgebucht“; das Formular
// bleibt erreichbar (konservativ, OFFENE-PUNKTE P20.5). Vorauswahl über die Adresse (V-11 a, V-20; `src/lib/commission/
// link.ts`): `?art=zeichnung` wählt den Gegenstand vor; `?nach=115` (nur öffentliche Stücke) zeigt „So etwas wie Nr. 115 …“
// mit Bild, wählt die Art des Stücks vor und schickt die Nummer mit der Anfrage mit. Ungültiges wird ignoriert; die
// kanonische Adresse bleibt ohne Parameter (`routeMetadata`).

const FALLBACK_STEPS = ['1', '2', '3', '4'] as const

const visibleImages = (images: (number | Media)[] | null | undefined): Media[] =>
  (images ?? []).filter(
    (m): m is Media => typeof m === 'object' && m !== null && isMediaPubliclyVisible(m),
  )

export default async function CommissionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  const locale = ((await params).locale === 'en' ? 'en' : 'de') as Locale
  setRequestLocale(locale)
  const prefill = parseCommissionParams(await searchParams)
  const [t, tRoutes, page, contact, tattooSettings, similar, similarDe] = await Promise.all([
    getTranslations({ locale, namespace: 'commission' }),
    getTranslations({ locale, namespace: 'common.routes' }),
    loadPublicPage('commissions', locale),
    getContactInfo(),
    getTattooSettings(locale),
    prefill.similarTo
      ? getPublicProductByItemNumber(prefill.similarTo, locale).catch(() => null)
      : null,
    // Art des Stücks aus dem deutschen Namen („Schälchen …“ → Schale), auch auf /en
    prefill.similarTo && locale !== 'de'
      ? getPublicProductByItemNumber(prefill.similarTo, 'de').catch(() => null)
      : null,
  ])
  // V-20: nur ein öffentliches Stück zählt; sonst bleibt alles wie ohne Parameter
  const objectType = similar
    ? objectTypeForProduct(similar.category, (similarDe ?? similar).title)
    : prefill.objectType
  const similarPhoto = similar?.images?.find((m): m is Media => typeof m === 'object' && m !== null)
  const booking = activeBooking(tattooSettings.booking, systemClock.now())
  const stepsBlock = blocksOfType(page, 'processSteps')[0]
  const gallery = blocksOfType(page, 'imageGallery')[0]
  const formBlock = blocksOfType(page, 'commissionForm')[0]
  const faqBlock = blocksOfType(page, 'faqList')[0]
  const texts = blocksOfType(page, 'richText')
  const callouts = blocksOfType(page, 'callout')
  const faqCategory: FaqCategory = faqBlock?.category ?? 'commissions'
  const faqs = await listFaqs(faqCategory, locale)
  const steps =
    stepsBlock?.steps?.map((s, i) => ({ key: s.id ?? String(i), title: s.title, text: s.text })) ??
    FALLBACK_STEPS.map((n) => ({
      key: n,
      title: t(`steps.${n}.title`),
      text: t(`steps.${n}.text`),
    }))
  const examples = visibleImages(gallery?.images).slice(0, 9)

  return (
    <div className={`u-container ${styles.page}`} data-commission-page="">
      <header className={styles.head}>
        <h1 className={styles.title}>{tRoutes('R10')}</h1>
        <p className={styles.lead}>{t('lead')}</p>
      </header>

      <div className={styles.body}>
        {texts.length > 0 ? (
          <div className={tattoo.prose}>
            {texts.map((b, i) => (
              <RichTextContent key={b.id ?? i} data={b.content} />
            ))}
          </div>
        ) : null}

        <section
          className={tattoo.section}
          aria-labelledby="commission-steps"
          data-commission-steps=""
        >
          <h2
            id="commission-steps"
            className={tattoo.sectionHeading}
            data-leash-station="steps"
            data-leash-loop="right"
          >
            {stepsBlock?.heading || t('stepsHeading')}
          </h2>
          <ol className={tattoo.steps}>
            {steps.map((s) => (
              <li key={s.key} className={tattoo.step}>
                <div>
                  <h3>{s.title}</h3>
                  <p>{s.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {examples.length > 0 ? (
          <section
            className={tattoo.section}
            aria-labelledby="commission-examples"
            data-commission-examples=""
          >
            <h2
              id="commission-examples"
              className={tattoo.sectionHeading}
              data-leash-station="examples"
              data-leash-loop="spiral"
            >
              {t('examplesHeading')}
            </h2>
            <figure className={styles.examples}>
              <ul className={tattoo.galleryGrid}>
                {examples.map((m) => (
                  <li key={m.id} data-leash-anchor="tag">
                    <ResponsiveImage
                      media={m}
                      aspectRatio="4 / 5"
                      sizes="(min-width: 768px) 30vw, 45vw"
                      srcSizes={['thumb', 'card']}
                    />
                  </li>
                ))}
              </ul>
              {gallery?.caption ? (
                <figcaption className={styles.caption}>{gallery.caption}</figcaption>
              ) : null}
            </figure>
          </section>
        ) : null}

        <Callout variant="info">
          <p data-commission-notice="">{t('notice')}</p>
          {callouts.map((c, i) => (
            <p key={c.id ?? i}>{c.text}</p>
          ))}
        </Callout>

        {booking ? <BookingNotice locale={locale} booking={booking} context="commission" /> : null}

        <CommissionFormBlock
          locale={locale}
          heading={formBlock?.heading || t('formHeading')}
          intro={formBlock?.intro || t('formIntro')}
          successText={formBlock?.successText ?? null}
          contactEmail={contact.email}
          objectType={objectType}
          similarTo={similar ? similar.itemNumber : null}
        >
          {similar ? (
            <figure className={styles.similar} data-commission-similar={similar.itemNumber}>
              <span className={styles.similarPhoto}>
                <ResponsiveImage
                  media={similarPhoto}
                  aspectRatio="4 / 5"
                  sizes="72px"
                  srcSizes={['thumb']}
                  frameSize="thumb"
                />
              </span>
              <figcaption>
                <strong>
                  {t('similarHeading', {
                    number: formatItemNumber(similar.itemNumber, locale),
                    title: similar.title ?? '',
                  })}
                </strong>{' '}
                {t('similarText')}
              </figcaption>
            </figure>
          ) : null}
        </CommissionFormBlock>

        {faqBlock || faqs.length > 0 ? (
          <FaqList
            id="commission-faq"
            category={faqCategory}
            heading={faqBlock?.heading || t('faqHeading')}
            locale={locale}
            data={{ 'data-commission-faq': '' }}
          />
        ) : null}

        <section
          className={styles.contact}
          aria-labelledby="commission-contact"
          data-commission-contact=""
        >
          <h2
            id="commission-contact"
            className={tattoo.sectionHeading}
            data-leash-station="contact"
            data-leash-loop="right"
          >
            {t('contactHeading')}
          </h2>
          <p>{t('contactText')}</p>
          <ContactLinks
            locale={locale}
            contact={contact}
            showDistrict={false}
            emailSubject={t('emailSubject')}
          />
        </section>
      </div>
    </div>
  )
}
