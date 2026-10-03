import 'server-only'

import type { CollectionSlug, FlattenedField, GlobalSlug, Payload, Where } from 'payload'

// Verweise echter Dokumente auf Seed-Dokumente (DATENMODELL §13.5, SEED-SPEC §18), z. B. ein Block „Stücke-Auswahl“
// einer übernommenen Seite → Seed-Stück. `seed:remove` listet sie vor dem ersten Löschschritt im Bericht auf; entfernt
// werden sie beim Löschen des Ziels von der Datenbank selbst (Fremdschlüssel: `_rels`-Zeilen `ON DELETE CASCADE`,
// einfache Verweise `ON DELETE SET NULL`) – so bleiben übersetzte Texte in Blöcken unangetastet.
// Medien sind ausgenommen: Seed-Medien mit Verweisen werden übernommen statt gelöscht (Schritt `media`).

export interface SeedReferenceHit {
  /** Collection oder Global des verweisenden (echten) Dokuments. */
  source: string
  sourceId: number | string
  sourceTitle: string
  /** Feldpfad, z. B. `layout.products`. */
  path: string
  target: string
  targetId: number | string
  targetSeedKey: string
}

export interface FindSeedReferencesOptions {
  /** Collections, deren Seed-Dokumente stehen bleiben (z. B. `pages`/`faqs` bei „Texte behalten“). */
  keep?: readonly string[]
  /** Diese Seed-Dokumente gelten als echt (sie werden übernommen), z. B. `pages`/`faqs` bei „Texte behalten“. */
  adopted?: readonly string[]
}

type IdLike = number | string
type Targets = Map<string, Map<string, string>>

const NOT_SEED: Where = { or: [{ seed: { equals: false } }, { seed: { exists: false } }] }

function hasSeedField(fields: readonly FlattenedField[]): boolean {
  return fields.some((f) => 'name' in f && f.name === 'seed')
}

function blockFields(payload: Payload, block: unknown): FlattenedField[] {
  if (typeof block === 'string') {
    const ref = payload.config.blocks?.find((b) => b.slug === block)
    return (ref?.flattenedFields ?? []) as FlattenedField[]
  }
  return ((block as { flattenedFields?: FlattenedField[] }).flattenedFields ??
    []) as FlattenedField[]
}

/** Kann dieses Feld (rekursiv) auf eines der Ziele verweisen? */
function mayReference(
  payload: Payload,
  fields: readonly FlattenedField[],
  targets: Targets,
): boolean {
  return fields.some((f) => {
    if (f.type === 'relationship' || f.type === 'upload') {
      const to = Array.isArray(f.relationTo) ? f.relationTo : [f.relationTo]
      return to.some((t) => targets.has(t))
    }
    if (f.type === 'array' || f.type === 'group' || f.type === 'tab') {
      return mayReference(payload, f.flattenedFields as FlattenedField[], targets)
    }
    if (f.type === 'blocks') {
      const blocks = (f.blockReferences ?? f.blocks) as unknown[]
      return blocks.some((b) => mayReference(payload, blockFields(payload, b), targets))
    }
    return false
  })
}

function idOf(value: unknown): IdLike | null {
  if (typeof value === 'number' || typeof value === 'string') return value
  if (value && typeof value === 'object' && 'id' in value) return (value as { id: IdLike }).id
  return null
}

function walk(
  payload: Payload,
  fields: readonly FlattenedField[],
  data: unknown,
  targets: Targets,
  prefix: string,
  out: Array<Pick<SeedReferenceHit, 'path' | 'target' | 'targetId' | 'targetSeedKey'>>,
): void {
  if (!data || typeof data !== 'object') return
  const row = data as Record<string, unknown>
  for (const f of fields) {
    if (!('name' in f)) continue
    const value = row[f.name]
    if (value === null || value === undefined) continue
    const path = prefix ? `${prefix}.${f.name}` : f.name
    if (f.type === 'relationship' || f.type === 'upload') {
      const values = Array.isArray(value) ? value : [value]
      for (const v of values) {
        const poly = Array.isArray(f.relationTo)
        const target = poly ? (v as { relationTo?: string })?.relationTo : (f.relationTo as string)
        const id = idOf(poly ? (v as { value?: unknown })?.value : v)
        if (!target || id === null) continue
        const seedKey = targets.get(target)?.get(String(id))
        if (seedKey) out.push({ path, target, targetId: id, targetSeedKey: seedKey })
      }
    } else if (f.type === 'group' || f.type === 'tab') {
      walk(payload, f.flattenedFields as FlattenedField[], value, targets, path, out)
    } else if (f.type === 'array' && Array.isArray(value)) {
      for (const item of value)
        walk(payload, f.flattenedFields as FlattenedField[], item, targets, path, out)
    } else if (f.type === 'blocks' && Array.isArray(value)) {
      const blocks = (f.blockReferences ?? f.blocks) as unknown[]
      for (const item of value as Array<{ blockType?: string }>) {
        const block = blocks.find(
          (b) => (typeof b === 'string' ? b : (b as { slug: string }).slug) === item.blockType,
        )
        if (block) walk(payload, blockFields(payload, block), item, targets, path, out)
      }
    }
  }
}

function titleOf(doc: Record<string, unknown>, useAsTitle: string | undefined): string {
  const t = useAsTitle ? doc[useAsTitle] : undefined
  return typeof t === 'string' || typeof t === 'number' ? String(t) : String(doc.id ?? '')
}

