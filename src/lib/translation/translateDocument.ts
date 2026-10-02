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

export function getPath(obj: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (o, k) => (o && typeof o === 'object' && !Array.isArray(o) ? (o as Doc)[k] : undefined),
      obj,
    )
}

function setPath(target: Doc, path: string, value: unknown): void {
  const keys = path.split('.')
  let o = target
  for (const k of keys.slice(0, -1)) {
    if (!o[k] || typeof o[k] !== 'object') o[k] = {}
    o = o[k] as Doc
  }
  o[keys.at(-1)!] = value
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
  // Gruppen vollständig mitschicken (nicht lokalisierte Unterfelder bleiben unverändert).
  for (const key of Object.keys(patch)) {
    const current = en[key]
    if (jobs.some((j) => j.path.startsWith(`${key}.`)) && current && typeof current === 'object') {
      patch[key] = { ...(current as Doc), ...(patch[key] as Doc) }
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
