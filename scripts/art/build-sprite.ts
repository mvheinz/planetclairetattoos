// `pnpm art:sprite` (PLAN P2.18, DESIGN §10.4, ARCHITEKTUR §6.10): liest die Quelle `src/art/coco/coco-sprite.svg`,
// optimiert sie mit SVGO (`floatPrecision: 1`, IDs, `viewBox`, `data-*` und `data-part`-Gruppen bleiben) und schreibt
// - `public/art/coco-sprite.v{N}.svg` (ausgeliefert, Cache `immutable` über die Versionsnummer im Dateinamen) und
// - `src/art/coco/coco-sprite.json` (IDs, Anker, Bodenlinie, Bbox, fps, verdeckte Teile) für Code und Tests.
// Nach jeder Änderung an den Zeichnungen: `SPRITE_VERSION` erhöhen, dann `pnpm art:sprite`.
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { optimize } from 'svgo'

export const SPRITE_VERSION = 3
/** Nachgeladene Zusatz-Posen (P12.4): eigene Datei, eigene Versionsnummer. */
export const EXTRA_VERSION = 1
export const SPRITE_SOURCE = 'src/art/coco/coco-sprite.svg'
export const SPRITE_JSON = 'src/art/coco/coco-sprite.json'
/** Kompakte Anker je Pose/Brücke (Mittel über die Frames) für die Coco-Steuerung im Browser (klein halten). */
export const ANCHORS_JSON = 'src/art/coco/coco-anchors.json'
export const spritePublicPath = (v = SPRITE_VERSION) => `public/art/coco-sprite.v${v}.svg`
export const EXTRA_SOURCE = 'src/art/coco/coco-extra.svg'
export const EXTRA_JSON = 'src/art/coco/coco-extra.json'
/** Anker + Datei der Zusatz-Posen für die nachgeladene Steuerung (`src/leash/cocoExtra.ts`). */
export const EXTRA_ANCHORS_JSON = 'src/art/coco/coco-extra-anchors.json'
export const extraPublicPath = (v = EXTRA_VERSION) => `public/art/coco-extra.v${v}.svg`

/** Bildrate je Pose (DESIGN §10.3); Brücken 1 Frame à 83 ms. */
export const POSE_FPS: Record<string, number> = {
  rennen: 12,
  schnueffeln: 10,
  sitzen: 10,
  schlafen: 8,
  springen: 12,
  kopfschief: 10,
  bridge: 12,
  // Zusatz-Posen (P12.4)
  hecheln: 10,
  zucken: 10,
  kratzen: 10,
  gaehnen: 4,
  wedeln: 8,
  verbeugung: 6,
  schuetteln: 12,
  freude: 8,
  liegen: 5,
}

export interface SpriteSymbolMeta {
  id: string
  pose: string
  frame: 'a' | 'b' | 'c' | null
  bridge: boolean
  anchor: { x: number; y: number }
  groundY: number
  bbox: { x: number; y: number; w: number; h: number }
  fps: number
  hiddenParts: string[]
}

export interface SpriteManifest {
  version: number
  href: string
  viewBox: [number, number, number, number]
  symbols: SpriteSymbolMeta[]
}

const attr = (tag: string, name: string): string | null =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? null

/**
 * Punkte (End- und Kontrollpunkte) eines Pfads – Bbox als obere Schranke (Kontrollpolygon umschließt die Kurve).
 * Unterstützt M/L/H/V/C/S/Q/T/A/Z, absolut und relativ.
 */
export function pathPoints(d: string): [number, number][] {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? []
  const pts: [number, number][] = []
  let i = 0
  let cmd = ''
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  const num = () => Number(tokens[i++])
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i]!)) cmd = tokens[i++]!
    const rel = cmd === cmd.toLowerCase()
    const C = cmd.toUpperCase()
    if (C === 'Z') {
      x = sx
      y = sy
      continue
    }
    const pairs = { M: 1, L: 1, T: 1, C: 3, S: 2, Q: 2 }[C as 'M']
    if (pairs) {
      let lx = x
      let ly = y
      for (let k = 0; k < pairs; k++) {
        const px = num() + (rel ? x : 0)
        const py = num() + (rel ? y : 0)
        pts.push([px, py])
        lx = px
        ly = py
      }
      x = lx
      y = ly
      if (C === 'M') {
        sx = x
        sy = y
        cmd = rel ? 'l' : 'L'
      }
    } else if (C === 'H') {
      x = num() + (rel ? x : 0)
      pts.push([x, y])
    } else if (C === 'V') {
      y = num() + (rel ? y : 0)
      pts.push([x, y])
    } else if (C === 'A') {
      i += 5
      x = num() + (rel ? x : 0)
      y = num() + (rel ? y : 0)
      pts.push([x, y])
    } else i++
  }
  return pts
}

