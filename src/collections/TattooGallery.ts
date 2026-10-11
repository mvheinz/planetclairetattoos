import {
  APIError,
  type Access,
  type CollectionAfterChangeHook,
  type CollectionAfterDeleteHook,
  type CollectionBeforeChangeHook,
  type CollectionBeforeDeleteHook,
  type CollectionConfig,
  type PayloadRequest,
  type Where,
} from 'payload'

import { adminField, isAdmin, isAdminRequest, NOT_SEED } from '@/access'
import { galleryAdminEndpoints } from '@/endpoints/tattoo'
import { seedField, sortOrderField } from '@/fields'
import { writeAudit } from '@/lib/audit'
import { revalidateContent } from '@/lib/cache/revalidate'
import { TAGS } from '@/lib/cache/tags'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { CONSENT_SCOPES, TATTOO_PHOTO_KINDS } from '@/lib/enums'
import { seedPreviewModeActive } from '@/lib/env'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import {
  GALLERY_PUBLIC_WHERE,
  galleryConsentComplete,
  galleryPubliclyVisible,
  mediaVisibleInGallery,
} from '@/lib/tattoo/gallery'
import { addBerlinDays, berlinDayStart } from '@/lib/time'
import { mediaInUse } from '@/lib/media/inUse'
import { registerMediaReference } from '@/lib/media/references'
import { L_19B_PORTFOLIO_CONSENT, retainUntil } from '@/lib/retention/policy'
import { registerUploadReference } from '@/lib/uploads/references'

import { failField, idOf, rejectChanges } from './hooks/commerce'
import { changedFields } from './hooks/immutable'

// DATENMODELL §6.16 – Galerie Fresh & Healed (E-42): Fotos mit Kund:innen erscheinen nur mit dokumentierter Einwilligung.
// Keine Versionen/Drafts (§1.6): ein Widerruf muss ohne Rest wirken (L-19, L-20). Einzige Ausnahme: Beispieldaten
// (`seed = true`) bei SEED_PREVIEW_MODE=true – nie in Produktion. Die Aktion „Einwilligung widerrufen“
// (`POST /api/tattoo-gallery/:id/withdraw-consent`, `src/lib/tattoo/admin.ts`) gibt es seit P7.8. Löschen (P18.5): erst
// nach dem Widerruf; danach gehen ungenutzte Bilder mit, der Nachweis bekommt seine Frist (L-19 b).

const SLUG = 'tattoo-gallery'
const fail = (message: string, path: string): never => failField(SLUG, message, path)

type Doc = Record<string, unknown>

for (const path of ['image', 'extraImages']) {
  registerMediaReference({
    collection: SLUG,
    path,
    where: { published: { equals: true } },
    label: 'Galerie-Foto',
  })
}
// Einwilligungsnachweise bleiben, solange der Eintrag existiert (L-19 b).
registerUploadReference({
  target: 'private-uploads',
  collection: SLUG,
  path: 'consentEvidence',
  label: 'Galerie-Foto',
})

export const CREDIT_HANDLE_RE = /^@?[a-z0-9._]{1,30}$/

/** Öffentlich: veröffentlicht und (keine Kund:in oder Einwilligung); Vorschau zeigt zusätzlich Seed-Einträge. */
export const readTattooGallery: Access = ({ req }) => {
  if (isAdminRequest(req)) return true
  if (seedPreviewModeActive()) {
    return {
      or: [
        GALLERY_PUBLIC_WHERE,
        { and: [{ published: { equals: true } }, { seed: { equals: true } }] },
      ],
    } as Where
  }
  return { and: [GALLERY_PUBLIC_WHERE, NOT_SEED] } as Where
}

const mediaIdsOf = (doc: Doc | undefined): (number | string)[] => {
  if (!doc) return []
  const ids = [idOf(doc.image), ...((doc.extraImages as unknown[] | undefined) ?? []).map(idOf)]
  return ids.filter((v): v is number | string => v !== null)
}

