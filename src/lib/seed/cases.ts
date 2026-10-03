import 'server-only'

import type { CollectionSlug, PayloadRequest } from 'payload'

import { seedOp } from './context'
import { importPrivateUpload } from './uploads'
import { withDateTokens } from './lexical'
import type { SeedData } from './loader'
import type { SeedReport } from './report'
import { resolveSeedDate, resolveSeedTime } from './time'
import { findBySeedKey, upsertBySeedKey } from './upsert'

// Vorgänge nach den Bestellungen (SEED-SPEC §1.7 Schritt 7, PLAN P8.5/P8.5a): Widerrufe (§10) → Reklamationen (§10a)
// → Anfragen (§11) → Datenschutz-Anfragen (§11a) → Umsätze (§15); danach die privaten Dateien (Skizze, Fotos) mit
// ihrem Vorgang verknüpfen. Alles create-only (§1.3); Nummern, Status und Zeitstempel aus den Daten, berechnete Felder
// (`refundDueAt`, `deleteAfter`, `dueAt`, `retainUntil`, `carrierClaimDueAt`, `warrantyEndsAt`) rechnen die Hooks.
// Die Schritte laufen mit `N` als Request-Zeit (`seedStep(…, now)`), keine Mail, kein Job, kein Audit.

type Obj = Record<string, unknown>

export interface CaseImportOptions {
  report: SeedReport
  now: Date
}

function compact<T extends Obj>(o: T): T {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]
  return o
}

async function idOf(req: PayloadRequest, seedKey: string): Promise<number> {
  const collection = seedKey.slice(0, seedKey.indexOf(':')) as CollectionSlug
  const doc = await findBySeedKey(req, collection, seedKey)
  if (!doc) throw new Error(`Verweis ${seedKey} fehlt – bitte zuerst ${collection} importieren.`)
  return doc.id as number
}

const idsOf = (req: PayloadRequest, keys: readonly string[] | undefined) =>
  Promise.all((keys ?? []).map((k) => idOf(req, k)))

function customerOf(data: SeedData, key: string) {
  const c = data.customers.find((x) => x.key === key)
  if (!c) throw new Error(`Kund:in ${key} fehlt in customers.json`)
  return c
}

// ---------------------------------------------------------------------------------------------------------------
// Widerrufe (§10)

export async function importWithdrawals(
  req: PayloadRequest,
  data: SeedData,
  options: CaseImportOptions,
): Promise<void> {
  const { now } = options
  const t = (expr: string | undefined) =>
    expr ? resolveSeedDate(expr, now).toISOString() : undefined
  // Nummern steigen mit dem Eingang (§0.3, AK-SEED-22) – anlegen in dieser Reihenfolge.
  const list = [...data.withdrawals].sort(
    (a, b) =>
      resolveSeedDate(a.receivedAt, now).getTime() - resolveSeedDate(b.receivedAt, now).getTime(),
  )
  for (const w of list) {
    const customer = customerOf(data, w.customer)
    const text = (v: string | undefined) =>
      v ? withDateTokens(v, customer.locale, now) : undefined
    await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'withdrawals',
      seedKey: `withdrawals:${w.key}`,
      group: 'process',
      create: async () =>
        compact({
          reference: w.reference,
          channel: 'online_form',
          receivedAt: t(w.receivedAt),
          name: customer.name,
          email: customer.email,
          contractIdentification: text(w.contractIdentification),
          itemsText: text(w.itemsText),
          reason: text(w.reason),
          locale: customer.locale,
          order: w.order ? await idOf(req, w.order) : undefined,
          matchStatus: w.matchStatus,
          affectedItemIds: w.affectedItemIds,
          status: w.status,
          // Eingangsbestätigung sofort (§10, Mail-Log §16.1)
          confirmationSentAt: t(w.receivedAt),
          returnTrackingNumber: w.returnTrackingNumber,
          goodsReturnedAt: t(w.goodsReturnedAt),
          refundedAt: t(w.refundedAt),
          closedAt: t(w.closedAt),
          rejectedAt: t(w.rejectedAt),
          closeReason: w.closeReason,
          closeNote: w.closeNote,
          spam: w.spam ? { markedAt: t(w.spam.markedAt), reason: w.spam.reason } : undefined,
          adminNotes: text(w.adminNotes),
          createdAt: t(w.receivedAt),
        }),
    })
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Reklamationen (§10a)

export async function importComplaints(
  req: PayloadRequest,
  data: SeedData,
  options: CaseImportOptions,
): Promise<void> {
  const { now } = options
  const t = (expr: string | undefined) =>
    expr ? resolveSeedDate(expr, now).toISOString() : undefined
  for (const c of data.complaints) {
    const res = await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'complaints',
      seedKey: `complaints:${c.key}`,
      group: 'process',
      create: async () =>
        compact({
          order: await idOf(req, c.order),
          kind: c.kind,
          receivedAt: t(c.receivedAt),
          description: c.description,
          affectedItemIds: c.affectedItemIds,
          remedy: c.remedy,
          repairChoiceSentAt: t(c.repairChoiceSentAt),
          customerChoice: c.customerChoice,
          customerChoiceAt: t(c.customerChoiceAt),
          vsbgNoticeSentAt: t(c.vsbgNoticeSentAt),
          status: c.status,
          // interne Notizen auf Deutsch
          notes: c.notes ? withDateTokens(c.notes, 'de', now) : undefined,
          createdAt: t(c.receivedAt),
        }),
    })
    if (res.outcome !== 'created' || !c.photos?.length) continue
    // Fotos: Datei mit Pflichtbezug auf die Reklamation anlegen, dann an der Reklamation eintragen (§4.4).
    const photos: (number | string)[] = []
    for (const key of c.photos) {
      const entry = data.privateUploads.find((u) => `private-uploads:${u.key}` === key)
      if (!entry) throw new Error(`${key} fehlt in private-uploads.json`)
      const upload = await importPrivateUpload(req, entry, options.report, {
        relatedComplaint: res.doc.id,
      })
      photos.push(upload.doc.id)
    }
    await req.payload.update({
      collection: 'complaints',
      id: res.doc.id,
      data: { photos } as never,
      ...seedOp(req),
    })
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Anfragen (§11)

