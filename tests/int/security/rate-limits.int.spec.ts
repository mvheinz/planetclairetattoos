import { randomBytes, randomInt } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { addToCart } from '@/lib/commerce/cart'
import { checkoutStartAllowed } from '@/lib/commerce/checkout'
import { handleProductStatus } from '@/lib/commerce/productStatus'
import { checkoutSubmitAllowed } from '@/lib/commerce/submitCheckout'
import { handleCheckoutState, handleOrderDocument } from '@/lib/commerce/tokenPages'
import { createCommissionFormToken } from '@/lib/commission/formToken'
import { submitCommission } from '@/lib/commission/submit'
import { handleCommissionUpload } from '@/lib/commission/upload'
import { parseEnv } from '@/lib/env'
import { loadOrderStatusPage, loadThanksPage } from '@/lib/data/tokenPages'
import { submitWithdrawal } from '@/lib/legal/withdrawal'
import { handleClientError } from '@/lib/monitoring/clientErrors'
import { setErrorReporter } from '@/lib/monitoring/errorReporter'
import { handlePrivacyExport } from '@/lib/privacy/download'
import { ipHash } from '@/lib/security/ipHash'
import {
  hashRateLimitKey,
  hit,
  purgeRateLimits,
  RATE_LIMITS,
  RATE_LIMIT_RETENTION_MS,
  type RateLimitBucket,
} from '@/lib/security/rateLimit'

import { dbOf } from '../helpers/commerce'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P10.6 Rate-Limits (ARCHITEKTUR §8.5, R-134, L-13a): jeder Bucket tabellengetrieben mit Grenzwert-Test – der N-te
// Aufruf wird zugelassen, der (N+1)-te abgelehnt (429 mit `Retry-After` bzw. die in §8.5 genannte stille Antwort), eine
// andere IP bleibt unberührt, gespeichert wird nur der Hash. Die Grenzen selbst werden aus der Tabelle in
// ARCHITEKTUR §8.5 gelesen und mit `RATE_LIMITS` verglichen. Aufgerufen wird jeweils die echte Stelle des Buckets.

const ROOT = path.resolve(import.meta.dirname, '../../..')
const NOW = new Date('2026-10-02T10:00:30.000Z')
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const freshIp = () =>
  `2001:db8:10:${randomInt(0, 65535).toString(16)}::${randomBytes(3).toString('hex')}`
const freshToken = () => randomBytes(32).toString('base64url')

// --- 1. Grenzen laut ARCHITEKTUR §8.5 ------------------------------------------------------------------------------

const UNIT_MS: Record<string, number> = { min: MINUTE, h: HOUR, Tag: DAY }

/** Tabelle §8.5 → `{ bucket: [{limit, windowMs}, …] }` (zweiter Wert einer Zeile = Tages-Bucket `<bucket>_day`). */
function documentedLimits(): Record<string, { limit: number; windowMs: number }> {
  const doc = readFileSync(path.join(ROOT, 'docs/ARCHITEKTUR.md'), 'utf8')
  const section = doc.slice(doc.indexOf('### 8.5 Rate-Limits'), doc.indexOf('### 8.6 '))
  const out: Record<string, { limit: number; windowMs: number }> = {}
  for (const line of section.split('\n')) {
    const cells = line.split('|').map((c) => c.trim())
    const bucket = /^`([a-z_]+)`$/.exec(cells[1] ?? '')?.[1]
    if (!bucket) continue
    const grenzen = [...(cells[4] ?? '').matchAll(/(\d+) \/ (?:(\d+) )?(min|h|Tag)/g)]
    expect(grenzen.length, `Grenze von ${bucket}`).toBeGreaterThan(0)
    grenzen.forEach((m, i) => {
      out[i === 0 ? bucket : `${bucket}_day`] = {
        limit: Number(m[1]),
        windowMs: Number(m[2] ?? 1) * UNIT_MS[m[3]!]!,
      }
    })
  }
  return out
}

describe('ARCHITEKTUR §8.5 ↔ RATE_LIMITS', () => {
  it('jede Zeile der Tabelle (inkl. Tages-Buckets) steht mit gleicher Grenze und gleichem Fenster im Code', () => {
    const documented = documentedLimits()
    expect(Object.keys(documented).length).toBeGreaterThanOrEqual(13)
    for (const [bucket, rule] of Object.entries(documented)) {
      expect(RATE_LIMITS[bucket as RateLimitBucket], bucket).toEqual(rule)
    }
  })

  it('jeder Bucket im Code hat einen Grenzwert-Test in dieser Datei (oder steht als Zusatz-Bucket in der Liste)', () => {
    const covered = new Set<string>(CASES.flatMap((c) => c.buckets))
    for (const bucket of Object.keys(RATE_LIMITS)) expect(covered.has(bucket), bucket).toBe(true)
  })
})

