import { readFile, unlink } from 'node:fs/promises'
import path from 'node:path'

import {
  APIError,
  ValidationError,
  type Access,
  type CollectionBeforeChangeHook,
  type CollectionBeforeOperationHook,
  type CollectionConfig,
  type ImageSize,
  type PayloadRequest,
  type TextFieldSingleValidation,
  type Where,
} from 'payload'

import { isAdmin, isAdminRequest, NOT_SEED } from '@/access'
import { adminText } from '@/admin/translations'
import { mediaAdminEndpoints } from '@/endpoints/tattoo'
import { seedField } from '@/fields'
import { revalidateContent } from '@/lib/cache/revalidate'
import { TAGS } from '@/lib/cache/tags'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { MEDIA_SOURCES, SHOWS_PERSON } from '@/lib/enums'
import { getEnv, seedPreviewModeActive } from '@/lib/env'
import { findMediaReferences, formatReferenceMessage } from '@/lib/media/references'
import {
  MEDIA_MAX_EDGE,
  MEDIA_MIME_TYPES,
  MediaFileError,
  computePlaceholder,
  imageSizeFilename,
  isCompleteSize,
  normalizeUpload,
} from '@/lib/media/pipeline'
import { DERIVATIVES_VERSION } from '@/lib/media/version'
import { getAppContext } from '@/lib/payload/context'
import { uploadStaticDir, uploadStorage } from '@/lib/storage'
import { mediaVisibleInGallery } from '@/lib/tattoo/gallery'

// DATENMODELL §6.2 – öffentliche Bilder mit Bildpipeline (DESIGN §12.2 Schritte 1–3, 7, 8).

/** Fotos von Jutta nur mit ihrer Freigabe (R-181, DATENMODELL §6.2; P8.20). */
const OWNER_APPROVED: Where = {
  or: [{ showsPerson: { not_equals: 'jutta' } }, { ownerApproved: { equals: true } }],
}

/**
 * Öffentlich lesbar (KONZEPT §9.7, `isMediaPubliclyVisible`): nicht gesperrte Bilder ohne Seed; im Vorschau-Modus
 * zusätzlich alle Seed-Bilder (auch gesperrte Seed-Tattoofotos, R-182). Fotos von Jutta (`showsPerson = jutta`) nur mit
 * Häkchen `ownerApproved` (R-181, P8.20) – auch im Vorschau-Modus. Dateiabrufe (`isReadingStaticFile`) lässt die
 * Regel durch – die Sichtbarkeit prüft der Datei-Handler (`fileResponseHandler`) und antwortet mit 404 statt 403, damit
 * eine erratene URL nichts verrät (P7.5).
 */
export const readMedia: Access = ({ req, isReadingStaticFile }) => {
  if (isAdminRequest(req)) return true
  if (isReadingStaticFile) return true
  if (seedPreviewModeActive()) {
    return {
      and: [
        OWNER_APPROVED,
        { or: [{ restricted: { not_equals: true } }, { seed: { equals: true } }] },
      ],
    } as Where
  }
  return { and: [{ restricted: { not_equals: true } }, OWNER_APPROVED, NOT_SEED] } as Where
}

export const DOWNSCALE_UPLOAD_COMPONENT = '/admin/components/DownscaleUpload#DownscaleUpload'
export const ENHANCE_PREVIEW_COMPONENT = '/admin/components/EnhancePreview#EnhancePreview'

/**
 * Bildgrößen – verbindliche Liste (DATENMODELL §6.2). Unvollständige Größen entfallen (`isCompleteSize`). Jede Größe hat
 * einen eigenen Dateinamen (`imageSizeFilename`), auch wenn zwei Größen dasselbe Ausgabemaß haben.
 */
