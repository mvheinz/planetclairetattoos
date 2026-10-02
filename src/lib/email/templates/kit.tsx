import 'server-only'

import { Fragment, type ReactNode } from 'react'

import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import type { Locale } from '@/lib/enums'
import { formatMoney } from '@/lib/money'
import { formatBerlin } from '@/lib/time'

import {
  AdminFooter,
  adminFooterText,
  CidImage,
  CustomerFooter,
  customerFooterText,
  EmailLayout,
  renderMailHtml,
  type MailBusiness,
  type MailLinks,
} from '../layout'
import { COLORS, S } from '../layout/styles'
import type { RenderedMail } from '../registry'
import type { MailAttachment } from '../types'

// Baukasten der Mail-Vorlagen (P4.14/P4.15): Inhalt als Folge von Blöcken, aus denen HTML (React, Inline-Stile) und
// Textfassung parallel entstehen – so enthalten beide Fassungen dieselben Pflichtangaben. Texte der Kund:innen-Mails
// kommen aus `src/i18n/messages/{de,en}.json` (`email.*`); `fill` wirft bei fehlenden Werten, damit nie ein roher
// Platzhalter in einer Mail steht (R-084). Verwaltungs-Mails sind immer Deutsch.

const MESSAGES = { de: de.email, en: en.email } as const
export type EmailMessages = (typeof MESSAGES)['de']

export function mailTexts(locale: Locale): EmailMessages {
  return MESSAGES[locale] as EmailMessages
}

export class MailTextError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MailTextError'
  }
}

/** Ersetzt `{name}`-Platzhalter; fehlender oder leerer Wert → `MailTextError`. */
export function fill(template: string, vars: Record<string, string | number> = {}): string {
  const out = template.replace(/\{(\w+)\}/g, (raw, name: string) => {
    const v = vars[name]
    if (v === undefined || v === null || String(v).trim() === '') {
      throw new MailTextError(`Mail-Text: Platzhalter ${raw} ohne Wert.`)
    }
    return String(v)
  })
  return out
}

// --- Formate (Anzeige immer Europe/Berlin) ---------------------------------------------------------------------

const DATE: Record<Locale, string> = { de: 'dd.MM.yyyy', en: 'd MMM yyyy' }

export const fmtDate = (iso: string | Date, locale: Locale) =>
  formatBerlin(new Date(iso), DATE[locale], locale)

export const fmtDateTime = (iso: string | Date, locale: Locale) =>
  fill(mailTexts(locale).common.dateTime, {
    date: fmtDate(iso, locale),
    time: formatBerlin(new Date(iso), 'HH:mm', locale),
  })

export const money = (cents: number, locale: Locale) => formatMoney(cents, locale)

// --- Blöcke ----------------------------------------------------------------------------------------------------

export interface Block {
  html: ReactNode
  text: string
}

const TD_LABEL = { padding: '2px 12px 2px 0', color: COLORS.muted, verticalAlign: 'top' } as const
const TD_VALUE = { padding: '2px 0', verticalAlign: 'top' } as const
const TD_AMOUNT = { padding: '2px 0', textAlign: 'right', whiteSpace: 'nowrap' } as const
const H2 = { fontSize: 16, lineHeight: '1.3', margin: '20px 0 8px', fontWeight: 700 } as const
const NOTE = {
  margin: '0 0 12px',
  padding: '8px 12px',
  border: `1px dashed ${COLORS.muted}`,
  color: COLORS.muted,
} as const

