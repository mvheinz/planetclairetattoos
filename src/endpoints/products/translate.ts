import type { PayloadRequest } from 'payload'

import { EN_TEMPLATE_PATHS, EN_TEXT_PATHS, getPath } from '@/collections/hooks/products'
import { getTranslationAdapter } from '@/lib/translation'
import { inTransaction } from '@/lib/payload/transaction'
import { preservingReq } from '@/lib/payload/localReq'

import { productAction } from './actions'

// „Übersetzen“ (E-61, DATENMODELL §6.6.10): DE → EN über den Übersetzungs-Adapter (Mock: "[EN] " + Text) für die
// Textfelder des Stücks und die Alt-Texte seiner Bilder. Speichert mit `context.translation` → `enStatus = machine`.
// Leere EN-Felder werden immer gefüllt; vorhandene nur mit `force` bzw. maschinelle Texte (außer Vorlagen).

type Doc = Record<string, unknown>

function setPath(target: Doc, path: string, value: unknown): void {
  const keys = path.split('.')
  let o = target
  for (const k of keys.slice(0, -1)) {
    if (!o[k] || typeof o[k] !== 'object') o[k] = {}
    o = o[k] as Doc
  }
  o[keys.at(-1)!] = value
}

const text = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export async function translateProduct(
  req: PayloadRequest,
  id: number,
  { force = false }: { force?: boolean } = {},
) {
  const read = (locale: 'de' | 'en') =>
    preservingReq(req, () =>
      req.payload.findByID({
        collection: 'products',
        id,
        locale,
        fallbackLocale: false,
        depth: 0,
        overrideAccess: true,
        req,
      }),
    ) as Promise<unknown> as Promise<Doc>
  // Nacheinander: Local-API-Aufrufe mit demselben `req` setzen `req.locale` (kein Promise.all).
  const de = await read('de')
  const en = await read('en')
  const machine = (en.i18n as Doc | undefined)?.enStatus === 'machine'
  const paths: string[] = []
  for (const path of EN_TEXT_PATHS) {
    const source = text(getPath(de, path))
    if (!source) continue
    const current = text(getPath(en, path))
    const overwrite = force || (machine && !EN_TEMPLATE_PATHS.has(path))
    if (!current || overwrite) paths.push(path)
  }
  const adapter = getTranslationAdapter()
  const translated = paths.length
    ? await adapter.translate({
        texts: paths.map((p) => text(getPath(de, p))),
        source: 'de',
        target: 'en',
      })
    : []
  const patch: Doc = {}
  paths.forEach((p, i) => setPath(patch, p, translated[i]))
  // Gruppen vollständig mitschicken (nicht lokalisierte Maße bleiben unverändert).
  if (patch.dimensions)
    patch.dimensions = { ...(en.dimensions as Doc), ...(patch.dimensions as Doc) }
  if (patch.seo) patch.seo = { ...(en.seo as Doc), ...(patch.seo as Doc) }

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
    return preservingReq(req, () =>
      req.payload.update({
        collection: 'products',
        id,
        locale: 'en',
        data: patch as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, translation: true },
      }),
    )
  })
}

export const translateEndpoint = productAction('translate', (req, id, body) =>
  translateProduct(req, id, { force: body.force === true }),
)
