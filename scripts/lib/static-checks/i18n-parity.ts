import { readFileSync } from 'node:fs'
import path from 'node:path'

import type { CheckResult, StaticCheck } from './types'

// T-06 / EK-09 (ARCHITEKTUR §7.4): de.json und en.json haben dieselben Schlüssel, keine leeren Werte, kein „lorem“.
export const MESSAGE_NAMESPACES = [
  'common',
  'header',
  'menu',
  'footer',
  'legal',
  'errors',
  'home',
  'a11y',
  'previewExport',
  // P2.16/P2.18 Kontakt und Widerruf, P3 Shop, Archiv, Bausteine und SEO (P3.16, EK-09)
  'contact',
  'withdraw',
  'ui',
  'seo',
  'shop',
  'archive',
] as const

type Json = string | number | boolean | null | Json[] | { [k: string]: Json }

/** Flacht verschachtelte Nachrichten zu `a.b.c` → Wert ab. */
export function flattenMessages(obj: Json, prefix = ''): Map<string, Json> {
  const out = new Map<string, Json>()
  if (obj !== null && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k
      if (v !== null && typeof v === 'object') {
        for (const [kk, vv] of flattenMessages(v, key)) out.set(kk, vv)
      } else out.set(key, v)
    }
  }
  return out
}

export function checkI18nParity(messages: Record<string, Json>): CheckResult {
  const errors: string[] = []
  const flat = Object.fromEntries(
    Object.entries(messages).map(([locale, m]) => [locale, flattenMessages(m)]),
  )
  const locales = Object.keys(flat)
  const allKeys = new Set(locales.flatMap((l) => [...flat[l]!.keys()]))
  for (const locale of locales) {
    const map = flat[locale]!
    const top = messages[locale] as Record<string, Json>
    for (const ns of MESSAGE_NAMESPACES) {
      if (!(ns in top)) errors.push(`${locale}.json: Namensraum „${ns}“ fehlt.`)
    }
    for (const key of allKeys) {
      if (!map.has(key)) errors.push(`${locale}.json: Schlüssel „${key}“ fehlt.`)
    }
    for (const [key, value] of map) {
      if (typeof value !== 'string') {
        errors.push(`${locale}.json: „${key}“ ist kein Text.`)
        continue
      }
      if (value.trim() === '') errors.push(`${locale}.json: „${key}“ ist leer.`)
      if (/lorem/i.test(value)) errors.push(`${locale}.json: „${key}“ enthält „lorem“.`)
    }
  }
  return { errors, warnings: [] }
}

export function loadMessages(root: string): Record<string, Json> {
  const dir = path.join(root, 'src/i18n/messages')
  return {
    de: JSON.parse(readFileSync(path.join(dir, 'de.json'), 'utf8')) as Json,
    en: JSON.parse(readFileSync(path.join(dir, 'en.json'), 'utf8')) as Json,
  }
}

export const i18nParityCheck: StaticCheck = {
  name: 'i18n-parity',
  run: (root) => checkI18nParity(loadMessages(root)),
}