export const MEDIA_IMAGE_SIZES: ImageSize[] = (
  [
    {
      name: 'thumb',
      width: 400,
      height: 500,
      fit: 'cover',
      withoutEnlargement: true,
      formatOptions: { format: 'webp', options: { quality: 80 } },
    },
    {
      name: 'card',
      width: 800,
      height: 1000,
      fit: 'cover',
      withoutEnlargement: true,
      formatOptions: { format: 'webp', options: { quality: 80 } },
    },
    {
      name: 'detail',
      width: 1600,
      withoutEnlargement: true,
      formatOptions: { format: 'webp', options: { quality: 82 } },
    },
    {
      name: 'zoom',
      width: 2560,
      withoutEnlargement: true,
      formatOptions: { format: 'webp', options: { quality: 85 } },
    },
    {
      name: 'og',
      width: 1200,
      height: 630,
      fit: 'cover',
      withoutEnlargement: true,
      formatOptions: { format: 'jpeg', options: { quality: 85 } },
    },
  ] satisfies ImageSize[]
).map((size) => ({ ...size, generateImageName: imageSizeFilename }))

const ALT_MIN = 5
const ALT_MAX = 250

/** Alt-Text: in DE Pflicht (5–250, ≠ Dateiname, kein „Bild von“ am Anfang); EN optional (Prüfung bei Veröffentlichung). */
export const validateAlt: TextFieldSingleValidation = (value, { req, data }) => {
  const text = typeof value === 'string' ? value.trim() : ''
  const locale = req?.locale ?? 'de'
  if (!text) return locale === 'en' ? true : adminText('mediaAltRequired')
  if (text.length < ALT_MIN || text.length > ALT_MAX)
    return adminText('lengthBetween', { min: ALT_MIN, max: ALT_MAX })
  if (/^(bild|foto|image|photo|picture)\s+(von|of)\b/i.test(text))
    return adminText('mediaAltPrefix')
  const rawFilename = (data as { filename?: unknown } | undefined)?.filename
  const filename = typeof rawFilename === 'string' ? rawFilename : ''
  const base = (s: string) =>
    s
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[-_\s]+/g, ' ')
      .trim()
      .toLowerCase()
  if (filename && base(text) === base(filename)) return adminText('mediaAltFilename')
  return true
}

async function fileBuffer(file: { data?: Buffer; tempFilePath?: string }): Promise<Buffer> {
  if (file.data && file.data.length > 0) return file.data
  if (file.tempFilePath) return readFile(file.tempFilePath)
  return Buffer.alloc(0)
}

/** Schritt 2: Orientierung anwenden, sRGB, Metadaten verwerfen; nur JPEG/PNG/WebP; Dateiname mit Inhalts-Hash. */
const normalizeIncomingFile: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if ((operation !== 'create' && operation !== 'update') || !req.file) return args
  const file = req.file
  const data = (args as { data?: { enhance?: unknown; source?: unknown } }).data
  try {
    const normalized = await normalizeUpload(await fileBuffer(file), file.name, file.mimetype, {
      enhance: data?.enhance === 'off' ? 'off' : 'auto',
      // Zeichnungen und Platzhalter: halber Weißabgleich (DESIGN §12.2 Schritt 4)
      category:
        data?.source === 'placeholder' || data?.source === 'generated' ? 'drawing' : 'photo',
    })
    req.file = { ...file, ...normalized, tempFilePath: undefined }
  } catch (e) {
    if (e instanceof MediaFileError) {
      throw new ValidationError({
        collection: 'media',
        errors: [{ message: e.message, path: 'file' }],
      })
    }
    throw e
  }
  return args
}

type SizesData = Record<string, Record<string, unknown> | null | undefined>
const DROPPED_SIZES = Symbol.for('planetclaire.media.droppedSizes')
type ReqWithDropped = PayloadRequest & { [DROPPED_SIZES]?: string[] }

/**
 * Größen, die das Zielmaß nicht erreichen (Original zu klein), entfallen – nie hochskaliert, nie aufgefüllt
 * (DESIGN §12.2 Schritte 3, 7). Dateien dazu löscht `afterChange` beim Treiber `local`.
 */
