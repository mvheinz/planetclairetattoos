import 'server-only'

import type { PayloadRequest } from 'payload'

import { LEGAL_TEXT_TRANSITION, VALID_FROM_TOLERANCE_MS } from '@/collections/LegalTexts'
import { TASK_DEFS } from '@/jobs/index'
import { writeAudit } from '@/lib/audit'
import { TransitionError } from '@/lib/commerce/transitionError'
import type { LegalSnippetKey, LegalTextStatus, LegalTextType, Locale } from '@/lib/enums'
import { jobAlarm } from '@/lib/jobs/alarm'
import { createLogger } from '@/lib/monitoring/logger'
import { requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import { getTaxModeAt, type TaxSettings } from '@/lib/tax'

import { publishProblems } from './publishChecks'
import {
  LegalRenderError,
  legalPlainText,
  loadLegalTokenValues,
  renderLegalContent,
  type LegalTokenValues,
  type LexicalContent,
} from './render'
import {
  invalidateLegalSnippets,
  invalidSnippetTokens,
  sha256Text,
  SNIPPET_CONTEXT_TOKENS,
} from './snippets'
import { LEGAL_TOKENS_MAY_BE_EMPTY, type LegalToken } from './tokens'

// Aktivierung einer Rechtstext- oder Baustein-Fassung (DATENMODELL §6.12, §6.28, R-012) in einer Transaktion:
// `draft`/`scheduled` → `active` (validFrom ≤ jetzt) bzw. `draft` → `scheduled` (validFrom in der Zukunft; der Task
// `activateScheduledLegalTexts` ruft den Service am `validFrom` erneut auf, Weckzeit per `jobAlarm.bump`). Beim
// Aktivieren wird die bisher aktive Fassung desselben Typs bzw. Schlüssels `superseded`; `activatedAt` ist der Beginn
// der Prüf-Erinnerung (P6.20). Vorher müssen alle Sprachen fehlerfrei rendern und die Prüfungen aus KONZEPT §7.13
// bestehen (`publishProblems`) – sonst ist das Veröffentlichen gesperrt (HTTP 422). PDFs der Rechtstexte erzeugt der
// Task `renderLegalTextPdf`, eingereiht im selben Commit.

const log = createLogger()

export interface ActivateLegalTextOptions {
  /** Text für `{{returnCostsNote}}`; ohne Angabe der aktive Baustein `withdrawal.returnCostsNote`. */
  returnCostsNote?: string | null
  /** Neues „gültig ab“ (nur Entwürfe): sofort (≤ jetzt) oder geplant. */
  validFrom?: Date
  /** Zeitpunkt der Aktivierung; ohne Angabe die Uhr des Requests (`req.context.now`). */
  now?: Date
}

export interface ActivateLegalTextResult {
  id: number
  type: LegalTextType
  status: 'active' | 'scheduled'
  supersededId: number | null
  /** Job `renderLegalTextPdf` (nach dem Commit direkt ausführbar); `null` bei `scheduled`. */
  pdfJobId: number | string | null
}

export interface ActivateLegalSnippetResult {
  id: number
  key: LegalSnippetKey
  status: 'active' | 'scheduled'
  supersededId: number | null
}

type LocalizedContent = Partial<Record<Locale, LexicalContent | null>>
type LocalizedText = Partial<Record<Locale, string | null>>

const LOCALES = ['de', 'en'] as const
const TOKEN_RE = /\{\{([^{}]*)\}\}/g

function nowOf(req: PayloadRequest, options: ActivateLegalTextOptions): Date {
  return options.now ?? requestNow(req)
}

async function taxSettings(req: PayloadRequest): Promise<TaxSettings> {
  return (await preservingReq(req, () =>
    req.payload.findGlobal({ slug: 'settings', depth: 0, overrideAccess: true, req }),
  )) as unknown as TaxSettings
}

/** Geplante Fassung: Task `activateScheduledLegalTexts` am `validFrom` wecken (nach dem Commit, Fehler nur loggen). */
async function wakeAt(validFrom: Date): Promise<void> {
  await jobAlarm
    .bump(validFrom)
    .catch((err: unknown) =>
      log.warn('legal.activate_alarm_failed', { reason: (err as Error)?.message }),
    )
}

// --- Rechtstexte ---------------------------------------------------------------------------------------------------

export interface LegalVersionCheck {
  /** Prüfsummen je Sprache (Rechtstext: gerenderter Klartext; Baustein: gespeicherter Text). */
  hashes: Partial<Record<Locale, string>>
  /** Render- und Veröffentlichungsfehler (leer = veröffentlichbar). */
  errors: string[]
}

/**
 * Rendert eine Rechtstext-Fassung in allen vorhandenen Sprachen und prüft sie vor dem Veröffentlichen (R-012, R-095,
 * V-01, V-02). Speichert nichts – Grundlage auch für die Vorschau (P6.4).
 */
export async function checkLegalText(
  req: PayloadRequest,
  doc: { type: LegalTextType; validFrom: string | Date; content?: unknown },
  options: Pick<ActivateLegalTextOptions, 'returnCostsNote'> = {},
): Promise<LegalVersionCheck> {
  const content = (doc.content ?? {}) as LocalizedContent
  const errors: string[] = []
  const hashes: Partial<Record<Locale, string>> = {}
  if (!content.de?.root) return { hashes, errors: ['Der deutsche Text fehlt.'] }
  const rendered: Partial<Record<Locale, string>> = {}
  const withdrawalUrl: Partial<Record<Locale, string>> = {}
  for (const locale of LOCALES) {
    const c = content[locale]
    if (!c?.root) continue
    const values: LegalTokenValues = await loadLegalTokenValues(req, locale, options)
    withdrawalUrl[locale] = values.withdrawalUrl ?? undefined
    try {
      const r = renderLegalContent(c, values)
      hashes[locale] = r.sha256
      rendered[locale] = r.plainText
    } catch (e) {
      if (!(e instanceof LegalRenderError)) throw e
      errors.push(`${locale.toUpperCase()}: ${e.message}`)
      rendered[locale] = legalPlainText(c)
    }
  }
  const taxMode = getTaxModeAt(await taxSettings(req), new Date(doc.validFrom))
  for (const p of publishProblems({
    type: doc.type,
    rendered,
    rawJson: JSON.stringify(content),
    withdrawalUrl,
    taxMode,
  })) {
    errors.push(p.message)
  }
  return { hashes, errors }
}

export async function activateLegalText(
  req: PayloadRequest,
  id: number,
  options: ActivateLegalTextOptions = {},
): Promise<ActivateLegalTextResult> {
  const result = await inTransaction(req, async () => {
    const now = nowOf(req, options)
    let doc = await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'legal-texts',
        id,
        locale: 'all',
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )
    if (doc.status !== 'draft' && doc.status !== 'scheduled') {
      throw new TransitionError('Nur Entwürfe und geplante Fassungen lassen sich aktivieren.')
    }
    const context = {
      ...req.context,
      system: true,
      transition: LEGAL_TEXT_TRANSITION,
      now: now.toISOString(),
    }
    const update = (docId: number, data: Record<string, unknown>) =>
      preservingReq(req, () =>
        req.payload.update({
          collection: 'legal-texts',
          id: docId,
          data,
          depth: 0,
          overrideAccess: true,
          req,
          context,
        }),
      )
    if (options.validFrom) {
      if (doc.status !== 'draft') {
        throw new TransitionError('„Gültig ab“ lässt sich nur bei Entwürfen ändern.')
      }
      await update(id, { validFrom: options.validFrom.toISOString() })
      doc = { ...doc, validFrom: options.validFrom.toISOString() }
    }
    const validFrom = new Date(doc.validFrom)

    const check = await checkLegalText(req, doc, options)
    if (check.errors.length) throw new TransitionError(check.errors.join(' '), 422)

    if (validFrom.getTime() > now.getTime() + VALID_FROM_TOLERANCE_MS) {
      await update(id, {
        status: 'scheduled',
        contentSha256De: check.hashes.de ?? null,
        contentSha256En: check.hashes.en ?? null,
      })
      return {
        id,
        type: doc.type,
        status: 'scheduled' as const,
        supersededId: null,
        pdfJobId: null,
        wake: validFrom,
      }
    }

    const current = await preservingReq(req, () =>
      req.payload.find({
        collection: 'legal-texts',
        where: { and: [{ type: { equals: doc.type } }, { status: { equals: 'active' } }] },
        depth: 0,
        pagination: false,
        overrideAccess: true,
        req,
      }),
    )
    let supersededId: number | null = null
    for (const prev of current.docs) {
      if (prev.id === id) continue
      await update(prev.id, { status: 'superseded', supersededAt: now.toISOString() })
      supersededId = prev.id
      await writeAudit(req, {
        action: 'legal_text_superseded',
        entityCollection: 'legal-texts',
        entityId: prev.id,
        summary: `Rechtstext ${doc.type} ${prev.versionLabel ?? `v${prev.version}`} abgelöst`,
        changes: { status: ['active', 'superseded'] },
        transition: LEGAL_TEXT_TRANSITION,
      })
    }
    await update(id, {
      status: 'active',
      activatedAt: now.toISOString(),
      contentSha256De: check.hashes.de ?? null,
      contentSha256En: check.hashes.en ?? null,
    })
    // PDFs DE/EN per Job `renderLegalTextPdf` im selben Commit; Werte zum Aktivierungszeitpunkt eingefroren.
    const job = await req.payload.jobs.queue({
      task: 'renderLegalTextPdf',
      input: { legalTextId: id },
      queue: TASK_DEFS.renderLegalTextPdf.queue,
      req,
    })
    await writeAudit(req, {
      action: 'legal_text_activated',
      entityCollection: 'legal-texts',
      entityId: id,
      summary: `Rechtstext ${doc.type} ${doc.versionLabel ?? `v${doc.version}`} veröffentlicht`,
      changes: { status: [doc.status, 'active'] },
      transition: LEGAL_TEXT_TRANSITION,
    })
    return {
      id,
      type: doc.type,
      status: 'active' as const,
      supersededId,
      pdfJobId: job.id,
      wake: null,
    }
  })
  const { wake, ...out } = result
  if (wake) await wakeAt(wake)
  return out
}

