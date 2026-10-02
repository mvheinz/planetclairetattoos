import { notFound } from 'next/navigation'
import type { Payload } from 'payload'
import React from 'react'

import { computeNextItemNumber } from '@/endpoints/products/nextItemNumber'
import type { ProductCategory, ProductStatus } from '@/lib/enums'
import { getEnv } from '@/lib/env'
import { translationAvailability } from '@/lib/translation'

import type { PiecePhoto } from '../../components/PhotoPicker/photoList'
import type { AdminViewBodyProps } from '../AdminViewBody'
import { PieceEditor } from './PieceEditor'
import { emptyPieceForm, formFromDoc, type CategoryTemplateTexts } from './pieceForm'

// Ansichten „Neues Stück“ (`/neues-stueck`) und „Stück bearbeiten“ (`/stuecke/:id`) – PLAN P5.5/P5.6, KONZEPT §7.4.
// Lädt Stück (DE und EN, ohne Rückfall), Fotos mit Alt-Texten, Kategorie-Vorlagen aus den Einstellungen, gültige
// Konformitätserklärungen und den Nummernvorschlag; das Formular selbst ist eine Client-Komponente.

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
  return { safety: toMap(settings.safetyTemplates), care: toMap(settings.careTemplates) }
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

export async function PieceEditorView({ match, adminRoute, req }: AdminViewBodyProps) {
  const payload = req.payload
  const [templates, declarationsResult] = await Promise.all([
    loadTemplates(payload),
    payload.find({
      collection: 'conformity-declarations',
      where: { status: { equals: 'active' } },
      depth: 0,
      limit: 100,
      sort: 'name',
      overrideAccess: true,
    }),
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
    initial = {
      id,
      status: (de.status as ProductStatus) ?? 'draft',
      firstPublishedAt: (de.firstPublishedAt as string | null) ?? null,
      slug: (de.slug as string | null) ?? null,
      form: formFromDoc(de, en),
      photos: await loadPhotos(payload, imageIds),
    }
  } else {
    initial = {
      id: null,
      status: null,
      firstPublishedAt: null,
      slug: null,
      form: emptyPieceForm(await computeNextItemNumber(req)),
      photos: [],
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
      translation={translation}
    />
  )
}
