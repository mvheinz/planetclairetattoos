import { getTranslations, setRequestLocale } from 'next-intl/server'
import React from 'react'

import styles from '@/components/tattoo/Tattoo.module.css'
import { TattooShell } from '@/components/tattoo/TattooShell'
import { tattooLocale, tattooMetadata } from '@/components/tattoo/tattooRoute'
import { Callout } from '@/components/ui/Callout'
import { blocksOfType, getTattooPage, getTattooSettings } from '@/lib/data/tattoo'

// R16 Ablauf (KONZEPT §9.2): 5 Schritte aus dem Block `processSteps` der Seite `tattoo` (Anfrage → Termin → Anzahlung
// (offline) → Stechen → Aftercare; ohne Block die Entwurfstexte aus den Nachrichten), Hinweis „Tattoos erst ab 18“,
// Ort nur als Bezirk (E-50), Kontakt-Block mit Betreff „Tattoo-Anfrage – eigene Idee“. Keine Online-Buchung.

export const revalidate = 3600
export const generateMetadata = tattooMetadata('R16')

const FALLBACK_STEPS = ['1', '2', '3', '4', '5'] as const

export default async function ProcessPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = tattooLocale((await params).locale)
  setRequestLocale(locale)
  const [t, settings, page] = await Promise.all([
    getTranslations({ locale, namespace: 'tattoo.process' }),
    getTattooSettings(locale),
    getTattooPage(locale),
  ])
  const block = blocksOfType(page, 'processSteps')[0]
  const steps =
    block?.steps?.map((s, i) => ({ key: s.id ?? String(i), title: s.title, text: s.text })) ??
    FALLBACK_STEPS.map((n) => ({
      key: n,
      title: t(`steps.${n}.title`),
      text: t(`steps.${n}.text`),
    }))

  return (
    <TattooShell
      locale={locale}
      routeId="R16"
      settings={settings}
      lead={<p>{t('intro')}</p>}
      contactTopic={{ kind: 'custom' }}
    >
      <section className={styles.section} aria-labelledby="process-steps" data-tattoo-steps="">
        <h2 id="process-steps" className={styles.sectionHeading}>
          {block?.heading || t('stepsHeading')}
        </h2>
        <ol className={styles.steps}>
          {steps.map((s) => (
            <li key={s.key} className={styles.step} data-tattoo-step="">
              <div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <Callout variant="info">
        <p data-tattoo-age="">{t('ageHint')}</p>
      </Callout>
      <section className={styles.section} aria-labelledby="process-place" data-tattoo-place="">
        <h2 id="process-place" className={styles.sectionHeading}>
          {t('placeHeading')}
        </h2>
        <p>
          {settings.studioDistrict
            ? t('place', { district: settings.studioDistrict })
            : t('placeNoDistrict')}
        </p>
      </section>
    </TattooShell>
  )
}
