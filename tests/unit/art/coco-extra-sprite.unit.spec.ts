import { existsSync, readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

import { describe, expect, it } from 'vitest'

import { EXTRA_POSES, drawSprite } from '../../../scripts/art/draw-coco'
import { EXTRA_VERSION, extraPublicPath } from '../../../scripts/art/build-sprite'
import extraAnchors from '../../../src/art/coco/coco-extra-anchors.json'

// P12.4: Zusatz-Sprite (nachgeladen) – 9 Posen × 3 Frames, nur <path>, Budget, Anker, Quelle = Generator-Ausgabe.

describe('Coco-Zusatz-Sprite (P12.4, U-03/U-04)', () => {
  const svg = readFileSync(extraPublicPath(), 'utf8')

  it('9 Posen × 3 Frames mit IDs coco-<pose>-<a|b|c>, gleiche viewBox, nur Pfade', () => {
    expect(EXTRA_POSES).toHaveLength(9)
    for (const p of EXTRA_POSES)
      for (const f of ['a', 'b', 'c']) expect(svg).toContain(`id="coco-${p}-${f}"`)
    expect((svg.match(/<symbol\b/g) ?? []).length).toBe(27)
    expect(new Set(svg.match(/viewBox="[^"]+"/g)?.filter((v) => v.includes('160')))).toEqual(
      new Set(['viewBox="0 0 160 120"']),
    )
    expect(svg).not.toMatch(/<(circle|ellipse|rect|line|polygon)\b/)
  })

  it('Budget: ≤ 60 KB roh, ≤ 14 KB gz (nachgeladen, eigene Datei mit Versionsnummer)', () => {
    expect(extraPublicPath()).toBe(`public/art/coco-extra.v${EXTRA_VERSION}.svg`)
    expect(svg.length).toBeLessThanOrEqual(60_000)
    expect(gzipSync(svg, { level: 9 }).length).toBeLessThanOrEqual(14_000)
  })

  it('Anker-Datei nennt Datei und Anker aller Zusatz-Posen', () => {
    expect(extraAnchors.href).toBe(`/art/coco-extra.v${EXTRA_VERSION}.svg`)
    expect(existsSync(`public${extraAnchors.href}`)).toBe(true)
    expect(Object.keys(extraAnchors.anchors).sort()).toEqual([...EXTRA_POSES].sort())
  })

  it('Quelle ist die aktuelle Generator-Ausgabe (pnpm art:coco)', () => {
    expect(readFileSync('src/art/coco/coco-extra.svg', 'utf8')).toBe(drawSprite('extra'))
    expect(readFileSync('src/art/coco/coco-sprite.svg', 'utf8')).toBe(drawSprite('main'))
  })
})
