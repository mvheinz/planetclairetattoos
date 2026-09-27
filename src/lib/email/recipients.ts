import 'server-only'

// Empfänger-Regeln (ARCHITEKTUR §3.4, R-180): reservierte Domains werden in allen Umgebungen nie beliefert.

export const SUPPRESSED_DOMAINS = ['example.com', 'example.org', 'example.net'] as const
export const SUPPRESSED_TLDS = ['invalid', 'test'] as const

export function domainOf(address: string): string {
  return (address.split('@').pop() ?? '').toLowerCase().trim().replace(/\.$/, '')
}

/** Reservierte Empfänger-Domains werden in allen Umgebungen unterdrückt (R-180, ARCHITEKTUR §3.4). */
export function isSuppressedRecipient(to: string): boolean {
  const domain = domainOf(to)
  if ((SUPPRESSED_DOMAINS as readonly string[]).includes(domain)) return true
  return SUPPRESSED_TLDS.some((tld) => domain === tld || domain.endsWith(`.${tld}`))
}

type AddressInput =
  | string
  | { name?: string; address?: string }
  | (string | { name?: string; address?: string })[]
  | undefined
  | null

/** Reine Adressen aus einem nodemailer-Adressfeld („Name <a@b>“, Objekt oder Liste). */
export function addressList(value: AddressInput | unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.flatMap((v) => addressList(v))
  if (typeof value === 'object') {
    const a = (value as { address?: string }).address
    return a ? [a.trim()] : []
  }
  return String(value)
    .split(',')
    .map((part) => {
      const m = /<([^>]+)>/.exec(part)
      return (m ? m[1] : part)!.trim()
    })
    .filter((a) => a.includes('@'))
}
