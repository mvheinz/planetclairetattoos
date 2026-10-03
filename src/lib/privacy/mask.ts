// Teilweise maskierte Empfänger für Protokoll-Listen (PLAN P6.19, KONZEPT §6.1): genug zum Wiedererkennen, nicht
// genug zum Abschreiben – „er***@pl***.local“. Reine Funktion (auch im Browser nutzbar).

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '–'
  const at = email.lastIndexOf('@')
  if (at < 1) return '***'
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  const dot = domain.lastIndexOf('.')
  const host = dot > 0 ? domain.slice(0, dot) : domain
  const tld = dot > 0 ? domain.slice(dot) : ''
  return `${local.slice(0, Math.min(2, local.length - 1) || 1)}***@${host.slice(0, 2)}***${tld}`
}
