import 'server-only'

import { sql } from '@payloadcms/db-postgres'
import { convertLexicalToHTML } from '@payloadcms/richtext-lexical/html'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { PayloadRequest } from 'payload'

import { VALID_FROM_TOLERANCE_MS } from '@/collections/LegalTexts'
import { LEGAL_TEXT_VERSION_TYPES } from '@/fields/legalTextVersions'
import { writeAudit } from '@/lib/audit'
import { TransitionError } from '@/lib/commerce/transitionError'
import {
  LEGAL_SNIPPET_KEYS,
  LEGAL_TEXT_TYPES,
  type LegalSnippetKey,
  type LegalTextOrigin,
  type LegalTextStatus,
  type LegalTextType,
  type Locale,
} from '@/lib/enums'
import { poolDb } from '@/lib/jobs/runLog'
import { requestNow } from '@/lib/payload/context'
import { inTransaction } from '@/lib/payload/transaction'
import { berlinDateKey, berlinDayStart } from '@/lib/time'

import {
  activateLegalSnippet,
  activateLegalText,
  checkLegalSnippet,
  checkLegalText,
  type ActivateLegalSnippetResult,
  type ActivateLegalTextResult,
} from './activate'
import { legalInputToLexical, type LegalInputFormat } from './htmlToLexical'
import {
  LegalRenderError,
  loadLegalTokenValues,
  renderLegalContent,
  type LexicalContent,
} from './render'
import { berlinDaysBetween, loadLegalReviewStates, setLegalReviewDates } from './review'
import { LEGAL_SNIPPET_REQUIRES_LAWYER, SNIPPET_CONTEXT_TOKENS } from './snippets'

// Bereich „Rechtstexte“ der Ansicht „Texte“ (PLAN P6.4, KONZEPT §7.13): Übersicht je Rechtstext-Typ und Baustein,
// Vorschau einer neuen Fassung (rendert mit Tokens und zeigt die Fehlerliste, speichert nichts), Veröffentlichen
// (Entwurf anlegen und über `activateLegalText`/`activateLegalSnippet` sofort aktivieren oder ab Datum planen – alles
// in einer Transaktion; scheitert eine Prüfung, bleibt nichts zurück) und „Geprüft, keine Änderung“
// (`settings.legal.reviews[type].reviewedAt`, Audit `legal_review_confirmed`, R-014).

const LOCALES = ['de', 'en'] as const

/** Herkunft, die Jutta wählen darf (`placeholder` nur Grund-Seed, KONZEPT §7.13). */
export const ADMIN_LEGAL_ORIGINS = ['draft', 'lawyer'] as const
export type AdminLegalOrigin = (typeof ADMIN_LEGAL_ORIGINS)[number]

export class LegalAdminError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message)
    this.name = 'LegalAdminError'
  }
}

// --- Übersicht ------------------------------------------------------------------------------------------------------

export interface LegalVersionRow {
  id: number
  version: number
  versionLabel: string
  status: LegalTextStatus
  origin: LegalTextOrigin
  validFrom: string
  activatedAt: string | null
  /** Bestellungen mit dieser Fassung (`orders.legalTextVersions.*`). */
  orderCount: number
}

export interface LegalTextOverviewRow {
  type: LegalTextType
  active: LegalVersionRow | null
  /** Alter der aktiven Fassung in Berliner Kalendertagen seit „gültig ab“. */
  ageDays: number | null
  /** Datum der letzten Prüfung (jüngeres aus Aktivierung und „Geprüft“, R-014). */
  lastReviewedAt: string | null
  reviewDue: boolean
  /** Geplante Fassungen und frühere Fassungen (neueste zuerst). */
  versions: LegalVersionRow[]
}

