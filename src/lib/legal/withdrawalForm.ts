import 'server-only'

import config from '@payload-config'
import { createHmac, randomBytes } from 'node:crypto'
import { getPayload, type Payload } from 'payload'
import { z } from 'zod'

import type { Locale } from '@/lib/enums'
import { formatItemNumber } from '@/lib/products/itemNumber'
import { deriveKey } from '@/lib/security/keys'
import { safeEqual } from '@/lib/security/tokens'
import type { Order } from '@/payload-types'

import {
  submitWithdrawal,
  WITHDRAWAL_HONEYPOT_FIELD,
  withdrawalInputSchema,
  type WithdrawalFieldErrors,
  type WithdrawalReceipt,
} from './withdrawal'

// Ablauf der Widerrufsfunktion R26 (PLAN P6.8, KONZEPT §3.16, R-091 bis R-093, § 356a BGB): Schritt 1 (Erklärung) →
// Auswahl der Positionen (nur wenn Bestellnummer und E-Mail zu einer Bestellung passen) → Schritt 2 (Zusammenfassung mit
// „Ändern“ und „Widerruf bestätigen“) → Ergebnis. Zwischen den Schritten reisen die Eingaben per POST in einem signierten
// Formular-Token (HMAC-SHA256, HKDF-Schlüssel `pc:form-token:v1`, 6 h gültig) – nie in der URL (R-137), nie in einem
// Cookie (vor der ersten Warenkorb-Aktion keine Cookies, ARCHITEKTUR §8.7). Erst „Widerruf bestätigen“ ruft
// `submitWithdrawal` (vorher entsteht kein Datensatz, R-092). Funktioniert ohne JavaScript (Server Action mit
// `useActionState`, R-091).

/** Gültigkeit des Formular-Tokens (ein Ausfüllen dauert selten länger; danach Schritt 1 mit Hinweis). */
export const WITHDRAWAL_FORM_TOKEN_TTL_MS = 6 * 60 * 60 * 1000
const TOKEN_VERSION = 1
const ORDER_NUMBER_IN_TEXT = /PC-\d{4}-\d{5}/i
/** Vorbelegung über `?order=` (nur Bestellnummer, KONZEPT §3.16). */
export const WITHDRAWAL_ORDER_PARAM_RE = /^PC-\d{4}-\d{5}$/i

export interface WithdrawalFormValues {
  name: string
  contractIdentification: string
  email: string
  itemsText: string
  reason: string
}

export interface WithdrawalChoiceItem {
  id: string
  label: string
}

/** Inhalt des Formular-Tokens (nur Eingaben der Person und die zur Auswahl angebotenen Positionen). */
interface TokenBody {
  v: number
  iat: number
  /** Einmal-Kennung dieses Ausfüllens (Doppelklick auf „Widerruf bestätigen“ → ein Datensatz). */
  n: string
  locale: Locale
  values: WithdrawalFormValues
  /** Honeypot-Wert aus Schritt 1 (nur weitergereicht; `submitWithdrawal` entscheidet). */
  hp: string
  choices: WithdrawalChoiceItem[]
  selected: string[]
}

export type WithdrawalNotice = 'rate_limited' | 'expired' | 'failed'

export type WithdrawalFlowState =
  | {
      step: 'form'
      rev: number
      values: WithdrawalFormValues
      errors?: WithdrawalFieldErrors
      notice?: WithdrawalNotice
    }
  | {
      step: 'select'
      rev: number
      token: string
      values: WithdrawalFormValues
      choices: WithdrawalChoiceItem[]
      selected: string[]
    }
  | {
      step: 'confirm'
      rev: number
      token: string
      values: WithdrawalFormValues
      /** Gewählte Positionen (Text); leer = ganzer Vertrag. */
      selectedLabels: string[]
      matched: boolean
      notice?: WithdrawalNotice
    }
  | { step: 'done'; rev: number; receipt: WithdrawalReceipt | null }

export const emptyWithdrawalValues = (contractIdentification = ''): WithdrawalFormValues => ({
  name: '',
  contractIdentification,
  email: '',
  itemsText: '',
  reason: '',
})