export async function importInquiries(
  req: PayloadRequest,
  data: SeedData,
  options: CaseImportOptions,
): Promise<void> {
  const { now } = options
  const t = (expr: string) => resolveSeedDate(expr, now).toISOString()
  const list = [...data.inquiries].sort(
    (a, b) =>
      resolveSeedDate(a.createdAt, now).getTime() - resolveSeedDate(b.createdAt, now).getTime(),
  )
  for (const a of list) {
    const customer = customerOf(data, a.customer)
    const res = await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'inquiries',
      seedKey: `inquiries:${a.key}`,
      group: 'process',
      create: async () =>
        compact({
          reference: a.reference,
          name: customer.name,
          email: customer.email,
          idea: a.idea,
          objectType: a.objectType,
          desiredTimeframe: a.desiredTimeframe,
          budget: a.budget,
          locale: customer.locale,
          status: a.status,
          referenceImages: a.referenceImages ? await idsOf(req, a.referenceImages) : undefined,
          adminNotes: a.adminNotes ? withDateTokens(a.adminNotes, 'de', now) : undefined,
          createdAt: t(a.createdAt),
        }),
    })
    // Der Hook setzt `lastActivityAt` beim Anlegen auf den Eingang; danach der Stand laut §11.
    if (res.outcome === 'created' && a.lastActivityAt !== a.createdAt) {
      await req.payload.update({
        collection: 'inquiries',
        id: res.doc.id,
        data: { lastActivityAt: t(a.lastActivityAt) } as never,
        ...seedOp(req),
      })
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Datenschutz-Anfragen (§11a)

export async function importPrivacyRequests(
  req: PayloadRequest,
  data: SeedData,
  options: CaseImportOptions,
): Promise<void> {
  const { now } = options
  const t = (expr: string | undefined) =>
    expr ? resolveSeedDate(expr, now).toISOString() : undefined
  const list = [...data.privacyRequests].sort(
    (a, b) =>
      resolveSeedDate(a.receivedAt, now).getTime() - resolveSeedDate(b.receivedAt, now).getTime(),
  )
  for (const r of list) {
    const customer = customerOf(data, r.customer)
    await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'privacy-requests',
      seedKey: `privacy-requests:${r.key}`,
      group: 'process',
      create: async () =>
        compact({
          reference: r.reference,
          types: r.types,
          channel: r.channel,
          receivedAt: t(r.receivedAt),
          status: r.status,
          contactEmail: customer.email,
          contactName: customer.name,
          locale: customer.locale,
          identityVerified: r.identityVerified,
          identityMethod: r.identityMethod,
          identityVerifiedAt: t(r.identityVerifiedAt),
          matchedOrders: r.matchedOrders ? await idsOf(req, r.matchedOrders) : undefined,
          matchedWithdrawals: r.matchedWithdrawals
            ? await idsOf(req, r.matchedWithdrawals)
            : undefined,
          answeredAt: t(r.answeredAt),
          resultNote: r.resultNote ? withDateTokens(r.resultNote, 'de', now) : undefined,
          adminNotes: r.adminNotes ? withDateTokens(r.adminNotes, 'de', now) : undefined,
          remindersSent: {},
          createdAt: t(r.receivedAt),
        }),
    })
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Umsätze (§15)

export async function importRevenue(
  req: PayloadRequest,
  data: SeedData,
  options: CaseImportOptions,
): Promise<void> {
  for (const e of data.revenue) {
    const month = resolveSeedTime(e.month, { now: options.now }) as string
    // Echter Eintrag für (Monat, Quelle) vorhanden → Seed-Eintrag überspringen (§1.3, DATENMODELL §6.20).
    const real = await req.payload.count({
      collection: 'revenue-entries',
      where: {
        and: [
          { month: { equals: month } },
          { source: { equals: e.source } },
          { seed: { not_equals: true } },
        ],
      },
      ...seedOp(req),
    })
    if (real.totalDocs > 0) {
      options.report.add('revenue-entries', 'skipped')
      continue
    }
    await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'revenue-entries',
      seedKey: `revenue-entries:${e.month}:${e.source}`,
      group: 'process',
      create: () => compact({ month, source: e.source, amountCents: e.amountCents, note: e.note }),
    })
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Private Dateien mit ihrem Vorgang verknüpfen (§1.7 Schritt 7)

export async function linkCaseUploads(req: PayloadRequest, data: SeedData): Promise<void> {
  for (const u of data.privateUploads) {
    const link: Obj = {}
    if (u.relatedInquiry) {
      const doc = await findBySeedKey(req, 'inquiries', u.relatedInquiry)
      if (doc) link.relatedInquiry = doc.id
    }
    if (u.relatedComplaint) {
      const doc = await findBySeedKey(req, 'complaints', u.relatedComplaint)
      if (doc) link.relatedComplaint = doc.id
    }
    if (Object.keys(link).length === 0) continue
    const upload = await findBySeedKey(req, 'private-uploads', `private-uploads:${u.key}`)
    if (!upload || upload.seed !== true) continue
    const current = upload as Obj
    if (Object.keys(link).every((k) => current[k] === link[k])) continue
    await req.payload.update({
      collection: 'private-uploads',
      id: upload.id,
      data: link as never,
      ...seedOp(req),
    })
  }
}