/** Bestellungen je Rechtstext-Fassung über alle Felder `orders.legalTextVersions.*`. */
export async function legalTextOrderCounts(req: PayloadRequest): Promise<Map<number, number>> {
  const cols = Object.keys(LEGAL_TEXT_VERSION_TYPES).map(
    (k) => `legal_text_versions_${k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)}_id`,
  )
  const union = sql.join(
    cols.map((c) => sql`SELECT ${sql.identifier(c)} AS id FROM orders`),
    sql` UNION ALL `,
  )
  const res = (await poolDb(req.payload).execute(sql`
    SELECT id, count(*)::int AS n FROM (${union}) t WHERE id IS NOT NULL GROUP BY id
  `)) as unknown as { rows: { id: number; n: number }[] }
  return new Map(res.rows.map((r) => [Number(r.id), Number(r.n)]))
}

type TextDoc = {
  id: number
  type: LegalTextType
  version: number
  versionLabel?: string | null
  status: LegalTextStatus
  origin?: LegalTextOrigin | null
  validFrom: string
  activatedAt?: string | null
}

export async function loadLegalTextsOverview(
  req: PayloadRequest,
  now: Date = requestNow(req),
): Promise<LegalTextOverviewRow[]> {
  const [docs, counts, reviews] = await Promise.all([
    req.payload.find({
      collection: 'legal-texts',
      where: { status: { in: ['active', 'scheduled', 'superseded'] } },
      sort: ['-version'],
      select: {
        type: true,
        version: true,
        versionLabel: true,
        status: true,
        origin: true,
        validFrom: true,
        activatedAt: true,
      },
      depth: 0,
      pagination: false,
      overrideAccess: true,
      req,
    }),
    legalTextOrderCounts(req),
    loadLegalReviewStates(req.payload, now, req),
  ])
  const rows = (docs.docs as unknown as TextDoc[]).map((d): LegalVersionRow => ({
    id: d.id,
    version: d.version,
    versionLabel: d.versionLabel ?? `v${d.version}`,
    status: d.status,
    origin: d.origin ?? 'draft',
    validFrom: d.validFrom,
    activatedAt: d.activatedAt ?? null,
    orderCount: counts.get(d.id) ?? 0,
  }))
  const typeOf = new Map((docs.docs as unknown as TextDoc[]).map((d) => [d.id, d.type]))
  return LEGAL_TEXT_TYPES.map((type) => {
    const versions = rows.filter((r) => typeOf.get(r.id) === type)
    const active = versions.find((v) => v.status === 'active') ?? null
    const review = reviews.find((r) => r.type === type)
    return {
      type,
      active,
      ageDays: active ? berlinDaysBetween(new Date(active.validFrom), now) : null,
      lastReviewedAt: review?.lastReviewedAt ?? null,
      reviewDue: review?.due ?? false,
      versions: versions.filter((v) => v.status !== 'active'),
    }
  })
}

export interface LegalSnippetOverviewRow {
  key: LegalSnippetKey
  requiresLawyer: boolean
  active: Omit<LegalVersionRow, 'orderCount' | 'versionLabel'> | null
  scheduled: number
  superseded: number
}

type SnippetDoc = {
  id: number
  key: LegalSnippetKey
  version: number
  status: LegalTextStatus
  origin?: LegalTextOrigin | null
  validFrom: string
  activatedAt?: string | null
}

export async function loadLegalSnippetsOverview(
  req: PayloadRequest,
): Promise<LegalSnippetOverviewRow[]> {
  const res = await req.payload.find({
    collection: 'legal-snippets',
    where: { status: { in: ['active', 'scheduled', 'superseded'] } },
    select: {
      key: true,
      version: true,
      status: true,
      origin: true,
      validFrom: true,
      activatedAt: true,
    },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    req,
  })
  const docs = res.docs as unknown as SnippetDoc[]
  return [...LEGAL_SNIPPET_KEYS].sort().map((key) => {
    const mine = docs.filter((d) => d.key === key)
    const a = mine.find((d) => d.status === 'active')
    return {
      key,
      requiresLawyer: LEGAL_SNIPPET_REQUIRES_LAWYER.includes(key),
      active: a
        ? {
            id: a.id,
            version: a.version,
            status: a.status,
            origin: a.origin ?? 'draft',
            validFrom: a.validFrom,
            activatedAt: a.activatedAt ?? null,
          }
        : null,
      scheduled: mine.filter((d) => d.status === 'scheduled').length,
      superseded: mine.filter((d) => d.status === 'superseded').length,
    }
  })
}