const guardGallery: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const ctx = getAppContext(req)
  const original = (originalDoc ?? {}) as Doc
  const merged = { ...original, ...data } as Doc

  if (!ctx.transition) {
    rejectChanges(
      SLUG,
      ['consentWithdrawnAt'],
      original,
      data as Doc,
      'Wird nur über „Einwilligung widerrufen“ gesetzt.',
    )
  }

  if (merged.kind === 'healed') {
    const m = merged.healedDurationMonths
    if (typeof m !== 'number' || !Number.isInteger(m) || m < 1 || m > 600) {
      fail('Bei „healed“: Monate seit dem Stechen (1–600).', 'healedDurationMonths')
    }
  }

  if (merged.consentGiven === true) {
    const at = merged.consentDate ? new Date(String(merged.consentDate)) : null
    if (!at || Number.isNaN(at.getTime()))
      fail('Bitte das Datum der Einwilligung angeben.', 'consentDate')
    const endOfToday = berlinDayStart(addBerlinDays(requestNow(req), 1))
    const dateChanged =
      !original.id || changedFields(['consentDate'], original, data as Doc).length > 0
    if (dateChanged && at!.getTime() >= endOfToday.getTime()) {
      fail('Das Datum der Einwilligung darf nicht in der Zukunft liegen.', 'consentDate')
    }
    const note = typeof merged.consentNote === 'string' ? merged.consentNote.trim() : ''
    if (note.length < 5 || note.length > 300) {
      fail(
        'Bitte kurz notieren, wie und wo die Einwilligung erteilt wurde (5–300 Zeichen).',
        'consentNote',
      )
    }
  }

  if (merged.published === true && !galleryConsentComplete(merged)) {
    // Beispielbestand (SEED-SPEC §1.6): Anlegen im Seed-Kontext erlaubt; sichtbar nur im Vorschau-Modus (Lesezugriff)
    const previewSeed = merged.seed === true && (ctx.seed || seedPreviewModeActive())
    if (!previewSeed) {
      fail(
        'Ohne Einwilligung der Kundin/des Kunden nicht veröffentlichen (Häkchen, Datum und Notiz).',
        'published',
      )
    }
  }

  const handle = merged.creditHandle
  if (typeof handle === 'string' && handle !== '' && !CREDIT_HANDLE_RE.test(handle)) {
    fail(
      'Instagram-Name: nur a–z, 0–9, Punkt und Unterstrich (höchstens 30 Zeichen).',
      'creditHandle',
    )
  }

  const evidence = idOf(merged.consentEvidence)
  if (evidence !== null && (operation(data, original, 'consentEvidence') || !original.id)) {
    const upload = await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'private-uploads',
        id: evidence,
        depth: 0,
        select: { purpose: true },
        overrideAccess: true,
        disableErrors: true,
        req,
      }),
    )
    if (upload?.purpose !== 'consent_evidence') {
      fail('Als Nachweis nur Dateien mit Zweck „Einwilligungsnachweis“.', 'consentEvidence')
    }
  }
  return data
}

/** `true`, wenn `field` in `data` steht und sich ändert. */
function operation(data: Doc, original: Doc, field: string): boolean {
  return field in data && idOf(data[field]) !== idOf(original[field])
}

/** `media.restricted` eines Bildes = nicht in einem öffentlich sichtbaren Eintrag (§6.16). */
async function syncRestricted(req: PayloadRequest, id: number | string): Promise<void> {
  const restricted = !(await mediaVisibleInGallery(req, id))
  await preservingReq(req, () =>
    req.payload.update({
      collection: 'media',
      id,
      data: { restricted },
      depth: 0,
      overrideAccess: true,
      req,
      context: { ...req.context, gallerySync: true },
    }),
  )
}

/** `media.restricted` der verknüpften Bilder = nicht in einem öffentlich sichtbaren Eintrag (§6.16). */
const syncMedia: CollectionAfterChangeHook = async ({ doc, previousDoc, req, operation: op }) => {
  const ctx = getAppContext(req)
  const ids = new Set([...mediaIdsOf(doc as Doc), ...mediaIdsOf(previousDoc as Doc | undefined)])
  for (const id of ids) await syncRestricted(req, id)
  const nowVisible = galleryPubliclyVisible(doc as Doc)
  const wasVisible = op === 'update' && galleryPubliclyVisible((previousDoc ?? {}) as Doc)
  if (nowVisible && !wasVisible && !ctx.seed) {
    await writeAudit(req, {
      action: 'gallery_published',
      entityCollection: SLUG,
      entityId: doc.id,
      summary: `Galerie-Foto ${doc.id} veröffentlicht`,
    })
  }
  revalidateContent(TAGS.tattooGallery, { context: ctx })
  return doc
}

/** Meldung beim Löschen eines Fotos mit wirksamer Einwilligung (R-172, L-19 b, L-20). */
export const GALLERY_DELETE_CONSENT_MESSAGE =
  'Dieses Foto zeigt eine Kundin oder einen Kunden mit Einwilligung. Bitte zuerst unter Tattoo → Galerie ' +
  '„Einwilligung widerrufen“ nutzen – dann wird das Foto sicher entfernt.'

