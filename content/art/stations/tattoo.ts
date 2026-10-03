// Station „Tattoo“ (DESIGN §12.4): Kelch mit Schlange (Flash, `post-DbJ1QRrjCcb.jpg`) als echte Linienzeichnung –
// Kontrollpunkte von Hand nach dem Foto nachgezeichnet (P9.12, statt potrace-Flächen mit großen Schwarzflächen). Der
// dunkle Kelchschatten der Vorlage ist, wie in Juttas Skizzen, nur als einseitige Schraffur angedeutet.
// Koordinaten im Ausschnitt `crop` (sources.json) auf 400 Einheiten Breite.
import type { Ink } from '../../../scripts/art/lib/handline'
import { dot, merge } from '../placeholders/_parts'

const hatchLines: string[] = []
for (let i = 0; i < 11; i++) {
  const x = 156 + i * 9.4
  const top = 262 + (i % 3) * 5
  const bottom = 420 + Math.round(70 * Math.sin((i / 10) * 1.4)) + 20 - i * 3
  hatchLines.push(`M${x.toFixed(1)} ${top}C${(x - 1).toFixed(1)} ${top + 40} ${(x + 1.5).toFixed(1)} ${bottom - 60} ${(x - 3).toFixed(1)} ${bottom}`)
}

const ink: Ink = merge({
  strokes: [
    // Kelchschale: Rand, linke Wand, Boden – offen, mit Absetzer
    'M18 270C60 264 140 260 250 255',
    { d: 'M20 272C22 340 30 420 52 478C66 506 100 524 150 530', double: true },
    'M250 255C256 300 254 360 244 430C236 470 214 508 164 528',
    // Stiel, Knauf, Fuß
    'M112 540C108 580 108 612 106 640',
    'M154 542C148 590 150 620 150 650',
    'M96 658C98 628 128 612 160 622C184 632 186 664 172 682C158 696 120 694 104 682C96 676 94 666 96 658',
    'M106 696C100 724 94 746 76 756',
    'M154 698C152 722 154 744 158 760',
    // Fuß: flache Ellipse, offen
    'M18 772C30 756 90 748 150 752C196 754 224 760 228 776C226 792 190 804 130 806C80 808 32 806 18 790C14 784 14 778 18 772',
    // Schlange: S-förmiger Körper aus zwei Linien, steigt hinter dem Kelchrand auf
    { d: 'M170 250C142 240 124 216 122 184C120 150 124 114 140 84C152 62 174 48 204 42', double: true },
    'M204 56C178 66 160 84 160 110C160 140 184 160 202 184C212 202 206 226 188 246',
    // Kopf und Zunge
    'M210 46C226 40 244 34 262 36C288 38 316 46 340 44C352 43 364 44 374 46',
    'M262 40C290 50 322 56 350 54C358 52 366 50 372 52',
    // Querstriche am Schlangenbauch (Schuppen), quer zur Körperrichtung
    'M163 100C173 104 180 108 186 114',
    'M166 124C176 128 184 134 190 142',
    'M176 150C186 154 192 160 198 168',
    'M190 176C198 178 204 184 208 192',
    'M196 202C202 206 204 212 204 220',
    // zweite Schlinge im Kelch (hinter dem Henkelbogen)
    'M64 300C84 296 108 306 116 328C124 350 112 376 92 396C80 408 68 412 64 400C62 392 70 386 78 388',
    'M108 296C122 300 134 316 136 340C138 366 124 392 102 410',
    // Schlangenschuppen im Kelch
    'M98 330L112 336',
    'M104 352L118 356',
    'M100 374L114 372',
    ...hatchLines,
  ],
  dots: [dot(204, 62, 8, 6), dot(70, 395, 8, 6)],
})

export default { ink, tilt: 0, viewBox: '0 0 400 830', strokeWidth: 1.6 }
