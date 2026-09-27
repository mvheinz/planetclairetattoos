import 'server-only'

import { createHash } from 'node:crypto'

import type { PayloadRequest } from 'payload'

import type { Locale } from '@/lib/enums'
import { getEnv } from '@/lib/env'
import { preservingReq } from '@/lib/payload/localReq'
import { shippingTableText, type ShippingTableSettings } from '@/lib/shop/shippingTable'

// Renderer der Rechtstexte (DATENMODELL §6.12, RECHT R-012): ersetzt genau die Tokens der kanonischen Liste
// (gleichlautend mit KANZLEI-BRIEFING §16.3). Keine Aliase, keine weiteren Schreibweisen. Ein unbekanntes oder nicht
// ersetzbares Token ist ein Render-Fehler (Aktivieren gesperrt, öffentliche Seiten zeigen nie rohe Tokens).
// `{{STEUERNUMMER}}` gibt es bewusst nicht (E-46, R-020). Nur `{{wIdNr}}`/`{{ustIdNr}}` dürfen leer ersetzt werden.

export const LEGAL_TOKENS = [
  'name',
  'street',
  'postalCode',
  'city',
  'email',
  'phone',
  'wIdNr',
  'ustIdNr',
  'siteUrl',
  'withdrawalUrl',
  'shippingTable',
  'deliveryTime',
  'vorkasseDays',
  'returnCostsNote',
] as const
export type LegalToken = (typeof LEGAL_TOKENS)[number]

/** Die einzigen Tokens, die leer ersetzt werden dürfen (R-012). */
export const LEGAL_TOKENS_MAY_BE_EMPTY: ReadonlySet<LegalToken> = new Set<LegalToken>([
  'wIdNr',
  'ustIdNr',
])

/** Pfad der Widerrufsfunktion R26 je Sprache (KONZEPT §2.2). */
export const WITHDRAWAL_PATHS: Readonly<Record<Locale, string>> = Object.freeze({
  de: '/de/vertrag-widerrufen',
  en: '/en/withdraw-from-contract',
})

const KNOWN = new Set<string>(LEGAL_TOKENS)
const TOKEN_RE = /\{\{([^{}]*)\}\}/g

export type LegalTokenValues = Partial<Record<LegalToken, string | null | undefined>>

export class LegalRenderError extends Error {
  constructor(
    readonly unknownTokens: readonly string[],
    readonly missingTokens: readonly string[],
    readonly malformed = false,
  ) {
    const parts: string[] = []
    if (unknownTokens.length) parts.push(`unbekannte Platzhalter: ${unknownTokens.join(', ')}`)
    if (missingTokens.length) parts.push(`ohne Wert: ${missingTokens.join(', ')}`)
    if (malformed) parts.push('unvollständige Platzhalter-Klammern')
    super(`Rechtstext nicht darstellbar (${parts.join('; ')}).`)
    this.name = 'LegalRenderError'
  }
}

function valueOf(token: string, values: LegalTokenValues): string | null {
  if (!KNOWN.has(token)) return null
  const v = values[token as LegalToken]
  if (typeof v === 'string' && v.trim() !== '') return v
  if (LEGAL_TOKENS_MAY_BE_EMPTY.has(token as LegalToken)) return ''
  return null
}

interface Scan {
  unknown: string[]
  missing: string[]
  malformed: boolean
}

function scan(text: string, values: LegalTokenValues, acc: Scan): string {
  const out = text.replace(TOKEN_RE, (raw, inner: string) => {
    if (!KNOWN.has(inner)) {
      acc.unknown.push(raw)
      return raw
    }
    const v = valueOf(inner, values)
    if (v === null) {
      acc.missing.push(raw)
      return raw
    }
    return v
  })
  // Reste wie `{{name` (über Formatgrenzen geteilte oder unvollständige Tokens) gelten als Fehler.
  if (/\{\{|\}\}/.test(text.replace(TOKEN_RE, ''))) acc.malformed = true
  return out
}

function fail(acc: Scan): void {
  if (acc.unknown.length || acc.missing.length || acc.malformed) {
    throw new LegalRenderError([...new Set(acc.unknown)], [...new Set(acc.missing)], acc.malformed)
  }
}

/** Ersetzt die Tokens in einem Text; wirft `LegalRenderError` bei unbekannten oder unersetzten Tokens. */
export function renderLegalString(text: string, values: LegalTokenValues): string {
  const acc: Scan = { unknown: [], missing: [], malformed: false }
  const out = scan(text, values, acc)
  fail(acc)
  return out
}

// --- Lexical -------------------------------------------------------------------------------------------------------

type LexicalNode = { type?: string; text?: string; children?: LexicalNode[]; [k: string]: unknown }
export interface LexicalContent {
  root: LexicalNode
  [k: string]: unknown
}

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'listitem', 'quote'])

