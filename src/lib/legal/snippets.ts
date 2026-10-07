import 'server-only'

import { createHash } from 'node:crypto'

import type { Payload, PayloadRequest } from 'payload'

import {
  LEGAL_SNIPPET_KEYS,
  type LegalSnippetKey,
  type LegalTextOrigin,
  type LegalTextStatus,
  type Locale,
} from '@/lib/enums'
import { createLogger } from '@/lib/monitoring/logger'

import { LEGAL_TOKENS } from './tokens'
import { LEGAL_SNIPPET_SEED, SNIPPET_PLACEHOLDER_TEXT } from './snippetSeed'

export { SNIPPET_PLACEHOLDER_TEXT }

// Rechtliche Textbausteine (RECHT ANFORDERUNGEN §6, DATENMODELL §6.28, R-012). Ab P6 liest `getSnippet` die gültige
// Fassung aus der Collection `legal-snippets`. Damit die Funktion synchron bleibt (Server-Komponenten, Mail-Vorlagen,
// PDF), hält dieses Modul die veröffentlichten und abgelösten Fassungen im Speicher: geladen beim Start
// (`onInit`), nach jeder Aktivierung im selben Prozess als veraltet markiert und spätestens nach
// `SNIPPET_CACHE_TTL_MS` im Hintergrund neu gelesen. Wer die Version speichert (Kasse absenden), lädt vorher frisch
// (`loadLegalSnippets`). Solange nichts geladen ist (Unit-Tests ohne Datenbank, Start), gilt der Grund-Seed-Text mit
// der Version `draft-1` aus P3–P5 – Bestellungen aus P4/P5 behalten diese Einträge.

const log = createLogger()

/** Version der Arbeitsfassungen aus P3–P5 (Konstanten); bleibt in Bestellungen aus dieser Zeit stehen. */
export const LEGAL_SNIPPET_DRAFT_VERSION = 'draft-1'

/** Höchstalter des Speicherstands, danach liest der nächste Aufruf im Hintergrund neu. */
export const SNIPPET_CACHE_TTL_MS = 60_000

/**
 * Kontext-Tokens, die ein Baustein neben den Tokens aus R-012 (`LEGAL_TOKENS`) verwenden darf – nur die in seiner
 * Arbeitsfassung genannten (ANFORDERUNGEN §6); der Aufrufer liefert sie.
 */
export const SNIPPET_CONTEXT_TOKENS = [
  'itemTitle',
  'objectNumber',
  'deviationText',
  'metalMaterial',
  'condition',
  'amount',
  'dueDate',
  'accountHolder',
  'iban',
  'orderNumber',
] as const

/** Spalte „Kanzlei: ja“ aus ANFORDERUNGEN §6 (Go-live verlangt `origin = lawyer`, DATENMODELL §13.7). */
export const LEGAL_SNIPPET_REQUIRES_LAWYER: readonly LegalSnippetKey[] = LEGAL_SNIPPET_KEYS.filter(
  (k) =>
    ![
      'product.noSpecialWarnings',
      'product.glassFrame',
      'email.pickup.ready',
      // Schutz des geistigen Eigentums (U-22): Juttas eigene Klauseln, keine Pflichttexte; Kanzlei-Durchsicht empfohlen
      'ip.copyrightNotice',
      'ip.aiMiningReservation',
      'ip.purchaseClause',
      'ip.tattooFlashNotice',
    ].includes(k),
)

const TOKEN_RE = /\{\{([^{}]*)\}\}/g
const ALLOWED_TOKENS = new Set<string>([...LEGAL_TOKENS, ...SNIPPET_CONTEXT_TOKENS])
const CONTEXT_TOKENS = new Set<string>(SNIPPET_CONTEXT_TOKENS)

/** Tokens eines Texts (`{{deliveryTime}}` → `deliveryTime`). */
export function snippetTokens(text: string): string[] {
  return [...text.matchAll(TOKEN_RE)].map((m) => m[1]!)
}

/**
 * Erlaubte Kontext-Tokens je Schlüssel: genau die, die seine Arbeitsfassung (Grund-Seed, ANFORDERUNGEN §6) nennt.
 * Neue Fassungen dürfen daneben nur die Tokens aus R-012 verwenden (DATENMODELL §6.28).
 */
export const SNIPPET_CONTEXT_TOKENS_BY_KEY: Readonly<Record<LegalSnippetKey, readonly string[]>> =
  Object.freeze(
    Object.fromEntries(
      LEGAL_SNIPPET_KEYS.map((key) => [
        key,
        [
          ...new Set(
            snippetTokens(LEGAL_SNIPPET_SEED[key].de).filter((t) => CONTEXT_TOKENS.has(t)),
          ),
        ],
      ]),
    ) as unknown as Record<LegalSnippetKey, readonly string[]>,
  )

