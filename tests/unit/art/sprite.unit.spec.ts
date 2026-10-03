import { readFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'

import sharp from 'sharp'

import { describe, expect, it } from 'vitest'

import {
  ANCHORS_JSON,
  SPRITE_JSON,
  SPRITE_SOURCE,
  SPRITE_VERSION,
  anchorTable,
  optimizeSprite,
  readSymbols,
  spritePublicPath,
  type SpriteManifest,
} from '../../../scripts/art/build-sprite'
import { PARTS, drawSprite } from '../../../scripts/art/draw-coco'
import { COCO_POSES } from '../../../src/lib/enums'
import { COCO_POSE_TO_SPRITE } from '../../../src/leash/poses'

// Coco-Sprite (P2.18 Platzhalter, P9.9/P9.10 gezeichnet; DESIGN §10.3, §10.4, §9.10; KUNST-QA CO-01, CO-04, CO-07, PF-10, MO-03).

const source = readFileSync(SPRITE_SOURCE, 'utf8')
const built = readFileSync(spritePublicPath(), 'utf8')
const manifest = JSON.parse(readFileSync(SPRITE_JSON, 'utf8')) as SpriteManifest

const POSES = Object.values(COCO_POSE_TO_SPRITE)
const EXPECTED_IDS = [
  ...POSES.flatMap((p) => ['a', 'b', 'c'].map((f) => `coco-${p}-${f}`)),
  'coco-bridge-bremsen',
  'coco-bridge-abspringen',
  'coco-bridge-einrollen-1',
  'coco-bridge-einrollen-2',
].sort()

function symbols(svg: string): { id: string; tag: string; body: string }[] {
  return [...svg.matchAll(/<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/g)].map((m) => ({
    id: /\sid="([^"]+)"/.exec(m[1]!)![1]!,
    tag: m[1]!,
    body: m[2]!,
  }))
}

describe('Coco-Sprite: Umfang und Format (CO-01)', () => {
  for (const [label, svg] of [
    ['Quelle', source],
    ['ausgeliefert', built],
  ] as const) {
    it(`${label}: genau 22 IDs laut §10.4 und überall viewBox 0 0 160 120`, () => {
      const list = symbols(svg)
      expect(list.map((s) => s.id).sort()).toEqual(EXPECTED_IDS)
      for (const s of list) expect(s.tag, s.id).toContain('viewBox="0 0 160 120"')
    })

    it(`${label}: keine Formen-Primitive (CO-07), nur <path> als Zeichnung`, () => {
      expect(svg).not.toMatch(/<(circle|ellipse|rect|line|polygon|polyline)\b/)
      const tags = new Set([...svg.matchAll(/<([a-z]+)\b/g)].map((m) => m[1]))
      expect([...tags].sort()).toEqual(['g', 'path', 'style', 'svg', 'symbol'])
    })
  }

  it('Ebenen .fur/.harness/.line/.solid je Symbol, .hi wo Augen offen; Fell und Geschirr versetzt (Riso)', () => {
    for (const s of symbols(source)) {
      for (const layer of ['fur', 'harness', 'line', 'solid'])
        expect(s.body, `${s.id} .${layer}`).toContain(`class="${layer}"`)
      if (!s.id.includes('schlafen')) expect(s.body, `${s.id} .hi`).toContain('class="hi"')
      expect(s.body).toContain('<g class="fur" transform="translate(1.5 1.2)">')
      expect(s.body).toContain('<g class="harness" transform="translate(1.5 1.2)">')
    }
  })

  it('jede Körperteil-Gruppe (data-part) vorhanden oder in data-hidden-parts begründet – auch nach SVGO', () => {
    for (const svg of [source, built])
      for (const s of symbols(svg)) {
        const present = new Set([...s.body.matchAll(/data-part="([\w-]+)"/g)].map((m) => m[1]))
        const hidden = (/data-hidden-parts="([^"]*)"/.exec(s.tag)?.[1] ?? '').split(' ')
        for (const part of PARTS)
          expect(present.has(part) || hidden.includes(part), `${s.id}: ${part}`).toBe(true)
        for (const h of hidden.filter(Boolean))
          expect(present.has(h), `${s.id}: ${h} verdeckt`).toBe(false)
      }
  })
})