export function initialWithdrawalState(orderParam?: string | null): WithdrawalFlowState {
  const prefill =
    orderParam && WITHDRAWAL_ORDER_PARAM_RE.test(orderParam.trim())
      ? orderParam.trim().toUpperCase()
      : ''
  return { step: 'form', rev: 0, values: emptyWithdrawalValues(prefill) }
}

// ---------- Formular-Token ----------

const tokenSchema = z.object({
  v: z.literal(TOKEN_VERSION),
  iat: z.number().int(),
  n: z.string().min(16).max(64),
  locale: z.enum(['de', 'en']),
  values: z.object({
    name: z.string().max(200),
    contractIdentification: z.string().max(1000),
    email: z.string().max(300),
    itemsText: z.string().max(2000),
    reason: z.string().max(4000),
  }),
  hp: z.string().max(500),
  choices: z.array(z.object({ id: z.string().max(64), label: z.string().max(300) })).max(50),
  selected: z.array(z.string().max(64)).max(50),
})

const sign = (body: string, key: Buffer) =>
  createHmac('sha256', key).update(body, 'utf8').digest('base64url')

export function signWithdrawalToken(body: Omit<TokenBody, 'v'>, key?: Buffer): string {
  const encoded = Buffer.from(JSON.stringify({ ...body, v: TOKEN_VERSION }), 'utf8').toString(
    'base64url',
  )
  return `${encoded}.${sign(encoded, key ?? deriveKey('formToken'))}`
}

/** Prüft Signatur und Alter; `null` bei manipuliertem, fremdem oder abgelaufenem Token. */
export function verifyWithdrawalToken(token: unknown, now: Date, key?: Buffer): TokenBody | null {
  if (typeof token !== 'string' || token.length > 20_000) return null
  const [encoded, mac, rest] = token.split('.')
  if (!encoded || !mac || rest !== undefined) return null
  if (!safeEqual(mac, sign(encoded, key ?? deriveKey('formToken')))) return null
  try {
    const parsed = tokenSchema.safeParse(
      JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')),
    )
    if (!parsed.success) return null
    const age = now.getTime() - parsed.data.iat
    if (age < -60_000 || age > WITHDRAWAL_FORM_TOKEN_TTL_MS) return null
    return parsed.data as TokenBody
  } catch {
    return null
  }
}

// ---------- Schritte ----------

const str = (fd: FormData, key: string, max = 4000) => {
  const v = fd.get(key)
  return typeof v === 'string' ? v.slice(0, max) : ''
}

function valuesOf(fd: FormData): WithdrawalFormValues {
  return {
    name: str(fd, 'name', 200),
    contractIdentification: str(fd, 'contractIdentification', 1000),
    email: str(fd, 'email', 300),
    itemsText: str(fd, 'itemsText', 2000),
    reason: str(fd, 'reason', 4000),
  }
}

type OrderItem = Order['items'][number]

function itemLabel(item: OrderItem, locale: Locale): string {
  const title = (locale === 'en' ? item.titleEn || item.titleDe : item.titleDe) ?? ''
  return `${formatItemNumber(item.itemNumber, locale)} · ${title}`.trim().slice(0, 300)
}

/**
 * Positionen zur Auswahl: nur wenn eine Bestellnummer `PC-…` im Text steht **und** die E-Mail (ohne Groß/Klein) zur
 * Bestellung passt – dieselbe Regel wie die automatische Zuordnung (DATENMODELL §6.11). Sonst `[]` (keine Auswahl).
 */
export async function withdrawalChoices(
  values: Pick<WithdrawalFormValues, 'contractIdentification' | 'email'>,
  locale: Locale,
  payload?: Payload,
): Promise<WithdrawalChoiceItem[]> {
  const match = ORDER_NUMBER_IN_TEXT.exec(values.contractIdentification)
  const email = values.email.trim().toLowerCase()
  if (!match || !email) return []
  const p = payload ?? (await getPayload({ config }))
  const res = await p.find({
    collection: 'orders',
    where: { orderNumber: { equals: match[0].toUpperCase() } },
    limit: 1,
    depth: 0,
    select: { customer: true, items: true, status: true },
    overrideAccess: true,
  })
  const order = res.docs[0] as Pick<Order, 'customer' | 'items' | 'status'> | undefined
  if (!order || order.customer?.email?.trim().toLowerCase() !== email) return []
  return (order.items ?? [])
    .filter((i) => i.status === 'active' && i.id)
    .map((i) => ({ id: i.id as string, label: itemLabel(i, locale) }))
}

