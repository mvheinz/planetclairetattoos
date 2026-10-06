import { getTranslations } from 'next-intl/server'
import Link from 'next/link'
import React from 'react'

import { PlanetMark } from '@/components/home/SpaceMarks'
import { Station } from '@/components/leash/Station'
import { QA_LEASH_LOOPS, QA_LEASH_POSES, parseLeashQuery } from '@/lib/qa/leashQuery'
import { PRESETS } from '@/lib/routes/registry'

import { requireArtQa } from '../guard'
import { LeashSandbox } from '../LeashSandbox'
import { QaFrame } from '../QaFrame'
import styles from '../qa.module.css'

// `/{locale}/qa/leash?preset=journey&stations=7` (KUNST-QA §3.2): synthetische Langseite je Preset mit Ankern, zum
// isolierten Messen der Tuschelinie (gleiche Engine wie im Produkt, Seed `qa/<preset>/<n>`).

export default async function QaLeashPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const locale = await requireArtQa(params)
  const { preset, stations } = parseLeashQuery(await searchParams)
  const t = await getTranslations({ locale, namespace: 'qa' })
  return (
    <QaFrame locale={locale} page="leash" wide>
      <div className={styles.controls}>
        <span>{t('presets')}:</span>
        {PRESETS.map((p) => (
          <Link
            key={p}
            href={`/${locale}/qa/leash?preset=${p}&stations=${stations}`}
            aria-current={p === preset ? 'true' : undefined}
          >
            {p}
          </Link>
        ))}
        <span>{t('stationsCount', { count: stations })}</span>
      </div>
      <LeashSandbox preset={preset} routeKey={`qa/${preset}/${stations}`}>
        <div className="u-container">
          <h2 className={styles.sectionTitle}>
            <Station id="qa-start" as="span" pose="sitzen" loop="orbit" className={styles.mark}>
              <PlanetMark />
            </Station>{' '}
            {preset}
          </h2>
          {Array.from({ length: stations }, (_, i) => (
            <section key={i} className={styles.leashStation} data-qa-station={i + 1}>
              <Station
                id={`qa-${i + 1}`}
                pose={QA_LEASH_POSES[i % QA_LEASH_POSES.length]}
                loop={QA_LEASH_LOOPS[i % QA_LEASH_LOOPS.length]}
                className={styles.leashBox}
              >
                {t('stationLabel', { n: i + 1 })}
              </Station>
            </section>
          ))}
          <span data-leash-anchor="end" />
        </div>
      </LeashSandbox>
    </QaFrame>
  )
}