// --- 2. Aufrufe je Bucket -------------------------------------------------------------------------------------------

let payload: Payload
const cleanup: (() => Promise<void>)[] = []
let tinyPng: Buffer

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')

interface Outcome {
  /** Wurde der Aufruf wegen des Limits abgelehnt (bzw. still verworfen)? */
  blocked: boolean
  status?: number
  retryAfter?: number
}

/** Ein Aufruf der echten Stelle mit der Identität `who` (IP bzw. Token) zur Zeit `at`. */
type Call = (who: string, at: Date, i: number) => Promise<Outcome>

interface Case {
  /** Name im Testtitel */
  name: string
  buckets: RateLimitBucket[]
  /** N laut Tabelle */
  limit: number
  /** Abstand der Aufrufe (0 = alle in einem Fenster, sonst Tages-Buckets über mehrere Fenster) */
  spreadMs?: number
  /** Schlüsselart: `ip` (Standard) oder `token` */
  who?: 'ip' | 'token'
  /** erwarteter Status des abgelehnten Aufrufs (Standard 429) */
  blockedStatus?: number
  call: Call
}

const retry = (res: Response): number | undefined => {
  const v = res.headers.get('retry-after')
  return v === null ? undefined : Number(v)
}
const fromIp = (ip: string, extra: Record<string, string> = {}) => ({
  'x-forwarded-for': ip,
  ...extra,
})

const COMMISSION_FORM = (loaded: Date) => ({
  name: 'Erika Beispiel',
  email: 'ratelimit-test@planetclaire.local',
  objectType: 'cap',
  idea: 'zu kurz', // ungültig: zählt gegen das Limit, legt aber nichts an
  locale: 'de',
  formToken: createCommissionFormToken(loaded),
})

const uploadRequest = (ip: string, token: string, file: Buffer, type: string) => {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(file)], { type }), 'datei')
  return new Request('http://localhost:3000/api/uploads/commission?locale=de', {
    method: 'POST',
    headers: fromIp(ip, { 'x-form-token': token }),
    body: form,
  })
}

const statusReq = (ip: string) =>
  new Request('http://localhost:3000/api/public/product-status?ids=1', { headers: fromIp(ip) })

const clientErrorEnv = parseEnv({
  ...process.env,
  NEXT_PUBLIC_CLIENT_ERRORS_ENABLED: 'true',
  APP_ENV: 'production',
})

