import 'server-only'

import type { PayloadRequest } from 'payload'

import { getStatusHistory } from '@/lib/audit'
import { ENUM_LABELS } from '@/lib/enumLabels'
import type { InquiryStatus } from '@/lib/enums'
import { INQUIRY_TRANSITIONS, isReopen } from '@/lib/inquiries/transitions'
import { formatBerlin } from '@/lib/time'
import type { Inquiry, PrivateUpload } from '@/payload-types'

// Daten der Ansicht „Anfragen“ `/anfragen` und `/anfragen/:id` (PLAN P5.20, KONZEPT §7.11, DATENMODELL §6.17). Nur
// lesend; Aktionen über `src/endpoints/inquiries/actions.ts` und `POST /api/inquiries/:id/notes`. Referenzbilder nur
// über die angemeldete Dateiroute von `private-uploads` (bei S3 leitet sie auf eine signierte URL ≤ 300 s um,
// ARCHITEKTUR §8.3) – nie eine öffentliche Adresse.

const date = (iso: string | null | undefined) =>
  iso ? formatBerlin(new Date(iso), 'dd.MM.yyyy') : ''
const dateTime = (iso: string | null | undefined) =>
  iso ? formatBerlin(new Date(iso), "dd.MM.yyyy, HH:mm 'Uhr'") : ''

export interface InquiryCard {
  id: number
  reference: string
  createdAt: string
  name: string
  objectLabel: string
  status: InquiryStatus
  statusLabel: string
  deleteAfter: string
}

function objectLabel(i: Inquiry): string {
  const label = ENUM_LABELS.INQUIRY_OBJECT_TYPES[i.objectType].de
  return i.objectType === 'sonstiges' && i.objectTypeOther
    ? `${label}: ${i.objectTypeOther}`
    : label
}

function card(i: Inquiry): InquiryCard {
  return {
    id: i.id,
    reference: i.reference,
    createdAt: date(i.createdAt),
    name: i.name,
    objectLabel: objectLabel(i),
    status: i.status,
    statusLabel: ENUM_LABELS.INQUIRY_STATUSES[i.status].de,
    deleteAfter: date(i.deleteAfter),
  }
}

/** Alle Anfragen, neueste zuerst (höchstens 200; ältere sind nach 6 Monaten ohnehin gelöscht). */
export async function loadInquiryList(req: PayloadRequest): Promise<InquiryCard[]> {
  const res = await req.payload.find({
    collection: 'inquiries',
    sort: '-createdAt',
    limit: 200,
    depth: 0,
    overrideAccess: true,
    req,
  })
  return (res.docs as Inquiry[]).map(card)
}

export interface InquiryImage {
  id: number
  /** Angemeldete Dateiroute (`/api/private-uploads/file/…`). */
  url: string
  thumbUrl: string
  filename: string
}

export interface InquiryStatusOption {
  status: InquiryStatus
  label: string
  reopen: boolean
}

export interface InquiryDetail {
  card: InquiryCard
  email: string
  locale: 'de' | 'en'
  localeLabel: string
  idea: string
  desiredTimeframe: string | null
  budget: string | null
  lastActivityAt: string
  adminNotes: string
  images: InquiryImage[]
  transitions: InquiryStatusOption[]
  history: { at: string; from: string | null; to: string | null; actor: string }[]
  legalHold: boolean
}

const statusLabel = (s: string | null) =>
  s && s in ENUM_LABELS.INQUIRY_STATUSES
    ? ENUM_LABELS.INQUIRY_STATUSES[s as InquiryStatus].de
    : (s ?? '–')

export async function loadInquiryDetail(
  req: PayloadRequest,
  id: number,
): Promise<InquiryDetail | null> {
  const i = (await req.payload.findByID({
    collection: 'inquiries',
    id,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })) as Inquiry | null
  if (!i) return null
  const imageIds = (i.referenceImages ?? [])
    .map((v) => (typeof v === 'number' ? v : v?.id))
    .filter((v): v is number => typeof v === 'number')
  const uploads =
    imageIds.length > 0
      ? ((
          await req.payload.find({
            collection: 'private-uploads',
            where: { id: { in: imageIds } },
            limit: imageIds.length,
            pagination: false,
            depth: 0,
            overrideAccess: true,
            req,
          })
        ).docs as PrivateUpload[])
      : []
  const images: InquiryImage[] = uploads
    .filter((u) => u.url)
    .map((u) => ({
      id: u.id,
      url: u.url!,
      thumbUrl: u.sizes?.thumb?.url ?? u.url!,
      filename: u.filename ?? '',
    }))
  const history = await getStatusHistory('inquiries', i.id, { req })
  return {
    card: card(i),
    email: i.email,
    locale: i.locale,
    localeLabel: ENUM_LABELS.LOCALES[i.locale].de,
    idea: i.idea,
    desiredTimeframe: i.desiredTimeframe ?? null,
    budget: i.budget ?? null,
    lastActivityAt: dateTime(i.lastActivityAt),
    adminNotes: i.adminNotes ?? '',
    images,
    transitions: INQUIRY_TRANSITIONS[i.status].map((to) => ({
      status: to,
      label: statusLabel(to),
      reopen: isReopen(i.status, to),
    })),
    history: history.map((h) => ({
      at: dateTime(h.at),
      from: h.from ? statusLabel(h.from) : null,
      to: h.to ? statusLabel(h.to) : null,
      actor: ENUM_LABELS.ACTOR_TYPES[h.actorType]?.de ?? h.actorType,
    })),
    legalHold: Boolean(i.privacy?.legalHold),
  }
}

/** `mailto:` für „Antworten“: Betreff nach Sprache der Anfrage (KONZEPT §7.11). */
export function inquiryReplyHref(email: string, reference: string, locale: 'de' | 'en'): string {
  const subject = locale === 'en' ? `Your request ${reference}` : `Deine Anfrage ${reference}`
  return `mailto:${encodeURIComponent(email).replace(/%40/g, '@')}?subject=${encodeURIComponent(subject)}`
}
