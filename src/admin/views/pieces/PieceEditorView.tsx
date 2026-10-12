import { notFound } from 'next/navigation'
import type { Payload } from 'payload'
import React from 'react'

import { computeNextItemNumber } from '@/endpoints/products/nextItemNumber'
import { CARE_TEMPLATE_TEXTS } from '@/globals/settingsDefaults'
import type { ProductCategory, ProductStatus } from '@/lib/enums'
import { getEnv } from '@/lib/env'
import { CARE_CATEGORIES } from '@/lib/products/categoryRules'
import { readinessOfProduct } from '@/lib/products/publishReadiness'
import { formatBerlin } from '@/lib/time'
import { translationAvailability } from '@/lib/translation'

import type { PiecePhoto } from '../../components/PhotoPicker/photoList'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { PieceEditor } from './PieceEditor'
import { emptyPieceForm, formFromDoc, type CategoryTemplateTexts } from './pieceForm'
import { attentionOf } from './piecesQuery'

// Ansichten „Neues Stück“ (`/neues-stueck`) und „Stück bearbeiten“ (`/stuecke/:id`) – PLAN P5.5/P5.6, KONZEPT §7.4.
// Lädt Stück (DE und EN, ohne Rückfall), Fotos mit Alt-Texten, Kategorie-Vorlagen aus den Einstellungen, gültige
// Konformitätserklärungen und den Nummernvorschlag; das Formular selbst ist eine Client-Komponente. P20.6: Markierung
// „zu prüfen“ (V-31), „Was fehlt noch?“ und den nächsten Entwurf in der Reihenfolge von „Meine Stücke“ (neueste
// Änderung zuerst, V-32) sowie die schon hochgeladenen Nickel-Nachweise zur Auswahl (V-32, nur Verwaltung).

type Doc = Record<string, unknown>