// --- Bausteine -----------------------------------------------------------------------------------------------------

/** Kontext-Tokens für die Prüfung: Platzhalterwert, damit nur die Tokens aus R-012 echte Werte brauchen. */
const CONTEXT_PROBE: Readonly<Record<string, string>> = Object.fromEntries(
  SNIPPET_CONTEXT_TOKENS.map((t) => [t, `‹${t}›`]),
)

/** Prüft eine Baustein-Fassung vor dem Veröffentlichen (Tokens laut §6.28, R-012-Werte vorhanden, V-01, V-02). */
export async function checkLegalSnippet(
  req: PayloadRequest,
  doc: { key: LegalSnippetKey; validFrom: string | Date; text?: unknown },
): Promise<LegalVersionCheck> {
  const text = (typeof doc.text === 'string' ? { de: doc.text } : (doc.text ?? {})) as LocalizedText
  const errors: string[] = []
  const hashes: Partial<Record<Locale, string>> = {}
  if (!text.de?.trim()) return { hashes, errors: ['Der deutsche Text fehlt.'] }
  const rendered: Partial<Record<Locale, string>> = {}
  for (const locale of LOCALES) {
    const t = text[locale]
    if (!t?.trim()) continue
    hashes[locale] = sha256Text(t)
    const bad = invalidSnippetTokens(doc.key, t)
    if (bad.length) {
      errors.push(`${locale.toUpperCase()}: unbekannte Platzhalter: ${bad.join(', ')}`)
      rendered[locale] = t
      continue
    }
    const vars: Record<string, string | null | undefined> = {
      ...CONTEXT_PROBE,
      ...(await loadLegalTokenValues(req, locale)),
    }
    // Gleiche Regel wie der Renderer der Rechtstexte: ein R-012-Token ohne Wert ist ein Fehler.
    const missing = [...t.matchAll(TOKEN_RE)]
      .map((m) => m[1]!)
      .filter((name) => {
        const v = vars[name]
        return !LEGAL_TOKENS_MAY_BE_EMPTY.has(name as LegalToken) && !(v ?? '').trim()
      })
    if (missing.length) {
      const list = [...new Set(missing)].map((m) => `{{${m}}}`).join(', ')
      errors.push(`${locale.toUpperCase()}: ohne Wert: ${list}`)
    }
    rendered[locale] = t.replace(TOKEN_RE, (_raw, name: string) => vars[name] ?? '')
  }
  const taxMode = getTaxModeAt(await taxSettings(req), new Date(doc.validFrom))
  for (const p of publishProblems({
    type: null,
    rendered,
    rawJson: JSON.stringify(text),
    withdrawalUrl: {},
    taxMode,
  })) {
    errors.push(p.message)
  }
  return { hashes, errors }
}