/** Nicht erlaubte Tokens eines Bausteintexts für `key` (leer = in Ordnung); auch unvollständige Klammern. */
export function invalidSnippetTokens(key: LegalSnippetKey, text: string): string[] {
  const allowed = new Set<string>([...LEGAL_TOKENS, ...(SNIPPET_CONTEXT_TOKENS_BY_KEY[key] ?? [])])
  const bad = [...text.matchAll(TOKEN_RE)].filter((m) => !allowed.has(m[1]!)).map((m) => m[0])
  if (/\{\{|\}\}/.test(text.replace(TOKEN_RE, ''))) bad.push('{{…}}')
  return [...new Set(bad)]
}

export class SnippetRenderError extends Error {
  constructor(
    readonly key: string,
    readonly unknownTokens: readonly string[] = [],
    readonly missingTokens: readonly string[] = [],
  ) {
    const parts: string[] = []
    if (unknownTokens.length) parts.push(`unbekannte Platzhalter: ${unknownTokens.join(', ')}`)
    if (missingTokens.length) parts.push(`ohne Wert: ${missingTokens.join(', ')}`)
    super(`Baustein ${key} nicht darstellbar (${parts.join('; ') || 'unbekannter Schlüssel'}).`)
    this.name = 'SnippetRenderError'
  }
}

export type SnippetVars = Readonly<Record<string, string | number | null | undefined>>

/**
 * Ersetzt die Platzhalter eines Bausteintexts. Unbekannte Platzhalter (weder R-012 noch Kontext-Token), Platzhalter
 * ohne Wert und unvollständige Klammern → `SnippetRenderError`.
 */
export function renderSnippetText(key: string, template: string, vars: SnippetVars = {}): string {
  const unknown: string[] = []
  const missing: string[] = []
  const text = template.replace(TOKEN_RE, (raw, name: string) => {
    if (!ALLOWED_TOKENS.has(name)) {
      unknown.push(raw)
      return raw
    }
    const value = vars[name]
    if (value === null || value === undefined || String(value).trim() === '') {
      missing.push(raw)
      return raw
    }
    return String(value)
  })
  if (unknown.length || missing.length || /\{\{|\}\}/.test(template.replace(TOKEN_RE, ''))) {
    throw new SnippetRenderError(key, [...new Set(unknown)], [...new Set(missing)])
  }
  return text
}

export const sha256Text = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')

// --- Speicherstand der Collection ----------------------------------------------------------------------------------

/** Eine veröffentlichte oder abgelöste Fassung im Speicher. */
export interface CachedSnippet {
  key: LegalSnippetKey
  version: number
  status: Extract<LegalTextStatus, 'active' | 'superseded'>
  validFrom: Date
  text: Record<Locale, string>
  origin: LegalTextOrigin
  /** SHA-256 (hex) des DE-Texts. */
  sha256: string
}

interface SnippetCache {
  loadedAt: number
  byKey: Map<LegalSnippetKey, CachedSnippet[]>
}

let cache: SnippetCache | null = null
let cachePayload: Payload | null = null
let refreshing: Promise<unknown> | null = null

type SnippetDoc = {
  key: LegalSnippetKey
  version: number
  status: LegalTextStatus
  validFrom: string
  text?: Partial<Record<Locale, string | null>> | string | null
  origin?: LegalTextOrigin | null
  sha256De?: string | null
}

function toCached(doc: SnippetDoc): CachedSnippet | null {
  if (doc.status !== 'active' && doc.status !== 'superseded') return null
  const t = typeof doc.text === 'string' ? { de: doc.text } : (doc.text ?? {})
  const de = t.de ?? ''
  if (!de) return null
  return {
    key: doc.key,
    version: doc.version,
    status: doc.status,
    validFrom: new Date(doc.validFrom),
    text: { de, en: t.en || de },
    origin: doc.origin ?? 'draft',
    sha256: doc.sha256De || sha256Text(de),
  }
}

/**
 * Liest alle veröffentlichten und abgelösten Fassungen (alle Sprachen) und ersetzt den Speicherstand. Mit `req` liest
 * die Funktion in dessen Transaktion und übernimmt den Stand nicht (die Transaktion könnte scheitern).
 */