function renderNode(node: LexicalNode, values: LegalTokenValues, acc: Scan): LexicalNode[] {
  if (node.type === 'text' && typeof node.text === 'string') {
    const text = scan(node.text, values, acc)
    // Mehrzeilige Werte (z. B. `{{shippingTable}}`) werden zu Zeilenumbrüchen.
    const lines = text.split('\n')
    return lines.flatMap((line, i) => {
      const parts: LexicalNode[] = []
      if (i > 0) parts.push({ type: 'linebreak', version: 1 })
      if (line !== '' || lines.length === 1) parts.push({ ...node, text: line })
      return parts
    })
  }
  if (Array.isArray(node.children)) {
    return [{ ...node, children: node.children.flatMap((c) => renderNode(c, values, acc)) }]
  }
  return [node]
}

function plainText(node: LexicalNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (node.type === 'linebreak') return '\n'
  const inner = (node.children ?? []).map(plainText).join('')
  return BLOCK_TYPES.has(node.type ?? '') ? `${inner}\n` : inner
}

/** Klartext eines Lexical-Inhalts (Absätze durch Zeilenumbruch getrennt), Grundlage des Hashes. */
export function legalPlainText(content: LexicalContent | null | undefined): string {
  if (!content?.root) return ''
  return plainText(content.root).replace(/\n+$/, '')
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

export interface RenderedLegalContent {
  content: LexicalContent
  plainText: string
  sha256: string
}

/** Rendert einen Lexical-Inhalt mit Tokenwerten; wirft `LegalRenderError` (R-012). */
export function renderLegalContent(
  content: LexicalContent,
  values: LegalTokenValues,
): RenderedLegalContent {
  const acc: Scan = { unknown: [], missing: [], malformed: false }
  const [root] = renderNode(content.root, values, acc)
  fail(acc)
  const rendered: LexicalContent = { ...content, root: root! }
  const text = legalPlainText(rendered)
  return { content: rendered, plainText: text, sha256: sha256Hex(text) }
}

// --- Werte ---------------------------------------------------------------------------------------------------------

export interface LegalTokenSettings {
  business?: {
    legalName?: string | null
    tradeName?: string | null
    street?: string | null
    postalCode?: string | null
    city?: string | null
    email?: string | null
    phone?: string | null
    economicId?: string | null
    vatId?: string | null
  } | null
  shipping?: (ShippingTableSettings & { deliveryTimeText?: string | null }) | null
  payment?: { prepaymentDays?: number | null } | null
}

export interface LegalTokenInput {
  /** Global `settings` in der Sprache der Fassung (`deliveryTimeText` ist lokalisiert). */
  settings: LegalTokenSettings
  /** `NEXT_PUBLIC_SITE_URL` ohne `/` am Ende. */
  siteUrl: string
  locale: Locale
  /**
   * Text des aktiven Bausteins `withdrawal.returnCostsNote` (RECHT §6). Bausteine gibt es ab P3.3
   * (`src/lib/legal/snippets.ts`) bzw. P6 (`legal-snippets`); ohne Wert ist `{{returnCostsNote}}` nicht ersetzbar.
   */
  returnCostsNote?: string | null
}

/** Tokenwerte aus `settings` und `NEXT_PUBLIC_SITE_URL` (Tabelle R-012). */
export function buildLegalTokenValues(input: LegalTokenInput): LegalTokenValues {
  const b = input.settings.business ?? {}
  const shipping = input.settings.shipping ?? {}
  const base = input.siteUrl.replace(/\/+$/, '')
  const name =
    b.legalName && b.tradeName ? `${b.legalName}, ${b.tradeName}` : (b.legalName ?? undefined)
  const days = input.settings.payment?.prepaymentDays
  return {
    name,
    street: b.street,
    postalCode: b.postalCode,
    city: b.city,
    email: b.email,
    phone: b.phone,
    wIdNr: b.economicId ?? '',
    ustIdNr: b.vatId ?? '',
    siteUrl: base,
    withdrawalUrl: base ? `${base}${WITHDRAWAL_PATHS[input.locale]}` : undefined,
    shippingTable: shippingTableText(shipping, input.locale),
    deliveryTime: shipping.deliveryTimeText,
    vorkasseDays: typeof days === 'number' ? String(days) : undefined,
    returnCostsNote: input.returnCostsNote,
  }
}

/** Lädt `settings` in der Sprache `locale` und bildet die Tokenwerte (gleiche Transaktion wie `req`). */
export async function loadLegalTokenValues(
  req: PayloadRequest,
  locale: Locale,
  options: { returnCostsNote?: string | null } = {},
): Promise<LegalTokenValues> {
  const settings = await preservingReq(req, () =>
    req.payload.findGlobal({ slug: 'settings', locale, depth: 0, overrideAccess: true, req }),
  )
  return buildLegalTokenValues({
    settings: settings as unknown as LegalTokenSettings,
    siteUrl: getEnv().NEXT_PUBLIC_SITE_URL,
    locale,
    returnCostsNote: options.returnCostsNote,
  })
}