export async function activateLegalSnippet(
  req: PayloadRequest,
  id: number,
  options: Pick<ActivateLegalTextOptions, 'validFrom' | 'now'> = {},
): Promise<ActivateLegalSnippetResult> {
  const result = await inTransaction(req, async () => {
    const now = nowOf(req, options)
    let doc = await preservingReq(req, () =>
      req.payload.findByID({
        collection: 'legal-snippets',
        id,
        locale: 'all',
        depth: 0,
        overrideAccess: true,
        req,
      }),
    )
    const status = doc.status as LegalTextStatus
    if (status !== 'draft' && status !== 'scheduled') {
      throw new TransitionError('Nur Entwürfe und geplante Fassungen lassen sich aktivieren.')
    }
    const context = {
      ...req.context,
      system: true,
      transition: LEGAL_TEXT_TRANSITION,
      now: now.toISOString(),
    }
    const update = (docId: number, data: Record<string, unknown>) =>
      preservingReq(req, () =>
        req.payload.update({
          collection: 'legal-snippets',
          id: docId,
          data,
          depth: 0,
          overrideAccess: true,
          req,
          context,
        }),
      )
    if (options.validFrom) {
      if (status !== 'draft') {
        throw new TransitionError('„Gültig ab“ lässt sich nur bei Entwürfen ändern.')
      }
      await update(id, { validFrom: options.validFrom.toISOString() })
      doc = { ...doc, validFrom: options.validFrom.toISOString() }
    }
    const validFrom = new Date(doc.validFrom)
    const check = await checkLegalSnippet(req, doc)
    if (check.errors.length) throw new TransitionError(check.errors.join(' '), 422)

    if (validFrom.getTime() > now.getTime() + VALID_FROM_TOLERANCE_MS) {
      await update(id, {
        status: 'scheduled',
        sha256De: check.hashes.de ?? null,
        sha256En: check.hashes.en ?? null,
      })
      return {
        id,
        key: doc.key,
        status: 'scheduled' as const,
        supersededId: null,
        wake: validFrom,
      }
    }

    const current = await preservingReq(req, () =>
      req.payload.find({
        collection: 'legal-snippets',
        where: { and: [{ key: { equals: doc.key } }, { status: { equals: 'active' } }] },
        depth: 0,
        pagination: false,
        overrideAccess: true,
        req,
      }),
    )
    let supersededId: number | null = null
    for (const prev of current.docs) {
      if (prev.id === id) continue
      await update(prev.id, { status: 'superseded', supersededAt: now.toISOString() })
      supersededId = prev.id
      await writeAudit(req, {
        action: 'legal_snippet_superseded',
        entityCollection: 'legal-snippets',
        entityId: prev.id,
        summary: `Baustein ${doc.key} v${prev.version} abgelöst`,
        changes: { status: ['active', 'superseded'] },
        transition: LEGAL_TEXT_TRANSITION,
      })
    }
    await update(id, {
      status: 'active',
      activatedAt: now.toISOString(),
      sha256De: check.hashes.de ?? null,
      sha256En: check.hashes.en ?? null,
    })
    await writeAudit(req, {
      action: 'legal_snippet_activated',
      entityCollection: 'legal-snippets',
      entityId: id,
      summary: `Baustein ${doc.key} v${doc.version} veröffentlicht`,
      changes: { status: [status, 'active'] },
      transition: LEGAL_TEXT_TRANSITION,
    })
    return { id, key: doc.key, status: 'active' as const, supersededId, wake: null }
  })
  const { wake, ...out } = result
  invalidateLegalSnippets()
  if (wake) await wakeAt(wake)
  return out
}