export const block = {
  p(text: string, key?: string): Block {
    return {
      html: (
        <p key={key} style={S.p}>
          {text}
        </p>
      ),
      text,
    }
  },
  h(text: string, key?: string): Block {
    return {
      html: (
        <h2 key={key} style={H2}>
          {text}
        </h2>
      ),
      text: `\n${text}\n${'-'.repeat(Math.min(text.length, 40))}`,
    }
  },
  /** Absatz, darunter ein Link (Text: „Beschriftung: URL“). */
  link(intro: string, label: string, href: string, key?: string): Block {
    return {
      html: (
        <p key={key} style={S.p}>
          {intro}{' '}
          <a href={href} style={S.link}>
            {label}
          </a>
        </p>
      ),
      text: `${intro}\n${label}: ${href}`,
    }
  },
  /** Zweispaltige Liste „Bezeichnung – Wert“. */
  rows(rows: readonly (readonly [string, string])[], key?: string): Block {
    return {
      html: (
        <table
          key={key}
          role="presentation"
          cellPadding={0}
          cellSpacing={0}
          style={{ margin: '0 0 12px' }}
        >
          <tbody>
            {rows.map(([label, value], i) => (
              <tr key={i}>
                <td style={TD_LABEL}>{label}</td>
                <td style={TD_VALUE}>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ),
      text: rows.map(([l, v]) => `${l}: ${v}`).join('\n'),
    }
  },
  list(items: readonly string[], key?: string): Block {
    return {
      html: (
        <ul key={key} style={{ margin: '0 0 12px', paddingLeft: 20 }}>
          {items.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      ),
      text: items.map((t) => `- ${t}`).join('\n'),
    }
  },
  /** Mehrzeiliger Block (z. B. Adresse), Zeilen mit `<br>`. */
  lines(lines: readonly string[], key?: string): Block {
    return {
      html: (
        <p key={key} style={S.p}>
          {lines.map((l, i) => (
            <span key={i}>
              {i > 0 ? <br /> : null}
              {l}
            </span>
          ))}
        </p>
      ),
      text: lines.join('\n'),
    }
  },
  /** Gekennzeichneter Platzhalter (Kanzlei-Wortlaut folgt, R-002). */
  placeholder(mark: string, text: string, key?: string): Block {
    return {
      html: (
        <p key={key} style={NOTE}>
          <strong>{mark}</strong> {text}
        </p>
      ),
      text: `${mark} ${text}`,
    }
  },
  image(cid: string, alt: string, size: number, key?: string): Block {
    return {
      html: (
        <div key={key} style={{ margin: '0 0 12px' }}>
          <CidImage cid={cid} alt={alt} width={size} height={size} style={{ margin: 0 }} />
        </div>
      ),
      text: '',
    }
  },
}

export interface PriceLine {
  label: string
  detail?: string[]
  amount: string
  strong?: boolean
}

/** Positionen mit Beträgen rechts (Stücke, Versand, Gesamt). */
export function priceTable(lines: readonly PriceLine[], key?: string): Block {
  return {
    html: (
      <table
        key={key}
        role="presentation"
        width="100%"
        cellPadding={0}
        cellSpacing={0}
        style={{ margin: '0 0 12px', borderCollapse: 'collapse' }}
      >
        <tbody>
          {lines.map((l, i) => (
            <tr key={i} style={l.strong ? { borderTop: `1px solid ${COLORS.line}` } : undefined}>
              <td style={{ ...TD_VALUE, padding: '4px 12px 4px 0' }}>
                {l.strong ? <strong>{l.label}</strong> : l.label}
                {(l.detail ?? []).map((d, j) => (
                  <span key={j} style={{ display: 'block', color: COLORS.muted, fontSize: 13 }}>
                    {d}
                  </span>
                ))}
              </td>
              <td style={{ ...TD_AMOUNT, padding: '4px 0' }}>
                {l.strong ? <strong>{l.amount}</strong> : l.amount}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
    text: lines
      .map((l) => [`${l.label}: ${l.amount}`, ...(l.detail ?? []).map((d) => `  ${d}`)].join('\n'))
      .join('\n'),
  }
}

// --- Zusammensetzen --------------------------------------------------------------------------------------------

function joinText(blocks: readonly Block[]): string {
  return blocks
    .map((b) => b.text)
    .filter((t) => t !== '')
    .join('\n\n')
    .replace(/\n{3,}/g, '\n\n')
}

export interface CustomerMailInput {
  locale: Locale
  subject: string
  title: string
  blocks: readonly Block[]
  links: MailLinks
  business: MailBusiness
  /** Bestellmail: Fuß mit Bestellstatus und „Vertrag widerrufen“. */
  orderMail: boolean
  images?: MailAttachment[]
}

export async function renderCustomerMail(input: CustomerMailInput): Promise<RenderedMail> {
  const footer = {
    locale: input.locale,
    business: input.business,
    links: input.links,
    orderMail: input.orderMail,
  }
  const html = await renderMailHtml(
    <EmailLayout locale={input.locale} title={input.title} footer={<CustomerFooter {...footer} />}>
      {input.blocks.map((b, i) => (
        <Fragment key={i}>{b.html}</Fragment>
      ))}
    </EmailLayout>,
  )
  const text = `${[input.title, '', joinText(input.blocks), '', customerFooterText(footer)].join('\n')}\n`
  return { subject: input.subject, html, text, images: input.images ?? [] }
}

export interface AdminMailInput {
  subject: string
  blocks: readonly Block[]
  links: MailLinks
  /** Pfad unterhalb von `ADMIN_ROUTE` (Direktlink). */
  adminPath?: string
}

export async function renderAdminMail(input: AdminMailInput): Promise<RenderedMail> {
  const html = await renderMailHtml(
    <EmailLayout
      locale="de"
      title={input.subject}
      footer={<AdminFooter links={input.links} adminPath={input.adminPath} />}
    >
      {input.blocks.map((b, i) => (
        <Fragment key={i}>{b.html}</Fragment>
      ))}
    </EmailLayout>,
  )
  const text = `${[input.subject, '', joinText(input.blocks), '', adminFooterText(input.links, input.adminPath)].join('\n')}\n`
  return { subject: input.subject, html, text, images: [] }
}

/** Grußformel: Mail-Baustein „Grußformel und Signatur“ (P5.27), sonst Standard-Grußformel mit Geschäftsname. */
export function closingBlock(locale: Locale, business: MailBusiness): Block {
  const signature = business.signature?.trim()
  if (signature)
    return block.lines(
      signature
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    )
  const name = business.tradeName || business.legalName
  return block.lines([mailTexts(locale).common.closing, name])
}

export function greetingBlock(locale: Locale, name?: string | null): Block {
  const t = mailTexts(locale).common
  const first = name?.trim()
  return block.p(first ? fill(t.greeting, { name: first }) : t.greetingNoName)
}