export async function loadLegalSnippets(
  payload: Payload,
  options: { req?: PayloadRequest } = {},
): Promise<ReadonlyMap<LegalSnippetKey, readonly CachedSnippet[]>> {
  const res = await payload.find({
    collection: 'legal-snippets',
    where: { status: { in: ['active', 'superseded'] } },
    locale: 'all',
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req: options.req,
  })
  const byKey = new Map<LegalSnippetKey, CachedSnippet[]>()
  for (const doc of res.docs as unknown as SnippetDoc[]) {
    const entry = toCached(doc)
    if (!entry) continue
    const list = byKey.get(entry.key) ?? []
    list.push(entry)
    byKey.set(entry.key, list)
  }
  for (const list of byKey.values()) {
    list.sort((a, b) => b.validFrom.getTime() - a.validFrom.getTime() || b.version - a.version)
  }
  cachePayload = payload
  if (!options.req) cache = { loadedAt: performance.now(), byKey }
  return byKey
}

/** Beim Start (`onInit`): Speicherstand laden; fehlt die Tabelle (Migration läuft noch), nur protokollieren. */
export async function initLegalSnippets(payload: Payload): Promise<void> {
  cachePayload = payload
  try {
    await loadLegalSnippets(payload)
  } catch (err) {
    log.warn('legal.snippets_load_failed', { reason: (err as Error)?.message })
  }
}

/** Nach einer Aktivierung: Speicherstand gilt als veraltet; der nächste Aufruf liest im Hintergrund neu. */
export function invalidateLegalSnippets(): void {
  if (cache) cache.loadedAt = Number.NEGATIVE_INFINITY
}

/** Nur für Tests: Speicherstand verwerfen (danach gelten die Seed-Texte als Rückfall). */
export function resetLegalSnippetCache(): void {
  cache = null
  cachePayload = null
  refreshing = null
}

function refreshInBackground(): void {
  if (!cache || !cachePayload || refreshing) return
  if (performance.now() - cache.loadedAt < SNIPPET_CACHE_TTL_MS) return
  refreshing = loadLegalSnippets(cachePayload)
    .catch((err: unknown) =>
      log.warn('legal.snippets_refresh_failed', { reason: (err as Error)?.message }),
    )
    .finally(() => {
      refreshing = null
    })
}

/** Gültige Fassung eines Schlüssels: ohne `at` die aktive, sonst die mit spätestem `validFrom ≤ at`. */
function pick(
  list: readonly CachedSnippet[] | undefined,
  at: Date | undefined,
): CachedSnippet | null {
  if (!list?.length) return null
  if (!at) return list.find((s) => s.status === 'active') ?? null
  return list.find((s) => s.validFrom.getTime() <= at.getTime()) ?? null
}

export interface RenderedSnippet {
  key: LegalSnippetKey
  locale: Locale
  text: string
  /** Fassung aus `legal-snippets` (`"1"`, `"2"` …) bzw. `draft-1` (Rückfall Arbeitsfassung). */
  version: string
  origin: LegalTextOrigin
  /** SHA-256 des DE-Texts der Fassung (für Kasse, Bestellung, `consent-log`). */
  sha256: string
}

const isSnippetKey = (key: string): key is LegalSnippetKey =>
  (LEGAL_SNIPPET_KEYS as readonly string[]).includes(key)

/**
 * Baustein in `locale` mit ersetzten Platzhaltern – gültige Fassung aus `legal-snippets` (ohne `at` die aktive).
 * Unbekannter Schlüssel, unbekannter Platzhalter (weder R-012 noch Kontext-Token) oder Platzhalter ohne Wert →
 * `SnippetRenderError` (Muster R-012; nie rohe Tokens anzeigen).
 */
export function getSnippet(
  key: LegalSnippetKey,
  locale: Locale,
  vars: SnippetVars = {},
  at?: Date,
): RenderedSnippet {
  if (!isSnippetKey(key)) throw new SnippetRenderError(String(key))
  refreshInBackground()
  const found = pick(cache?.byKey.get(key), at)
  if (found) {
    return {
      key,
      locale,
      text: renderSnippetText(key, found.text[locale], vars),
      version: String(found.version),
      origin: found.origin,
      sha256: found.sha256,
    }
  }
  if (cache) log.warn('legal.snippet_missing', { key })
  const seed = LEGAL_SNIPPET_SEED[key]
  return {
    key,
    locale,
    text: renderSnippetText(key, seed[locale], vars),
    version: LEGAL_SNIPPET_DRAFT_VERSION,
    origin: seed.origin,
    sha256: sha256Text(seed.de),
  }
}