/**
 * `beforeDelete` (R-172, L-19 b, L-20): Fotos mit Kund:in und wirksamer Einwilligung erst nach „Einwilligung
 * widerrufen“ löschen – nur dieser Weg sperrt die Bilder sofort, schreibt das Audit und schickt auf Wunsch die
 * Bestätigung (M16). Beispieldaten und der Seed-Kontext („Beispieldaten entfernen“) sind ausgenommen.
 */
const guardGalleryDelete: CollectionBeforeDeleteHook = async ({ id, req }) => {
  if (getAppContext(req).seed) return
  const doc = (await preservingReq(req, () =>
    req.payload.findByID({
      collection: SLUG,
      id,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )) as Doc | null
  if (!doc || doc.seed === true) return
  if (doc.showsCustomer !== false && doc.consentGiven === true) {
    throw new APIError(GALLERY_DELETE_CONSENT_MESSAGE, 409, null, true)
  }
}

/**
 * Frist des Einwilligungsnachweises nach dem Löschen des Eintrags (L-19 b): 3 Jahre ab Widerruf bzw. ab jetzt (Ende der
 * Veröffentlichung); eine kürzere Frist bleibt. Nutzt ein anderer Eintrag denselben Nachweis, bleibt er unberührt.
 */
async function scheduleEvidenceDeletion(
  req: PayloadRequest,
  evidence: number | string,
  doc: Doc,
): Promise<void> {
  const others = await preservingReq(req, () =>
    req.payload.count({
      collection: SLUG,
      where: { consentEvidence: { equals: evidence } },
      overrideAccess: true,
      req,
    }),
  )
  if (others.totalDocs > 0) return
  const upload = await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'private-uploads',
      id: evidence,
      depth: 0,
      select: { deleteAfter: true },
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )
  if (!upload) return
  const start = doc.consentWithdrawnAt ? new Date(String(doc.consentWithdrawnAt)) : requestNow(req)
  const due = retainUntil(L_19B_PORTFOLIO_CONSENT, start)
  const current = upload.deleteAfter ? new Date(upload.deleteAfter) : null
  if (current && current.getTime() <= due.getTime()) return
  await preservingReq(req, () =>
    req.payload.update({
      collection: 'private-uploads',
      id: evidence,
      data: { deleteAfter: due.toISOString() } as never,
      depth: 0,
      overrideAccess: true,
      req,
      context: { ...req.context, system: true },
    }),
  )
}

/**
 * `afterDelete` (R-172, L-19 b, L-20): Bilder ohne weiteren Verweis gehen mit dem Eintrag (samt Dateien und Varianten),
 * alle übrigen bekommen `restricted` neu wie in `syncMedia` – ein gelöschter Eintrag hält kein Bild öffentlich. Der
 * Nachweis bekommt seine Löschfrist. Im Seed-Kontext räumt „Beispieldaten entfernen“ Bilder und Dateien selbst auf.
 */
const releaseDeletedEntry: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const ctx = getAppContext(req)
  if (ctx.seed) return doc
  for (const id of new Set(mediaIdsOf(doc as Doc))) {
    if (await mediaInUse(req, Number(id))) {
      await syncRestricted(req, id)
      continue
    }
    await preservingReq(req, () =>
      req.payload.delete({
        collection: 'media',
        id,
        overrideAccess: true,
        req,
        context: { ...req.context, gallerySync: true },
      }),
    )
  }
  const evidence = idOf((doc as Doc).consentEvidence)
  if (evidence !== null) await scheduleEvidenceDeletion(req, evidence, doc as Doc)
  revalidateContent(TAGS.tattooGallery, { context: ctx, immediate: true })
  revalidateContent(TAGS.home, { context: ctx, immediate: true })
  return doc
}

