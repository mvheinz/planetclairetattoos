import type { CollectionBeforeChangeHook, CollectionConfig, PayloadRequest } from 'payload'

import { isAdmin } from '@/access'
import { moneyField, seedField } from '@/fields'
import { writeAudit } from '@/lib/audit'
import { ENUM_LABELS, enumOptions } from '@/lib/enumLabels'
import { REVENUE_SOURCES } from '@/lib/enums'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { preservingReq } from '@/lib/payload/localReq'
import { addBerlinMonths, berlinMonthKey, systemClock } from '@/lib/time'

import { failField } from './hooks/commerce'

// DATENMODELL §6.20 – manuelle Monatsumsätze außerhalb des Shops (E-45) für den Umsatz-Wächter (R-125). Ein echter
// Eintrag ersetzt einen Seed-Eintrag mit gleichem (Monat, Quelle) in derselben Transaktion. Das Einreihen des Jobs
// `revenueGuardCheck` nach jeder Änderung (P5.23).

const SLUG = 'revenue-entries'
const fail = (message: string, path: string): never => failField(SLUG, message, path)

type Doc = Record<string, unknown>

export const REVENUE_MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/
export const REVENUE_MAX_CENTS = 100_000_000

const guardRevenue: CollectionBeforeChangeHook = async ({ data, originalDoc, req }) => {
  const ctx = getAppContext(req)
  const original = (originalDoc ?? {}) as Doc
  const merged = { ...original, ...data } as Doc
  const month = String(merged.month ?? '')
  if (!REVENUE_MONTH_RE.test(month)) fail('Monat im Format JJJJ-MM, z. B. 2026-09.', 'month')
  if (month > berlinMonthKey(requestNow(req))) fail('Der Monat liegt in der Zukunft.', 'month')
  const amount = merged.amountCents
  if (
    typeof amount !== 'number' ||
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    amount > REVENUE_MAX_CENTS
  ) {
    fail('Betrag in Cent von 0 bis 1.000.000,00 €.', 'amountCents')
  }
  if (ctx.seed) return data
  data.seed = false

  // Echter Eintrag ersetzt den Seed-Eintrag mit gleichem Monat und gleicher Quelle (kein UNIQUE-Konflikt).
  const samples = await preservingReq(req, () =>
    req.payload.find({
      collection: SLUG,
      where: {
        and: [
          { month: { equals: month } },
          { source: { equals: merged.source } },
          { seed: { equals: true } },
          ...(original.id ? [{ id: { not_equals: original.id } }] : []),
        ],
      },
      depth: 0,
      pagination: false,
      overrideAccess: true,
      req,
    }),
  )
  for (const sample of samples.docs) {
    await preservingReq(req, () =>
      req.payload.delete({
        collection: SLUG,
        id: sample.id,
        overrideAccess: true,
        req,
        context: { ...req.context, seed: true },
      }),
    )
    await writeAudit(req, {
      action: 'seed_removed',
      entityCollection: SLUG,
      entityId: sample.id,
      summary: `Beispiel-Eintrag ersetzt (${month}, ${String(merged.source)})`,
    })
  }
  return data
}

/** Umsatz-Wächter nach jeder Änderung einer Monatssumme neu prüfen (P5.23, KONZEPT §8.4). */
const queueGuard = async <T>({ doc, req }: { doc: T; req: PayloadRequest }): Promise<T> => {
  const { queueRevenueGuardCheck } = await import('@/lib/revenue/check')
  await queueRevenueGuardCheck(req)
  return doc
}

export const RevenueEntries: CollectionConfig = {
  slug: SLUG,
  labels: { singular: 'Umsatz (manuell)', plural: 'Umsätze (manuell)' },
  admin: {
    group: 'Finanzen',
    useAsTitle: 'month',
    defaultColumns: ['month', 'source', 'amountCents', 'note'],
    description:
      'Monatssummen außerhalb des Shops (Tattoo, Flohmarkt, Auftragsarbeiten, Sonstiges) für den Umsatz-Wächter.',
  },
  access: { read: isAdmin, create: isAdmin, update: isAdmin, delete: isAdmin },
  defaultSort: '-month',
  indexes: [{ fields: ['month', 'source'], unique: true }],
  fields: [
    {
      name: 'month',
      type: 'text',
      label: 'Monat',
      required: true,
      index: true,
      defaultValue: () => berlinMonthKey(addBerlinMonths(systemClock.now(), -1)),
      admin: { description: 'z. B. „2026-09“' },
    },
    {
      name: 'source',
      type: 'select',
      label: 'Quelle',
      required: true,
      defaultValue: 'tattoo',
      options: enumOptions(REVENUE_SOURCES, ENUM_LABELS.REVENUE_SOURCES),
    },
    moneyField('amountCents', {
      label: 'Betrag',
      required: true,
      admin: { description: 'Brutto = Netto bei Kleinunternehmerregelung.' },
    }),
    { name: 'note', type: 'text', label: 'Notiz', maxLength: 200 },
    ...seedField(),
  ],
  hooks: {
    beforeChange: [guardRevenue],
    afterChange: [queueGuard],
    afterDelete: [queueGuard],
  },
}
