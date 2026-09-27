import { getTranslations } from 'next-intl/server'
import React from 'react'

import { getEnv, seedPreviewModeActive, type Env } from '@/lib/env'
import type { Locale } from '@/lib/routes/registry'

import styles from './PreviewBanner.module.css'

// Vorschau-Banner (KONZEPT §3.0.4, DESIGN KO-01, R-002 vorgezogen): nur bei `SEED_PREVIEW_MODE=true` und
// `APP_ENV≠production`; im Vorschau-Export zusätzlich „Phase P<n>“ (`PREVIEW_PHASE`). Nicht animiert, nicht schließbar.

export interface PreviewBannerState {
  show: boolean
  phase: string | null
}

export function previewBannerState(env: Env = getEnv()): PreviewBannerState {
  const show = seedPreviewModeActive(env)
  const phase = show && env.PREVIEW_EXPORT && env.PREVIEW_PHASE ? env.PREVIEW_PHASE : null
  return { show, phase }
}

export async function PreviewBanner({
  locale,
  state,
}: {
  locale: Locale
  state: PreviewBannerState
}) {
  if (!state.show) return null
  const t = await getTranslations({ locale, namespace: 'previewExport' })
  return (
    <div className={styles.banner} data-preview-banner="">
      <p className={styles.text}>
        {t('seedBanner')}
        {state.phase ? ` · ${t('phase', { phase: state.phase })}` : null}
      </p>
    </div>
  )
}