const CASES: Case[] = [
  {
    name: 'cart_add – Server-Action „In den Korb“ (60 / 10 min)',
    buckets: ['cart_add'],
    limit: 60,
    call: async (ip, now) => {
      const out = await addToCart(
        { productId: 2_000_000_000, locale: 'de', cookie: null, ip, now },
        payload,
      )
      return { blocked: !out.response.ok && out.response.code === 'rate_limited' }
    },
  },
  {
    name: 'checkout_start – „Zur Kasse“ (10 / 10 min)',
    buckets: ['checkout_start'],
    limit: 10,
    call: async (ip, now) => ({ blocked: !(await checkoutStartAllowed(ip, now, payload)) }),
  },
  {
    name: 'checkout_start_day – „Zur Kasse“ (30 / Tag, über Fenster verteilt)',
    buckets: ['checkout_start_day'],
    limit: 30,
    spreadMs: 10 * MINUTE,
    call: async (ip, now) => ({ blocked: !(await checkoutStartAllowed(ip, now, payload)) }),
  },
  {
    name: 'checkout_submit – „Zahlungspflichtig bestellen“ je Kassen-Token (10 / 30 min)',
    buckets: ['checkout_submit'],
    limit: 10,
    who: 'token',
    call: async (token, now) => ({ blocked: !(await checkoutSubmitAllowed(token, now, payload)) }),
  },
  {
    name: 'commission_submit – Auftragsanfrage (5 / h)',
    buckets: ['commission_submit'],
    limit: 5,
    call: async (ip, now) => {
      const r = await submitCommission(COMMISSION_FORM(new Date(now.getTime() - 2 * MINUTE)), {
        now,
        ip,
        payload,
      })
      return {
        blocked: !r.ok && r.status === 429,
        status: r.status,
        retryAfter: !r.ok && r.status === 429 ? r.retryAfterSeconds : undefined,
      }
    },
  },
  {
    name: 'commission_submit_day – Auftragsanfrage (20 / Tag, über Stunden verteilt)',
    buckets: ['commission_submit_day'],
    limit: 20,
    spreadMs: HOUR,
    call: async (ip, now) => {
      const r = await submitCommission(COMMISSION_FORM(new Date(now.getTime() - 2 * MINUTE)), {
        now,
        ip,
        payload,
      })
      return {
        blocked: !r.ok && r.status === 429,
        status: r.status,
        retryAfter: !r.ok && r.status === 429 ? r.retryAfterSeconds : undefined,
      }
    },
  },
  {
    name: 'commission_upload – POST /api/uploads/commission (15 / h)',
    buckets: ['commission_upload'],
    limit: 15,
    call: async (ip, now) => {
      const token = createCommissionFormToken(new Date(now.getTime() - 2 * MINUTE))
      const res = await handleCommissionUpload(
        uploadRequest(ip, token, PDF, 'application/pdf'),
        payload,
        now,
      )
      return { blocked: res.status === 429, status: res.status, retryAfter: retry(res) }
    },
  },
  {
    name: 'commission_form_uploads – höchstens 5 Bilder je Formular (409 mit Text)',
    buckets: ['commission_form_uploads'],
    limit: 5,
    blockedStatus: 409,
    call: async (ip, now) => {
      // Gleiches Formular-Token für alle Aufrufe dieses Falls (Schlüssel ist dessen Nonce).
      const token = (formTokens[ip] ??= createCommissionFormToken(
        new Date(now.getTime() - 2 * MINUTE),
      ))
      const res = await handleCommissionUpload(
        uploadRequest(ip, token, tinyPng, 'image/png'),
        payload,
        now,
      )
      if (res.status === 201) {
        const body = (await res.json()) as { uploadId: number }
        cleanup.push(async () => {
          await payload
            .delete({
              collection: 'private-uploads',
              id: body.uploadId,
              overrideAccess: true,
              context: { system: true },
            })
            .catch(() => undefined)
        })
      }
      return { blocked: res.status === 409, status: res.status }
    },
  },
  {
    name: 'withdrawal_submit – Widerruf bestätigen (30 / h)',
    buckets: ['withdrawal_submit'],
    limit: 30,
    call: async (ip, now) => {
      const r = await submitWithdrawal({}, { now, ip, payload })
      return {
        blocked: !r.ok && r.status === 429,
        status: r.status,
        retryAfter: !r.ok && r.status === 429 ? r.retryAfterSeconds : undefined,
      }
    },
  },
  {
    name: 'admin_login – Payload-Login (10 / 15 min)',
    buckets: ['admin_login'],
    limit: 10,
    call: async (ip) => {
      const res = await rest(
        'POST',
        '/users/login',
        { email: 'niemand@example.com', password: 'falsches-passwort-123' },
        fromIp(ip),
      )
      return { blocked: res.status === 429, status: res.status, retryAfter: retry(res) }
    },
  },
  {
    name: 'forgot_password – Passwort vergessen (3 / h, Antwort immer gleich)',
    buckets: ['forgot_password'],
    limit: 3,
    call: async (ip) => {
      const res = await rest(
        'POST',
        '/users/forgot-password',
        { email: 'niemand@example.com' },
        fromIp(ip),
      )
      return { blocked: res.status === 429, status: res.status, retryAfter: retry(res) }
    },
  },
  {
    name: 'token_pages – GET /api/checkout/[token]/state (60 / min)',
    buckets: ['token_pages'],
    limit: 60,
    call: async (ip, now) => {
      const res = await handleCheckoutState(
        new Request('http://localhost/api/checkout/x/state', { headers: fromIp(ip) }),
        freshToken(),
        now,
        { payload },
      )
      return { blocked: res.status === 429, status: res.status, retryAfter: retry(res) }
    },
  },
  {
    name: 'token_pages – Dokument-Download (60 / min)',
    buckets: ['token_pages'],
    limit: 60,
    call: async (ip, now) => {
      const res = await handleOrderDocument(
        new Request('http://localhost/api/orders/x/documents/AGB_v1.pdf', { headers: fromIp(ip) }),
        freshToken(),
        'AGB_v1.pdf',
        now,
        { payload },
      )
      return { blocked: res.status === 429, status: res.status, retryAfter: retry(res) }
    },
  },
  {
    name: 'token_pages – GET /api/privacy-export/[token] (60 / min)',
    buckets: ['token_pages'],
    limit: 60,
    call: async (ip, now) => {
      const res = await handlePrivacyExport(
        new Request('http://localhost/api/privacy-export/x', { headers: fromIp(ip) }),
        'ungueltig',
        now,
        { payload },
      )
      return { blocked: res.status === 429, status: res.status, retryAfter: retry(res) }
    },
  },
  {
    name: 'token_pages – Seiten R08 und R09 (60 / min, zusammen)',
    buckets: ['token_pages'],
    limit: 60,
    call: async (ip, now, i) => {
      const headers = new Headers(fromIp(ip))
      const r =
        i % 2 === 0
          ? await loadThanksPage(freshToken(), 'de', headers, now)
          : await loadOrderStatusPage(freshToken(), 'de', headers, now)
      return { blocked: r.kind === 'rate_limited' }
    },
  },
  {
    name: 'product_status – GET /api/public/product-status (120 / min)',
    buckets: ['product_status'],
    limit: 120,
    call: async (ip, now) => {
      const res = await handleProductStatus(statusReq(ip), payload, now)
      return { blocked: res.status === 429, status: res.status, retryAfter: retry(res) }
    },
  },
  {
    name: 'client_errors – POST /api/client-errors (10 / min, darüber stilles Verwerfen mit 204)',
    buckets: ['client_errors'],
    limit: 10,
    call: async (ip, now) => {
      const reported = vi.fn()
      setErrorReporter(reported)
      const res = await handleClientError(
        new Request('http://localhost:3000/api/client-errors', {
          method: 'POST',
          headers: fromIp(ip, { 'content-type': 'application/json' }),
          body: JSON.stringify({ message: 'Test' }),
        }),
        { env: clientErrorEnv, payload: async () => payload, now },
      )
      expect(res.status).toBe(204)
      return { blocked: reported.mock.calls.length === 0, status: res.status }
    },
  },
]
const formTokens: Record<string, string> = {}

