// S11 T-Shirt „Coco fliegt zum Mond“: Coco mit rundem Helm auf einer kleinen Rakete Richtung Mondsichel; an der
// linken Seitennaht ein gestopfter Fleck aus Kreuzstichen.
import type { Motif } from '../../../scripts/art/lib/handline'
import { cocoSitting, merge, moon, place, tshirt } from './_parts'

/** Rakete waagerecht, Spitze rechts (Mitte), Länge ~200. */
const rocket = {
  strokes: [
    { d: 'M-80 -14C-40 -24 30 -24 60 -16', double: true },
    'M60 -16C76 -12 88 -4 96 0C88 4 76 10 60 14',
    'M60 14C30 22 -40 22 -80 12',
    'M-80 -14C-84 -6 -84 4 -80 12',
    'M57 -15C61 -6 61 6 57 13',
    'M14 0C13.6 -7.4 26.4 -7.6 26.4 0C26.6 7 14.4 7.4 14 0',
    'M-60 -18C-70 -34 -82 -40 -96 -40C-92 -28 -86 -18 -80 -14',
    'M-60 16C-70 32 -82 38 -96 38C-92 26 -86 16 -80 12',
    'M-86 -6C-100 -8 -110 -4 -122 -10C-112 0 -104 2 -86 2',
    'M-86 6C-98 8 -106 14 -118 12',
  ],
}

const motif: Motif = {
  tilt: -1.8,
  ...merge(
    tshirt(),
    place(moon(), { x: 286, y: 196, s: 1.7, r: 20 }),
    place(rocket, { x: 222, y: 324, s: 0.86, r: -26 }),
    place(cocoSitting(0.5, -6), { x: 204, y: 314, s: 0.66, r: -18 }),
    {
      strokes: [
        // Helm (runde Glaskugel um den Kopf)
        'M150 266C140 236 156 212 180 210C206 210 218 234 212 260C210 268 206 274 200 278',
        // gestopfter Fleck an der linken Seitennaht
        'M116 330L124 338M124 330L116 338M116 344L124 352M124 344L116 352M116 358L124 366M124 358L116 366',
      ],
    },
  ),
  wash: 'M170 126C200 136 214 134 230 126C262 132 296 140 322 154C332 174 338 192 342 208C326 214 310 216 296 214L296 396C236 402 170 402 116 396L116 214C102 218 86 216 60 208C66 190 72 172 80 156C108 140 140 132 170 126Z',
  shadow: { x: 120, y: 426, w: 80, count: 6, len: 15 },
}
export default motif
