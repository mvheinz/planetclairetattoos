import {
  APIError,
  type Access,
  type CollectionAfterChangeHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionConfig,
} from 'payload'

import { adminWhere, isAdmin, isAdminRequest } from '@/access'
import { revalidateAll } from '@/lib/cache/revalidate'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import {
  LEGAL_SNIPPET_KEYS,
  LEGAL_TEXT_ORIGINS,
  LEGAL_TEXT_STATUSES,
  type LegalSnippetKey,
  type LegalTextStatus,
} from '@/lib/enums'
import { invalidateLegalSnippets, invalidSnippetTokens } from '@/lib/legal/snippets'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'

import { failField, rejectChanges, SHA256_HEX } from './hooks/commerce'
import { changedFields } from './hooks/immutable'
import { LEGAL_TEXT_TRANSITIONS, VALID_FROM_TOLERANCE_MS } from './LegalTexts'

// DATENMODELL §6.28 – Rechtsbausteine (R-012, R-013, RECHT ANFORDERUNGEN §6). Jede Fassung ist ein eigenes Dokument
// (keine Payload-Versionen, §1.6). Nur `draft` ist bearbeitbar und löschbar; `active`/`superseded` sind
// unveränderlich. Statuswechsel nur über den Service `activateLegalText` (src/lib/legal/activate.ts, derselbe wie
// für `legal-texts`). Partieller UNIQUE-Index „eine aktive Fassung je Schlüssel“ in `p6_legal_snippets_complaints_sql`.

const SLUG = 'legal-snippets'
const fail = (message: string, path: string): never => failField(SLUG, message, path)
const ro = { readOnly: true } as const

type Doc = Record<string, unknown>

/** Felder, die der Service an einer aktiven bzw. abgelösten Fassung noch setzen darf. */
const SERVICE_FIELDS_AFTER_ACTIVATION = new Set([
  'status',
  'supersededAt',
  'updatedAt',
  'createdAt',
  'id',
])

/** Öffentlich lesbar nur die aktive Fassung (DATENMODELL §6.28); Admin alles. Kein Seed-Flag. */
const readActiveOrAdmin: Access = ({ req }) =>
  isAdminRequest(req) ? true : { status: { equals: 'active' } }

function textOf(value: unknown): Record<string, string> {
  if (typeof value === 'string') return { de: value }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).filter(
        (e): e is [string, string] => typeof e[1] === 'string',
      ),
    )
  }
  return {}
}

const guardSnippet: CollectionBeforeChangeHook = async ({ data, originalDoc, operation, req }) => {
  const ctx = getAppContext(req)
  const original = (originalDoc ?? {}) as Doc
  const now = requestNow(req)
  const before = (original.status ?? 'draft') as LegalTextStatus

  if (operation === 'create') {
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
          where: { key: { equals: data.key } },
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
    rejectChanges(SLUG, ['key', 'version'], original, data as Doc, 'Unveränderlich.')
    const statusChanged = 'status' in data && data.status !== before
    // Der Grund-Seed ergänzt an seiner eigenen Fassung v1 nur die englische Übersetzung.
    if (!ctx.seed && (statusChanged || before !== 'draft')) {
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
          const changed = changedFields(
            Object.keys(data).filter((k) => !SERVICE_FIELDS_AFTER_ACTIVATION.has(k)),
            original,
            data as Doc,
          )
          if (changed.length > 0) fail('Die Fassung ist unveränderlich.', changed[0]!)
        }
      }
    }
  }

  // validFrom ≥ jetzt − 1 min (Ausnahme Seed, wie §6.12)
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

  // Nur Tokens aus R-012 plus die Kontext-Tokens der Arbeitsfassung des Schlüssels (§6.28).
  const key = (data.key ?? original.key) as LegalSnippetKey
  if (data.text !== undefined) {
    for (const [locale, text] of Object.entries(textOf(data.text))) {
      const bad = invalidSnippetTokens(key, text)
      if (bad.length)
        fail(`Unbekannte Platzhalter (${locale.toUpperCase()}): ${bad.join(', ')}`, 'text')
    }
  }
  for (const f of ['sha256De', 'sha256En'] as const) {
    const v = data[f]
    if (v !== undefined && v !== null && v !== '' && !SHA256_HEX.test(String(v))) {
      fail('Ungültige Prüfsumme.', f)
    }
  }
  return data
}

/** Löschen nur für Entwürfe (Seed ausgenommen). */
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

/** Neue gültige Fassung: Speicherstand neu lesen und Seiten erneuern (Bausteine stehen auf vielen Seiten). */
const afterStatusChange: CollectionAfterChangeHook = ({ doc, previousDoc, req }) => {
  if (doc.status !== previousDoc?.status && doc.status !== 'draft') {
    invalidateLegalSnippets()
    revalidateAll({ context: getAppContext(req) })
  }
  return doc
}

export const LegalSnippets: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Rechtsbaustein', plural: 'Rechtsbausteine' },
  admin: {
    group: 'Inhalte',
    useAsTitle: 'key',
    defaultColumns: ['key', 'version', 'status', 'origin', 'validFrom'],
    description:
      'Kurze Rechtstexte (Preis-, Liefer-, Kassen-, Mail- und Widerrufshinweise). Jede Fassung ist ein eigenes Dokument; veröffentlichte Fassungen lassen sich nicht mehr ändern.',
  },
  access: {
    read: readActiveOrAdmin,
    create: isAdmin,
    // Veröffentlichte, geplante und abgelöste Fassungen: nur lesen (403); `guardSnippet` bleibt die Sperre.
    update: adminWhere({ status: { equals: 'draft' } }),
    delete: adminWhere({ status: { equals: 'draft' } }),
  },
  defaultSort: 'key',
  indexes: [{ fields: ['key', 'version'], unique: true }],
  fields: [
    {
      name: 'key',
      type: 'select',
      label: 'Schlüssel',
      required: true,
      index: true,
      options: enumOptions(LEGAL_SNIPPET_KEYS, ENUM_LABELS.LEGAL_SNIPPET_KEYS),
    },
    {
      name: 'version',
      type: 'number',
      label: 'Fassung',
      min: 1,
      admin: { ...ro, position: 'sidebar' },
    },
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
      name: 'text',
      type: 'textarea',
      label: 'Text',
      localized: true,
      maxLength: 2000,
      admin: {
        description:
          'Deutsch ist verbindlich, Englisch eine Übersetzung. Erlaubt sind nur die Platzhalter aus der Liste (z. B. {{deliveryTime}}).',
      },
      validate: (value: unknown, { req }: { req: { locale?: string | null } }) =>
        req?.locale === 'en' || (typeof value === 'string' && value.trim() !== '')
          ? true
          : 'Pflichtfeld.',
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
      name: 'changeNote',
      type: 'text',
      label: 'Änderung gegenüber der Vorversion',
      maxLength: 300,
    },
    { name: 'sha256De', type: 'text', label: 'Prüfsumme Text (DE)', admin: ro },
    { name: 'sha256En', type: 'text', label: 'Prüfsumme Text (EN)', admin: ro },
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
  ],
  hooks: {
    beforeChange: [guardSnippet],
    beforeDelete: [guardDelete],
    afterChange: [afterStatusChange],
  },
}