/** Symbole der Quelle mit Metadaten; Füll-Ebenen mit ihrem Versatz (`translate`) eingerechnet. */
export function readSymbols(svg: string): SpriteSymbolMeta[] {
  const out: SpriteSymbolMeta[] = []
  for (const m of svg.matchAll(/<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/g)) {
    const tag = m[1]!
    const body = m[2]!
    const id = attr(tag, 'id') ?? ''
    const bridge = id.startsWith('coco-bridge-')
    const pose = bridge ? id.slice('coco-bridge-'.length) : id.replace(/^coco-|-[abc]$/g, '')
    const frame = bridge ? null : ((id.slice(-1) as 'a' | 'b' | 'c') ?? null)
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const g of body.split(/(?=<g\b)/)) {
      const t = /translate\(([-\d.]+)[ ,]+([-\d.]+)\)/.exec(g)
      const dx = t ? Number(t[1]) : 0
      const dy = t ? Number(t[2]) : 0
      for (const p of g.matchAll(/\sd="([^"]+)"/g))
        for (const [px, py] of pathPoints(p[1]!)) {
          minX = Math.min(minX, px + dx)
          minY = Math.min(minY, py + dy)
          maxX = Math.max(maxX, px + dx)
          maxY = Math.max(maxY, py + dy)
        }
    }
    const r1 = (n: number) => Math.round(n * 10) / 10
    out.push({
      id,
      pose,
      frame,
      bridge,
      anchor: { x: Number(attr(tag, 'data-anchor-x')), y: Number(attr(tag, 'data-anchor-y')) },
      groundY: Number(attr(tag, 'data-ground-y')),
      bbox: { x: r1(minX), y: r1(minY), w: r1(maxX - minX), h: r1(maxY - minY) },
      fps: POSE_FPS[bridge ? 'bridge' : pose] ?? 12,
      hiddenParts: (attr(tag, 'data-hidden-parts') ?? '').split(' ').filter(Boolean),
    })
  }
  return out
}

export function optimizeSprite(svg: string): string {
  return optimize(svg, {
    multipass: true,
    floatPrecision: 1,
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            cleanupIds: false,
            collapseGroups: false,
            removeUnknownsAndDefaults: { keepDataAttrs: true },
            inlineStyles: false,
            mergePaths: false,
            convertShapeToPath: false,
            removeHiddenElems: false,
            removeUselessDefs: false,
          },
        },
      },
    ],
  }).data
}

/** `{ href, anchors: { rennen: [x, y], …, 'bridge-bremsen': [x, y] } }` */
export function anchorTable(manifest: SpriteManifest): {
  href: string
  anchors: Record<string, [number, number]>
} {
  const groups = new Map<string, SpriteSymbolMeta[]>()
  for (const s of manifest.symbols) {
    const key = s.bridge ? `bridge-${s.pose}` : s.pose
    groups.set(key, [...(groups.get(key) ?? []), s])
  }
  const r1 = (n: number) => Math.round(n * 10) / 10
  const anchors = Object.fromEntries(
    [...groups].map(([k, list]) => [
      k,
      [
        r1(list.reduce((a, s) => a + s.anchor.x, 0) / list.length),
        r1(list.reduce((a, s) => a + s.anchor.y, 0) / list.length),
      ] as [number, number],
    ]),
  )
  return { href: manifest.href, anchors }
}

export function buildSprite(set: 'main' | 'extra' = 'main'): {
  svg: string
  manifest: SpriteManifest
} {
  const extra = set === 'extra'
  const source = readFileSync(extra ? EXTRA_SOURCE : SPRITE_SOURCE, 'utf8')
  const svg = optimizeSprite(source)
  const version = extra ? EXTRA_VERSION : SPRITE_VERSION
  const manifest: SpriteManifest = {
    version,
    href: `/art/coco-${extra ? 'extra' : 'sprite'}.v${version}.svg`,
    viewBox: [0, 0, 160, 120],
    symbols: readSymbols(svg),
  }
  return { svg, manifest }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { svg, manifest } = buildSprite()
  writeFileSync(spritePublicPath(), svg)
  writeFileSync(SPRITE_JSON, `${JSON.stringify(manifest, null, 2)}\n`)
  writeFileSync(ANCHORS_JSON, `${JSON.stringify(anchorTable(manifest))}\n`)
  const ex = buildSprite('extra')
  writeFileSync(extraPublicPath(), ex.svg)
  writeFileSync(EXTRA_JSON, `${JSON.stringify(ex.manifest, null, 2)}\n`)
  writeFileSync(EXTRA_ANCHORS_JSON, `${JSON.stringify(anchorTable(ex.manifest))}\n`)
  console.log(
    `art:sprite: ${spritePublicPath()} (${svg.length} B, ${manifest.symbols.length} Symbole), ${extraPublicPath()} (${ex.svg.length} B, ${ex.manifest.symbols.length} Symbole) und die Manifeste geschrieben.`,
  )
}