// --- Eingabe --------------------------------------------------------------------------------------------------------

export interface LegalTextInput {
  type: LegalTextType
  format: LegalInputFormat
  de: string
  en?: string | null
  origin: AdminLegalOrigin
  sourceNote?: string | null
  changeNote?: string | null
  /** ISO-Zeitpunkt „gültig ab“; leer = sofort. */
  validFrom?: string | null
}

export interface LegalSnippetInput {
  key: LegalSnippetKey
  de: string
  en?: string | null
  origin: AdminLegalOrigin
  changeNote?: string | null
  validFrom?: string | null
}

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

/**
 * „Gültig ab“: leer = sofort; `JJJJ-MM-TT` = Beginn des Berliner Tags (heute = sofort); sonst ISO-Zeitpunkt.
 */
export function parseValidFrom(v: unknown, now?: Date): Date | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const start = berlinDayStart(new Date(`${v}T12:00:00Z`))
    if (Number.isNaN(start.getTime())) {
      throw new LegalAdminError('„Gültig ab“ ist kein gültiges Datum.')
    }
    return now && berlinDateKey(start) === berlinDateKey(now) ? null : start
  }
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) throw new LegalAdminError('„Gültig ab“ ist kein gültiges Datum.')
  return d
}

function parseOrigin(v: unknown): AdminLegalOrigin {
  if ((ADMIN_LEGAL_ORIGINS as readonly unknown[]).includes(v)) return v as AdminLegalOrigin
  throw new LegalAdminError('Bitte die Herkunft wählen (Arbeitsfassung oder Kanzlei).')
}

/** Rumpf einer Anfrage → geprüfte Eingabe eines Rechtstexts. */
export function parseLegalTextInput(body: Record<string, unknown>): LegalTextInput {
  if (!(LEGAL_TEXT_TYPES as readonly unknown[]).includes(body.type)) {
    throw new LegalAdminError('Unbekannter Rechtstext.')
  }
  const format: LegalInputFormat = body.format === 'text' ? 'text' : 'html'
  const de = typeof body.de === 'string' ? body.de : ''
  if (!de.trim()) throw new LegalAdminError('Bitte den deutschen Text einfügen.')
  if (de.length > 400_000) throw new LegalAdminError('Der Text ist zu lang.')
  const en = typeof body.en === 'string' && body.en.trim() ? body.en : null
  if (en && en.length > 400_000) throw new LegalAdminError('Der englische Text ist zu lang.')
  parseValidFrom(body.validFrom)
  return {
    type: body.type as LegalTextType,
    format,
    de,
    en,
    origin: parseOrigin(body.origin),
    sourceNote: str(body.sourceNote, 200),
    changeNote: str(body.changeNote, 300),
    validFrom: typeof body.validFrom === 'string' && body.validFrom ? body.validFrom : null,
  }
}

export function parseLegalSnippetInput(body: Record<string, unknown>): LegalSnippetInput {
  if (!(LEGAL_SNIPPET_KEYS as readonly unknown[]).includes(body.key)) {
    throw new LegalAdminError('Unbekannter Baustein.')
  }
  const de = typeof body.de === 'string' ? body.de.trim() : ''
  if (!de) throw new LegalAdminError('Bitte den deutschen Text einfügen.')
  if (de.length > 2000) throw new LegalAdminError('Der Text ist zu lang (höchstens 2000 Zeichen).')
  const en = typeof body.en === 'string' && body.en.trim() ? body.en.trim() : null
  if (en && en.length > 2000) throw new LegalAdminError('Der englische Text ist zu lang.')
  parseValidFrom(body.validFrom)
  return {
    key: body.key as LegalSnippetKey,
    de,
    en,
    origin: parseOrigin(body.origin),
    changeNote: str(body.changeNote, 300),
    validFrom: typeof body.validFrom === 'string' && body.validFrom ? body.validFrom : null,
  }
}

