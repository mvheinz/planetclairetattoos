import {
  APIError,
  ValidationError,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionConfig,
  type Endpoint,
} from 'payload'

import { adminField, isAdmin, isAdminRequest, publicRead } from '@/access'
import { seedField } from '@/fields'
import { revalidateContent } from '@/lib/cache/revalidate'
import { TAGS } from '@/lib/cache/tags'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { CONFORMITY_STATUSES } from '@/lib/enums'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { registerUploadReference } from '@/lib/uploads/references'

// DATENMODELL §6.13 – Konformitätserklärungen Keramik (E-15): Laborbefund privat, Erklärung öffentlich. Voraussetzung für
// `foodContact = lebensmittelecht`. Der Wechsel auf `revoked` läuft nur über den Service `revokeConformityDeclaration`
// (§6.6.6, R-044; src/lib/commerce/conformity.ts). Eine Erklärung mit verknüpften Stücken lässt sich nicht löschen.

const SLUG = 'conformity-declarations'

/** Übergangs-Kennung (`req.context.transition`) des Service `revokeConformityDeclaration`. */
export const CONFORMITY_REVOKE_TRANSITION = 'revokeConformityDeclaration'

// Dateien einer Erklärung dürfen nicht gelöscht werden, solange sie verwendet werden (§6.3, §6.4).
registerUploadReference({
  target: 'documents',
  collection: SLUG,
  path: 'declarationPdf',
  where: { status: { equals: 'active' } },
  label: 'Konformitätserklärung',
  titleField: 'name',
})
registerUploadReference({
  target: 'private-uploads',
  collection: SLUG,
  path: 'labReport',
  label: 'Konformitätserklärung',
  titleField: 'name',
})

function fail(message: string, path: string): never {
  throw new ValidationError({ collection: SLUG, errors: [{ message, path }] })
}

type V = true | string
const len =
  (min: number, max: number, required = false) =>
  (value: unknown): V => {
    const s = typeof value === 'string' ? value.trim() : ''
    if (!s) return required ? 'Pflichtfeld.' : true
    return s.length >= min && s.length <= max ? true : `Bitte ${min}–${max} Zeichen eingeben.`
  }

/** Statuswechsel nur über den Service (R-044); Laborbericht-Datum nicht in der Zukunft. */
const guardStatus: CollectionBeforeChangeHook = ({ data, operation, originalDoc, req }) => {
  const ctx = getAppContext(req)
  const status = data.status ?? originalDoc?.status ?? 'active'
  const viaService = ctx.transition === CONFORMITY_REVOKE_TRANSITION
  if (operation === 'create' && status !== 'active' && !ctx.seed) {
    fail('Eine neue Erklärung ist immer aktiv.', 'status')
  }
  if (operation === 'update' && originalDoc && status !== originalDoc.status && !viaService) {
    fail(
      'Der Status ändert sich nur über „Erklärung widerrufen“ – dabei werden betroffene Stücke mitgeprüft.',
      'status',
    )
  }
  if (originalDoc?.status === 'revoked' && status === 'active') {
    fail('Eine widerrufene Erklärung bleibt widerrufen. Bitte eine neue anlegen.', 'status')
  }
  const labReportDate = data.labReportDate ? new Date(String(data.labReportDate)) : null
  if (labReportDate && labReportDate.getTime() > requestNow(req).getTime()) {
    fail('Das Datum des Laborberichts darf nicht in der Zukunft liegen.', 'labReportDate')
  }
  return data
}

/** Löschsperre (R-044): solange ein Stück auf die Erklärung verweist. */
const guardDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const linked = await req.payload.find({
    collection: 'products',
    where: { conformityDeclarations: { in: [id] } },
    limit: 5,
    depth: 0,
    select: { adminTitle: true },
    overrideAccess: true,
    req,
  })
  if (linked.totalDocs > 0) {
    const names = linked.docs.map((d) => d.adminTitle ?? `Stück ${d.id}`).join(', ')
    throw new APIError(
      `Die Erklärung ist mit Stücken verknüpft und lässt sich nicht löschen (${names}). Bitte stattdessen widerrufen.`,
      409,
      undefined,
      true,
    )
  }
}

/** `POST /api/conformity-declarations/:id/revoke` (Verwaltung): Service `revokeConformityDeclaration`. */
const revokeEndpoint: Endpoint = {
  path: '/:id/revoke',
  method: 'post',
  handler: async (req) => {
    if (!isAdminRequest(req)) return Response.json({ error: 'Nicht erlaubt.' }, { status: 403 })
    const { revokeConformityDeclaration } = await import('@/lib/commerce/conformity')
    const { errorResponse } = await import('@/endpoints/products/actions')
    try {
      const result = await revokeConformityDeclaration(req, Number(req.routeParams?.id))
      return Response.json(result, { headers: { 'cache-control': 'private, no-store' } })
    } catch (err) {
      return errorResponse(err)
    }
  },
}

export const ConformityDeclarations: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Konformitätserklärung', plural: 'Konformitätserklärungen' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'labName', 'validFrom', 'status'],
    group: 'Shop',
    description:
      'Je Glasur: Laborbericht (privat) und Konformitätserklärung (öffentlich). Nur damit darf Keramik „lebensmittelecht“ sein.',
  },
  access: {
    read: publicRead({ status: { equals: 'active' } }),
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
    readVersions: isAdmin,
  },
  versions: { maxPerDoc: 10 },
  endpoints: [revokeEndpoint],
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Glasur',
      required: true,
      localized: true,
      validate: len(2, 80, true),
      admin: { description: 'Glasurname, wie auf der Seite angezeigt.' },
    },
    { name: 'glazeManufacturer', type: 'text', label: 'Glasur-Hersteller', maxLength: 80 },
    {
      name: 'glazeProduct',
      type: 'text',
      label: 'Produktbezeichnung/Nummer',
      maxLength: 80,
    },
    {
      name: 'leadCadmiumFreeByManufacturer',
      type: 'checkbox',
      label: 'Blei-/cadmiumfrei laut Hersteller',
      defaultValue: false,
    },
    {
      name: 'labName',
      type: 'text',
      label: 'Prüflabor',
      required: true,
      access: adminField,
      validate: len(2, 120, true),
    },
    { name: 'labReportDate', type: 'date', label: 'Datum des Laborberichts', required: true },
    {
      name: 'labReport',
      type: 'upload',
      label: 'Laborbericht (privat)',
      relationTo: 'private-uploads',
      required: true,
      access: adminField,
      filterOptions: { purpose: { equals: 'lab_report' } },
      admin: { description: 'Nicht öffentlich.' },
    },
    {
      name: 'declarationPdf',
      type: 'upload',
      label: 'Konformitätserklärung (PDF, öffentlich)',
      relationTo: 'documents',
      required: true,
      filterOptions: { kind: { equals: 'conformity_declaration' } },
    },
    { name: 'validFrom', type: 'date', label: 'Gültig ab', required: true },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'active',
      index: true,
      options: enumOptions(CONFORMITY_STATUSES, ENUM_LABELS.CONFORMITY_STATUSES),
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Widerrufen sperrt verknüpfte „lebensmittelecht“-Stücke.',
      },
    },
    {
      name: 'notes',
      type: 'textarea',
      label: 'Notizen (nur Verwaltung)',
      maxLength: 1000,
      access: adminField,
    },
    ...seedField(),
  ],
  hooks: {
    beforeChange: [guardStatus],
    beforeDelete: [guardDelete],
    afterChange: [
      ({ doc, req }) => {
        revalidateContent(TAGS.page('conformity'), { context: getAppContext(req) })
        return doc
      },
    ],
  },
}
