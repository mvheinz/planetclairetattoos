import 'server-only'

import { createHash } from 'node:crypto'

import type { CollectionSlug, PayloadRequest } from 'payload'

import { ENUM_LABELS } from '@/lib/enumLabels'
import type { EmailTemplate, Locale } from '@/lib/enums'
import { adminRecipient } from '@/lib/email/outbox'
import { fill, mailTexts } from '@/lib/email/templates/kit'
import { getSnippet, loadLegalSnippets } from '@/lib/legal/snippets'
import { padItemNumber } from '@/lib/products/itemNumber'
import type { Clock } from '@/lib/time'
import { formatBerlin } from '@/lib/time'

import { seedOp } from './context'
import type { SeedData } from './loader'
import type { SeedReport } from './report'
import type { EmailEvent, LogsData } from './schemas'
import { resolveSeedDate } from './time'
import { findBySeedKey, upsertBySeedKey } from './upsert'

// Protokolle des Beispielbestands (SEED-SPEC §16, PLAN P8.8). Der Seed erzeugt Einträge und versendet nichts:
// - `email-log` aus den Zeitleisten nach den Regeln in `logs.json` (Ereignis → Vorlagen, §16.1);
// - `consent-log` mit dem gerenderten RECHT-Baustein in der Sprache der Bestellung bzw. Anfrage (§16.2);
// - `audit-log` mit den Einträgen aus `logs.json` (§16.3).
// Alles create-only (§1.3); `withdrawals.confirmationEmail` zeigt danach auf den `withdrawal_receipt`-Eintrag.

type Obj = Record<string, unknown>

export interface LogImportOptions {
  report: SeedReport
  now: Date
  clock: Clock
}

/** Ein abgeleiteter Mail-Eintrag (rein, testbar). */
export interface PlannedMail {
  /** Bezug für den seedKey: `O01`, `W4`, `A2`, `RK3`, `DS1`. */
  ref: string
  template: EmailTemplate
  at: Date
  locale: Locale
  /** Empfänger: Kund:in bzw. `admin`. */
  to: string | 'admin'
  /** Nummer im Betreff. */
  number: string
  order?: string
  withdrawal?: string
  inquiry?: string
  /** Platzhalter des Betreffs. */
  vars: Record<string, string>
}

const sha256 = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')
const isAdminTemplate = (t: EmailTemplate) => t.startsWith('admin_')
const camel = (t: string) => t.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase())

/** `<seed.<seedKey ohne Sonderzeichen>@planetclairetattoos.invalid>` (§2.5). */
export function seedMessageId(seedKey: string): string {
  return `<seed.${seedKey.replace(/[^A-Za-z0-9]/g, '')}@planetclairetattoos.invalid>`
}

function dateVars(at: Date, locale: Locale): { date: string; time: string } {
  return {
    date: locale === 'en' ? formatBerlin(at, 'd MMM yyyy', 'en') : formatBerlin(at, 'dd.MM.yyyy'),
    time: formatBerlin(at, 'HH:mm', locale),
  }
}

/**
 * Betreff: Vorlage aus den Mail-Texten (`email.<vorlage>.subject`) mit eingesetzter Nummer; fehlt die Vorlage oder ein
 * Platzhalter (z. B. Verwaltungs-Mails): „<Vorlagen-Name> <Nummer>“ (§16.1).
 */
export function seedMailSubject(
  mail: Pick<PlannedMail, 'template' | 'locale' | 'number' | 'vars'>,
) {
  const texts = mailTexts(mail.locale) as Record<string, { subject?: string } | undefined>
  const subject = isAdminTemplate(mail.template) ? undefined : texts[camel(mail.template)]?.subject
  if (subject) {
    try {
      return fill(subject, { ...mail.vars, orderNumber: mail.number, reference: mail.number })
    } catch {
      // fällt auf den Vorlagen-Namen zurück
    }
  }
  return `${ENUM_LABELS.EMAIL_TEMPLATES[mail.template].de} ${mail.number}`
}

