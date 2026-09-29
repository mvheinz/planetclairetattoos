import 'server-only'

import de from '@/i18n/messages/de.json'
import en from '@/i18n/messages/en.json'
import type { Locale } from '@/lib/enums'
import { WITHDRAWAL_LINK_LABEL } from '@/lib/legal/constants'

import type { MailLinks } from './links'
import { S } from './styles'

// Fußbereiche (KONZEPT §6.1, R-080, R-021): Kund:innen-Mails mit Anbieterkennung (Name, Anschrift, E-Mail – die
// Telefonnummer nur in der Anbieterkennung von M01/M02, P4.14), Links Impressum und Datenschutz, bei Bestellmails
// zusätzlich Bestellstatus und „Vertrag widerrufen“. Keine Werbung, keine Social-Links, kein OS-Link.
// Verwaltungs-Mails: Direktlink in die Verwaltung (`ADMIN_ROUTE`), immer Deutsch.

const MESSAGES = { de, en } as const

export interface MailBusiness {
  legalName: string
  tradeName?: string | null
  street: string
  postalCode?: string | null
  city: string
  email: string
}

export interface CustomerFooterInput {
  locale: Locale
  business: MailBusiness
  links: MailLinks
  /** Bestellmail: Links Bestellstatus (falls vorhanden) und „Vertrag widerrufen“. */
  orderMail: boolean
}

function footerLinks(input: CustomerFooterInput): { label: string; href: string }[] {
  const t = MESSAGES[input.locale].email.footer
  const out = [
    { label: t.imprint, href: input.links.imprint },
    { label: t.privacy, href: input.links.privacy },
  ]
  if (input.orderMail) {
    if (input.links.orderStatus) out.push({ label: t.orderStatus, href: input.links.orderStatus })
    out.push({ label: WITHDRAWAL_LINK_LABEL[input.locale], href: input.links.withdraw })
  }
  return out
}

const nameLine = (b: MailBusiness) =>
  b.tradeName ? `${b.legalName} · ${b.tradeName}` : b.legalName
const addressLine = (b: MailBusiness) => `${b.street}, ${b.postalCode ?? ''} ${b.city}`.trim()

export function CustomerFooter(input: CustomerFooterInput) {
  const links = footerLinks(input)
  return (
    <>
      <p style={{ margin: '0 0 4px' }}>{nameLine(input.business)}</p>
      <p style={{ margin: '0 0 4px' }}>{addressLine(input.business)}</p>
      <p style={{ margin: '0 0 10px' }}>
        <a href={`mailto:${input.business.email}`} style={S.link}>
          {input.business.email}
        </a>
      </p>
      <p style={{ margin: 0 }}>
        {links.map((l, i) => (
          <span key={l.href}>
            {i > 0 ? ' · ' : null}
            <a href={l.href} style={S.link}>
              {l.label}
            </a>
          </span>
        ))}
      </p>
    </>
  )
}

export function customerFooterText(input: CustomerFooterInput): string {
  const b = input.business
  return [
    '--',
    nameLine(b),
    addressLine(b),
    b.email,
    '',
    ...footerLinks(input).map((l) => `${l.label}: ${l.href}`),
  ].join('\n')
}

export const ADMIN_FOOTER_NOTE = 'Diese Nachricht hat deine Website automatisch erzeugt.'

export function adminLink(links: MailLinks, adminPath = ''): string {
  return `${links.admin}${adminPath}`
}

export function AdminFooter({ links, adminPath }: { links: MailLinks; adminPath?: string }) {
  return (
    <>
      <p style={{ margin: '0 0 4px' }}>{ADMIN_FOOTER_NOTE}</p>
      <p style={{ margin: 0 }}>
        <a href={adminLink(links, adminPath)} style={S.link}>
          Zur Verwaltung
        </a>
      </p>
    </>
  )
}

export function adminFooterText(links: MailLinks, adminPath = ''): string {
  return ['--', ADMIN_FOOTER_NOTE, `Zur Verwaltung: ${adminLink(links, adminPath)}`].join('\n')
}
