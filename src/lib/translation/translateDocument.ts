import 'server-only'

import type { CollectionSlug, PayloadRequest } from 'payload'

import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'

import { getTranslationAdapter, type TranslationAdapter } from './index'
import {
  applyLexicalTexts,
  collectLexicalTexts,
  isLexicalState,
  type LexicalState,
} from './lexical'

// Allgemeiner Übersetzen-Dienst (E-61, ARCHITEKTUR §3.6): liest DE und EN eines Dokuments, übersetzt die genannten
// Felder (Text oder Lexical-Rich-Text, Pfade mit Punkt für Gruppen, z. B. `dimensions.note`) in einem gebündelten
// Adapter-Aufruf und speichert EN mit `context.translation` (Hooks setzen daran `enStatus = machine`). Leere EN-Felder
// werden immer gefüllt, vorhandene nur mit `force` (Rückfrage-Dialog im Knopf) oder wenn `mayOverwrite` es erlaubt.
// Wiederverwendet für Stücke (P5.4) und in P7 für Flash, Angebote, Tattoo-Seiten und FAQ.

type Doc = Record<string, unknown>

const INDEX_RE = /^\d+$/

/** Wert unter einem Punkt-Pfad; Ziffern-Segmente greifen in Listen (Blöcke, Zeilen: `layout.0.steps.1.title`). */
export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => {
    if (Array.isArray(o)) return INDEX_RE.test(k) ? o[Number(k)] : undefined
    return o && typeof o === 'object' ? (o as Doc)[k] : undefined
  }, obj)
}

function setPath(target: Doc, path: string, value: unknown): void {
  const keys = path.split('.')
  let o = target as Record<string, unknown>
  keys.slice(0, -1).forEach((k, i) => {
    if (!o[k] || typeof o[k] !== 'object') o[k] = INDEX_RE.test(keys[i + 1]!) ? [] : {}
    o = o[k] as Record<string, unknown>
  })
  o[keys.at(-1)!] = value
}

/** `patch` in eine Kopie von `base` legen (Listen nach Position; nur gesetzte Einträge des Patches zählen). */
function deepMerge(base: unknown, patch: unknown): unknown {
  if (!patch || typeof patch !== 'object') return patch
  if (!base || typeof base !== 'object') return patch
  const out = (Array.isArray(base) ? [...base] : { ...(base as Doc) }) as Record<string, unknown>
  for (const key of Object.keys(patch as object)) {
    out[key] = deepMerge(out[key], (patch as Record<string, unknown>)[key])
  }
  return out
}

/** Hat das Feld sichtbaren Inhalt (Text getrimmt bzw. Lexical mit Textknoten)? */
export function hasContent(value: unknown): boolean {
  if (typeof value === 'string') return value.trim() !== ''
  return isLexicalState(value) && collectLexicalTexts(value).length > 0
}

export interface TranslateDocumentOptions {
  /** Vorhandene EN-Texte überschreiben (nach Rückfrage). */
  force?: boolean
  /** Ohne `force` trotzdem überschreiben (z. B. maschinelle Texte eines Stücks, DATENMODELL §6.6.10). */
  mayOverwrite?: (path: string, en: Doc) => boolean
  adapter?: TranslationAdapter
}

export interface PreparedTranslation {
  /** Übersetzte Pfade. */
  paths: string[]
  /** EN-Daten fürs Speichern (Gruppen vollständig, damit nicht lokalisierte Felder bleiben). */
  patch: Doc
  de: Doc
  en: Doc
}

const readLocale = (
  req: PayloadRequest,
  collection: CollectionSlug,
  id: number | string,
  locale: 'de' | 'en',
) =>
  preservingReq(req, () =>
    req.payload.findByID({
      collection,
      id,
      locale,
      fallbackLocale: false,
      depth: 0,
      overrideAccess: true,
      req,
    }),
  ) as Promise<unknown> as Promise<Doc>

/** Übersetzt die Felder, schreibt aber noch nicht (für Aufrufer, die mehr in derselben Transaktion speichern). */
export async function prepareDocumentTranslation(
  req: PayloadRequest,
  collection: CollectionSlug,
  id: number | string,
  fieldPaths: readonly string[],
  { force = false, mayOverwrite, adapter = getTranslationAdapter() }: TranslateDocumentOptions = {},
): Promise<PreparedTranslation> {
  // Nacheinander: Local-API-Aufrufe mit demselben `req` setzen `req.locale` (kein Promise.all).
  const de = await readLocale(req, collection, id, 'de')
  const en = await readLocale(req, collection, id, 'en')

  const jobs: { path: string; source: string | LexicalState; texts: string[] }[] = []
  for (const path of fieldPaths) {
    const source = getPath(de, path)
    if (!hasContent(source)) continue
    const overwrite = force || (mayOverwrite?.(path, en) ?? false)
    if (hasContent(getPath(en, path)) && !overwrite) continue
    const texts =
      typeof source === 'string' ? [source.trim()] : collectLexicalTexts(source as LexicalState)
    jobs.push({ path, source: source as string | LexicalState, texts })
  }

  const all = jobs.flatMap((j) => j.texts)
  const translated = all.length
    ? await adapter.translate({ texts: all, source: 'de', target: 'en' })
    : []
  if (translated.length !== all.length) throw new Error('Übersetzung unvollständig.')

  const patch: Doc = {}
  let offset = 0
  for (const job of jobs) {
    const part = translated.slice(offset, offset + job.texts.length)
    offset += job.texts.length
    setPath(
      patch,
      job.path,
      typeof job.source === 'string' ? part[0] : applyLexicalTexts(job.source, part),
    )
  }
  // Gruppen und Listen (Blöcke) vollständig mitschicken: nicht lokalisierte Unterfelder, Zeilen-IDs und nicht
  // übersetzte Einträge bleiben unverändert, die Struktur bleibt gleich.
  for (const key of Object.keys(patch)) {
    const current = en[key]
    if (jobs.some((j) => j.path.startsWith(`${key}.`)) && current && typeof current === 'object') {
      patch[key] = deepMerge(current, patch[key])
    }
  }
  return { paths: jobs.map((j) => j.path), patch, de, en }
}

/** Speichert EN mit `context.translation` (setzt `enStatus = machine`, wo die Collection ihn führt). */
export function writeTranslation(
  req: PayloadRequest,
  collection: CollectionSlug,
  id: number | string,
  patch: Doc,
) {
  return preservingReq(req, () =>
    req.payload.update({
      collection,
      id,
      locale: 'en',
      data: patch as never,
      depth: 0,
      overrideAccess: true,
      req,
      context: { ...req.context, translation: true },
    }),
  )
}

/** DE → EN für `fieldPaths` eines Dokuments; Rückgabe: gespeichertes EN-Dokument und die übersetzten Pfade. */
export async function translateDocumentFields(
  req: PayloadRequest,
  collection: CollectionSlug,
  id: number | string,
  fieldPaths: readonly string[],
  options: TranslateDocumentOptions = {},
): Promise<{ doc: Doc; paths: string[] }> {
  const prepared = await prepareDocumentTranslation(req, collection, id, fieldPaths, options)
  const doc = (await inTransaction(req, () =>
    writeTranslation(req, collection, id, prepared.patch),
  )) as unknown as Doc
  return { doc, paths: prepared.paths }
}