function validFromProblems(validFrom: Date, now: Date): string[] {
  return validFrom.getTime() < now.getTime() - VALID_FROM_TOLERANCE_MS
    ? ['„Gültig ab“ darf nicht in der Vergangenheit liegen.']
    : []
}

// --- Vorschau -------------------------------------------------------------------------------------------------------

export interface LegalPreview {
  /** Leer = veröffentlichbar. */
  errors: string[]
  /** Gerenderte Fassung je Sprache (HTML bzw. Text); bei Render-Fehlern mit rohen Platzhaltern. */
  html: Partial<Record<Locale, string>>
  validFrom: string
  scheduled: boolean
}

function contentOf(input: LegalTextInput): Partial<Record<Locale, LexicalContent>> {
  const de = legalInputToLexical(input.de, input.format)
  if (!de) throw new LegalAdminError('Nach der Bereinigung ist vom deutschen Text nichts übrig.')
  const en = input.en ? legalInputToLexical(input.en, input.format) : null
  return { de: de as LexicalContent, ...(en ? { en: en as LexicalContent } : {}) }
}

const toHtml = (c: LexicalContent) =>
  convertLexicalToHTML({ data: c as unknown as SerializedEditorState, disableContainer: true })

/** Vorschau eines Rechtstexts: rendert mit den aktuellen Werten, prüft wie beim Veröffentlichen, speichert nichts. */
export async function previewLegalText(
  req: PayloadRequest,
  input: LegalTextInput,
  now: Date = requestNow(req),
): Promise<LegalPreview> {
  const validFrom = parseValidFrom(input.validFrom, now) ?? now
  const content = contentOf(input)
  const check = await checkLegalText(req, { type: input.type, validFrom, content })
  const html: Partial<Record<Locale, string>> = {}
  for (const locale of LOCALES) {
    const c = content[locale]
    if (!c) continue
    try {
      html[locale] = toHtml(renderLegalContent(c, await loadLegalTokenValues(req, locale)).content)
    } catch (e) {
      if (!(e instanceof LegalRenderError)) throw e
      html[locale] = toHtml(c)
    }
  }
  return {
    errors: [...validFromProblems(validFrom, now), ...check.errors],
    html,
    validFrom: validFrom.toISOString(),
    scheduled: validFrom.getTime() > now.getTime() + VALID_FROM_TOLERANCE_MS,
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Vorschau eines Bausteins (Kontext-Platzhalter als ‹Name›). */
export async function previewLegalSnippet(
  req: PayloadRequest,
  input: LegalSnippetInput,
  now: Date = requestNow(req),
): Promise<LegalPreview> {
  const validFrom = parseValidFrom(input.validFrom, now) ?? now
  const text: Partial<Record<Locale, string>> = {
    de: input.de,
    ...(input.en ? { en: input.en } : {}),
  }
  const check = await checkLegalSnippet(req, { key: input.key, validFrom, text })
  const probe = Object.fromEntries(SNIPPET_CONTEXT_TOKENS.map((t) => [t, `‹${t}›`]))
  const html: Partial<Record<Locale, string>> = {}
  for (const locale of LOCALES) {
    const t = text[locale]
    if (!t) continue
    const vars: Record<string, string | null | undefined> = {
      ...probe,
      ...(await loadLegalTokenValues(req, locale)),
    }
    const out = t.replace(/\{\{([^{}]*)\}\}/g, (raw, name: string) => vars[name]?.trim() || raw)
    html[locale] = `<p>${escapeHtml(out).replace(/\n/g, '<br>')}</p>`
  }
  return {
    errors: [...validFromProblems(validFrom, now), ...check.errors],
    html,
    validFrom: validFrom.toISOString(),
    scheduled: validFrom.getTime() > now.getTime() + VALID_FROM_TOLERANCE_MS,
  }
}

// --- Veröffentlichen ------------------------------------------------------------------------------------------------

export interface PublishedLegalText extends ActivateLegalTextResult {
  version: number
  validFrom: string
}

/** Neue Rechtstext-Fassung anlegen und veröffentlichen (sofort `active` oder ab Datum `scheduled`). */
export async function publishLegalText(
  req: PayloadRequest,
  input: LegalTextInput,
  now: Date = requestNow(req),
): Promise<PublishedLegalText> {
  const validFrom = parseValidFrom(input.validFrom, now) ?? now
  const problems = validFromProblems(validFrom, now)
  if (problems.length) throw new LegalAdminError(problems.join(' '), 422)
  const content = contentOf(input)
  const context = { ...req.context, now: now.toISOString() }
  return inTransaction(req, async () => {
    const created = await req.payload.create({
      collection: 'legal-texts',
      locale: 'de',
      data: {
        type: input.type,
        status: 'draft',
        origin: input.origin,
        source: 'manual',
        validFrom: validFrom.toISOString(),
        content: content.de as never,
        sourceNote: input.sourceNote ?? undefined,
        changeNote: input.changeNote ?? undefined,
      },
      depth: 0,
      overrideAccess: true,
      req,
      context,
    })
    if (content.en) {
      await req.payload.update({
        collection: 'legal-texts',
        id: created.id,
        locale: 'en',
        data: { content: content.en as never },
        depth: 0,
        overrideAccess: true,
        req,
        context,
      })
    }
    const result = await activateLegalText(req, created.id, { now })
    return { ...result, version: created.version as number, validFrom: validFrom.toISOString() }
  })
}

export interface PublishedLegalSnippet extends ActivateLegalSnippetResult {
  version: number
  validFrom: string
}

export async function publishLegalSnippet(
  req: PayloadRequest,
  input: LegalSnippetInput,
  now: Date = requestNow(req),
): Promise<PublishedLegalSnippet> {
  const validFrom = parseValidFrom(input.validFrom, now) ?? now
  const problems = validFromProblems(validFrom, now)
  if (problems.length) throw new LegalAdminError(problems.join(' '), 422)
  const context = { ...req.context, now: now.toISOString() }
  return inTransaction(req, async () => {
    const created = await req.payload.create({
      collection: 'legal-snippets',
      locale: 'de',
      data: {
        key: input.key,
        status: 'draft',
        origin: input.origin,
        validFrom: validFrom.toISOString(),
        text: input.de,
        changeNote: input.changeNote ?? undefined,
      } as never,
      depth: 0,
      overrideAccess: true,
      req,
      context,
    })
    if (input.en) {
      await req.payload.update({
        collection: 'legal-snippets',
        id: created.id,
        locale: 'en',
        data: { text: input.en } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context,
      })
    }
    const result = await activateLegalSnippet(req, created.id, { now })
    return {
      ...result,
      version: (created as { version: number }).version,
      validFrom: validFrom.toISOString(),
    }
  })
}

// --- Prüfung bestätigen ---------------------------------------------------------------------------------------------

/** „Geprüft, keine Änderung“ (R-014): `reviewedAt = now` für den Typ, Audit `legal_review_confirmed`. */
export async function confirmLegalReview(
  req: PayloadRequest,
  type: LegalTextType,
  now: Date = requestNow(req),
): Promise<{ type: LegalTextType; reviewedAt: string }> {
  if (!(LEGAL_TEXT_TYPES as readonly string[]).includes(type)) {
    throw new LegalAdminError('Unbekannter Rechtstext.')
  }
  const active = await req.payload.count({
    collection: 'legal-texts',
    where: { and: [{ type: { equals: type } }, { status: { equals: 'active' } }] },
    overrideAccess: true,
    req,
  })
  if (active.totalDocs === 0) {
    throw new TransitionError('Ohne aktive Fassung gibt es nichts zu prüfen.', 409)
  }
  await setLegalReviewDates(req, [type], 'reviewedAt', now)
  await writeAudit(req, {
    action: 'legal_review_confirmed',
    entityCollection: 'settings',
    entityId: type,
    summary: `Rechtstext ${type} geprüft, keine Änderung`,
    changes: { reviewedAt: [null, now.toISOString()] },
  })
  return { type, reviewedAt: now.toISOString() }
}
