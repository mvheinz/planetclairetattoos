// `pnpm art:calibration` (PLAN P2.18, KUNST-QA §3.1 „Kalibrierbogen“): rendert den Coco-Platzhalter-Sprite als
// Kontaktbogen – alle 22 Symbole in allen Größenklassen (DESIGN §10.5: 24, 40, 42, 64, 72, 180, 240 px, jeweils mit dem
// zugehörigen Strich) – mit echtem Chromium (Playwright, gleiche CSS wie die Seite) und schreibt
// `docs/design/qa-log/img/calibration-p2-placeholder.webp`. Einmalig vor der Zeichenarbeit in P9 (Kalibrierung R1).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { chromium } from '@playwright/test'
import sharp from 'sharp'

import { SPRITE_JSON, spritePublicPath, type SpriteManifest } from './build-sprite'

export const CALIBRATION_OUT = 'docs/design/qa-log/img/calibration-p2-placeholder.webp'

/**
 * Größenklassen (Breite in px, `data-size`, gerenderter Strich) laut DESIGN §10.5. Seit P9.2 nur 72 und 180 px
 * (KUNST-QA §3.1, PLAN P9.2: „alle Posen, 72 und 180 px“, ≤ 150 KB); alle 7 Größen zeigt `/qa/coco` (SC-12).
 */
export const CALIBRATION_SIZES = [
  { w: 72, size: 'm', stroke: 1.8 },
  { w: 180, size: 'xl', stroke: 2.2 },
] as const

/** Höchstgröße der Datei (KUNST-QA §8). */
export const CALIBRATION_MAX_BYTES = 150 * 1024

export function calibrationHtml(): string {
  const manifest = JSON.parse(readFileSync(SPRITE_JSON, 'utf8')) as SpriteManifest
  const sprite = readFileSync(spritePublicPath(), 'utf8').replace(
    '<svg ',
    '<svg style="display:none" ',
  )
  const css = ['src/styles/tokens.css', 'src/styles/coco.css']
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n')
  const rows = manifest.symbols
    .map((s) => {
      const cells = CALIBRATION_SIZES.map(
        (z) =>
          `<div class="cell"><div class="coco" data-size="${z.size}" data-pose="${s.pose}" data-boil="off" ` +
          `style="--coco-w:${z.w}px;--coco-stroke:${z.stroke}px"><div class="coco__hop"><svg viewBox="0 0 160 120">` +
          `<use class="f f-a" href="#${s.id}"/></svg></div></div><span>${z.w}</span></div>`,
      ).join('')
      return `<section><h2>${s.id}</h2><div class="row">${cells}</div></section>`
    })
    .join('')
  return (
    `<!doctype html><meta charset="utf-8"><style>${css}` +
    'body{margin:16px;background:var(--paper);color:var(--ink);font:12px/1.2 monospace;display:grid;' +
    'grid-template-columns:repeat(4,max-content);gap:12px 32px}h2{font-size:12px;margin:0 0 4px}' +
    '.row{display:flex;align-items:flex-end;gap:10px}.cell{display:flex;flex-direction:column;align-items:center;' +
    'gap:2px}.cell span{color:var(--ink-3);font-size:10px}.coco{outline:1px dotted var(--paper-2)}</style>' +
    `<h1 style="grid-column:1/-1;font-size:14px;margin:0">Coco – Kalibrierbogen P2 (Platzhalter, ${manifest.symbols.length} Symbole, Sprite v${manifest.version}, 72 + 180 px)</h1>` +
    `${sprite}${rows}`
  )
}

export async function renderCalibrationSheet(
  out: string = CALIBRATION_OUT,
): Promise<{ width: number; height: number; bytes: number; quality: number }> {
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage({
      viewport: { width: 1360, height: 800 },
      deviceScaleFactor: 1,
    })
    await page.setContent(calibrationHtml())
    const png = await page.screenshot({ fullPage: true })
    mkdirSync(path.dirname(out), { recursive: true })
    // Höchste Qualität, die ins Budget passt (Striche sollen nicht verwaschen).
    for (const quality of [90, 85, 80, 75, 70]) {
      const buf = await sharp(png).webp({ quality }).toBuffer()
      if (buf.length <= CALIBRATION_MAX_BYTES || quality === 70) {
        writeFileSync(out, buf)
        const meta = await sharp(buf).metadata()
        return { width: meta.width!, height: meta.height!, bytes: buf.length, quality }
      }
    }
    throw new Error('unreachable')
  } finally {
    await browser.close()
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { width, height, bytes, quality } = await renderCalibrationSheet()
  console.log(
    `art:calibration: ${CALIBRATION_OUT} (${width} × ${height} px, ${Math.round(bytes / 1024)} KB, q${quality}) geschrieben.`,
  )
}