const idOf = (v: unknown): number | null => {
  const raw = v && typeof v === 'object' ? (v as { id?: unknown }).id : v
  const n = Number(raw)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

async function loadTemplates(payload: Payload): Promise<CategoryTemplateTexts> {
  const settings = (await payload.findGlobal({
    slug: 'settings',
    locale: 'de',
    depth: 0,
    overrideAccess: true,
  })) as unknown as {
    safetyTemplates?: { category?: ProductCategory; text?: string | null }[] | null
    careTemplates?: { category?: ProductCategory; text?: string | null }[] | null
  }
  const toMap = (rows: typeof settings.safetyTemplates) =>
    Object.fromEntries(
      (rows ?? [])
        .filter((r) => r.category && typeof r.text === 'string')
        .map((r) => [r.category!, r.text!]),
    ) as Partial<Record<ProductCategory, string>>
  // Ohne gespeicherte Zeile gilt der Startwert (wie im Server-Hook) – z. B. Keramik/Schmuck seit V-23
  const careDefaults = Object.fromEntries(
    CARE_CATEGORIES.map((c) => [c, CARE_TEMPLATE_TEXTS[c].de]),
  ) as Partial<Record<ProductCategory, string>>
  return {
    safety: toMap(settings.safetyTemplates),
    care: { ...careDefaults, ...toMap(settings.careTemplates) },
  }
}

/** Fotos mit Alt-Texten DE/EN und Fokuspunkt (auch für Flash und Galerie, P7.6/P7.8). */
export async function loadPhotos(payload: Payload, ids: number[]): Promise<PiecePhoto[]> {
  const photos: PiecePhoto[] = []
  for (const id of ids) {
    const read = (locale: 'de' | 'en') =>
      payload.findByID({
        collection: 'media',
        id,
        locale,
        fallbackLocale: false,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
      }) as Promise<Doc | null>
    const de = await read('de')
    if (!de) continue
    const en = await read('en')
    const sizes = (de.sizes ?? {}) as { thumb?: { url?: string | null } | null }
    photos.push({
      id,
      url: sizes.thumb?.url ?? (de.url as string | null) ?? null,
      altDe: typeof de.alt === 'string' ? de.alt : '',
      altEn: typeof en?.alt === 'string' ? en.alt : '',
      altDeAuto: false,
      focalX: typeof de.focalX === 'number' ? de.focalX : 50,
      focalY: typeof de.focalY === 'number' ? de.focalY : 50,
      dirty: false,
    })
  }
  return photos
}

/** Schon hochgeladene Nickel-Nachweise (neueste zuerst) zur Auswahl im Formular (V-32). */
async function loadEvidenceOptions(payload: Payload): Promise<{ id: number; label: string }[]> {
  const result = await payload.find({
    collection: 'private-uploads',
    where: { purpose: { equals: 'nickel_evidence' } },
    depth: 0,
    limit: 50,
    sort: '-createdAt',
    overrideAccess: true,
  })
  return result.docs.map((d) => {
    const doc = d as { id: number; filename?: string | null; createdAt?: string | null }
    const date = doc.createdAt ? formatBerlin(new Date(doc.createdAt), 'dd.MM.yyyy') : null
    return {
      id: Number(doc.id),
      label: `${doc.filename ?? `#${doc.id}`}${date ? ` (${date})` : ''}`,
    }
  })
}

/** Nächster Entwurf in der Reihenfolge von „Meine Stücke“ (neueste Änderung zuerst) nach diesem Stand. */
async function nextDraftId(
  payload: Payload,
  id: number,
  updatedAt: unknown,
): Promise<number | null> {
  if (typeof updatedAt !== 'string') return null
  const result = await payload.find({
    collection: 'products',
    where: {
      and: [
        { status: { equals: 'draft' } },
        { id: { not_equals: id } },
        { updatedAt: { less_than: updatedAt } },
      ],
    },
    sort: '-updatedAt',
    depth: 0,
    limit: 1,
    select: { updatedAt: true },
    overrideAccess: true,
  })
  const next = result.docs[0] as { id?: number } | undefined
  return next?.id ? Number(next.id) : null
}

export async function PieceEditorView({ match, adminRoute, req }: AdminViewBodyProps) {
  const payload = req.payload
  const [templates, declarationsResult, evidenceOptions] = await Promise.all([
    loadTemplates(payload),
    payload.find({
      collection: 'conformity-declarations',
      where: { status: { equals: 'active' } },
      depth: 0,
      limit: 100,
      sort: 'name',
      overrideAccess: true,
    }),
    loadEvidenceOptions(payload),
  ])
  const declarations = declarationsResult.docs.map((d) => ({
    id: Number(d.id),
    label: String((d as { name?: unknown }).name ?? `#${d.id}`),
  }))
  const availability = translationAvailability()
  const translation = { enabled: availability.enabled, reason: availability.reason }
  const siteUrl = getEnv().NEXT_PUBLIC_SITE_URL

  let initial
  if (match.id) {
    const id = Number(match.id)
    const read = (locale: 'de' | 'en') =>
      payload.findByID({
        collection: 'products',
        id,
        locale,
        fallbackLocale: false,
        depth: 0,
        overrideAccess: true,
        disableErrors: true,
      }) as Promise<Doc | null>
    const de = await read('de')
    if (!de) notFound()
    const en = await read('en')
    const imageIds = ((de.images as unknown[] | null) ?? [])
      .map(idOf)
      .filter((n): n is number => n !== null)
    const status = (de.status as ProductStatus) ?? 'draft'
    initial = {
      id,
      status,
      attention: attentionOf(de.adminAttention),
      readiness: status === 'draft' ? await readinessOfProduct(req, id) : null,
      nextDraftId: status === 'draft' ? await nextDraftId(payload, id, de.updatedAt) : null,
      firstPublishedAt: (de.firstPublishedAt as string | null) ?? null,
      slug: (de.slug as string | null) ?? null,
      form: formFromDoc(de, en),
      photos: await loadPhotos(payload, imageIds),
      scalePhotos: await loadPhotos(
        payload,
        [idOf(de.scalePhoto)].filter((n): n is number => n !== null),
      ),
    }
  } else {
    initial = {
      id: null,
      status: null,
      attention: null,
      readiness: null,
      nextDraftId: null,
      firstPublishedAt: null,
      slug: null,
      form: emptyPieceForm(await computeNextItemNumber(req)),
      photos: [],
      scalePhotos: [],
    }
  }

  return (
    <PieceEditor
      key={initial.id ?? 'new'}
      adminRoute={adminRoute}
      siteUrl={siteUrl}
      initial={initial}
      templates={templates}
      declarations={declarations}
      evidenceOptions={evidenceOptions}
      translation={translation}
    />
  )
}
