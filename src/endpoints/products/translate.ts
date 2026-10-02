import { APIError, type PayloadRequest } from 'payload'

import { EN_TEMPLATE_PATHS, EN_TEXT_PATHS } from '@/collections/hooks/products'
import { getTranslationAdapter, translationAvailability } from '@/lib/translation'
import { prepareDocumentTranslation, writeTranslation } from '@/lib/translation/translateDocument'
import { inTransaction } from '@/lib/payload/transaction'
import { preservingReq } from '@/lib/payload/localReq'

import { productAction } from './actions'

// „Übersetzen“ (E-61, DATENMODELL §6.6.10): DE → EN über den Übersetzungs-Adapter (Mock: "[EN] " + Text) für die
// Textfelder des Stücks und die Alt-Texte seiner Bilder. Speichert mit `context.translation` → `enStatus = machine`.
// Leere EN-Felder werden immer gefüllt; vorhandene nur mit `force` bzw. maschinelle Texte (außer Vorlagen). Allgemeiner
// Teil: `translateDocumentFields` (src/lib/translation/translateDocument.ts). In Produktion mit dem Mock → 409
// „Übersetzen ist noch nicht eingerichtet“ (ARCHITEKTUR §3.6).

type Doc = Record<string, unknown>

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export async function translateProduct(
  req: PayloadRequest,
  id: number,
  { force = false }: { force?: boolean } = {},
) {
  const availability = translationAvailability()
  if (!availability.enabled) throw new APIError(availability.reason!, 409, undefined, true)
  const adapter = getTranslationAdapter()
  // Maschinelle EN-Texte (enStatus = machine) dürfen ohne `force` neu übersetzt werden, Vorlagen-Texte nicht;
  // von dir geprüfte (`reviewed`) nur mit `force` (DATENMODELL §6.6.10).
  const { patch, de } = await prepareDocumentTranslation(req, 'products', id, EN_TEXT_PATHS, {
    force,
    adapter,
    mayOverwrite: (path, en) =>
      (en.i18n as Doc | undefined)?.enStatus === 'machine' && !EN_TEMPLATE_PATHS.has(path),
  })

  // Alt-Texte der Bilder
  const imageIds = (Array.isArray(de.images) ? de.images : []).map((m) =>
    typeof m === 'object' && m ? (m as Doc).id : m,
  ) as number[]
  const alts: { id: number; text: string }[] = []
  for (const mediaId of imageIds) {
    const readMedia = (locale: 'de' | 'en') =>
      preservingReq(req, () =>
        req.payload.findByID({
          collection: 'media',
          id: mediaId,
          locale,
          fallbackLocale: false,
          depth: 0,
          overrideAccess: true,
          req,
        }),
      )
    const mDe = await readMedia('de')
    const mEn = await readMedia('en')
    const source = text(mDe?.alt)
    if (source && (force || !text(mEn?.alt))) alts.push({ id: mediaId, text: source })
  }
  const altTexts = alts.length
    ? await adapter.translate({ texts: alts.map((a) => a.text), source: 'de', target: 'en' })
    : []

  return inTransaction(req, async () => {
    for (const [i, a] of alts.entries()) {
      await preservingReq(req, () =>
        req.payload.update({
          collection: 'media',
          id: a.id,
          locale: 'en',
          data: { alt: altTexts[i] } as never,
          depth: 0,
          overrideAccess: true,
          req,
          context: { ...req.context, translation: true },
        }),
      )
    }
    return writeTranslation(req, 'products', id, patch)
  })
}

export const translateEndpoint = productAction('translate', (req, id, body) =>
  translateProduct(req, id, { force: body.force === true }),
)
