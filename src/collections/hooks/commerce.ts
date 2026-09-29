import { ValidationError, type PayloadRequest } from 'payload'

import type { ActorType } from '@/lib/enums'
import { getAppContext } from '@/lib/payload/context'

import { changedFields } from './immutable'

// Gemeinsame Helfer der Kassen-, Bestell-, Beleg- und Widerrufs-Hooks (DATENMODELL §6.7–§6.11, §6.25).

type Doc = Record<string, unknown>

export function failField(collection: string, message: string, path: string): never {
  throw new ValidationError({ collection, errors: [{ message, path }] })
}

/** Auslöser eines Schreibvorgangs für Statusverlauf und Audit (KONZEPT §5 Regel 2). */
export function actorTypeOf(req: PayloadRequest): ActorType {
  const ctx = getAppContext(req)
  if (ctx.seed) return 'seed'
  if (req.user?.collection === 'users') return 'admin'
  return ctx.actorType ?? 'system'
}

/** Lehnt Änderungen an `fields` nach dem Anlegen ab (`message` je Feld). */
export function rejectChanges(
  collection: string,
  fields: readonly string[],
  original: Doc,
  data: Doc,
  message: string,
): void {
  const changed = changedFields(fields, original, data)
  if (changed.length > 0) {
    throw new ValidationError({
      collection,
      errors: changed.map((path) => ({ path, message })),
    })
  }
}

/** Gruppe als Objekt (fehlend → `{}`), z. B. `timestamps`. */
export function groupOf(doc: Doc | undefined, name: string): Doc {
  const v = doc?.[name]
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Doc) : {}
}

/** Relation als ID (auch bei befüllter Relation). */
export function idOf(value: unknown): number | string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'object' && 'id' in (value as Doc)) return (value as { id: number }).id
  return value as number | string
}

export const SHA256_HEX = /^[0-9a-f]{64}$/
export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