/** Mails aus den Zeitleisten nach den Regeln (§16.1); Kassen ohne Bestellung erzeugen keine Mail. */
export function planSeedMails(data: SeedData, rules: LogsData['email'], now: Date): PlannedMail[] {
  const out: PlannedMail[] = []
  const t = (expr: string) => resolveSeedDate(expr, now)
  const customer = (key: string) => {
    const c = data.customers.find((x) => x.key === key.replace(/^customers:/, ''))
    if (!c) throw new Error(`Kund:in ${key} fehlt`)
    return c
  }
  const rulesFor = (
    event: EmailEvent,
    filter: (r: LogsData['email'][number]) => boolean = () => true,
  ) => rules.filter((r) => r.event === event && filter(r)).flatMap((r) => r.templates)
  const push = (
    base: Omit<PlannedMail, 'template' | 'to' | 'locale'>,
    locale: Locale,
    email: string,
    templates: EmailTemplate[],
  ) => {
    for (const template of templates) {
      const admin = isAdminTemplate(template)
      out.push({ ...base, template, to: admin ? 'admin' : email, locale: admin ? 'de' : locale })
    }
  }

  for (const o of data.orders.orders) {
    const c = customer(o.customer)
    const method = o.payment.method
    const base = (at: Date, vars: Record<string, string> = {}) => ({
      ref: o.key,
      at,
      number: o.orderNumber,
      order: `orders:${o.key}`,
      vars: { ...dateVars(at, o.locale), ...vars },
    })
    const byMethod = (r: LogsData['email'][number]) =>
      !r.paymentMethods || r.paymentMethods.includes(method)
    const tl = o.timeline
    const events: [EmailEvent, string | undefined][] = [
      ['order.placedAt', tl.placedAt],
      ['order.paidAt', tl.paidAt],
      ['order.prepayment.reminderSentAt', o.prepayment?.reminderSentAt],
      ['order.cancelledAt', tl.cancelledAt],
      ['order.shippedAt', tl.shippedAt],
      ['order.readyForPickupAt', tl.readyForPickupAt],
      ['order.disputedAt', tl.disputedAt],
    ]
    for (const [event, expr] of events) {
      if (!expr) continue
      push(base(t(expr)), o.locale, c.email, rulesFor(event, byMethod))
    }
    for (const r of o.refunds ?? []) {
      push(base(t(r.createdAt)), o.locale, c.email, rulesFor('order.refunds.createdAt', byMethod))
    }
  }
  for (const w of data.withdrawals) {
    const c = customer(w.customer)
    const at = t(w.receivedAt)
    push(
      {
        ref: w.key,
        at,
        number: w.reference,
        withdrawal: `withdrawals:${w.key}`,
        order: w.order,
        vars: dateVars(at, c.locale),
      },
      c.locale,
      c.email,
      rulesFor('withdrawal.receivedAt'),
    )
  }
  for (const i of data.inquiries) {
    const c = customer(i.customer)
    const at = t(i.createdAt)
    push(
      {
        ref: i.key,
        at,
        number: i.reference,
        inquiry: `inquiries:${i.key}`,
        vars: dateVars(at, c.locale),
      },
      c.locale,
      c.email,
      rulesFor('inquiry.createdAt'),
    )
  }
  for (const k of data.complaints) {
    const o = data.orders.orders.find((x) => `orders:${x.key}` === k.order)
    if (!o) throw new Error(`${k.key}: Bestellung ${k.order} fehlt`)
    const c = customer(o.customer)
    for (const [event, expr] of [
      ['complaint.repairChoiceSentAt', k.repairChoiceSentAt],
      ['complaint.vsbgNoticeSentAt', k.vsbgNoticeSentAt],
    ] as const) {
      if (!expr) continue
      const at = t(expr)
      push(
        { ref: k.key, at, number: o.orderNumber, order: k.order, vars: dateVars(at, o.locale) },
        o.locale,
        c.email,
        rulesFor(event),
      )
    }
  }
  for (const r of data.privacyRequests) {
    if (!r.answeredAt) continue
    const c = customer(r.customer)
    const at = t(r.answeredAt)
    push(
      { ref: r.key, at, number: r.reference, vars: dateVars(at, c.locale) },
      c.locale,
      c.email,
      rulesFor(
        'privacyRequest.answeredAt',
        (rule) => !rule.privacyTypes || r.types.some((x) => rule.privacyTypes!.includes(x)),
      ),
    )
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime())
}

