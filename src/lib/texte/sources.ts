import 'server-only'

import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { SiteTexts } from '@/globals/SiteTexts'

import type { TextData, TextFile } from './model'

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
  return {
    messages: { de: await read('messages.de'), en: await read('messages.en') },
    siteTexts: await read('siteTexts'),
    siteTextFields: siteTextFields(),
    pages: await read('pages'),
    faqs: await read('faqs'),
    base: await read('base'),
  }
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
