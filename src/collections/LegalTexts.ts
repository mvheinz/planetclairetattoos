import {
  APIError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionConfig,
} from 'payload'

import { legalTextAdminEndpoints } from '@/endpoints/legal/admin'
import { adminWhere, isAdmin, publicRead } from '@/access'
import { legalRichTextEditor, seedField } from '@/fields'
import { revalidateContent } from '@/lib/cache/revalidate'
import { TAGS } from '@/lib/cache/tags'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import {
  LEGAL_TEXT_ORIGINS,
  LEGAL_TEXT_SOURCES,
  LEGAL_TEXT_STATUSES,
  LEGAL_TEXT_TYPES,
  type LegalTextStatus,
} from '@/lib/enums'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { formatBerlin } from '@/lib/time'
import { registerUploadReference } from '@/lib/uploads/references'

import { failField, rejectChanges, SHA256_HEX } from './hooks/commerce'
import { changedFields } from './hooks/immutable'

// DATENMODELL §6.12 – Rechtstexte (E-41, R-002, R-012). Jede Fassung ist ein eigenes Dokument (keine Payload-Versionen,
// §1.6). Nur `draft` ist bearbeitbar und löschbar; `active`/`superseded` sind unveränderlich. Statuswechsel laufen nur
// über den Service `activateLegalText` (src/lib/legal/activate.ts). Der partielle UNIQUE-Index „eine aktive Fassung je
// Typ“ entsteht in `p1_constraints` (§9.3); bis dahin sichert ihn die Transaktion des Service.

const SLUG = 'legal-texts'
const fail = (message: string, path: string): never => failField(SLUG, message, path)
const ro = { readOnly: true } as const

type Doc = Record<string, unknown>

/** Übergangs-Kennung (`req.context.transition`) des Service `activateLegalText`. */
export const LEGAL_TEXT_TRANSITION = 'activateLegalText'

/** Erlaubte Statuswechsel des Service (DATENMODELL §6.12 „Übergänge“). */
export const LEGAL_TEXT_TRANSITIONS: Readonly<Record<LegalTextStatus, readonly LegalTextStatus[]>> =
  {
    draft: ['active', 'scheduled'],
    scheduled: ['active', 'draft'],
    active: ['superseded'],
    superseded: [],
  }

/** Felder, die der Service an einer aktiven bzw. abgelösten Fassung noch setzen darf (PDFs per Job, P4/P6). */
const SERVICE_FIELDS_AFTER_ACTIVATION = new Set([
  'status',
  'supersededAt',
  'pdfDe',
  'pdfEn',
  'updatedAt',
  'createdAt',
  'id',
])

/** Toleranz für `validFrom` in der Vergangenheit (R-012: „≥ jetzt − 1 min“). */
export const VALID_FROM_TOLERANCE_MS = 60_000

// PDFs einer veröffentlichten oder abgelösten Fassung sind nicht löschbar (DM-DOC-01).
for (const path of ['pdfDe', 'pdfEn']) {
  registerUploadReference({
    target: 'documents',
    collection: SLUG,
    path,
    where: { status: { in: ['active', 'superseded'] } },
    label: 'Rechtstext',
    titleField: 'versionLabel',
  })
}

export function legalTextVersionLabel(version: number, validFrom: Date): string {
  return `v${version} · gültig ab ${formatBerlin(validFrom, 'dd.MM.yyyy')}`
}

