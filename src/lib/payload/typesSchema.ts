import type { Config } from 'payload'

// DM-P1-06 (PLAN P1.32): `pnpm generate:types` erzeugt Typen ohne `any`. Lexical markiert `children[].type` im
// Ausgabe-Schema mit `tsType: 'any'`; hier wird daraus der eigentliche JSON-Typ (`string`). Reine Funktion, wird in
// `payload.config.ts` unter `typescript.schema` eingehängt.

/** Entfernt rekursiv jedes `tsType: 'any'` (der Typ ergibt sich dann aus `type`, sonst `unknown`). */
export function stripAnyTsTypes<T>(node: T): T {
  if (Array.isArray(node)) return node.map((n) => stripAnyTsTypes(n)) as T
  if (!node || typeof node !== 'object') return node
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (key === 'tsType' && typeof value === 'string' && /^\s*any(\[\])?\s*$/.test(value)) {
      if (!('type' in (node as object))) out.tsType = value.includes('[]') ? 'unknown[]' : 'unknown'
      continue
    }
    out[key] = stripAnyTsTypes(value)
  }
  return out as T
}

type SchemaHook = NonNullable<NonNullable<Config['typescript']>['schema']>[number]

export const noAnyTypesSchema: SchemaHook = ({ jsonSchema }) => stripAnyTsTypes(jsonSchema)
