// `pnpm art:fitness` (PLAN P12.5, U-09, `content/art/jutta-skizzen/FITNESS-COCO.md`): Fitness-Coco der Startseite.
// Neu als Puppen-Gerüst (`src/lib/fitness/rig.ts`): Coco ist ein kleines 3D-Skelett mit Röhren-Gliedmaßen, Rumpf-Querschnitten
// und Kopf (Blesse, Schnauze, Augen, Ohren – rechtes Ohr geknickt), jedes Bild wird daraus als Tusche-Strich mit Wasch-Fläche
// und oranger Buntstift-Schraffur berechnet (weiße Brust, Schnauze, Pfoten und Schwanzspitze bleiben Papier). Dieses Skript
// beschreibt nur den Ablauf: sieben Übungen in Juttas Reihenfolge + erschöpft Liegen, weiche Überblendungen, nahtlose Schleife.
// Ausgabe: `public/art/fitness-coco.v2.json` (nachgeladen nach dem ersten Bild, wenige KB) und
// `public/art/fitness-still.v2.svg` (Standbild als <img> und für reduzierte Bewegung). Deterministisch.
import { mkdirSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

import { build, ground, toSvg } from '../../src/lib/fitness/rig'
import {
  REST_POSE,
  loopMs,
  type Exercise,
  type FitnessData,
  type Term,
} from '../../src/lib/fitness/timeline'

export type { Exercise, FitnessData }
export const FITNESS_VERSION = 2
export const FITNESS_JSON = `public/art/fitness-coco.v${FITNESS_VERSION}.json`
export const FITNESS_STILL = `public/art/fitness-still.v${FITNESS_VERSION}.webp`
/** Standbild als WebP (Pixel, 2× der größten Anzeige von 360 px): bewusst kein SVG, weil „SVG der Startseite ≤ 60 KB“ (PF-10) sonst reißt. */
export const STILL_SIZE = [720, 900] as const
export const STILL_MAX = 32_000
export const BUDGET_GZ = 6000

const m = (v: number): Term => ['m', v]
const s = (a: number, c: number, ph = 0): Term => ['s', a, c, ph]
const b = (a: number, c: number, ph = 0): Term => ['b', a, c, ph]
const k = (c: number, keys: [number, number][]): Term => ['k', c, keys]
/** Schlüsselwerte skalieren (Verlauf 0 … 1 → Wertebereich). */
const kk = (c: number, keys: [number, number][], from: number, to: number): Term =>
  k(
    c,
    keys.map(([u, v]) => [u, from + (to - from) * v] as [number, number]),
  )

/** Hebe-Pulse in den Slots `slots` von `n` (u-Anteil), Verlauf 0 → 1 → 0. */
const pulse = (slots: number[], n: number): [number, number][] => {
  const w = 1 / n
  const out: [number, number][] = [[0, 0]]
  for (const i of slots) {
    const a = i * w
    out.push([a + w * 0.04, 0], [a + w * 0.3, 1], [a + w * 0.58, 1], [a + w * 0.86, 0])
  }
  return out.sort((x, y) => x[0] - y[0])
}
const pv = (slots: number[], n: number, from: number, to: number): Term =>
  kk(1, pulse(slots, n), from, to)

/** Offen → geschlossen → offen (Brustöffner, Periode 1/c). */
const CLOSE: [number, number][] = [
  [0, 0],
  [0.3, 0],
  [0.5, 1],
  [0.7, 1],
  [0.9, 0],
]

const WAVE: Exercise = {
  id: 'wave',
  ms: 5200,
  w: 900,
  f: {
    x: [s(7, 4, 0)],
    y: [m(4), s(2.2, 8, 0.1)],
    swy: [s(5, 4, 0.05)],
    bs: [s(-10, 4, 0.12)],
    bf: [s(8, 4, 0.27)],
    pit: [m(-2)],
    hr: [s(9, 4, -0.1)],
    hy: [s(8, 4, 0.3)],
    hp: [s(-6, 4, 0.4)],
    lx: [s(0.35, 4, 0)],
    mo: [m(1)],
    ra1: [m(150), s(15, 4, 0.25)],
    ra2: [m(158), s(13, 4, 0.3)],
    rb: [m(14), s(70, 4, 0)],
    la1: [m(30), s(16, 4, 0.5)],
    la2: [m(22), s(12, 4, 0.55)],
    lb: [m(8), s(12, 4, 0.3)],
    tm: [m(30)],
    ta: [m(76)],
    tb: [m(8), s(14, 4, 0.5)],
    tc: [m(18)],
  },
}
const BOUNCE: Exercise = {
  id: 'bounce',
  ms: 5000,
  w: 800,
  f: {
    y: [m(11), b(-26, 5, 0)],
    sq: [m(0.93), b(0.14, 5, 0)],
    bf: [b(-4, 5, 0)],
    la1: [m(14), b(26, 5, -0.14)],
    ra1: [m(14), b(26, 5, -0.14)],
    la2: [m(8), b(30, 5, -0.2)],
    ra2: [m(8), b(30, 5, -0.2)],
    hp: [b(-6, 5, -0.1)],
    ly: [m(-0.2)],
    mo: [m(1)],
    ta: [m(14)],
    tc: [m(5)],
    tb: [m(6)],
    tm: [m(6)],
    lfx: [m(-6)],
    rfx: [m(6)],
  },
}
const ARM: Exercise = {
  id: 'arm',
  ms: 5400,
  w: 800,
  f: {
    ra1: [pv([0, 1], 4, 14, 152)],
    ra2: [pv([0, 1], 4, 8, 156)],
    la1: [pv([2, 3], 4, 14, 152)],
    la2: [pv([2, 3], 4, 8, 156)],
    rb: [m(6)],
    lb: [m(6)],
    hy: [kk(1, pulse([0, 1], 4), 0, 30), kk(1, pulse([2, 3], 4), 0, -30)],
    lx: [kk(1, pulse([0, 1], 4), 0, 0.8), kk(1, pulse([2, 3], 4), 0, -0.8)],
    swy: [kk(1, pulse([0, 1], 4), 0, -4), kk(1, pulse([2, 3], 4), 0, 4)],
    lid: [m(0.42)],
    mo: [m(-0.2)],
    hp: [m(-4)],
    ta: [m(60)],
    tm: [m(10)],
    tb: [m(6), s(8, 2, 0)],
  },
}
const HIP: Exercise = {
  id: 'hip',
  ms: 5200,
  w: 800,
  f: {
    hip: [s(34, 3, 0)],
    tw: [s(-26, 3, 0)],
    x: [s(5, 3, 0.25)],
    swy: [s(7, 3, 0.25)],
    y: [m(8), b(-10, 6, 0.1)],
    la1: [m(32), s(18, 3, 0.4)],
    ra1: [m(32), s(18, 3, 0.9)],
    la2: [m(44), s(10, 3, 0.45)],
    ra2: [m(44), s(10, 3, 0.95)],
    lb: [m(22)],
    rb: [m(22)],
    hy: [s(-14, 3, 0.1)],
    hr: [s(6, 3, 0.4)],
    mo: [m(1)],
    lx: [s(0.5, 3, 0.1)],
    tm: [m(55)],
    ta: [m(80)],
    tc: [m(18)],
    tb: [m(6), s(22, 3, 0.5)],
    lfx: [m(-6)],
    rfx: [m(6)],
    kb: [m(14)],
  },
}
const CHEST: Exercise = {
  id: 'chest',
  ms: 5400,
  w: 800,
  f: {
    la1: [m(98), kk(3, CLOSE, 0, -48)],
    ra1: [m(98), kk(3, CLOSE, 0, -48)],
    la2: [m(98), kk(3, CLOSE, 0, 2)],
    ra2: [m(98), kk(3, CLOSE, 0, 2)],
    lb: [m(0), kk(3, CLOSE, 0, 55)],
    rb: [m(0), kk(3, CLOSE, 0, 55)],
    lbe: [m(0), kk(3, CLOSE, 0, 105)],
    rbe: [m(0), kk(3, CLOSE, 0, 105)],
    bf: [m(-8), kk(3, CLOSE, 0, 9)],
    hp: [m(-7)],
    lid: [m(0.55)],
    mo: [m(0.25)],
    sq: [m(1.02)],
    y: [m(3), kk(3, CLOSE, 0, 2)],
    hr: [s(3, 3, 0)],
    ta: [m(45)],
    tm: [m(8)],
    tb: [m(6)],
  },
}
const TWIST: Exercise = {
  id: 'twist',
  ms: 5200,
  w: 800,
  f: {
    tw: [s(78, 2.5, 0)],
    hip: [s(-8, 2.5, 0)],
    hy: [s(-26, 2.5, 0.05)],
    lx: [s(0.6, 2.5, 0.1)],
    la1: [m(90)],
    ra1: [m(90)],
    la2: [m(90)],
    ra2: [m(90)],
    lb: [m(0)],
    rb: [m(0)],
    y: [m(4), s(1.5, 5, 0)],
    mo: [m(0.3)],
    lid: [m(0.15)],
    tm: [m(22)],
    ta: [m(70)],
    tb: [m(6)],
  },
}
const THUMP_A: [number, number][] = [
  [0, 14],
  [0.4, 172],
  [0.55, 176],
  [0.68, -8],
  [0.76, 20],
]
const THUMP: Exercise = {
  id: 'thump',
  ms: 5200,
  w: 1500,
  f: {
    yaw: [m(90)],
    rb: [m(80)],
    lb: [m(100)],
    ra1: [k(3, THUMP_A)],
    la1: [
      k(
        3,
        THUMP_A.map(([u, v]) => [u + 0.015, v - 6] as [number, number]),
      ),
    ],
    ra2: [
      k(3, [
        [0, 10],
        [0.42, 170],
        [0.57, 176],
        [0.68, -4],
        [0.77, 16],
      ]),
    ],
    la2: [
      k(3, [
        [0.015, 6],
        [0.435, 166],
        [0.585, 172],
        [0.695, -8],
        [0.785, 12],
      ]),
    ],
    y: [
      k(3, [
        [0, 4],
        [0.4, 0],
        [0.55, -2],
        [0.67, 13],
        [0.78, 5],
      ]),
    ],
    sq: [
      k(3, [
        [0, 1],
        [0.4, 1.03],
        [0.55, 1.04],
        [0.67, 0.92],
        [0.78, 1],
      ]),
    ],
    bf: [
      k(3, [
        [0, 0],
        [0.4, -10],
        [0.55, -12],
        [0.68, 18],
        [0.85, 3],
      ]),
    ],
    hp: [
      k(3, [
        [0, 0],
        [0.4, -8],
        [0.55, -10],
        [0.68, 10],
        [0.85, 0],
      ]),
    ],
    ta: [
      k(3, [
        [0, 60],
        [0.55, 75],
        [0.68, 40],
      ]),
    ],
    tb: [m(82)],
    tc: [m(12)],
    tm: [m(12)],
    lfz: [m(-8)],
    rfz: [m(8)],
    lid: [m(0.25)],
    mo: [m(0.4)],
    lx: [m(0.7)],
  },
}
const LYING: Exercise = {
  id: 'lying',
  ms: 6000,
  w: 1700,
  f: {
    roll: [m(90)],
    x: [m(-14)],
    y: [m(37)],
    yaw: [m(0)],
    sq: [m(1), s(0.03, 3, 0)],
    lfx: [m(-34)],
    lfy: [m(16)],
    rfx: [m(-56)],
    rfy: [m(3)],
    kb: [m(0)],
    la1: [m(70)],
    la2: [m(85)],
    lb: [m(80)],
    ra1: [m(60)],
    ra2: [m(70)],
    rb: [m(100)],
    hp: [m(0)],
    hr: [m(-62)],
    hy: [m(0)],
    lid: [m(1)],
    mo: [m(0.9)],
    tg: [m(0.95), s(0.07, 6, 0)],
    tga: [m(-14)],
    ear: [m(-12)],
    ta: [m(24)],
    tc: [m(6)],
    tb: [m(0)],
    tm: [m(0)],
    bf: [m(0)],
    pit: [m(0)],
  },
}

export const EXERCISES: Exercise[] = [WAVE, BOUNCE, ARM, HIP, CHEST, TWIST, THUMP, LYING]

export function buildFitness(): { data: FitnessData; still: string } {
  const data: FitnessData = { v: 2, ex: EXERCISES }
  return { data, still: stillSvg() }
}

/** Standbild: Ruhepose (`REST`), freundlich stehend mit leicht geneigtem Kopf (Quelle des WebP, auch für Tests). */
export function stillSvg(): string {
  return toSvg([...ground(), ...build(REST_POSE)])
}

/** SVG → WebP (720 × 900, mit Transparenz; lossy 78 reicht für Linien und Flächen, ≈ 26 KB). */
export async function stillWebp(): Promise<Buffer> {
  const { default: sharp } = await import('sharp')
  const [w, h] = STILL_SIZE
  const png = await sharp(Buffer.from(stillSvg()), { density: (72 * w) / 200 })
    .resize(w, h)
    .png()
    .toBuffer()
  return sharp(png).webp({ quality: 78, alphaQuality: 100, effort: 6 }).toBuffer()
}

export async function main() {
  const { data } = buildFitness()
  mkdirSync('public/art', { recursive: true })
  const json = JSON.stringify(data)
  writeFileSync(FITNESS_JSON, json + '\n')
  const webp = await stillWebp()
  writeFileSync(FITNESS_STILL, webp)
  console.log(
    `fitness-coco: ${json.length} B roh / ${gzipSync(json, { level: 9 }).length} B gz, Standbild ${webp.length} B WebP, Schleife ${loopMs(data)} ms`,
  )
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) void main()
