import { ValidationError, type CollectionBeforeChangeHook } from 'payload'

import { adminText } from '@/admin/translations'

// Unveränderliche Felder (Protokolle, DATENMODELL §6.21–§6.24, §6.27): auch Server-Code mit `overrideAccess`
// darf sie nach dem Anlegen nicht mehr ändern.

type Doc = Record<string, unknown>

function normalize(value: unknown): unknown {
  if (value === undefined || value === '') return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const t = new Date(value)
    return Number.isNaN(t.getTime()) ? value : t.toISOString()
  }
  if (value && typeof value === 'object' && !Array.isArray(value) && 'id' in value) {
    return (value as { id: unknown }).id
  }
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Doc)
        .filter(([k]) => k !== 'id')
        .map(([k, v]) => [k, normalize(v)]),
    )
  }
  return value
}

/** Liste der Felder, die sich zwischen `original` und `data` unterscheiden (nur Felder, die `data` enthält). */
export function changedFields(fields: readonly string[], original: Doc, data: Doc): string[] {
  return fields.filter(
    (f) =>
      f in data && JSON.stringify(normalize(data[f])) !== JSON.stringify(normalize(original[f])),
  )
}

/**
 * `beforeChange`-Hook: bei `update` sind nur die Felder in `mutable` änderbar; `'none'` sperrt alle Felder.
 * System-Felder (`id`, `createdAt`, `updatedAt`) sind ausgenommen.
 */
export function immutableFields(mutable: readonly string[] | 'none'): CollectionBeforeChangeHook {
  const allowed = new Set(['id', 'createdAt', 'updatedAt', ...(mutable === 'none' ? [] : mutable)])
  return ({ operation, data, originalDoc, collection, req }) => {
    if (operation !== 'update' || !originalDoc) return data
    const candidates = Object.keys(data).filter((k) => !allowed.has(k))
    const changed = changedFields(candidates, originalDoc as Doc, data as Doc)
    if (changed.length > 0) {
      throw new ValidationError(
        {
          collection: collection.slug,
          errors: changed.map((path) => ({ path, message: adminText('immutableField') })),
        },
        req.t,
      )
    }
    return data
  }
}