const dropIncompleteSizes: CollectionBeforeChangeHook = ({ data, req }) => {
  const sizes = data.sizes as SizesData | undefined
  if (!sizes) return data
  const kept = new Set<string>()
  if (typeof data.filename === 'string') kept.add(data.filename)
  const dropped: string[] = []
  for (const spec of MEDIA_IMAGE_SIZES) {
    const size = sizes[spec.name]
    if (!size?.filename) continue
    if (isCompleteSize(spec, size)) kept.add(String(size.filename))
    else {
      dropped.push(String(size.filename))
      sizes[spec.name] = {
        filename: null,
        filesize: null,
        height: null,
        mimeType: null,
        url: null,
        width: null,
      }
    }
  }
  const r = req as ReqWithDropped
  r[DROPPED_SIZES] = [...(r[DROPPED_SIZES] ?? []), ...dropped.filter((f) => !kept.has(f))]
  if (req.payloadUploadSizes) {
    for (const spec of MEDIA_IMAGE_SIZES) {
      if (!sizes[spec.name]?.filename) delete req.payloadUploadSizes[spec.name]
    }
  }
  return data
}

/** Schritt 8 und Sichtbarkeit: LQIP/Dominanzfarbe bei neuer Datei; Kund:innen-Bilder sind gesperrt. */
const computeDerived: CollectionBeforeChangeHook = async ({ data, req, originalDoc }) => {
  if (req.file) {
    const buffer = await fileBuffer(req.file)
    if (buffer.length > 0) Object.assign(data, await computePlaceholder(buffer))
    data.derivativesVersion = DERIVATIVES_VERSION
  }
  // `restricted` steuert die Tattoo-Galerie (§6.16, Hook `tattoo-gallery.afterChange`). Sonst gilt: Kund:innen-Haut
  // ist gesperrt, solange kein öffentlich sichtbarer Galerie-Eintrag mit Einwilligung darauf verweist.
  if (getAppContext(req).gallerySync) return data
  if (data.showsPerson !== undefined) {
    data.restricted =
      data.showsPerson === 'customer' &&
      !(originalDoc?.id !== undefined && (await mediaVisibleInGallery(req, originalDoc.id)))
  }
  return data
}

