import { getTranslations } from 'next-intl/server'
import React from 'react'

import { Icon } from '@/components/icons/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  blocksOfType,
  galleryByFlash,
  getTattooPage,
  getTattooSettings,
  listFlash,
  listGallery,
} from '@/lib/data/tattoo'
import { localizedPath } from '@/lib/routes/paths'
import type { Locale } from '@/lib/routes/registry'
import { listSearch, type ListParams } from '@/lib/shop/listParams'

import { FlashCard } from './FlashCard'
import styles from './Tattoo.module.css'
import { TattooPriceFootnote } from './TattooPriceFootnote'
import { TattooShell } from './TattooShell'

// R12 Flash (KONZEPT §9.3, DESIGN KO-20): Einleitung (Block `flashGrid` der Seite `tattoo`: Überschrift; sonst Text aus
// den Nachrichten), Filter „alle“/„verfügbar“ als Links (`?available=1`, statische Variante wie im Shop, Spike B-05),
// Raster 2 Spalten mobil, 3 ab 768 px, Abstände ≥ 32 px; verfügbare nach `sortOrder`, dann vergebene (sofern der
// Block `showClaimed` nicht abschaltet). Preis-Fußnote einmal je Seite (R-034). Leerzustände nach KONZEPT §9.2 bzw.
// KO-17. Ohne JavaScript vollständig lesbar.

export async function FlashListPage({ locale, list }: { locale: Locale; list: ListParams }) {
  const [t, settings, page, all, gallery] = await Promise.all([
    getTranslations({ locale, namespace: 'tattoo.flash' }),
    getTattooSettings(locale),
    getTattooPage(locale),
    listFlash(locale),
    listGallery(locale),
  ])
  // U-56: „Schon gestochen – Foto ansehen“ nur für Fotos, die die Galerie öffentlich zeigt (Einwilligung, Tag
  // `tattoo-gallery` hält die Seite aktuell).
  const photos = galleryByFlash(gallery)
  const galleryBase = localizedPath('R15', locale)
  const block = blocksOfType(page, 'flashGrid')[0]
  const showClaimed = block?.showClaimed !== false
  const visible = all.filter((f) => f.status === 'available' || (showClaimed && !list.available))
  const base = localizedPath('R12', locale)
  const anyAvailable = all.some((f) => f.status === 'available')

  return (
    <TattooShell
      locale={locale}
      routeId="R12"
      settings={settings}
      lead={
        <>
          {block?.heading ? <p className={styles.muted}>{block.heading}</p> : null}
          <p>{t('intro')}</p>
        </>
      }
    >
      <nav className={styles.filters} aria-label={t('filterLabel')} data-flash-filter="">
        <ul className={styles.chips}>
          <li>
            <a
              className={styles.chip}
              href={base}
              aria-current={!list.available ? 'page' : undefined}
              data-chip="all"
            >
              {t('all')}
            </a>
          </li>
          <li>
            <a
              className={styles.chip}
              href={`${base}${listSearch({ available: true })}`}
              aria-current={list.available ? 'page' : undefined}
              data-chip="available"
            >
              {list.available ? <Icon name="check" size={16} /> : null}
              {t('available')}
              {list.available ? <span className="u-sr-only"> {t('filterOn')}</span> : null}
            </a>
          </li>
        </ul>
      </nav>

      {visible.length > 0 ? (
        <section aria-labelledby="flash-list-heading" data-flash-list="">
          <h2 id="flash-list-heading" className="u-sr-only">
            {t('listHeading')}
          </h2>
          <ul className={styles.flashGrid}>
            {visible.map((f, i) => (
              <li key={f.id}>
                <FlashCard
                  flash={f}
                  locale={locale}
                  settings={settings}
                  eager={i < 2}
                  photoHref={
                    photos.has(f.number) ? `${galleryBase}#${photos.get(f.number)!.anchor}` : null
                  }
                />
              </li>
            ))}
          </ul>
          <TattooPriceFootnote locale={locale} taxMode={settings.taxMode} />
        </section>
      ) : all.length > 0 && !anyAvailable ? (
        <EmptyState
          pose="schlafen"
          title={t('allTakenTitle')}
          text={t('allTakenText')}
          action={{ href: localizedPath('R20', locale), label: t('allTakenAction') }}
        />
      ) : (
        <EmptyState
          pose="schlafen"
          title={t('emptyTitle')}
          text={t('emptyText')}
          action={{ href: localizedPath('R16', locale), label: t('emptyAction') }}
        />
      )}
    </TattooShell>
  )
}