beforeAll(async () => {
  payload = await getTestPayload()
  tinyPng = await sharp({ create: { width: 6, height: 4, channels: 3, background: '#c33' } })
    .png()
    .toBuffer()
})
afterEach(() => {
  setErrorReporter(undefined)
  vi.useRealTimers()
})
afterAll(async () => {
  for (const fn of cleanup) await fn()
})

describe('AK-A-8-03 R-134 Grenzwert je Bucket (tabellengetrieben)', () => {
  it.each(CASES.map((c) => [c.name, c] as const))('%s', async (_name, c) => {
    // Feste Zeit nur für die Payload-REST-Hooks (`requestNow` liest die Systemuhr).
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    const who = c.who === 'token' ? freshToken() : freshIp()
    const other = c.who === 'token' ? freshToken() : freshIp()
    const spread = c.spreadMs ?? 0
    // Bei verteilten Aufrufen innerhalb desselben Tages bleiben (UTC und Berlin): Start 00:30 UTC.
    const base = spread > 0 ? new Date('2026-10-03T00:30:30.000Z') : NOW
    const at = (i: number) => new Date(base.getTime() + i * spread)

    for (let i = 0; i < c.limit; i++) {
      vi.setSystemTime(at(i))
      const out = await c.call(who, at(i), i)
      expect(
        out.blocked,
        `${c.name}: Aufruf ${i + 1} von ${c.limit} muss durchgehen (${out.status})`,
      ).toBe(false)
    }
    vi.setSystemTime(at(c.limit))
    const over = await c.call(who, at(c.limit), c.limit)
    expect(over.blocked, `${c.name}: Aufruf ${c.limit + 1} muss abgelehnt werden`).toBe(true)
    if (c.blockedStatus ?? 429)
      expect(over.status ?? c.blockedStatus ?? 429).toBe(c.blockedStatus ?? 429)
    if (over.status === 429 && c.buckets[0] !== 'client_errors') {
      // Retry-After nur dort, wo die Antwort einen Header bzw. ein Feld trägt
      if (over.retryAfter !== undefined) {
        expect(over.retryAfter).toBeGreaterThanOrEqual(1)
        expect(over.retryAfter).toBeLessThanOrEqual(
          Math.ceil(RATE_LIMITS[c.buckets[0]!].windowMs / 1000),
        )
      }
    }
    // Eine andere IP (bzw. ein anderes Token) ist nicht betroffen.
    vi.setSystemTime(at(0))
    expect((await c.call(other, at(0), 0)).blocked, `${c.name}: andere Identität`).toBe(false)
  })

  it('Antwort-Header und -Text: 429 trägt Retry-After (Sekunden bis Fensterende) – REST-Login und Produkt-Status', async () => {
    const ip = freshIp()
    for (let i = 0; i < RATE_LIMITS.forgot_password.limit; i++) {
      await rest('POST', '/users/forgot-password', { email: 'x@example.com' }, fromIp(ip))
    }
    const res = await rest('POST', '/users/forgot-password', { email: 'x@example.com' }, fromIp(ip))
    expect(res.status).toBe(429)
    const retryAfter = Number(res.headers.get('retry-after'))
    expect(retryAfter).toBeGreaterThanOrEqual(1)
    expect(retryAfter).toBeLessThanOrEqual(3600)
    expect(JSON.stringify(await res.json())).toMatch(/Zu viele Versuche/)

    const ip2 = freshIp()
    for (let i = 0; i < RATE_LIMITS.product_status.limit; i++)
      await handleProductStatus(statusReq(ip2), payload, NOW)
    const blocked = await handleProductStatus(statusReq(ip2), payload, NOW)
    expect(blocked.status).toBe(429)
    expect(Number(blocked.headers.get('retry-after'))).toBe(30) // NOW = 10:00:30 → Fensterende in 30 s
    expect(blocked.headers.get('cache-control')).toBe('no-store')
  })
})

