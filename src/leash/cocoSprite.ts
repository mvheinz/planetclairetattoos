import sprite from '../art/coco/coco-anchors.json'

import type { SpritePose } from './types'

// Coco-Sprite (DESIGN §10.4): ausgelieferte Datei, Symbol-IDs, Anker (D-Ring) je Pose und Größenklassen. Rein und
// framework-frei; genutzt von der Coco-Steuerung (`coco.ts`), der SSR-Komponente `Coco.tsx` und der Vorschau.
// `coco-anchors.json` erzeugt `pnpm art:sprite` aus dem Sprite (nicht von Hand ändern).

export type CocoSize = 'horizon' | 'leash' | 's' | 'm' | 'xl' | 'xxl'
export type CocoBridge = 'bremsen' | 'abspringen' | 'einrollen-1' | 'einrollen-2'
export type CocoFrame = 'a' | 'b' | 'c'

/** Ausgelieferte Sprite-Datei mit Versionsnummer im Namen (Cache `immutable`). */
export const COCO_SPRITE_HREF: string = sprite.href
export const COCO_VIEWBOX = { w: 160, h: 120 } as const
export const COCO_FRAMES: readonly CocoFrame[] = ['a', 'b', 'c']

/** D-Ring (Leinen-Anker) in viewBox-Einheiten je Pose bzw. Brücke. */
export const COCO_ANCHORS = sprite.anchors as unknown as Readonly<Record<string, [number, number]>>

export const poseSymbol = (pose: SpritePose, frame: CocoFrame): string => `coco-${pose}-${frame}`
export const bridgeSymbol = (bridge: CocoBridge): string => `coco-bridge-${bridge}`

/** `href` eines Symbols; `base` leer → Symbol im selben Dokument (Vorschau-Datei, §9.12). */
export const cocoHref = (id: string, base: string = COCO_SPRITE_HREF): string => `${base}#${id}`

const SVG_NS = 'http://www.w3.org/2000/svg'

/**
 * Gruppe `<g class="cg">` mit drei `<use>` (A/B/C); `reuse` übernimmt vorhandene `<use>`. Sichtbar ist nur die Gruppe
 * mit `data-on`. Ein Posenwechsel schaltet nur dieses Attribut um – ein neues `href` würde den Schatten-Baum des
 * `<use>` neu aufbauen und je Wechsel ein Layout auslösen (KUNST-QA PF-05).
 */
export function makeGroup(
  svg: Element,
  ids: string[],
  href: string,
  reuse: Element[] = [],
): Element {
  const g = svg.ownerDocument.createElementNS(SVG_NS, 'g')
  g.setAttribute('class', 'cg')
  COCO_FRAMES.forEach((f, i) => {
    const use = reuse[i] ?? svg.ownerDocument.createElementNS(SVG_NS, 'use')
    use.setAttribute('class', `f f-${f}`)
    use.setAttribute('href', cocoHref(ids[i]!, href))
    use.removeAttribute('data-href')
    g.appendChild(use)
  })
  svg.appendChild(g)
  return g
}
