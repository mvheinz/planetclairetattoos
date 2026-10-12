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
  /(?<![\w-])(?:\+|00)\d{1,3}[\s/-]?\(?\d{1,5}\)?(?:[\s/-]?\d{2,}){2,}(?![\w-])/g, // Telefonnummer international
  // Telefonnummer national. Beide Telefon-Muster nicht innerhalb von Bindestrich-Kennungen (UUID `08274916-9ea3-…`)
  /(?<![\w-])0\d{2,5}[\s/-]?\d{3,}(?:[\s/-]?\d{2,})*(?![\w-])/g,
]

/**
 * Werte aus Datenbank-Fehlern (R-137, R-133): Drizzle hängt an jede fehlgeschlagene Abfrage `\nparams: <Werte>` an
 * (`DrizzleQueryError` – Namen, Adressen, Freitext der Anfrage), Postgres nennt Werte in `Failing row contains (…)`,
 * `Key (spalte)=(wert)` und `invalid input … : "wert"`. Diese Teile fallen vor allen anderen Mustern weg; SQL-Text,
 * Spalten- und Constraint-Namen bleiben lesbar.
 */
const DB_VALUE_PATTERNS: [RegExp, string][] = [
  // Zeilenumbruch echt oder als `\n` (bereits JSON-kodierter Text); alles danach gehört zu den Werten bzw. zum Stack.
  [/(\r?\n|\\n)params: [\s\S]*$/, `$1params: ${REDACTED}`],
  [/Failing row contains [\s\S]*$/, `Failing row contains (${REDACTED})`],
  [/\bKey \(([^()\n]*)\)=\([^\n]*/g, `Key ($1)=(${REDACTED})`],
  [/(invalid input (?:syntax|value) for [^:\n]{1,120}: )"[^\n]*/g, `$1"${REDACTED}"`],
]

export function isSensitiveKey(key: string): boolean {
  return KEY_PATTERNS.some((re) => re.test(key))
}

export function redactText(text: string): string {
  const withoutValues = DB_VALUE_PATTERNS.reduce((acc, [re, by]) => acc.replace(re, by), text)
  return TEXT_PATTERNS.reduce((acc, re) => acc.replace(re, REDACTED), withoutValues)
}

/** Kurzer, nicht personenbezogener Fehlercode (Postgres-SQLSTATE `23505`, Node `ECONNREFUSED`, Stripe-Codes). */
function errorCode(e: object): string | undefined {
  const code = (e as { code?: unknown }).code
  if (typeof code === 'number') return String(code)
  return typeof code === 'string' && /^[A-Za-z0-9_.-]{1,64}$/.test(code) ? code : undefined
}

/**
 * Fehler als Log-Objekt: Name, Code, Constraint (nur Namen) und geschwärzte Meldung; `cause` rekursiv (Drizzle legt den
 * Postgres-Fehler dort ab). Abfrage (`query`), Werte (`params`) und Postgres-`detail` werden nie übernommen.
 */
function redactError(e: Error, seen: WeakSet<object>): unknown {
  if (seen.has(e)) return '[circular]'
  seen.add(e)
  const out: Record<string, unknown> = { name: e.name, message: redactText(String(e.message)) }
  const code = errorCode(e)
  if (code) out.code = code
  const constraint = (e as { constraint?: unknown }).constraint
  if (typeof constraint === 'string' && /^[A-Za-z0-9_.-]{1,128}$/.test(constraint)) {
    out.constraint = constraint
  }
  if (e.cause !== undefined && e.cause !== null) out.cause = redact(e.cause, seen)
  return out
}

/** Schwärzt Schlüssel und Freitext rekursiv; Zyklen werden abgeschnitten. */
export function redact(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === 'string') return redactText(value)
  if (value === null || typeof value !== 'object') return value
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) return redactError(value, seen)
  if (seen.has(value)) return '[circular]'
  seen.add(value)
  if (Array.isArray(value)) return value.map((v) => redact(v, seen))
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value)) {
    out[k] = isSensitiveKey(k) ? REDACTED : redact(v, seen)
  }
  return out
}

const SUMMARY_PART_MAX = 240
const SUMMARY_DEPTH = 3

/** Name für die Kurzform: `DrizzleQueryError` setzt keinen eigenen `name`, nur die Klasse heißt so. */
function errorName(e: Error): string {
  const ctor = (e.constructor as { name?: unknown } | undefined)?.name
  if (e.name === 'Error' && typeof ctor === 'string' && /^[A-Z]\w{2,}Error$/.test(ctor)) return ctor
  return e.name
}

function summaryPart(e: unknown): string {
  if (!(e instanceof Error)) {
    const message =
      typeof e === 'string'
        ? e
        : typeof (e as { message?: unknown } | null)?.message === 'string'
          ? (e as { message: string }).message
          : String(e)
    return redactText(message)
  }
  const name = errorName(e)
  const code = errorCode(e)
  const label = [name !== 'Error' ? name : '', code ? `[${code}]` : ''].filter(Boolean).join(' ')
  const message = redactText(String(e.message)).replace(/\s+/g, ' ').trim()
  const short =
    message.length > SUMMARY_PART_MAX ? `${message.slice(0, SUMMARY_PART_MAX - 1)}…` : message
  return label ? `${label}: ${short}` : short
}

/**
 * Kurzform eines Fehlers für Log-Felder und technische Fehlerspalten (R-137, R-133): Name (ohne das nichtssagende
 * `Error`), Code (Postgres-SQLSTATE u. a.) und geschwärzte Meldung – ohne Drizzle-`params` und Postgres-Werte –, dazu bis
 * zu zwei Ebenen `cause` („←“). Ein schlichter `new Error('x')` ergibt `x`.
 */
export function errorSummary(e: unknown): string {
  const parts: string[] = []
  let current: unknown = e
  for (let depth = 0; depth < SUMMARY_DEPTH && current !== undefined && current !== null; depth++) {
    parts.push(summaryPart(current))
    current = current instanceof Error ? current.cause : undefined
  }
  return parts.join(' ← ')
}
