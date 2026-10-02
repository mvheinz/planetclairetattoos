import 'server-only'

import { z } from 'zod'

import type { Locale } from '@/lib/enums'
import { getSnippet } from '@/lib/legal/snippets'
import { formatItemNumber } from '@/lib/products/itemNumber'
import { formatBerlin, formatBerlinWithZone } from '@/lib/time'

import type { MailBusiness } from '../layout'
import type { RenderedMail, TemplateRenderInput } from '../registry'

import {
  block,
  closingBlock,
  fill,
  fmtDate,
  greetingBlock,
  mailTexts,
  renderCustomerMail,
  type Block,
} from './kit'

// M08 `withdrawal_receipt` – Eingangsbestätigung des Widerrufs (§ 356a Abs. 4 BGB, KONZEPT §6.3 „M08“, R-093):
// vollständiger Inhalt der Erklärung, Datum und Uhrzeit des Eingangs mit Zeitzone (MEZ/MESZ), Vorgangsnummer,
// Bausteine `withdrawal.receiptNotice` und `withdrawal.returnInfo` (Rücksendeadresse, Rücksendekosten E-27),
// Erstattungshinweis; bei unbezahlter Vorkasse stattdessen „Deine Bestellung ist damit storniert. Bitte nichts
// überweisen.“ Keine Bestellmail (kein Status-Link), keine Werbung.

export const WITHDRAWAL_RECEIPT_VERSION = 'm08-v1'

const iso = z.iso.datetime({ offset: true })

export const withdrawalReceiptDataSchema = z.object({
  withdrawalId: z.number().int().positive(),
  reference: z.string().regex(/^(BSP-)?WR-\d{4}-\d{5,}$/),
  receivedAt: iso,
  refundDueAt: iso,
  name: z.string().min(1).max(100),
  contractIdentification: z.string().min(1).max(500),
  email: z.string().min(3).max(254),
  itemsText: z.string().max(1000).nullish(),
  /** Ausgewählte Positionen der zugeordneten Bestellung (leer = ganzer Vertrag bzw. Freitext). */
  items: z
    .array(z.object({ itemNumber: z.number().int().positive(), title: z.string().min(1).max(200) }))
    .max(50)
    .default([]),
  reason: z.string().max(2000).nullish(),
  /** Unbezahlte Vorkasse-Bestellung durch den Widerruf storniert (O4 `withdrawn`, W5). */
  unpaidOrderCancelled: z.boolean().default(false),
  /** `settings.business.returnAddress` beim Eingang (leer = Geschäftsadresse). */
  returnAddress: z.string().max(300).nullish(),
})
export type WithdrawalReceiptData = z.infer<typeof withdrawalReceiptDataSchema>

export const withdrawalReceiptSubject = (d: WithdrawalReceiptData, locale: Locale) => {
  const at = new Date(d.receivedAt)
  return fill(mailTexts(locale).withdrawalReceipt.subject, {
    reference: d.reference,
    date: fmtDate(at, locale),
    time: formatBerlin(at, 'HH:mm', locale),
  })
}

/** „Name, Straße, PLZ Ort“ aus der Rücksendeadresse (eine Zeile je Angabe); `null`, wenn nicht zerlegbar. */
export function splitReturnAddress(
  text: string,
): { name: string; street: string; postalCode: string; city: string } | null {
  const lines = text
    .split(/\r?\n|,/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 3) return null
  const last = /^(\d{4,5})\s+(.+)$/.exec(lines[lines.length - 1]!)
  if (!last) return null
  return {
    name: lines[0]!,
    street: lines.slice(1, -1).join(', '),
    postalCode: last[1]!,
    city: last[2]!,
  }
}

/** Baustein `withdrawal.returnInfo` mit der Rücksendeadresse (leer = Geschäftsadresse). */
function returnInfoBlocks(d: WithdrawalReceiptData, locale: Locale, b: MailBusiness): Block[] {
  const custom = d.returnAddress?.trim()
  const parts = custom
    ? splitReturnAddress(custom)
    : {
        name: b.tradeName ? `${b.legalName} · ${b.tradeName}` : b.legalName,
        street: b.street,
        postalCode: b.postalCode ?? '',
        city: b.city,
      }
  if (parts && parts.postalCode) {
    return [block.p(getSnippet('withdrawal.returnInfo', locale, parts).text)]
  }
  // Freie Rücksendeadresse, die sich nicht in Name/Straße/PLZ Ort zerlegen lässt: Adresse wörtlich, Kostenhinweis
  // aus dem Baustein `withdrawal.returnCostsNote` (gleicher Inhalt wie `returnInfo`).
  const address = (custom ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(', ')
  return [
    block.p(fill(mailTexts(locale).withdrawalReceipt.returnAddress, { address })),
    block.p(getSnippet('withdrawal.returnCostsNote', locale).text),
  ]
}

export async function renderWithdrawalReceipt(
  input: TemplateRenderInput<WithdrawalReceiptData>,
): Promise<RenderedMail> {
  const { data: d, locale, links, business } = input
  const t = mailTexts(locale).withdrawalReceipt
  const items =
    d.items.length > 0
      ? d.items.map((i) => `${formatItemNumber(i.itemNumber, locale)} · ${i.title}`).join('; ')
      : d.itemsText?.trim() || t.itemsAll
  const declaration: [string, string][] = [
    [t.name, d.name],
    [t.contract, d.contractIdentification],
    [t.items, items],
  ]
  if (d.reason?.trim()) declaration.push([t.reason, d.reason.trim()])
  declaration.push([t.email, d.email])

  const next: Block[] = d.unpaidOrderCancelled
    ? [block.p(t.unpaidCancelled)]
    : [
        block.h(t.nextHeading),
        ...returnInfoBlocks(d, locale, business),
        block.p(fill(t.refund, { date: fmtDate(d.refundDueAt, locale) })),
      ]

  return renderCustomerMail({
    locale,
    subject: withdrawalReceiptSubject(d, locale),
    title: t.title,
    links,
    business,
    // Fuß mit „Vertrag widerrufen“ wie alle bestellbezogenen Mails M01–M09 (PLAN P6.6, R-090); kein Status-Link.
    orderMail: true,
    blocks: [
      greetingBlock(locale, d.name),
      block.p(getSnippet('withdrawal.receiptNotice', locale).text),
      block.rows([
        [t.reference, d.reference],
        [t.receivedAt, formatBerlinWithZone(new Date(d.receivedAt), locale)],
      ]),
      block.h(t.declarationHeading),
      block.rows(declaration),
      ...next,
      block.p(t.keep),
      block.link(
        mailTexts(locale).common.privacyLink,
        mailTexts(locale).common.privacyLinkLabel,
        links.privacy,
      ),
      closingBlock(locale, business),
    ],
  })
}
