import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { Categories } from '@/collections/Categories'
import { Faqs } from '@/collections/Faqs'
import { Pages } from '@/collections/Pages'
import { Settings } from '@/globals/Settings'
import { SiteTexts } from '@/globals/SiteTexts'
import { validateDeliveryTimeText } from '@/lib/shop/deliveryTime'

import type { FieldRule, TextData, TextFile } from './model'

// Texte vor dem Start aus dem Repo laden (U-87, U-89): Sprachdateien, Standardtexte der Verwaltung, Seed-Seiten,
// -Fragen und Grunddaten. Schreiben übernimmt `scripts/pflege/texte.ts` (formatiert mit Prettier).

export const TEXT_FILES: Record<TextFile, string> = {
  'messages.de': path.join('src', 'i18n', 'messages', 'de.json'),
  'messages.en': path.join('src', 'i18n', 'messages', 'en.json'),
  siteTexts: path.join('src', 'globals', 'siteTexts.defaults.json'),
  pages: path.join('content', 'seed', 'data', 'pages.json'),
  faqs: path.join('content', 'seed', 'data', 'faqs.json'),
  base: path.join('content', 'seed', 'data', 'base.json'),
}

type F = {
  name?: string
  type: string
  label?: unknown
  maxLength?: number
  fields?: F[]
  tabs?: { fields: F[] }[]
  blocks?: { slug: string; fields: F[] }[]
}

/** Feld `name` in `fields` (auch in Reiter, Zeilen und anderen namenlosen Behältern). */
function findField(fields: readonly F[], name: string): F | null {
  for (const f of fields) {
    if (f.name === name) return f
    if (!f.name) {
      const inner = [...(f.fields ?? []), ...(f.tabs ?? []).flatMap((t) => t.fields)]
      const hit = findField(inner, name)
      if (hit) return hit
    }
  }
  return null
}

/** Schema-Feld zu einem Pfad im Dokument (Gruppen, Listen, Blöcke). */
export function fieldAt(fields: readonly F[], path: readonly string[], doc: unknown): F | null {
  let current: readonly F[] = fields
  let value: unknown = doc
  let field: F | null = null
  for (let i = 0; i < path.length; i++) {
    const seg = path[i]!
    field = findField(current, seg)
    if (!field) return null
    value = value && typeof value === 'object' ? (value as Record<string, unknown>)[seg] : undefined
    if (field.type === 'blocks' || field.type === 'array') {
      const idx = path[++i]
      value = Array.isArray(value) && idx !== undefined ? value[Number(idx)] : undefined
      if (field.type === 'blocks') {
        const type = (value as { blockType?: string } | undefined)?.blockType
        current = field.blocks?.find((b) => b.slug === type)?.fields ?? []
      } else current = field.fields ?? []
    } else current = field.fields ?? []
  }
  return field
}

/** Regeln aus der Verwaltung (Höchstlänge, Prüfungen) für einen Eintrag der Texte-Liste. */
export function fieldRule(d: Pick<TextData, 'pages' | 'faqs' | 'base'>, id: string): FieldRule {
  const [kind, key, path = ''] = id.split(':')
  const rule = (f: F | null, extra?: FieldRule['validate']): FieldRule => ({
    ...(f?.maxLength ? { maxLength: f.maxLength } : {}),
    ...(extra ? { validate: extra } : {}),
  })
  if (kind === 'seite') {
    const page = d.pages.find((p) => String(p.key) === key)
    return rule(fieldAt(Pages.fields as F[], path.split('.'), page))
  }
  if (kind === 'faq') return rule(fieldAt(Faqs.fields as F[], path.split('.'), null))
  if (kind === 'kat') return rule(fieldAt(Categories.fields as F[], path.split('.'), null))
  if (kind === 'einst') {
    const f = fieldAt(Settings.fields as F[], key!.split('.'), d.base.settings)
    return rule(f, key === 'shipping.deliveryTimeText' ? validateDeliveryTimeText : undefined)
  }
  return {}
}

/** Beschriftung und Höchstlänge der Verwaltungs-Textfelder (`footer.tagline` → …). */
export function siteTextFields(): Map<string, { label: string; maxLength?: number }> {
  const out = new Map<string, { label: string; maxLength?: number }>()
  const walk = (fields: F[], prefix: string) => {
    for (const f of fields) {
      if (f.type === 'tabs') for (const t of f.tabs ?? []) walk(t.fields, prefix)
      else if (f.type === 'group' && f.name && f.fields)
        walk(f.fields, prefix ? `${prefix}.${f.name}` : f.name)
      else if ((f.type === 'text' || f.type === 'textarea') && f.name)
        out.set(prefix ? `${prefix}.${f.name}` : f.name, {
          label: typeof f.label === 'string' ? f.label : f.name,
          ...(f.maxLength ? { maxLength: f.maxLength } : {}),
        })
    }
  }
  walk(SiteTexts.fields as F[], '')
  return out
}

export async function loadTextData(root: string): Promise<TextData> {
  const read = async (f: TextFile) =>
    JSON.parse(await readFile(path.join(root, TEXT_FILES[f]), 'utf8')) as never
  const data: Omit<TextData, 'fieldRule'> = {
    messages: { de: await read('messages.de'), en: await read('messages.en') },
    siteTexts: await read('siteTexts'),
    siteTextFields: siteTextFields(),
    pages: await read('pages'),
    faqs: await read('faqs'),
    base: await read('base'),
  }
  return { ...data, fieldRule: (id) => fieldRule(data, id) }
}

/** Datei-Inhalt (vor dem Formatieren) einer geänderten Quelle. */
export function serialize(d: TextData, f: TextFile): unknown {
  switch (f) {
    case 'messages.de':
      return d.messages.de
    case 'messages.en':
      return d.messages.en
    case 'siteTexts':
      return d.siteTexts
    case 'pages':
      return d.pages
    case 'faqs':
      return d.faqs
    case 'base':
      return d.base
  }
}