const guardLegalText: CollectionBeforeChangeHook = async ({
  data,
  originalDoc,
  operation,
  req,
}) => {
  const ctx = getAppContext(req)
  const original = (originalDoc ?? {}) as Doc
  const now = requestNow(req)
  const before = (original.status ?? 'draft') as LegalTextStatus

  if (operation === 'create') {
    // Nur der Seed legt Fassungen direkt aktiv an (Grund-Seed R-002); sonst immer als Entwurf.
    if (!ctx.seed) {
      if (data.status && data.status !== 'draft') {
        fail('Neue Fassungen beginnen als Entwurf; aktivieren über „Fassung aktivieren“.', 'status')
      }
      data.status = 'draft'
      data.activatedAt = null
      data.supersededAt = null
    }
    if (!ctx.seed || typeof data.version !== 'number') {
      const last = await preservingReq(req, () =>
        req.payload.find({
          collection: SLUG,
          where: { type: { equals: data.type } },
          sort: '-version',
          limit: 1,
          depth: 0,
          select: { version: true },
          overrideAccess: true,
          req,
        }),
      )
      data.version = ((last.docs[0]?.version as number | undefined) ?? 0) + 1
    }
  } else {
    rejectChanges(SLUG, ['type', 'version'], original, data as Doc, 'Unveränderlich.')
    const statusChanged = 'status' in data && data.status !== before
    if (statusChanged || before !== 'draft') {
      if (!ctx.transition) {
        if (before !== 'draft') {
          const changed = changedFields(
            Object.keys(data).filter((k) => !['id', 'createdAt', 'updatedAt'].includes(k)),
            original,
            data as Doc,
          )
          if (changed.length > 0) {
            fail(
              'Veröffentlichte, geplante und abgelöste Fassungen sind unveränderlich – bitte eine neue Fassung anlegen.',
              changed[0]!,
            )
          }
        } else {
          fail('Den Status ändert nur „Fassung aktivieren“.', 'status')
        }
      } else {
        const after = (data.status ?? before) as LegalTextStatus
        if (statusChanged && !LEGAL_TEXT_TRANSITIONS[before].includes(after)) {
          fail(`Statuswechsel ${before} → ${after} ist nicht erlaubt.`, 'status')
        }
        if (before === 'active' || before === 'superseded') {
          // Text-Prüfsummen darf der PDF-Job (P4.12) nur nachtragen, solange sie fehlen.
          const fillable = (k: string) =>
            (k === 'contentSha256De' || k === 'contentSha256En') && !original[k]
          const changed = changedFields(
            Object.keys(data).filter(
              (k) => !SERVICE_FIELDS_AFTER_ACTIVATION.has(k) && !fillable(k),
            ),
            original,
            data as Doc,
          )
          if (changed.length > 0) fail('Die Fassung ist unveränderlich.', changed[0]!)
        }
      }
    }
  }

  // validFrom ≥ jetzt − 1 min (Ausnahme Seed, R-012)
  const validFromChanged =
    operation === 'create' || changedFields(['validFrom'], original, data as Doc).length > 0
  const validFrom = new Date(String(data.validFrom ?? original.validFrom ?? ''))
  if (Number.isNaN(validFrom.getTime())) fail('Bitte „gültig ab“ angeben.', 'validFrom')
  if (
    validFromChanged &&
    !ctx.seed &&
    validFrom.getTime() < now.getTime() - VALID_FROM_TOLERANCE_MS
  ) {
    fail('„Gültig ab“ darf nicht in der Vergangenheit liegen.', 'validFrom')
  }

  // Abgeleitete Felder (R-002): isPlaceholder folgt origin.
  const origin = data.origin ?? original.origin ?? 'draft'
  data.isPlaceholder = origin === 'placeholder'
  const version = (data.version ?? original.version) as number
  data.versionLabel = legalTextVersionLabel(version, validFrom)
  for (const f of ['contentSha256De', 'contentSha256En'] as const) {
    const v = data[f]
    if (v !== undefined && v !== null && v !== '' && !SHA256_HEX.test(String(v))) {
      fail('Ungültige Prüfsumme.', f)
    }
  }
  return data
}

