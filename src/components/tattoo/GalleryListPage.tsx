import { getTranslations } from 'next-intl/server'
import React from 'react'

import { EmptyState } from '@/components/ui/EmptyState'
import { instagramUrl } from '@/lib/data/navigation'
import { blocksOfType, getTattooPage, getTattooSettings, listGallery } from '@/lib/data/tattoo'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { listSearch, type ListParams } from '@/lib/shop/listParams'

import { GalleryGrid } from './GalleryGrid'
import styles from './Tattoo.module.css'
import { TattooShell } from './TattooShell'

// R15 Galerie (KONZEPT §9.2, §9.7, DESIGN KO-20): Filter „alle“/„fresh“/„healed“ als Links (`?kind=`, statische
// Variante wie im Shop), Raster ohne Preise, Foto antippen → Vollbild mit Bildunterschrift (ohne JS: Link auf die
// große Datei). Nur Einträge, die `isPubliclyVisible` besteht – Kund:innen-Fotos nur mit Einwilligung, Seed-Ausnahme nur
// im Vorschau-Modus mit Etikett „intern – Einwilligung fehlt“ (R-172, R-182). Leerzustand „Hier kommen bald Fotos“.

const FILTERS = [
  { key: 'all', kind: undefined },
  { key: 'fresh', kind: 'fresh' },
  { key: 'healed', kind: 'healed' },
] as const

export async function GalleryListPage({ locale, list }: { locale: Locale; list: ListParams }) {
  const [t, settings, page, all] = await Promise.all([
    getTranslations({ locale, namespace: 'tattoo.gallery' }),
    getTattooSettings(locale),
    getTattooPage(locale),
    listGallery(locale),
  ])
  const block = blocksOfType(page, 'tattooGallery')[0]
  const entries = list.kind ? all.filter((e) => e.kind === list.kind) : all
  const base = localizedPath('R15', locale)

  return (
    <TattooShell
      locale={locale}
      routeId="R15"
      settings={settings}
      lead={
        <>
          {block?.heading ? <p className={styles.muted}>{block.heading}</p> : null}
          <p>{t('intro')}</p>
        </>
      }
    >
      <nav className={styles.filters} aria-label={t('filterLabel')} data-gallery-filter="">
        <ul className={styles.chips}>
          {FILTERS.map((f) => (
            <li key={f.key}>
              <a
                className={styles.chip}
                href={`${base}${listSearch({ kind: f.kind })}`}
                aria-current={list.kind === f.kind ? 'page' : undefined}
                data-chip={f.key}
              >
                {t(f.key)}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {entries.length > 0 ? (
        <GalleryGrid entries={entries} locale={locale} label={t('listHeading')} />
      ) : (
        <EmptyState
          pose="sitzen"
          title={t('emptyTitle')}
          text={t('emptyText')}
          action={{
            href: instagramUrl(settings.instagramHandle),
            label: t('emptyAction'),
            rel: 'noopener noreferrer',
          }}
        />
      )}
    </TattooShell>
  )
}
