import React from 'react'

import {
  COCO_FRAMES,
  COCO_SPRITE_HREF,
  COCO_VIEWBOX,
  cocoHref,
  poseSymbol,
  type CocoSize,
} from '@/leash/cocoSprite'
import type { SpritePose } from '@/leash/types'

// Coco als SSR-Markup (DESIGN §10.4, §10.5): feste Box je Größenklasse (Breite + `aspect-ratio: 4 / 3`, kein CLS beim
// Nachladen des Sprites), drei Frames als `<use>` auf den ausgelieferten Sprite, `aria-hidden`. Ohne Steuerung
// (`src/leash/coco.ts`) steht Frame A (`data-boil="off"`) – nichts bewegt sich länger als 5 s (WCAG 2.2.2).
// Ohne Hooks: nutzbar in Server- und Client-Komponenten. Stile: `src/styles/coco.css`.

export interface CocoProps {
  pose: SpritePose
  size: CocoSize
  className?: string
  /** Weitere `data-*`-Attribute (z. B. `data-leash-coco`). */
  data?: Record<`data-${string}`, string>
  ref?: React.Ref<HTMLDivElement>
  /**
   * Sprite erst nach dem ersten Bild laden: `<use data-href>` statt `href` – für Coco in Elementen, die beim Laden
   * unsichtbar sind (geschlossenes Menü-`<dialog>`). Das Verhaltensmodul des Elements setzt `href` (`activateSpriteUses` in `src/behaviors/menu.ts`).
   */
  deferSprite?: boolean
}

export function Coco({ pose, size, className, data, ref, deferSprite = false }: CocoProps) {
  return (
    <div
      ref={ref}
      className={className ? `coco ${className}` : 'coco'}
      data-size={size}
      data-pose={pose}
      data-boil="off"
      aria-hidden="true"
      {...data}
    >
      <div className="coco__hop">
        <svg viewBox={`0 0 ${COCO_VIEWBOX.w} ${COCO_VIEWBOX.h}`} focusable="false">
          {COCO_FRAMES.map((f) => (
            <use
              key={f}
              className={`f f-${f}`}
              {...{
                [deferSprite ? 'data-href' : 'href']: cocoHref(
                  poseSymbol(pose, f),
                  COCO_SPRITE_HREF,
                ),
              }}
            />
          ))}
        </svg>
      </div>
    </div>
  )
}