describe('Coco-Sprite: Anker und Bodenlinie (CO-04)', () => {
  it('D-Ring je Pose über A/B/C ± 2 Einheiten (rennen ± 3, echte Gangphasen), data-ground-y ± 2, alles in der viewBox', () => {
    for (const pose of POSES) {
      const tol = pose === 'rennen' ? 3 : 2
      const frames = manifest.symbols.filter((s) => s.pose === pose && !s.bridge)
      expect(frames).toHaveLength(3)
      const xs = frames.map((f) => f.anchor.x)
      const ys = frames.map((f) => f.anchor.y)
      const gs = frames.map((f) => f.groundY)
      expect(Math.max(...xs) - Math.min(...xs), `${pose} x`).toBeLessThanOrEqual(tol)
      expect(Math.max(...ys) - Math.min(...ys), `${pose} y`).toBeLessThanOrEqual(tol)
      expect(Math.max(...gs) - Math.min(...gs), `${pose} ground`).toBeLessThanOrEqual(2)
    }
    for (const s of manifest.symbols) {
      expect(s.bbox.x, s.id).toBeGreaterThanOrEqual(0)
      expect(s.bbox.y, s.id).toBeGreaterThanOrEqual(0)
      expect(s.bbox.x + s.bbox.w, s.id).toBeLessThanOrEqual(160)
      expect(s.bbox.y + s.bbox.h, s.id).toBeLessThanOrEqual(120)
      // D-Ring liegt in der Figur
      expect(s.anchor.x).toBeGreaterThan(s.bbox.x)
      expect(s.anchor.x).toBeLessThan(s.bbox.x + s.bbox.w)
    }
  })

  it('kein Frame ist Kopie oder reine Verschiebung eines anderen derselben Pose (CO-07)', () => {
    const numbers = (body: string) =>
      [...body.matchAll(/ d="([^"]+)"/g)].flatMap((m) => m[1]!.match(/-?\d*\.?\d+/g)!.map(Number))
    for (const pose of POSES) {
      const bodies = ['a', 'b', 'c'].map(
        (f) => symbols(source).find((s) => s.id === `coco-${pose}-${f}`)!.body,
      )
      for (let i = 0; i < 3; i++)
        for (let j = i + 1; j < 3; j++) {
          expect(bodies[i], `${pose} ${i}/${j}`).not.toBe(bodies[j])
          const a = numbers(bodies[i]!)
          const b = numbers(bodies[j]!)
          if (a.length !== b.length) continue
          const deltas = new Set(a.map((v, k) => Math.round((b[k]! - v) * 10) / 10))
          expect(deltas.size, `${pose} ${i}/${j} nur verschoben`).toBeGreaterThan(2)
        }
    }
  })
})

describe('Coco-Sprite: Erzeugung und Budget (§9.10)', () => {
  it('Quelle entspricht dem Zeichen-Generator, ausgelieferte Datei der SVGO-Optimierung, JSON dem Sprite', () => {
    expect(drawSprite()).toBe(source)
    expect(optimizeSprite(source)).toBe(built)
    expect(manifest.symbols).toEqual(readSymbols(built))
    expect(SPRITE_VERSION).toBeGreaterThanOrEqual(2)
    expect(manifest.version).toBe(SPRITE_VERSION)
    expect(manifest.href).toBe(`/art/coco-sprite.v${SPRITE_VERSION}.svg`)
    expect(JSON.parse(readFileSync(ANCHORS_JSON, 'utf8'))).toEqual(anchorTable(manifest))
    for (const s of manifest.symbols)
      expect(s.fps).toBe(
        s.pose === 'schlafen' ? 8 : ['rennen', 'springen'].includes(s.pose) || s.bridge ? 12 : 10,
      )
  })

  it('P9.10 PF-10: Sprite ≤ 45 KB roh und ≤ 12 KB gz', () => {
    expect(built.length).toBeLessThanOrEqual(45_000)
    expect(gzipSync(built, { level: 9 }).length).toBeLessThanOrEqual(12_000)
  })

  it('Stil im Sprite: Linie ohne Füllung mit --ink und --coco-stroke, non-scaling-stroke, erzwungene Farben', () => {
    const style = /<style>([\s\S]*?)<\/style>/.exec(built)![1]!
    expect(style).toContain('var(--coco-stroke')
    expect(style).toContain('vector-effect:non-scaling-stroke')
    expect(style).toContain('forced-colors:active')
    expect(style).toContain('var(--coco-harness')
    expect(style).not.toMatch(/https?:\/\/(?!www\.w3\.org)/)
  })
})