/** Schritt-1-Prüfung mit dem Schema des Dienstes (gleiche Regeln wie beim Speichern). */
function validate(values: WithdrawalFormValues, locale: Locale): WithdrawalFieldErrors | null {
  const parsed = withdrawalInputSchema.safeParse({ ...values, locale, affectedItemIds: [] })
  if (parsed.success) return null
  const out: WithdrawalFieldErrors = {}
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? 'name') as keyof WithdrawalFieldErrors
    const empty = String((values as unknown as Record<string, string>)[key] ?? '').trim() === ''
    out[key] ??= empty ? 'required' : 'invalid'
  }
  return out
}

export interface WithdrawalStepContext {
  now: Date
  locale: Locale
  ip?: string | null
  payload?: Payload
}

function confirmState(
  body: TokenBody,
  rev: number,
  now: Date,
  notice?: WithdrawalNotice,
): WithdrawalFlowState {
  const token = signWithdrawalToken({ ...body, iat: now.getTime() })
  const chosen = new Set(body.selected)
  return {
    step: 'confirm',
    rev,
    token,
    values: body.values,
    selectedLabels: body.choices.filter((c) => chosen.has(c.id)).map((c) => c.label),
    matched: body.choices.length > 0,
    ...(notice ? { notice } : {}),
  }
}

/**
 * Ein Schritt der Widerrufsfunktion. `intent` kommt vom gedrückten Knopf: `next` (Schritt 1 bzw. Auswahl → weiter),
 * `edit` („Ändern“ → Schritt 1 mit den Eingaben), `confirm` („Widerruf bestätigen“ → `submitWithdrawal`).
 */
export async function withdrawalStep(
  prev: WithdrawalFlowState,
  fd: FormData,
  ctx: WithdrawalStepContext,
): Promise<WithdrawalFlowState> {
  const { now, locale } = ctx
  const rev = (prev?.rev ?? 0) + 1
  const intent = str(fd, 'intent', 20)
  const stage = str(fd, 'stage', 20)

  if (stage === 'form') {
    const values = valuesOf(fd)
    const errors = validate(values, locale)
    if (errors) return { step: 'form', rev, values, errors }
    const choices = await withdrawalChoices(values, locale, ctx.payload)
    const body: TokenBody = {
      v: TOKEN_VERSION,
      iat: now.getTime(),
      n: randomBytes(16).toString('base64url'),
      locale,
      values,
      hp: str(fd, WITHDRAWAL_HONEYPOT_FIELD, 500),
      choices,
      selected: [],
    }
    if (choices.length === 0) return confirmState(body, rev, now)
    return {
      step: 'select',
      rev,
      token: signWithdrawalToken(body),
      values,
      choices,
      selected: [],
    }
  }

  const body = verifyWithdrawalToken(fd.get('token'), now)
  if (!body) {
    return { step: 'form', rev, values: emptyWithdrawalValues(), notice: 'expired' }
  }
  if (intent === 'edit') return { step: 'form', rev, values: body.values }

  if (stage === 'select') {
    const offered = new Set(body.choices.map((c) => c.id))
    const selected = fd
      .getAll('affectedItemIds')
      .map(String)
      .filter((id) => offered.has(id))
    return confirmState({ ...body, selected: [...new Set(selected)] }, rev, now)
  }

  if (stage === 'confirm' && intent === 'confirm') {
    let result: Awaited<ReturnType<typeof submitWithdrawal>>
    try {
      result = await submitWithdrawal(
        {
          ...body.values,
          affectedItemIds: body.selected,
          locale: body.locale,
          [WITHDRAWAL_HONEYPOT_FIELD]: body.hp,
        },
        { now, ip: ctx.ip ?? null, payload: ctx.payload, formNonce: body.n },
      )
    } catch {
      return confirmState(body, rev, now, 'failed')
    }
    if (result.ok) return { step: 'done', rev, receipt: result.spam ? null : result.receipt }
    if (result.status === 429) {
      return confirmState(body, rev, now, 'rate_limited')
    }
    return { step: 'form', rev, values: body.values, errors: result.errors }
  }
  return confirmState(body, rev, now)
}
