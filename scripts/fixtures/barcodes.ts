// Barcode-Test-Fixtures für den Scan der Sendungsnummer (PLAN P5.14, ARCHITEKTUR §1.2). Aufruf:
//   pnpm fixtures:barcodes
// Erzeugt mit `bwip-js` (nur devDependency) PNGs unter tests/fixtures/barcodes/ und prüft jedes mit `@zxing/library`
// (dieselbe Bibliothek wie der Foto-Rückfall im Browser) – ein nicht lesbares Fixture bricht das Skript ab:
// - code128.png, code39.png, itf.png, datamatrix.png: sauber gerendert;
// - code128-photo.png: „Foto“ eines Code-128-Etiketts (leicht gedreht, gedämpfter Kontrast, Rand, 1600×1200),
//   genutzt von tests/e2e/admin/tracking-scan.e2e.spec.ts.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library'
import bwipjs from 'bwip-js/node'
import sharp from 'sharp'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const BARCODE_DIR = path.join(root, 'tests/fixtures/barcodes')

/** Inhalt der Fixtures (DHL-Paketnummer, Sendungsnummer mit Buchstaben). */
export const BARCODE_VALUES = {
  code128: '0034043431234567890',
  code39: 'JJD000390007123456',
  itf: '00340434312345678900',
  datamatrix: 'JJD000390007654321',
} as const

const BCID: Record<keyof typeof BARCODE_VALUES, string> = {
  code128: 'code128',
  code39: 'code39',
  itf: 'interleaved2of5',
  datamatrix: 'datamatrix',
}

async function render(kind: keyof typeof BARCODE_VALUES): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: BCID[kind],
    text: BARCODE_VALUES[kind],
    scale: kind === 'datamatrix' ? 6 : 3,
    ...(kind === 'datamatrix'
      ? {}
      : { height: 18, includetext: true, textxalign: 'center' as const }),
    paddingwidth: 12,
    paddingheight: 12,
    backgroundcolor: 'FFFFFF',
  })
}

/** Etikett auf „Karton“ fotografiert: Rand, leichte Drehung, weicher Kontrast. */
async function photo(png: Buffer): Promise<Buffer> {
  const label = await sharp(png).rotate(2, { background: '#ffffff' }).linear(0.8, 30).toBuffer()
  const meta = await sharp(label).metadata()
  return sharp({
    create: { width: 1600, height: 1200, channels: 3, background: '#c9a77c' },
  })
    .composite([
      {
        input: label,
        left: Math.round((1600 - (meta.width ?? 0)) / 2),
        top: Math.round((1200 - (meta.height ?? 0)) / 2),
      },
    ])
    .blur(0.6)
    .png()
    .toBuffer()
}

/** Liest ein PNG mit @zxing/library (wie der Browser-Rückfall). */
export async function decodePng(png: Buffer): Promise<string> {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const pixels = new Int32Array(info.width * info.height)
  for (let i = 0; i < pixels.length; i++) {
    const o = i * 4
    pixels[i] = (data[o]! << 16) | (data[o + 1]! << 8) | data[o + 2]!
  }
  const source = new RGBLuminanceSource(pixels, info.width, info.height)
  const reader = new MultiFormatReader()
  const hints = new Map<DecodeHintType, unknown>([
    [
      DecodeHintType.POSSIBLE_FORMATS,
      [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.ITF, BarcodeFormat.DATA_MATRIX],
    ],
    [DecodeHintType.TRY_HARDER, true],
  ])
  return reader.decode(new BinaryBitmap(new HybridBinarizer(source)), hints).getText()
}

async function main(): Promise<void> {
  mkdirSync(BARCODE_DIR, { recursive: true })
  const out: [string, Buffer, string][] = []
  for (const kind of Object.keys(BARCODE_VALUES) as (keyof typeof BARCODE_VALUES)[]) {
    out.push([`${kind}.png`, await render(kind), BARCODE_VALUES[kind]])
  }
  out.push(['code128-photo.png', await photo(out[0]![1]), BARCODE_VALUES.code128])
  for (const [name, png, expected] of out) {
    const text = await decodePng(png)
    if (text !== expected) throw new Error(`${name}: gelesen „${text}“, erwartet „${expected}“`)
    writeFileSync(path.join(BARCODE_DIR, name), png)
    console.log(`${name}: ${expected}`)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err: unknown) => {
    console.error(err)
    process.exit(1)
  })
}
