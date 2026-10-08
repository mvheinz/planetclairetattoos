import 'server-only'

import type { Field, PayloadRequest } from 'payload'

// Hilfen für den Grund-Seed der Globals (SEED-SPEC §1.3 „nur leere Felder füllen“): Standardwerte aus der
// Feldkonfiguration je Sprache ermitteln und in einen vorhandenen Stand nur dort einsetzen, wo er leer ist.

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

export const isEmptyValue = (v: unknown): boolean =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T))

/** Standardwerte (`defaultValue`) einer Feldliste für eine Sprache, verschachtelt wie das Dokument. */
export async function fieldDefaults(
  fields: readonly Field[],
  locale: string,
  req: PayloadRequest,
): Promise<Obj> {
  const out: Obj = {}
  for (const field of fields) {
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        const values = await fieldDefaults(tab.fields, locale, req)
        if ('name' in tab && tab.name) out[tab.name] = values
        else Object.assign(out, values)
      }
      continue
    }
    if (field.type === 'row' || field.type === 'collapsible') {
      Object.assign(out, await fieldDefaults(field.fields, locale, req))
      continue
    }
    if (field.type === 'ui' || !('name' in field) || !field.name) continue
    const dv = (field as { defaultValue?: unknown }).defaultValue
    if (dv !== undefined) {
      out[field.name] =
        typeof dv === 'function'
          ? await (dv as (a: object) => unknown)({ locale, req, user: req.user })
          : clone(dv)
    } else if (field.type === 'group') {
      out[field.name] = await fieldDefaults(field.fields, locale, req)
    }
  }
  return out
}

/** Schlüssel, über die Array-Zeilen einander zugeordnet werden (z. B. `category`, `zone` + `shippingClass`). */
const ROW_IDENTITY = [
  'key',
  'category',
  'shippingClass',
  'zone',
  'type',
  'carrier',
  'mode',
  'target',
  'template',
  'serviceId',
] as const

function sameRow(a: Obj, b: Obj): boolean {
  const keys = ROW_IDENTITY.filter((k) => b[k] !== undefined)
  return keys.length > 0 && keys.every((k) => a[k] === b[k])
}

/**
 * Füllt leere Werte von `current` aus `desired` (tief). Vorhandene Werte bleiben immer; Array-Zeilen werden über
 * Schlüsselfelder zugeordnet (fehlende Zeilen werden nicht ergänzt, nur leere Felder vorhandener Zeilen).
 */
export function fillEmpty(current: unknown, desired: unknown): unknown {
  if (isEmptyValue(current)) return desired === undefined ? current : clone(desired)
  if (Array.isArray(current) && Array.isArray(desired)) {
    return current.map((row) => {
      if (!isObj(row)) return row
      const match = desired.find((d) => isObj(d) && sameRow(row, d))
      return match ? fillEmpty(row, match) : row
    })
  }
  if (isObj(current) && isObj(desired)) {
    const out: Obj = { ...current }
    for (const [k, v] of Object.entries(desired)) out[k] = fillEmpty(current[k], v)
    return out
  }
  return current
}

/**
 * Frühere Platzhalter des Grund-Seeds, die ein späterer Grund-Seed ersetzen darf, als wären die Felder leer (U-46,
 * P13.7: Juttas Anschrift kam nach der ersten Befüllung). Nur exakt diese Werte – alles, was Jutta selbst eingetragen
 * hat, bleibt (SEED-SPEC §1.3).
 */
export const LEGACY_SETTINGS_PLACEHOLDERS: Readonly<Record<string, readonly string[]>> = {
  'business.legalName': ['[Name folgt]'],
  'business.street': ['[Adresse folgt]'],
  'business.postalCode': ['00000'],
}

/** Setzt Felder mit einem früheren Platzhalter-Wert (Pfad → Werte) auf `null`, damit `fillEmpty` sie neu füllt. */
export function clearLegacyPlaceholders(
  current: Obj,
  placeholders: Readonly<Record<string, readonly string[]>>,
): Obj {
  const out = clone(current)
  for (const [dotted, values] of Object.entries(placeholders)) {
    const keys = dotted.split('.')
    let node: unknown = out
    for (const k of keys.slice(0, -1)) node = isObj(node) ? node[k] : undefined
    const leaf = keys[keys.length - 1]!
    if (isObj(node) && typeof node[leaf] === 'string' && values.includes(node[leaf] as string))
      node[leaf] = null
  }
  return out
}

/** Tief zusammenführen (b gewinnt), Arrays werden ersetzt. */
export function deepMerge(a: Obj, b: Obj): Obj {
  const out: Obj = { ...a }
  for (const [k, v] of Object.entries(b)) {
    out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k] as Obj, v) : clone(v)
  }
  return out
}

/** Lokalisierte Blätter `{ de, en }` auf eine Sprache reduzieren (Seed-Datei → Wert je Sprache). */
export function pickLocaleTree(value: unknown, locale: 'de' | 'en'): unknown {
  if (Array.isArray(value)) return value.map((v) => pickLocaleTree(v, locale))
  if (isObj(value)) {
    const keys = Object.keys(value)
    if (
      keys.length > 0 &&
      keys.every((k) => k === 'de' || k === 'en') &&
      keys.every((k) => typeof value[k] === 'string')
    ) {
      return value[locale] ?? null
    }
    return Object.fromEntries(keys.map((k) => [k, pickLocaleTree(value[k], locale)]))
  }
  return value
}

const META = new Set(['id', 'globalType', 'createdAt', 'updatedAt', '_status'])

export function stripMeta(doc: unknown): Obj {
  if (!isObj(doc)) return {}
  return Object.fromEntries(Object.entries(doc).filter(([k]) => !META.has(k)))
}
