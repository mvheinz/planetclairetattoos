import 'server-only'

import type { PayloadRequest, Where } from 'payload'

import { requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'

import type { LocalizedValue } from './localized'
import { readinessHints, readinessOf, type Readiness } from './readiness'
import {
  relationId,
  validateForPublish,
  type ProductForValidation,
  type PublishContext,
} from './validate'

// Gemeinsame Grundlage der Veröffentlichungsprüfung (DATENMODELL §6.6.6): Bilder, Erklärungen und Einstellungen
// gebündelt laden – für den Speicher-Hook (ein Stück) und für „was fehlt noch?“ / „Alle fertigen online stellen“
// (V-32, viele Entwürfe in wenigen Abfragen). Dieselbe Funktion `validateForPublish`, dieselben Daten.

type Doc = Record<string, unknown>

const idList = (v: unknown): (number | string)[] =>
  Array.isArray(v) ? v.map(relationId).filter((id): id is number | string => id !== null) : []

async function findAll(
  req: PayloadRequest,
  collection: 'media' | 'conformity-declarations',
  ids: (number | string)[],
): Promise<Doc[]> {
  if (ids.length === 0) return []
  const result = await preservingReq(req, () =>
    req.payload.find({
      collection,
      where: { id: { in: [...new Set(ids)] } },
      locale: 'all',
      depth: 0,
      limit: 0,
      pagination: false,
      overrideAccess: true,
      req,
    }),
  )
  return result.docs as unknown as Doc[]
}

/** Erklärungen (Status, gültig ab) zu den Stücken – auch für die Prüfung „lebensmittelecht“ beim Entwurf. */
export async function loadDeclarations(
  req: PayloadRequest,
  views: readonly Doc[],
): Promise<PublishContext['declarations']> {
  const ids = views.flatMap((v) => idList(v.conformityDeclarations))
  return (await findAll(req, 'conformity-declarations', ids)).map((d) => ({
    id: d.id as number,
    status: d.status as string,
    validFrom: d.validFrom as string,
  }))
}

/** Prüf-Kontext für eine Menge von Stücken (Stand mit allen Sprachen, `depth: 0`). */
export async function loadPublishContext(
  req: PayloadRequest,
  views: readonly Doc[],
): Promise<PublishContext> {
  const images = (
    await findAll(
      req,
      'media',
      views.flatMap((v) => idList(v.images)),
    )
  ).map((m) => ({
    id: m.id as number,
    alt: m.alt as LocalizedValue,
    restricted: m.restricted as boolean | null,
  }))
  const declarations = await loadDeclarations(req, views)
  const settings = req.payload.config.globals.some((g) => g.slug === 'settings')
    ? ((await preservingReq(req, () =>
        req.payload.findGlobal({ slug: 'settings', req, depth: 0, overrideAccess: true }),
      )) as unknown as Doc)
    : {}
  const legal = (settings.legal ?? {}) as Doc
  return {
    allowVisibleBlankBrands: legal.allowVisibleBlankBrands === true,
    business: (settings.business ?? null) as PublishContext['business'],
    images,
    declarations,
    now: requestNow(req),
  }
}

/** „Was fehlt noch?“ für Stücke im Stand mit allen Sprachen (`locale: 'all'`, `depth: 0`). */
export async function readinessFor(
  req: PayloadRequest,
  views: readonly Doc[],
): Promise<Map<number, Readiness>> {
  const out = new Map<number, Readiness>()
  if (views.length === 0) return out
  const ctx = await loadPublishContext(req, views)
  for (const view of views) {
    const issues = validateForPublish(view as ProductForValidation, ctx)
    out.set(Number(view.id), readinessOf(issues, readinessHints(view)))
  }
  return out
}

/** „Was fehlt noch?“ für ein Stück (alle Sprachen, dieselbe Prüfung wie beim Online-Stellen); `null` = unbekannt. */
export async function readinessOfProduct(
  req: PayloadRequest,
  id: number,
): Promise<Readiness | null> {
  const view = (await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'products',
      id,
      locale: 'all',
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )) as Doc | null
  if (!view) return null
  return (await readinessFor(req, [view])).get(id) ?? null
}

/** Entwürfe (alle Sprachen) laden; `where` grenzt zusätzlich ein (z. B. `id in …`). */
export async function loadDraftViews(req: PayloadRequest, where?: Where): Promise<Doc[]> {
  const result = await preservingReq(req, () =>
    req.payload.find({
      collection: 'products',
      where: where
        ? { and: [{ status: { equals: 'draft' } }, where] }
        : { status: { equals: 'draft' } },
      locale: 'all',
      depth: 0,
      limit: 0,
      pagination: false,
      sort: '-updatedAt',
      overrideAccess: true,
      req,
    }),
  )
  return result.docs as unknown as Doc[]
}
