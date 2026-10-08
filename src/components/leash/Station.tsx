import React from 'react'

import type { LoopKind, SpritePose } from '@/leash/types'
import type { CocoPose } from '@/lib/enums'

// Anker einer Station der Tuschelinie (DESIGN §9.1, KO-21): `data-leash-station` mit Pose und Schlaufe. Server-tauglich,
// ohne Zustand; die Engine misst den Anker in `measure()`. `pose` nimmt CMS-Werte (`CocoPose`) oder Sprite-IDs.
export function Station({
  id,
  pose,
  loop = 'none',
  as: Tag = 'div',
  className,
  children,
}: {
  id: string
  pose?: CocoPose | SpritePose
  loop?: LoopKind
  as?: 'div' | 'span' | 'section'
  className?: string
  children?: React.ReactNode
}) {
  return (
    <Tag
      className={className}
      data-leash-station={id}
      data-leash-pose={pose}
      data-leash-loop={loop}
    >
      {children}
    </Tag>
  )
}

/**
 * Kringel der Tuschelinie an einem vorhandenen Element (U-44): Attribute für eine Abschnitts-Überschrift o. Ä. – die
 * Leine kringelt sich dort in der Rinne, abwechselnd rechts/links nach `index` (fest je Seite, kein Zufall).
 */
export function coil(id: string, index: number, loop?: LoopKind) {
  return {
    'data-leash-station': id,
    'data-leash-loop': loop ?? (index % 2 ? 'left' : 'right'),
  } as const
}