/** seedKey je Mail: `email-log:<Bezug>:<vorlage>` (bei Wiederholung mit laufender Nummer). */
export function mailSeedKeys(mails: readonly PlannedMail[]): string[] {
  const seen = new Map<string, number>()
  return mails.map((m) => {
    const base = `email-log:${m.ref}:${m.template}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base}:${n}`
  })
}

async function idOf(req: PayloadRequest, seedKey: string | undefined): Promise<number | undefined> {
  if (!seedKey) return undefined
  const collection = seedKey.slice(0, seedKey.indexOf(':')) as CollectionSlug
  const doc = await findBySeedKey(req, collection, seedKey)
  if (!doc) throw new Error(`Verweis ${seedKey} fehlt – bitte zuerst ${collection} importieren.`)
  return doc.id as number
}

function compact<T extends Obj>(o: T): T {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k]
  return o
}

// ---------------------------------------------------------------------------------------------------------------

export async function importEmailLog(
  req: PayloadRequest,
  data: SeedData,
  options: LogImportOptions,
): Promise<void> {
  const mails = planSeedMails(data, data.logs.email, options.now)
  const keys = mailSeedKeys(mails)
  const admin = await adminRecipient(req)
  for (const [i, m] of mails.entries()) {
    const seedKey = keys[i]!
    const sentAt = m.at.toISOString()
    // Prepayment-Frist im Betreff (M02/M03): aus der angelegten Bestellung.
    let vars = m.vars
    if (
      m.order &&
      (m.template === 'prepayment_instructions' || m.template === 'prepayment_reminder')
    ) {
      const order = await findBySeedKey(req, 'orders', m.order)
      const due = (order?.prepayment as { dueAt?: string } | undefined)?.dueAt
      if (due) vars = { ...vars, date: dateVars(new Date(due), m.locale).date }
    }
    const res = await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'email-log',
      seedKey,
      group: 'process',
      create: async () =>
        compact({
          template: m.template,
          to: m.to === 'admin' ? admin : m.to,
          idempotencyKey: `seed:${seedKey}`,
          locale: m.locale,
          subject: seedMailSubject({ ...m, vars }),
          status: 'sent',
          transport: 'file',
          messageId: seedMessageId(seedKey),
          sentAt,
          attempts: 1,
          attachments: [],
          bodySha256: sha256(`seed:${seedKey}`),
          order: await idOf(req, m.order),
          withdrawal: await idOf(req, m.withdrawal),
          inquiry: await idOf(req, m.inquiry),
          createdAt: sentAt,
        }),
    })
    // Eingangsbestätigung am Widerruf verknüpfen (§16.1)
    if (m.template === 'withdrawal_receipt' && m.withdrawal && res.outcome === 'created') {
      await req.payload.update({
        collection: 'withdrawals',
        id: (await idOf(req, m.withdrawal))!,
        data: { confirmationEmail: res.doc.id, confirmationSentAt: sentAt } as never,
        ...seedOp(req),
      })
    }
  }
}