describe('P9.9/P9.10 Coco gezeichnet: Posen, Frames, Bildrate', () => {
  it('COCO_POSE_TO_SPRITE bildet jeden Wert aus COCO_POSES auf eine der sechs gezeichneten Posen ab', () => {
    expect(Object.keys(COCO_POSE_TO_SPRITE).sort()).toEqual([...COCO_POSES].sort())
    expect(new Set(Object.values(COCO_POSE_TO_SPRITE)).size).toBe(6)
    for (const pose of Object.values(COCO_POSE_TO_SPRITE))
      for (const f of ['a', 'b', 'c'])
        expect(
          manifest.symbols.some((s) => s.id === `coco-${pose}-${f}`),
          `${pose}-${f}`,
        ).toBe(true)
  })

  it('MO-03: rennen/springen 12 fps, schlafen 8 fps, übrige 10 fps, Brücken 1 Frame à 83 ms (12 fps)', () => {
    const fps = (pose: string) => manifest.symbols.find((s) => s.pose === pose && !s.bridge)!.fps
    expect([fps('rennen'), fps('springen'), fps('schlafen')]).toEqual([12, 12, 8])
    for (const p of ['schnueffeln', 'sitzen', 'kopfschief']) expect(fps(p)).toBe(10)
    for (const s of manifest.symbols.filter((x) => x.bridge)) expect(s.fps).toBe(12)
  })

  it('Frame A von Hand gesetzt, B/C nachgezeichnet: jede Linie anders, Anatomie gleich (gleiche data-part-Gruppen)', () => {
    const parts = (body: string) =>
      [...body.matchAll(/data-part="([\w-]+)"/g)].map((m) => m[1]).join(' ')
    for (const pose of POSES) {
      const [a, b, c] = ['a', 'b', 'c'].map(
        (f) => symbols(source).find((s) => s.id === `coco-${pose}-${f}`)!.body,
      )
      expect(parts(b!), pose).toBe(parts(a!))
      expect(parts(c!), pose).toBe(parts(a!))
      const paths = (body: string) => [...body.matchAll(/ d="([^"]+)"/g)].map((m) => m[1])
      const pa = paths(a!)
      const pb = paths(b!)
      const same = pa.filter((d, i) => d === pb[i]).length
      expect(same / pa.length, `${pose}: Anteil unveränderter Pfade A/B`).toBeLessThan(0.2)
    }
  })

  it('schlafen: Augen als geschlossene Bögen (keine Pupillen), 4–6 Schraffurstriche als Schatten', () => {
    for (const f of ['a', 'b', 'c']) {
      const body = symbols(source).find((s) => s.id === `coco-schlafen-${f}`)!.body
      const solid = /<g class="solid">([\s\S]*?)<\/g><\/g>/.exec(body)?.[1] ?? ''
      expect(solid).not.toContain('data-part="eye-l"')
      expect(body).not.toContain('class="hi"')
      const line = /<g class="line">([\s\S]*?)<g class="solid">/.exec(body)![1]!
      expect(line).toContain('data-part="eye-l"')
      // kurze Striche unterhalb der Bodenlinie (y > 112) = Schraffur
      const hatch = [...line.matchAll(/M([\d.]+) (11[3-9](?:\.\d)?)L/g)].length
      expect(hatch, f).toBeGreaterThanOrEqual(4)
      expect(hatch, f).toBeLessThanOrEqual(6)
    }
  })
})

describe('Kalibrierbogen (KUNST-QA §3.1)', () => {
  it('P9.2 Kalibrierbogen: Sprite v1, alle 22 Symbole in 72 und 180 px, WebP ≤ 150 KB', async () => {
    const { CALIBRATION_OUT, CALIBRATION_SIZES, CALIBRATION_MAX_BYTES, calibrationHtml } =
      await import('../../../scripts/art/calibration-sheet')
    const { statSync } = await import('node:fs')
    const meta = await sharp(CALIBRATION_OUT).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBeGreaterThanOrEqual(1200)
    // 22 Symbole à ≥ 135 px Höhe (180 × 3/4) in vier Spalten → ≥ 6 Reihen
    expect(meta.height).toBeGreaterThanOrEqual(6 * 135)
    expect(statSync(CALIBRATION_OUT).size).toBeLessThanOrEqual(CALIBRATION_MAX_BYTES)
    expect(CALIBRATION_SIZES.map((z) => z.w)).toEqual([72, 180])
    const html = calibrationHtml()
    expect(html).toContain(`Sprite v${SPRITE_VERSION}`)
    expect(html.match(/<use class="f f-a"/g)).toHaveLength(22 * 2)
  })
})
