import React from 'react'

import type { Media } from '@/payload-types'

import styles from './ResponsiveImage.module.css'

// Bild aus der Mediathek (ARCHITEKTUR §9.4, DESIGN §12.2): `<img srcset sizes width height alt decoding="async">` in
// einem Rahmen mit fester `aspect-ratio` (Endhöhe vor dem Laden, kein Layout-Sprung), Lade-Hintergrund aus der
// gespeicherten Dominanzfarbe (sonst `--paper-2` mit Schraffur), Ausschnitt am Fokuspunkt (`object-position`).
// Keine Next-Bildoptimierung; die Größen erzeugt die Pipeline (`thumb`, `card`, `detail`, `zoom`).
// Standard `loading="lazy"`; das LCP-Bild bzw. die ersten Karten mit `eager` (optional `fetchPriority="high"`).

export type MediaSizeName = 'thumb' | 'card' | 'detail' | 'zoom'

type MediaLike = Pick<
  Media,
  'alt' | 'url' | 'width' | 'height' | 'focalX' | 'focalY' | 'dominantColor' | 'sizes'
>

const HEX = /^#[0-9a-f]{6}$/i

/** `srcset` aus den genannten Größen (nur vorhandene, aufsteigend nach Breite, doppelte Breiten einmal). */
export function mediaSrcSet(media: MediaLike, names: readonly MediaSizeName[]): string {
  const seen = new Set<number>()
  return names
    .map((n) => media.sizes?.[n])
    .filter((s): s is { url: string; width: number } => !!s?.url && !!s.width)
    .sort((a, b) => a.width - b.width)
    .filter((s) => (seen.has(s.width) ? false : (seen.add(s.width), true)))
    .map((s) => `${s.url} ${s.width}w`)
    .join(', ')
}

/** Kleinste vorhandene Größe als `src` (Rückfall: Original). */
function fallbackSrc(media: MediaLike, names: readonly MediaSizeName[]): string | null {
  for (const n of names) {
    const s = media.sizes?.[n]
    if (s?.url) return s.url
  }
  return media.url ?? null
}

export interface ResponsiveImageProps {
  media: MediaLike | null | undefined
  /** Seitenverhältnis des Rahmens, z. B. `4 / 5`. */
  aspectRatio: string
  sizes: string
  srcSizes: readonly MediaSizeName[]
  /** `eager`: ohne `loading="lazy"` (erste Karten, LCP). */
  loading?: 'lazy' | 'eager'
  fetchPriority?: 'high' | 'auto'
  className?: string
  /** Zusätzliche Klasse am `<img>`. */
  imgClassName?: string
}

export function ResponsiveImage({
  media,
  aspectRatio,
  sizes,
  srcSizes,
  loading = 'lazy',
  fetchPriority,
  className,
  imgClassName,
}: ResponsiveImageProps) {
  const color = media?.dominantColor && HEX.test(media.dominantColor) ? media.dominantColor : null
  const frameStyle = {
    aspectRatio,
    ...(color ? { '--img-bg': color } : {}),
  } as React.CSSProperties
  const src = media ? fallbackSrc(media, srcSizes) : null
  const frameClass = [styles.frame, color ? '' : styles.hatch, className].filter(Boolean).join(' ')
  if (!media || !src)
    return <span className={frameClass} style={frameStyle} data-image-missing="" />
  const focal = `${media.focalX ?? 50}% ${media.focalY ?? 50}%`
  const card = media.sizes?.[srcSizes[srcSizes.length - 1]!]
  return (
    <span className={frameClass} style={frameStyle}>
      {/* eslint-disable-next-line @next/next/no-img-element -- keine Next-Bildoptimierung (ARCHITEKTUR §9.4), Größen aus der Pipeline */}
      <img
        className={imgClassName ? `${styles.img} ${imgClassName}` : styles.img}
        src={src}
        srcSet={mediaSrcSet(media, srcSizes) || undefined}
        sizes={sizes}
        width={card?.width ?? media.width ?? undefined}
        height={card?.height ?? media.height ?? undefined}
        alt={media.alt ?? ''}
        loading={loading === 'lazy' ? 'lazy' : undefined}
        decoding="async"
        fetchPriority={fetchPriority}
        style={{ objectPosition: focal }}
      />
    </span>
  )
}
