import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

import { cocoSymbolSvg } from '@/og/assets'

import type { MailAttachment } from '../types'

// Eingebettete Bilder der Mails (KONZEPT §6.1): nur per CID, nie als externe URL. Coco-Vignette aus der Sprite-Quelle
// (`src/art/coco/coco-sprite.svg`, Pose „rennen“) als PNG; der EPC-QR-Code kommt aus der Vorlage (M02/M03).

export const COCO_CID = 'coco@planetclaire'

let cocoPromise: Promise<MailAttachment | null> | undefined

/** Coco-Vignette (192 × 144 PNG, angezeigt 96 × 72); `null`, wenn die Sprite-Quelle fehlt. */
export function cocoVignette(): Promise<MailAttachment | null> {
  cocoPromise ??= (async () => {
    const sprite = await readFile(
      path.join(process.cwd(), 'src', 'art', 'coco', 'coco-sprite.svg'),
      'utf8',
    ).catch(() => '')
    const svg = cocoSymbolSvg(sprite, 'coco-rennen-a')
    if (!svg) return null
    const content = await sharp(Buffer.from(svg, 'utf8'))
      .resize(192, 144, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer()
    return { filename: 'coco.png', content, contentType: 'image/png', cid: COCO_CID }
  })()
  cocoPromise.catch(() => (cocoPromise = undefined))
  return cocoPromise
}