export const Media: CollectionConfig = {
  slug: 'media',
  labels: { singular: 'Bild', plural: 'Bilder' },
  endpoints: mediaAdminEndpoints,
  admin: {
    useAsTitle: 'alt',
    defaultColumns: ['filename', 'alt', 'showsPerson', 'restricted', 'updatedAt'],
    description:
      'Bilder für Shop, Seiten und Galerie. Große Fotos werden vor dem Hochladen verkleinert; Standortdaten werden entfernt.',
  },
  access: {
    // Öffentlich nur sichtbare Bilder (+ Seed-Filter); Dateiabrufe prüft der Datei-Handler (404).
    read: readMedia,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  upload: {
    ...uploadStorage('media'),
    mimeTypes: [...MEDIA_MIME_TYPES],
    resizeOptions: {
      width: MEDIA_MAX_EDGE,
      height: MEDIA_MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    },
    formatOptions: { format: 'webp', options: { quality: 90 } },
    imageSizes: MEDIA_IMAGE_SIZES,
    adminThumbnail: 'thumb',
    focalPoint: true,
    crop: true,
  },
  fields: [
    {
      name: 'downscaleUpload',
      type: 'ui',
      admin: { components: { Field: DOWNSCALE_UPLOAD_COMPONENT } },
    },
    {
      name: 'alt',
      type: 'text',
      label: 'Alt-Text',
      localized: true,
      maxLength: ALT_MAX,
      validate: validateAlt,
      admin: { description: 'Was ist zu sehen? Objekt, Motiv, Farbe.' },
    },
    { name: 'caption', type: 'text', label: 'Bildunterschrift', localized: true, maxLength: 200 },
    {
      name: 'showsPerson',
      type: 'select',
      label: 'Zeigt eine Person',
      required: true,
      defaultValue: 'none',
      options: enumOptions(SHOWS_PERSON, ENUM_LABELS.SHOWS_PERSON),
      admin: {
        position: 'sidebar',
        description:
          '„Kund:in“ = Haut oder Tattoo einer Kundin/eines Kunden (nie öffentlich ohne Einwilligung).',
      },
    },
    {
      name: 'ownerApproved',
      type: 'checkbox',
      label: 'Jutta hat dieses Foto von sich freigegeben',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Nur ankreuzen, wenn Jutta dieses Foto freigegeben hat.',
        condition: (data) => data?.showsPerson === 'jutta',
      },
    },
    {
      name: 'restricted',
      type: 'checkbox',
      label: 'Gesperrt (nicht öffentlich)',
      defaultValue: false,
      index: true,
      admin: { position: 'sidebar', readOnly: true },
    },
    {
      name: 'source',
      type: 'select',
      label: 'Herkunft',
      required: true,
      defaultValue: 'upload',
      index: true,
      options: enumOptions(MEDIA_SOURCES, ENUM_LABELS.MEDIA_SOURCES),
      admin: { position: 'sidebar' },
    },
    { name: 'sourceRef', type: 'text', label: 'Quelle (Kürzel)', maxLength: 80 },
    {
      name: 'enhance',
      type: 'select',
      label: 'Bildlook angleichen',
      required: true,
      defaultValue: 'auto',
      options: [
        { label: 'automatisch', value: 'auto' },
        { label: 'aus', value: 'off' },
      ],
      admin: {
        position: 'sidebar',
        description:
          'Gleicht Weißabgleich und Helligkeit sanft an. „Aus“ lässt das Foto, wie es ist (gilt beim nächsten Hochladen).',
      },
    },
    {
      name: 'enhancePreview',
      type: 'ui',
      admin: { position: 'sidebar', components: { Field: ENHANCE_PREVIEW_COMPONENT } },
    },
    {
      name: 'derivativesVersion',
      type: 'number',
      label: 'Version der Bildgrößen',
      defaultValue: 1,
      min: 1,
      admin: { readOnly: true, position: 'sidebar' },
      validate: (value: number | null | undefined) =>
        value === null || value === undefined || (Number.isInteger(value) && value >= 1)
          ? true
          : adminText('integerMin1'),
    },
    {
      name: 'placeholderDataUrl',
      type: 'text',
      label: 'Vorschau (LQIP)',
      maxLength: 2800,
      admin: { readOnly: true, hidden: true },
    },
    {
      name: 'dominantColor',
      type: 'text',
      label: 'Hauptfarbe',
      admin: { readOnly: true, position: 'sidebar' },
      validate: (value: string | null | undefined) =>
        !value || /^#[0-9a-f]{6}$/.test(value) ? true : adminText('mediaColorInvalid'),
    },
    ...seedField(),
  ],
  hooks: {
    beforeOperation: [normalizeIncomingFile],
    beforeChange: [dropIncompleteSizes, computeDerived],
    afterChange: [
      async ({ doc, req, context }) => {
        const r = req as ReqWithDropped
        const dropped = r[DROPPED_SIZES]
        r[DROPPED_SIZES] = undefined
        if (dropped?.length && getEnv().STORAGE_DRIVER === 'local') {
          const dir = uploadStaticDir('media')
          await Promise.all(
            dropped.map((f) => unlink(path.join(dir, path.basename(f))).catch(() => undefined)),
          )
        }
        revalidateContent(TAGS.media(doc.id), { context: getAppContext({ context }) })
        return doc
      },
    ],
    beforeDelete: [
      async ({ id, req }) => {
        const refs = await findMediaReferences(req.payload, id, req)
        if (refs.length > 0) throw new APIError(formatReferenceMessage(refs), 409, null, true)
      },
    ],
  },
}