export const TattooGallery: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Galerie-Foto', plural: 'Galerie (Fresh & Healed)' },
  admin: {
    group: 'Tattoo',
    useAsTitle: 'caption',
    defaultColumns: ['image', 'kind', 'showsCustomer', 'consentGiven', 'published'],
    description:
      'Fotos gestochener Tattoos. Fotos mit Kund:innen erscheinen nur mit dokumentierter Einwilligung.',
  },
  access: {
    read: readTattooGallery,
    create: isAdmin,
    update: isAdmin,
    delete: isAdmin,
  },
  defaultSort: 'sortOrder',
  endpoints: galleryAdminEndpoints,
  fields: [
    { name: 'image', type: 'upload', label: 'Foto', relationTo: 'media', required: true },
    {
      name: 'extraImages',
      type: 'upload',
      label: 'Weitere Fotos',
      relationTo: 'media',
      hasMany: true,
      maxRows: 4,
    },
    {
      name: 'kind',
      type: 'select',
      label: 'Art',
      required: true,
      defaultValue: 'fresh',
      options: enumOptions(TATTOO_PHOTO_KINDS, ENUM_LABELS.TATTOO_PHOTO_KINDS),
    },
    {
      name: 'healedDurationMonths',
      type: 'number',
      label: 'Abgeheilt seit (Monate)',
      min: 1,
      max: 600,
      admin: {
        condition: (data) => data?.kind === 'healed',
        description: 'z. B. 42 → „3,5 years healed“',
      },
    },
    {
      name: 'healedLabel',
      type: 'text',
      label: 'Eigene Angabe „healed“',
      localized: true,
      maxLength: 40,
      admin: { condition: (data) => data?.kind === 'healed' },
    },
    { name: 'caption', type: 'text', label: 'Bildunterschrift', localized: true, maxLength: 200 },
    {
      name: 'placement',
      type: 'text',
      label: 'Körperstelle',
      localized: true,
      maxLength: 60,
      admin: { description: 'z. B. „Unterarm“' },
    },
    { name: 'flash', type: 'relationship', label: 'Flash-Motiv', relationTo: 'flash' },
    {
      name: 'showsCustomer',
      type: 'checkbox',
      label: 'Zeigt eine Kundin / einen Kunden',
      defaultValue: true,
      admin: { description: 'Aus bei eigenen Zeichnungen oder Platzhaltern.' },
    },
    {
      type: 'collapsible',
      label: 'Einwilligung',
      fields: [
        {
          name: 'consentGiven',
          type: 'checkbox',
          label: 'Einwilligung zur Veröffentlichung auf der Website liegt vor',
          defaultValue: false,
        },
        {
          name: 'consentScope',
          access: adminField,
          type: 'select',
          label: 'Umfang',
          defaultValue: 'tattoo_only',
          options: enumOptions(CONSENT_SCOPES, ENUM_LABELS.CONSENT_SCOPES),
        },
        { name: 'consentDate', access: adminField, type: 'date', label: 'Datum der Einwilligung' },
        {
          name: 'consentNote',
          access: adminField,
          type: 'text',
          label: 'Wie/wo erteilt',
          maxLength: 300,
          admin: { description: 'z. B. „per Mail am 02.10.2026“' },
        },
        {
          name: 'consentEvidence',
          access: adminField,
          type: 'upload',
          label: 'Nachweis (Screenshot/Formular)',
          relationTo: 'private-uploads',
          filterOptions: { purpose: { equals: 'consent_evidence' } },
        },
        {
          name: 'consentWithdrawnAt',
          access: adminField,
          type: 'date',
          label: 'Einwilligung widerrufen am',
          admin: { readOnly: true },
        },
        {
          name: 'creditHandleAllowed',
          access: adminField,
          type: 'checkbox',
          label: 'Kund:in erlaubt die Nennung ihres Instagram-Namens',
          defaultValue: false,
          admin: {
            description: 'Eine Instagram-Freigabe deckt die Website nicht automatisch ab.',
          },
        },
        {
          name: 'creditHandle',
          type: 'text',
          label: 'Instagram-Name',
          maxLength: 31,
          admin: { condition: (data) => data?.creditHandleAllowed === true },
          hooks: {
            // Öffentlich nur mit Freigabe und Einwilligung (R-172).
            afterRead: [
              ({ value, siblingData, req }) =>
                isAdminRequest(req) ||
                (siblingData?.creditHandleAllowed === true && siblingData?.consentGiven === true)
                  ? value
                  : null,
            ],
          },
        },
      ],
    },
    {
      name: 'published',
      type: 'checkbox',
      label: 'Online',
      defaultValue: false,
      index: true,
      admin: { position: 'sidebar' },
    },
    {
      name: 'featured',
      type: 'checkbox',
      label: 'Hervorheben',
      defaultValue: false,
      admin: { position: 'sidebar' },
    },
    { ...sortOrderField(), required: true, admin: { position: 'sidebar' } },
    ...seedField(),
  ],
  hooks: {
    beforeChange: [guardGallery],
    afterChange: [syncMedia],
    beforeDelete: [guardGalleryDelete],
    afterDelete: [releaseDeletedEntry],
  },
}
