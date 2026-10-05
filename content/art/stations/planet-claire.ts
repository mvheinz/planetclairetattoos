// Station „Planet Claire“ (DESIGN §12.4): der Planet der Marke, frei mit der Handlinie gezeichnet (P9.18a, R1-05-03): wackliger
// Körper mit offenem Anschluss, ein Ring aus zwei Bögen mit Absetzer (kein Ideal-Oval), Schraffur nur als Akzent in einer Richtung.
import type { Ink } from '../../../scripts/art/lib/handline'
import { merge } from '../placeholders/_parts'

/** Zeichnung um die Mitte (200, 250) verkleinern (nur absolute Pfadbefehle mit Koordinatenpaaren): mehr Papier ums Motiv. */
const shrink = (d: string, k = 0.8): string => {
  let i = 0
  return d.replace(/-?\d+(?:\.\d+)?/g, (n) => {
    const v = Number(n)
    const out = i % 2 === 0 ? 200 + (v - 200) * k : 250 + (v - 250) * k
    i++
    return String(Math.round(out * 10) / 10)
  })
}

const ink: Ink = merge({
  strokes: ([
    'M118 240C128 192 170 160 216 166C262 172 292 212 286 260C280 304 244 336 198 334C156 332 124 298 120 254',
    // Ring: hinten zwei kurze Bögen, vorn ein langer, unten ein Absetzer
    'M54 270C50 244 88 220 126 210',
    'M276 196C322 200 352 222 346 248',
    'M62 284C96 330 208 346 312 312C350 298 358 272 346 256',
    // Schraffur
    'M236 270L262 242M240 298L272 268',
    // Glanzbogen
    'M146 214C156 200 170 192 186 188',
    // Strich-Funken
    'M70 150L82 136M318 128L330 112',
  ] as string[]).map((d) => shrink(d)),
  dots: [],
})

const station = { ink, tilt: 1, viewBox: '0 0 400 500' }
export default station