export async function importConsentLog(
  req: PayloadRequest,
  data: SeedData,
  options: LogImportOptions,
): Promise<void> {
  // Gültige Bausteine aus `legal-snippets` laden (sonst Arbeitsfassung, wie die Kasse)
  await loadLegalSnippets(req.payload)
  const t = (expr: string) => resolveSeedDate(expr, options.now).toISOString()
  for (const rule of data.logs.consent) {
    for (const orderKey of rule.orders ?? []) {
      const o = data.orders.orders.find((x) => `orders:${x.key}` === orderKey)!
      const c = data.customers.find((x) => `customers:${x.key}` === o.customer)!
      const order = await findBySeedKey(req, 'orders', orderKey)
      if (!order) throw new Error(`Verweis ${orderKey} fehlt`)
      let vars: Record<string, string> = {}
      if (rule.product) {
        const productId = await idOf(req, rule.product)
        const item = ((order.items ?? []) as Obj[]).find((it) => it.product === productId)
        if (!item) throw new Error(`${orderKey}: ${rule.product} ist keine Position`)
        vars = {
          itemTitle: String((o.locale === 'en' ? item.titleEn : undefined) ?? item.titleDe),
          objectNumber: padItemNumber(Number(item.itemNumber)),
          deviationText: String(item.deviationText ?? ''),
        }
      }
      const snippet = getSnippet(rule.snippet, o.locale, vars)
      const checkout = await findBySeedKey(req, 'checkouts', `checkouts:${o.key}`)
      await upsertBySeedKey({
        req,
        report: options.report,
        collection: 'consent-log',
        seedKey: `consent-log:${o.key}:${rule.purpose}`,
        group: 'process',
        create: async () =>
          compact({
            purpose: rule.purpose,
            granted: true,
            textSnapshot: snippet.text,
            snippetKey: rule.snippet,
            snippetVersion: snippet.version,
            locale: o.locale,
            email: c.email,
            order: order.id,
            checkout: checkout?.id,
            product: rule.product ? await idOf(req, rule.product) : undefined,
            createdAt: t(o.timeline.placedAt!),
          }),
      })
    }
    for (const inquiryKey of rule.inquiries ?? []) {
      const a = data.inquiries.find((x) => `inquiries:${x.key}` === inquiryKey)!
      const c = data.customers.find((x) => x.key === a.customer)!
      const snippet = getSnippet(rule.snippet, c.locale)
      await upsertBySeedKey({
        req,
        report: options.report,
        collection: 'consent-log',
        seedKey: `consent-log:${a.key}:${rule.purpose}`,
        group: 'process',
        create: async () => ({
          purpose: rule.purpose,
          granted: true,
          textSnapshot: snippet.text,
          snippetKey: rule.snippet,
          snippetVersion: snippet.version,
          locale: c.locale,
          email: c.email,
          inquiry: await idOf(req, inquiryKey),
          createdAt: t(a.createdAt),
        }),
      })
    }
  }
}

/** Anzahl angelegter Beispiel-Datensätze je Collection (Platzhalter `{<collection>}` im Audit-Text). */
async function seedCounts(req: PayloadRequest, summary: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {}
  for (const m of summary.matchAll(/\{([a-z-]+)\}/g)) {
    const collection = m[1] as CollectionSlug
    const { totalDocs } = await req.payload.count({
      collection,
      where: { seed: { equals: true } },
      ...seedOp(req),
    })
    out[collection] = String(totalDocs)
  }
  return out
}

export async function importAuditLog(
  req: PayloadRequest,
  data: SeedData,
  options: LogImportOptions,
): Promise<void> {
  const admins = await req.payload.find({
    collection: 'users',
    sort: 'createdAt',
    limit: 1,
    pagination: false,
    ...seedOp(req),
  })
  const adminId = admins.docs[0]?.id
  for (const a of data.logs.audit) {
    const counts = await seedCounts(req, a.summary)
    const summary = a.summary.replace(/\{([a-z-]+)\}/g, (_m, c: string) => counts[c] ?? '0')
    const at = a.at ? resolveSeedDate(a.at, options.now) : options.clock.now()
    const entityCollection = a.entity === 'settings' ? 'settings' : a.entity.split(':')[0]!
    const entityId = a.entity === 'settings' ? 'settings' : String(await idOf(req, a.entity))
    await upsertBySeedKey({
      req,
      report: options.report,
      collection: 'audit-log',
      seedKey: `audit-log:${a.key}`,
      group: 'process',
      create: () =>
        compact({
          action: a.action,
          actorType: a.actorType,
          actorUser: a.actorType === 'admin' ? adminId : undefined,
          entityCollection,
          entityId,
          summary,
          createdAt: at.toISOString(),
        }),
    })
  }
}