describe('i18n-Texte der 429-Antworten am Formular (DE und EN)', () => {
  const de = JSON.parse(readFileSync(path.join(ROOT, 'src/i18n/messages/de.json'), 'utf8'))
  const en = JSON.parse(readFileSync(path.join(ROOT, 'src/i18n/messages/en.json'), 'utf8'))
  const get = (o: unknown, p: string) =>
    p.split('.').reduce<unknown>((acc, k) => (acc as Record<string, unknown> | undefined)?.[k], o)

  it.each([
    ['cart_add', 'cart.notes.rate_limited'],
    ['checkout_start/checkout_submit', 'checkout.errors.codes.rate_limited'],
    ['commission_submit', 'commission.form.noticeRateLimited'],
    ['commission_upload', 'commission.upload.rate_limited'],
    ['withdrawal_submit', 'withdraw.noticeRateLimited'],
    ['token_pages R08/R09', 'order.rateLimited'],
    ['shop product (Korb-Knopf)', 'shop.product.notes.rate_limited'],
  ])('%s → %s in DE und EN vorhanden und verschieden', (_bucket, key) => {
    const d = get(de, key)
    const e = get(en, key)
    expect(typeof d, `de ${key}`).toBe('string')
    expect(typeof e, `en ${key}`).toBe('string')
    expect((d as string).length).toBeGreaterThan(20)
    expect(e).not.toBe(d)
  })
})

describe('R-134 L-13a Zähler: nur Hash, Löschung nach 24 h durch den Wartungs-Job', () => {
  it('es wird nie eine Klar-IP und kein Klar-Token gespeichert', async () => {
    const ip = freshIp()
    const token = freshToken()
    await hit('cart_add', ipHash(ip, { now: () => NOW }), NOW, payload)
    await checkoutSubmitAllowed(token, NOW, payload)
    const rows = (await dbOf(payload).execute(sql`SELECT bucket, key_hash FROM rate_limit_hits`))
      .rows
    expect(JSON.stringify(rows)).not.toContain(ip)
    expect(JSON.stringify(rows)).not.toContain(token)
    expect(rows.every((r) => /^[0-9a-f]{64}$/.test(String(r.key_hash)))).toBe(true)
  })

  it('purgeRateLimits entfernt Fenster älter als 24 h, behält das Fenster knapp darunter', async () => {
    const db = dbOf(payload)
    const now = new Date('2026-10-04T12:00:00.000Z')
    const key = hashRateLimitKey(`purge-${randomBytes(4).toString('hex')}`)
    const old = new Date(now.getTime() - RATE_LIMIT_RETENTION_MS - MINUTE)
    const young = new Date(now.getTime() - RATE_LIMIT_RETENTION_MS + MINUTE)
    await db.execute(sql`
      INSERT INTO rate_limit_hits (bucket, key_hash, window_start, count) VALUES
        ('cart_add', ${key}, ${old.toISOString()}::timestamptz, 3),
        ('cart_add', ${key}, ${young.toISOString()}::timestamptz, 3)`)
    expect(await purgeRateLimits(now, payload)).toBeGreaterThanOrEqual(1)
    const left = (
      await db.execute(sql`SELECT window_start FROM rate_limit_hits WHERE key_hash = ${key}`)
    ).rows
    expect(left).toHaveLength(1)
    expect(new Date(String(left[0]!.window_start)).getTime()).toBe(young.getTime())
    await db.execute(sql`DELETE FROM rate_limit_hits WHERE key_hash = ${key}`)
  })
})
