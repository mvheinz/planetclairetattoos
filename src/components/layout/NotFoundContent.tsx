import { getTranslations } from 'next-intl/server'
import React from 'react'

import type { Locale } from '@/lib/routes/registry'

// Inhalt von R28 „Coco hat sich losgerissen“ – Grundform (H1 fest im Code, Satz als Rückfall). Preset `lost`, Coco,
// Links Start/Shop/Tattoo und das Nummernfeld ergänzt P2.19 (DESIGN KO-18).
export async function NotFoundContent({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'errors' })
  return (
    <div className="u-container u-stack" data-not-found="">
      <h1>{t('notFoundTitle')}</h1>
      <p>{t('notFoundText')}</p>
    </div>
  )
}