/** Löschen nur für Entwürfe (Seed ausgenommen, §13.5). */
const guardDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  if (getAppContext(req).seed) return
  const doc = await preservingReq(req, () =>
    req.payload.findByID({
      collection: SLUG,
      id,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )
  if (doc && doc.status !== 'draft') {
    throw new APIError(
      'Nur Entwürfe lassen sich löschen; veröffentlichte Fassungen werden aufbewahrt.',
      409,
      null,
      true,
    )
  }
}

export const LegalTexts: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Rechtstext', plural: 'Rechtstexte' },
  admin: {
    group: 'Recht',
    useAsTitle: 'versionLabel',
    defaultColumns: ['type', 'versionLabel', 'status', 'origin', 'validFrom'],
    description:
      'Jede Fassung ist ein eigenes Dokument. Veröffentlichte Fassungen lassen sich nicht mehr ändern – für Änderungen eine neue Fassung anlegen.',
  },
  access: {
    read: publicRead({ status: { in: ['active', 'superseded'] } }),
    create: isAdmin,
    // Veröffentlichte, geplante und abgelöste Fassungen: nur lesen (403, R-012); `guardLegalText` bleibt die Sperre.
    update: adminWhere({ status: { equals: 'draft' } }),
    // Veröffentlichte Fassungen nur lesen, kein Lösch-Knopf (KONZEPT §7.16); `guardDelete` bleibt die Sperre.
    delete: adminWhere({ status: { equals: 'draft' } }),
  },
  defaultSort: '-validFrom',
  indexes: [{ fields: ['type', 'version'], unique: true }],
  fields: [
    {
      name: 'type',
      type: 'select',
      label: 'Rechtstext',
      required: true,
      index: true,
      options: enumOptions(LEGAL_TEXT_TYPES, ENUM_LABELS.LEGAL_TEXT_TYPES),
    },
    {
      name: 'version',
      type: 'number',
      label: 'Fassung',
      min: 1,
      admin: { ...ro, position: 'sidebar' },
    },
    { name: 'versionLabel', type: 'text', label: 'Bezeichnung', admin: ro },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'draft',
      index: true,
      options: enumOptions(LEGAL_TEXT_STATUSES, ENUM_LABELS.LEGAL_TEXT_STATUSES),
      admin: { ...ro, position: 'sidebar' },
    },
    { name: 'validFrom', type: 'date', label: 'Gültig ab', required: true },
    {
      name: 'content',
      type: 'richText',
      label: 'Text',
      localized: true,
      editor: legalRichTextEditor(),
      admin: {
        description:
          'Deutsch ist verbindlich, Englisch eine unverbindliche Übersetzung. Erlaubt sind nur die Platzhalter aus der Liste (z. B. {{name}}).',
      },
      validate: (value: unknown, { req }: { req: { locale?: string | null } }) =>
        req?.locale === 'en' || (value && typeof value === 'object') ? true : 'Pflichtfeld.',
    },
    {
      name: 'origin',
      type: 'select',
      label: 'Herkunft',
      required: true,
      defaultValue: 'draft',
      options: enumOptions(LEGAL_TEXT_ORIGINS, ENUM_LABELS.LEGAL_TEXT_ORIGINS),
      admin: { position: 'sidebar', description: 'Herkunft des Textes (R-002).' },
    },
    {
      name: 'isPlaceholder',
      type: 'checkbox',
      label: 'Platzhalter',
      defaultValue: false,
      admin: {
        ...ro,
        position: 'sidebar',
        description: 'Seite zeigt oben „PLATZHALTER – nicht rechtsverbindlich“.',
      },
    },
    {
      name: 'source',
      type: 'select',
      label: 'Eingangsweg',
      required: true,
      defaultValue: 'manual',
      options: enumOptions(LEGAL_TEXT_SOURCES, ENUM_LABELS.LEGAL_TEXT_SOURCES),
      admin: { position: 'sidebar' },
    },
    {
      name: 'sourceNote',
      type: 'text',
      label: 'Quelle',
      maxLength: 200,
      admin: { description: 'z. B. „Kanzlei X, Stand 15.11.2026“' },
    },
    {
      name: 'changeNote',
      type: 'text',
      label: 'Änderung gegenüber der Vorversion',
      maxLength: 300,
    },
    {
      name: 'pdfDe',
      type: 'upload',
      label: 'PDF (Deutsch)',
      relationTo: 'documents',
      admin: ro,
    },
    {
      name: 'pdfEn',
      type: 'upload',
      label: 'PDF (Englisch)',
      relationTo: 'documents',
      admin: ro,
    },
    { name: 'contentSha256De', type: 'text', label: 'Prüfsumme Text (DE)', admin: ro },
    { name: 'contentSha256En', type: 'text', label: 'Prüfsumme Text (EN)', admin: ro },
    {
      name: 'activatedAt',
      type: 'date',
      label: 'Veröffentlicht am',
      admin: { ...ro, position: 'sidebar' },
    },
    {
      name: 'supersededAt',
      type: 'date',
      label: 'Abgelöst am',
      admin: { ...ro, position: 'sidebar' },
    },
    ...seedField(),
  ],
  endpoints: legalTextAdminEndpoints,
  hooks: {
    beforeChange: [guardLegalText],
    beforeDelete: [guardDelete],
    afterChange: [
      ({ doc, previousDoc, req }) => {
        // Rechtsseiten sofort erneuern, sobald sich die veröffentlichte Fassung ändert.
        if (doc.status !== previousDoc?.status && doc.status !== 'draft') {
          revalidateContent(TAGS.legal(String(doc.type)), { context: getAppContext(req) })
        }
        return doc
      },
    ],
  },
}