// --- Geplante Fassungen --------------------------------------------------------------------------------------------

export type LegalVersionCollection = 'legal-texts' | 'legal-snippets'

export interface ActivateScheduledResult {
  activated: { collection: LegalVersionCollection; id: number }[]
  failed: { collection: LegalVersionCollection; id: number; reason: string }[]
  /** Nächstes `validFrom` einer noch geplanten Fassung (Weckzeit) oder `null`. */
  nextDueAt: Date | null
}

/**
 * Aktiviert alle geplanten Fassungen mit `validFrom ≤ now` (in `validFrom`-Reihenfolge, jede in eigener Transaktion
 * über `makeReq`). Zustandsbasiert: ein zweiter Lauf findet nichts mehr.
 */
export async function activateScheduledLegalVersions(
  makeReq: () => Promise<PayloadRequest>,
  now: Date,
): Promise<ActivateScheduledResult> {
  const out: ActivateScheduledResult = { activated: [], failed: [], nextDueAt: null }
  const probe = await makeReq()
  for (const collection of ['legal-texts', 'legal-snippets'] as const) {
    const due = await probe.payload.find({
      collection,
      where: { status: { equals: 'scheduled' } },
      sort: ['validFrom', 'version'],
      depth: 0,
      pagination: false,
      overrideAccess: true,
      select: { validFrom: true, version: true },
    })
    for (const doc of due.docs) {
      const validFrom = new Date(String(doc.validFrom))
      if (validFrom.getTime() > now.getTime() + VALID_FROM_TOLERANCE_MS) {
        if (!out.nextDueAt || validFrom < out.nextDueAt) out.nextDueAt = validFrom
        continue
      }
      const id = doc.id as number
      try {
        const req = await makeReq()
        if (collection === 'legal-texts') await activateLegalText(req, id, { now })
        else await activateLegalSnippet(req, id, { now })
        out.activated.push({ collection, id })
      } catch (err) {
        const reason = (err as Error)?.message ?? String(err)
        log.error('legal.scheduled_activation_failed', { collection, id, reason })
        out.failed.push({ collection, id, reason })
      }
    }
  }
  return out
}
