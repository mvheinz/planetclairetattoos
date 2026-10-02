import 'server-only'

// Schwärzung vor jeder Log-Ausgabe (ARCHITEKTUR §8.11, R-137).
export const REDACTED = '[redacted]'

const KEY_PATTERNS: RegExp[] = [
  /^email$/i,
  /^name$/i,
  /^firstName$/i,
  /^lastName$/i,
  /^(customer|full|buyer|recipient)Name$/i,
  // Empfänger von Mails (P4.13, ARCHITEKTUR §8.11)
  /^(to|cc|bcc|replyTo|recipient|recipients|originalTo)$/i,
  // Adressen und Käufer:innen-Blöcke (Liefer-/Rechnungsadresse, `invoice.data.buyer`)
  /address/i,
  /^(buyer|customer)$/i,
  /^street$/i,
  /^postalCode$/i,
  /^city$/i,
  /^phone$/i,
  /^iban$/i,
  /^bic$/i,
  // Tokens jeder Art: Status-Token, Siegel, Kassen-/Danke-Token, Reset-Token
  /token/i,
  /^statusUrl$/i,
  /^password$/i,
  /^authorization$/i,
  /^cookie$/i,
]

const TEXT_PATTERNS: RegExp[] = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, // E-Mail
  /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]){11,30}\b/g, // IBAN (auch mit Leerzeichen-Gruppen)
  /(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/g, // 43-Zeichen-base64url-Token
  /\bv1\.[A-Za-z0-9_-]{40,}/g, // Siegel des Status-Tokens (AES-GCM, `sealToken`)
  /(?<![\w])(?:\+|00)\d{1,3}[\s/-]?\(?\d{1,5}\)?(?:[\s/-]?\d{2,}){2,}(?![\w])/g, // Telefonnummer international
  /(?<![\w])0\d{2,5}[\s/-]?\d{3,}(?:[\s/-]?\d{2,})*(?![\w])/g, // Telefonnummer national
]

export function isSensitiveKey(key: string): boolean {
  return KEY_PATTERNS.some((re) => re.test(key))
}

export function redactText(text: string): string {
  return TEXT_PATTERNS.reduce((acc, re) => acc.replace(re, REDACTED), text)
}

/** Schwärzt Schlüssel und Freitext rekursiv; Zyklen werden abgeschnitten. */
export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactText(value)
  if (value === null || typeof value !== 'object') return value
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) return { name: value.name, message: redactText(value.message) }
  if (seen.has(value)) return '[circular]'
  seen.add(value)
  if (Array.isArray(value)) return value.map((v) => redact(v, seen))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    out[k] = isSensitiveKey(k) ? REDACTED : redact(v, seen)
  }
  return out
}
