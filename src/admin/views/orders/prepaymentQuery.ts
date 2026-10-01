import 'server-only'

import type { PayloadRequest } from 'payload'

import { daysUntilCancel } from '@/admin/components/orderActionsModel'
import { formatIban } from '@/lib/commerce/epc'
import { formatMoney } from '@/lib/money'
import { formatItemNumber } from '@/lib/products/itemNumber'
import { formatBerlin } from '@/lib/time'
import type { Order, Product, Setting } from '@/payload-types'

// Daten der Ansicht „Vorkasse offen“ `/vorkasse` (PLAN P5.18, KONZEPT §7.7, §4.8). Nur lesend; die Aktionen laufen über
// die Endpunkte aus P4.20 (`src/endpoints/orders/actions.ts`). Fälligste zuerst; Unterliste „Kürzlich automatisch
// storniert (30 Tage)“ mit der Angabe, ob alle Stücke noch frei sind (dann geht „Nachträglich bezahlt“, O5).

const DAY = 86_400_000
/** Zeitraum der Unterliste „Kürzlich automatisch storniert“. */
export const RECENTLY_CANCELLED_DAYS = 30

const date = (iso: string | null | undefined, fmt = 'dd.MM.yyyy') =>
  iso ? formatBerlin(new Date(iso), fmt) : ''

const itemsOf = (o: Order) =>
  o.items.map((i) => `${formatItemNumber(i.itemNumber, 'de')} ${i.titleDe}`)

export interface BankData {
  accountHolder: string
  iban: string
  bic: string | null
}

export interface PrepaymentCard {
  id: number
  orderNumber: string
  totalCents: number
  placedAt: string
  /** Fristende als Datum (Berlin), z. B. „01.10.2026“. */
  dueDate: string
  /** Berliner Kalendertage bis zum Fristende (0 = heute letzter Tag, < 0 = abgelaufen). */
  daysLeft: number
  reminderSent: boolean
  reminderSentAt: string | null
  name: string
  items: string[]
  /** Text für „Bankdaten kopieren“ (Kontoinhaberin, IBAN, BIC, Betrag, Verwendungszweck). */
  bankText: string | null
}

export interface CancelledCard {
  id: number
  orderNumber: string
  totalCents: number
  placedAt: string
  cancelledAt: string
  name: string
  items: string[]
  /** Alle Stücke noch `available` → „Nachträglich bezahlt“ möglich (der Dienst prüft erneut, atomar). */
  allAvailable: boolean
  /** „Rücküberweisung erledigt“ schon notiert. */
  refundNoted: boolean
}

export interface PrepaymentList {
  open: PrepaymentCard[]
  cancelled: CancelledCard[]
  bank: BankData | null
}

/** Text zum Kopieren der Bankdaten einer Bestellung (eine Angabe je Zeile). */
export function bankDataText(bank: BankData, amountCents: number, reference: string): string {
  return [
    `Kontoinhaberin: ${bank.accountHolder}`,
    `IBAN: ${bank.iban}`,
    bank.bic ? `BIC: ${bank.bic}` : null,
    `Betrag: ${formatMoney(amountCents, 'de')}`,
    `Verwendungszweck: ${reference}`,
  ]
    .filter(Boolean)
    .join('\n')
}

async function bankOf(req: PayloadRequest): Promise<BankData | null> {
  const settings = (await req.payload.findGlobal({
    slug: 'settings',
    depth: 0,
    overrideAccess: true,
    req,
  })) as Setting
  const p = settings.payment ?? {}
  if (!p.accountHolder || !p.iban) return null
  return { accountHolder: p.accountHolder, iban: formatIban(p.iban), bic: p.bic ?? null }
}

const productIdOf = (v: unknown): number | null =>
  typeof v === 'number' ? v : v && typeof v === 'object' ? ((v as Product).id ?? null) : null

export async function loadPrepaymentList(req: PayloadRequest, now: Date): Promise<PrepaymentList> {
  const [openRes, cancelledRes, bank] = await Promise.all([
    req.payload.find({
      collection: 'orders',
      where: { status: { equals: 'awaiting_prepayment' } },
      sort: 'prepayment.dueAt',
      limit: 200,
      depth: 0,
      overrideAccess: true,
      req,
    }),
    req.payload.find({
      collection: 'orders',
      where: {
        and: [
          { status: { equals: 'cancelled' } },
          { cancelReason: { equals: 'payment_timeout' } },
          {
            'timestamps.cancelledAt': {
              greater_than_equal: new Date(now.getTime() - RECENTLY_CANCELLED_DAYS * DAY),
            },
          },
        ],
      },
      sort: '-timestamps.cancelledAt',
      limit: 100,
      depth: 0,
      overrideAccess: true,
      req,
    }),
    bankOf(req),
  ])

  const open = (openRes.docs as Order[]).map((o): PrepaymentCard => {
    const dueAt = o.prepayment?.dueAt ?? null
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      totalCents: o.totalCents,
      placedAt: date(o.timestamps?.placedAt),
      dueDate: date(dueAt),
      daysLeft: dueAt ? daysUntilCancel(dueAt, now) : -1,
      reminderSent: Boolean(o.prepayment?.reminderSentAt),
      reminderSentAt: o.prepayment?.reminderSentAt ? date(o.prepayment.reminderSentAt) : null,
      name: o.billingAddress?.name || o.customer?.name || '',
      items: itemsOf(o),
      bankText: bank ? bankDataText(bank, o.totalCents, o.orderNumber) : null,
    }
  })

  const cancelledDocs = cancelledRes.docs as Order[]
  const productIds = [
    ...new Set(
      cancelledDocs.flatMap((o) =>
        o.items.map((i) => productIdOf(i.product)).filter((v): v is number => v !== null),
      ),
    ),
  ]
  const statusById = new Map<number, string>()
  if (productIds.length > 0) {
    const products = await req.payload.find({
      collection: 'products',
      where: { id: { in: productIds } },
      select: { status: true },
      limit: productIds.length,
      pagination: false,
      depth: 0,
      overrideAccess: true,
      req,
    })
    for (const p of products.docs as Pick<Product, 'id' | 'status'>[])
      statusById.set(p.id, p.status)
  }
  const cancelled = cancelledDocs.map((o): CancelledCard => {
    const ids = o.items.map((i) => productIdOf(i.product))
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      totalCents: o.totalCents,
      placedAt: date(o.timestamps?.placedAt),
      cancelledAt: date(o.timestamps?.cancelledAt),
      name: o.billingAddress?.name || o.customer?.name || '',
      items: itemsOf(o),
      allAvailable:
        ids.length > 0 && ids.every((id) => id !== null && statusById.get(id) === 'available'),
      refundNoted: (o.notes ?? '').includes('Rücküberweisung erledigt'),
    }
  })

  return { open, cancelled, bank }
}