/** Alle Verweise echter Dokumente (und Globals) auf Seed-Dokumente, die gelöscht werden. Nur lesend. */
export async function findSeedReferences(
  payload: Payload,
  options: FindSeedReferencesOptions = {},
): Promise<SeedReferenceHit[]> {
  const keep = new Set(['media', ...(options.keep ?? [])])
  const adopted = new Set(options.adopted ?? [])
  const collections = Object.values(payload.collections)

  // Ziele: Seed-Dokumente der Collections, die gelöscht werden (id → seedKey).
  const targets: Targets = new Map()
  for (const c of collections) {
    const slug = c.config.slug
    if (keep.has(slug) || !hasSeedField(c.config.flattenedFields)) continue
    const res = await payload.find({
      collection: slug as CollectionSlug,
      where: { seed: { equals: true } },
      limit: 0,
      pagination: false,
      depth: 0,
      overrideAccess: true,
      select: { seedKey: true } as never,
    })
    if (res.docs.length === 0) continue
    targets.set(
      slug,
      new Map(
        (res.docs as unknown as Array<{ id: IdLike; seedKey?: string | null }>).map((d) => [
          String(d.id),
          d.seedKey ?? `${slug}:${d.id}`,
        ]),
      ),
    )
  }
  if (targets.size === 0) return []

  const hits: SeedReferenceHit[] = []
  for (const c of collections) {
    const slug = c.config.slug
    const fields = c.config.flattenedFields as FlattenedField[]
    if (!mayReference(payload, fields, targets)) continue
    const seeded = hasSeedField(fields)
    const where: Where | undefined = !seeded
      ? undefined
      : adopted.has(slug)
        ? undefined // echt + gleich übernommen
        : NOT_SEED
    for (let page = 1; ; page++) {
      const res = await payload.find({
        collection: slug as CollectionSlug,
        where,
        limit: 200,
        page,
        depth: 0,
        overrideAccess: true,
      })
      for (const doc of res.docs as unknown as Record<string, unknown>[]) {
        const found: Parameters<typeof walk>[5] = []
        walk(payload, fields, doc, targets, '', found)
        for (const h of found) {
          hits.push({
            source: slug,
            sourceId: doc.id as IdLike,
            sourceTitle: titleOf(doc, c.config.admin?.useAsTitle),
            ...h,
          })
        }
      }
      if (!res.hasNextPage) break
    }
  }
  for (const g of payload.config.globals) {
    const fields = g.flattenedFields as FlattenedField[]
    if (!mayReference(payload, fields, targets)) continue
    const doc = (await payload.findGlobal({
      slug: g.slug as GlobalSlug,
      depth: 0,
      overrideAccess: true,
    })) as unknown as Record<string, unknown>
    const found: Parameters<typeof walk>[5] = []
    walk(payload, fields, doc, targets, '', found)
    for (const h of found) {
      hits.push({ source: g.slug, sourceId: g.slug, sourceTitle: g.slug, ...h })
    }
  }
  return hits
}

/** Berichtszeile, z. B. „Verweis entfernt: pages 12 „Startseite“ (layout.products) → products:S07“. */
export function formatSeedReference(hit: SeedReferenceHit): string {
  const title =
    hit.sourceTitle && hit.sourceTitle !== String(hit.sourceId) ? ` „${hit.sourceTitle}“` : ''
  return `Verweis entfernt: ${hit.source} ${hit.sourceId}${title} (${hit.path}) → ${hit.targetSeedKey}`
}

/** Alle IDs, auf die `data` (Dokument der Felder `fields`) in `target` verweist – rekursiv durch Gruppen, Arrays, Blöcke. */
export function referencedIds(
  payload: Payload,
  fields: readonly FlattenedField[],
  data: unknown,
  target: string,
): IdLike[] {
  const out = new Set<IdLike>()
  const visit = (fs: readonly FlattenedField[], value: unknown) => {
    if (!value || typeof value !== 'object') return
    const row = value as Record<string, unknown>
    for (const f of fs) {
      if (!('name' in f)) continue
      const v = row[f.name]
      if (v === null || v === undefined) continue
      if (f.type === 'relationship' || f.type === 'upload') {
        const poly = Array.isArray(f.relationTo)
        for (const item of Array.isArray(v) ? v : [v]) {
          const to = poly ? (item as { relationTo?: string })?.relationTo : (f.relationTo as string)
          const id = idOf(poly ? (item as { value?: unknown })?.value : item)
          if (to === target && id !== null) out.add(id)
        }
      } else if (f.type === 'group' || f.type === 'tab') {
        visit(f.flattenedFields as FlattenedField[], v)
      } else if (f.type === 'array' && Array.isArray(v)) {
        for (const item of v) visit(f.flattenedFields as FlattenedField[], item)
      } else if (f.type === 'blocks' && Array.isArray(v)) {
        const blocks = (f.blockReferences ?? f.blocks) as unknown[]
        for (const item of v as Array<{ blockType?: string }>) {
          const block = blocks.find(
            (b) => (typeof b === 'string' ? b : (b as { slug: string }).slug) === item.blockType,
          )
          if (block) visit(blockFields(payload, block), item)
        }
      }
    }
  }
  visit(fields, data)
  return [...out]
}
