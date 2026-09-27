import {
  APIError,
  ValidationError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionBeforeOperationHook,
  type CollectionConfig,
} from 'payload'

import { isAdmin, publicRead } from '@/access'
import { seedField } from '@/fields'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { DOCUMENT_KINDS } from '@/lib/enums'
import { MediaFileError } from '@/lib/media/pipeline'
import { uploadStorage } from '@/lib/storage'
import { PDF_MIME, checkDocumentFile, fileBuffer, sha256Hex } from '@/lib/uploads/files'
import { findUploadReferences, formatUploadReferenceMessage } from '@/lib/uploads/references'

// DATENMODELL §6.3 – öffentliche PDFs (Rechtstext-PDFs, Konformitätserklärungen, Aftercare).

const SHA256_RE = /^[a-f0-9]{64}$/

const checkIncomingFile: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if ((operation !== 'create' && operation !== 'update') || !req.file) return args
  try {
    const checked = checkDocumentFile(await fileBuffer(req.file), req.file.name)
    req.file = { ...req.file, ...checked, tempFilePath: undefined }
  } catch (e) {
    if (e instanceof MediaFileError) {
      throw new ValidationError({
        collection: 'documents',
        errors: [{ message: e.message, path: 'file' }],
      })
    }
    throw e
  }
  return args
}

/** `sha256` wird beim Upload berechnet und ist sonst nicht änderbar. */
const computeHash: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  if (req.file) data.sha256 = sha256Hex(await fileBuffer(req.file))
  else data.sha256 = originalDoc?.sha256 ?? data.sha256 ?? null
  return data
}

/** Rechtstext-PDFs nie löschen (außer Seed); Verweise (aktive Erklärungen, Rechtstexte) sperren das Löschen. */
const guardDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const doc = (await req.payload.findByID({
    collection: 'documents',
    id,
    req,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })) as { kind?: string; seed?: boolean | null } | null
  if (!doc || doc.seed) return
  if (doc.kind === 'legal_text_pdf') {
    throw new APIError(
      'PDFs von Rechtstexten werden aufbewahrt und können nicht gelöscht werden.',
      409,
      null,
      true,
    )
  }
  const refs = await findUploadReferences(req.payload, 'documents', id, req)
  if (refs.length > 0) throw new APIError(formatUploadReferenceMessage(refs), 409, null, true)
}

export const Documents: CollectionConfig = {
  slug: 'documents',
  labels: { singular: 'PDF-Dokument', plural: 'PDF-Dokumente' },
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'language', 'updatedAt'],
    group: 'Dateien',
    description:
      'Öffentlich abrufbare PDFs (z. B. Konformitätserklärungen, Pflegehinweise). Nur PDF, höchstens 20 MB.',
  },
  access: {
    read: publicRead(),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  upload: {
    ...uploadStorage('documents'),
    mimeTypes: [PDF_MIME],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Titel',
      required: true,
      localized: true,
      minLength: 3,
      maxLength: 120,
    },
    {
      name: 'kind',
      type: 'select',
      label: 'Art',
      required: true,
      defaultValue: 'other',
      index: true,
      options: enumOptions(DOCUMENT_KINDS, ENUM_LABELS.DOCUMENT_KINDS),
      admin: { position: 'sidebar' },
    },
    {
      name: 'language',
      type: 'select',
      label: 'Sprache des PDFs',
      options: [
        { label: 'Deutsch', value: 'de' },
        { label: 'Englisch', value: 'en' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'sha256',
      type: 'text',
      label: 'Prüfsumme (SHA-256)',
      admin: { readOnly: true, position: 'sidebar' },
      validate: (value: string | null | undefined) =>
        !value || SHA256_RE.test(value) ? true : 'Ungültige Prüfsumme.',
    },
    ...seedField(),
  ],
  hooks: {
    beforeOperation: [checkIncomingFile],
    beforeChange: [computeHash],
    beforeDelete: [guardDelete],
  },
}
