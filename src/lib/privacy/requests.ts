import 'server-only'

import { ValidationError, type PayloadRequest } from 'payload'

import {
  IDENTITY_CHECK_METHODS,
  LOCALES,
  PRIVACY_REQUEST_CHANNELS,
  PRIVACY_REQUEST_STATUSES,
  PRIVACY_REQUEST_TYPES,
  type PrivacyRequestStatus,
} from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import { parseBerlinLocal } from '@/lib/time'
import type { PrivacyRequest } from '@/payload-types'

import { PrivacyActionError } from './errors'

// Datenschutz-Anfragen erfassen und bearbeiten (PLAN P6.16, KONZEPT §7.15, LOESCHKONZEPT §5.1–§5.3, §5.11): Eingabe der
// Ansicht `/export/datenschutz`. Die Regeln (Nummer DS-JJJJ-NNNN, `dueAt` = Eingang + 1 Monat, Verlängerung höchstens
// 2 Monate mit Begründung und Mitteilung im ersten Monat, Statusübergänge, Pflichtangaben beim Abschluss) prüft der
// Collection-Hook (`src/collections/PrivacyRequests.ts`); hier werden nur Eingaben gelesen und Felder freigegeben.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Kalendertag `JJJJ-MM-TT` (Tag des Zugangs) → 12:00 Uhr Berlin (stabil über die Zeitumstellung). */
export function berlinDay(value: unknown, field: string): string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new PrivacyActionError(400, `Bitte ein Datum angeben (${field}).`)
  }
  const d = parseBerlinLocal(`${value}T12:00`)
  if (!d) throw new PrivacyActionError(400, `Ungültiges Datum (${field}).`)
  return d.toISOString()
}

const optionalDay = (value: unknown, field: string): string | null =>
  value === null || value === undefined || value === '' ? null : berlinDay(value, field)

const oneOf = <T extends string>(values: readonly T[], v: unknown, field: string): T => {
  if (typeof v === 'string' && (values as readonly string[]).includes(v)) return v as T
  throw new PrivacyActionError(400, `Ungültige Angabe (${field}).`)
}

const text = (v: unknown, max: number): string | null => {
  if (v === null || v === undefined) return null
  if (typeof v !== 'string') throw new PrivacyActionError(400, 'Ungültiger Text.')
  const t = v.trim()
  if (t.length > max) throw new PrivacyActionError(400, `Höchstens ${max} Zeichen.`)
  return t === '' ? null : t
}

export async function loadPrivacyRequest(req: PayloadRequest, id: number): Promise<PrivacyRequest> {
  const doc = (await preservingReq(req, () =>
    req.payload.findByID({
      collection: 'privacy-requests',
      id,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    }),
  )) as PrivacyRequest | null
  if (!doc) throw new PrivacyActionError(404, 'Unbekannte Datenschutz-Anfrage.')
  return doc
}

/** Neue Anfrage (LOESCHKONZEPT §5.1): Art(en), Eingangstag, Kanal, Kontaktadresse, Sprache, optional Name. */
export async function createPrivacyRequest(
  req: PayloadRequest,
  body: Record<string, unknown>,
  now: Date,
): Promise<PrivacyRequest> {
  const types = Array.isArray(body.types)
    ? [...new Set(body.types.map((t) => oneOf(PRIVACY_REQUEST_TYPES, t, 'Art')))]
    : []
  if (types.length === 0)
    throw new PrivacyActionError(400, 'Bitte mindestens eine Art der Anfrage wählen.')
  const email = typeof body.contactEmail === 'string' ? body.contactEmail.trim().toLowerCase() : ''
  if (!EMAIL_RE.test(email) || email.length > 254) {
    throw new PrivacyActionError(400, 'Bitte die E-Mail-Adresse der Person angeben.')
  }
  try {
    return (await preservingReq(req, () =>
      req.payload.create({
        collection: 'privacy-requests',
        data: {
          types,
          receivedAt: berlinDay(body.receivedAt, 'Eingangsdatum'),
          channel: oneOf(PRIVACY_REQUEST_CHANNELS, body.channel ?? 'email', 'Kanal'),
          contactEmail: email,
          contactName: text(body.contactName, 100),
          locale: oneOf(LOCALES, body.locale ?? 'de', 'Sprache'),
          adminNotes: text(body.adminNotes, 3000),
        } as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, now: now.toISOString() },
      }),
    )) as PrivacyRequest
  } catch (err) {
    throw asActionError(err)
  }
}

/**
 * Bearbeiten (Status, Identität, Verlängerung, Abschluss, Notizen). Nur die genannten Felder; `undefined` bleibt
 * unverändert. Gleicher Zielzustand → `unchanged`.
 */
export async function savePrivacyRequest(
  req: PayloadRequest,
  id: number,
  body: Record<string, unknown>,
  now: Date,
): Promise<{ doc: PrivacyRequest; unchanged: boolean }> {
  const current = await loadPrivacyRequest(req, id)
  const data: Record<string, unknown> = {}
  if (body.status !== undefined) {
    data.status = oneOf(PRIVACY_REQUEST_STATUSES, body.status, 'Status') as PrivacyRequestStatus
  }
  if (body.identityVerified !== undefined) data.identityVerified = body.identityVerified === true
  if (body.identityMethod !== undefined) {
    data.identityMethod =
      body.identityMethod === null || body.identityMethod === ''
        ? null
        : oneOf(IDENTITY_CHECK_METHODS, body.identityMethod, 'Prüfart')
  }
  if (body.extendedDueAt !== undefined) {
    data.extendedDueAt = optionalDay(body.extendedDueAt, 'Verlängert bis')
  }
  if (body.extensionReason !== undefined) data.extensionReason = text(body.extensionReason, 300)
  if (body.extensionNotifiedAt !== undefined) {
    data.extensionNotifiedAt = optionalDay(body.extensionNotifiedAt, 'Verlängerung mitgeteilt am')
  }
  if (body.answeredAt !== undefined)
    data.answeredAt = optionalDay(body.answeredAt, 'Beantwortet am')
  if (body.resultNote !== undefined) data.resultNote = text(body.resultNote, 2000)
  if (body.adminNotes !== undefined) data.adminNotes = text(body.adminNotes, 3000)
  if (body.contactName !== undefined) data.contactName = text(body.contactName, 100)

  const changed = Object.entries(data).some(([k, v]) => {
    const before = (current as unknown as Record<string, unknown>)[k] ?? null
    return k.endsWith('At') && before && v
      ? new Date(String(before)).getTime() !== new Date(String(v)).getTime()
      : before !== v
  })
  if (!changed) return { doc: current, unchanged: true }
  try {
    const doc = (await preservingReq(req, () =>
      req.payload.update({
        collection: 'privacy-requests',
        id,
        data: data as never,
        depth: 0,
        overrideAccess: true,
        req,
        context: { ...req.context, now: now.toISOString() },
      }),
    )) as PrivacyRequest
    return { doc, unchanged: false }
  } catch (err) {
    throw asActionError(err)
  }
}

/** Validierungsfehler des Hooks als 400 mit der Meldung für Jutta. */
export function asActionError(err: unknown): unknown {
  if (err instanceof ValidationError) {
    const first = err.data?.errors?.[0]?.message
    return new PrivacyActionError(400, first ?? err.message)
  }
  return err
}
