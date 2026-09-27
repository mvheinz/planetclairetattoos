import { createHash } from 'node:crypto'

import {
  APIError,
  ValidationError,
  type Access,
  type CollectionBeforeOperationHook,
  type CollectionConfig,
  type PayloadRequest,
} from 'payload'

import { isAdmin, isAdminRequest, none } from '@/access'
import { writeAudit } from '@/lib/audit'
import { isSuppressedRecipient } from '@/lib/email/recipients'
import {
  RESET_TOKEN_PLACEHOLDER,
  adminResetUrl,
  renderAdminPasswordReset,
} from '@/lib/email/render'
import { getEnv } from '@/lib/env'
import { getAppContext, requestNow } from '@/lib/payload/context'
import { ipHash } from '@/lib/security/ipHash'
import { clientIp, hit, retryAfterSeconds, type RateLimitBucket } from '@/lib/security/rateLimit'

// DATENMODELL §6.1 – genau ein Admin-Konto (E-03) mit Login-Sperre, Rate-Limit (ARCHITEKTUR §8.5) und deutscher
// „Passwort vergessen“-Mail (A17, `admin_password_reset`).

export const ONE_ACCOUNT_MESSAGE = 'Es gibt genau ein Admin-Konto (E-03).'
export const PASSWORD_RULE_MESSAGE =
  'Passwort: mindestens 12 Zeichen, nicht gleich der E-Mail-Adresse und nicht nur Ziffern.'
export const RATE_LIMIT_MESSAGE =
  'Zu viele Versuche. Bitte warte ein paar Minuten und versuche es dann erneut.'

export const USER_AUTH = {
  maxLoginAttempts: 5,
  lockTime: 15 * 60 * 1000,
  tokenExpiration: 7 * 24 * 60 * 60,
  forgotPasswordExpiration: 60 * 60 * 1000,
} as const

/** Passwortregel (DATENMODELL §6.1). Gibt die Fehlermeldung zurück oder `null`. */
export function checkPasswordRule(password: string, email?: string | null): string | null {
  if (password.length < 12) return PASSWORD_RULE_MESSAGE
  if (/^\d+$/.test(password)) return PASSWORD_RULE_MESSAGE
  if (email && password.trim().toLowerCase() === email.trim().toLowerCase())
    return PASSWORD_RULE_MESSAGE
  return null
}

function passwordError(message: string): ValidationError {
  return new ValidationError({ collection: 'users', errors: [{ message, path: 'password' }] })
}

async function accountCount(req: PayloadRequest): Promise<number> {
  const res = await req.payload.count({ collection: 'users', overrideAccess: true, req })
  return res.totalDocs
}

/** Ersteinrichtung/Grund-Seed: anlegen nur, solange es noch kein Konto gibt. */
const createOnlyFirst: Access = async ({ req }) => (await accountCount(req)) === 0

const ownAccount: Access = ({ req }) =>
  isAdminRequest(req) && req.user ? { id: { equals: req.user.id } } : false

const RATE_LIMITED_OPERATIONS: Partial<Record<string, RateLimitBucket>> = {
  login: 'admin_login',
  forgotPassword: 'forgot_password',
}

/** IP-Rate-Limit für Login und „Passwort vergessen“ (ARCHITEKTUR §8.5): 429 mit `Retry-After`. */
const rateLimitAuth: CollectionBeforeOperationHook = async ({ operation, req }) => {
  const bucket = RATE_LIMITED_OPERATIONS[operation]
  if (!bucket) return
  const ip = clientIp(req.headers)
  // Aufrufe aus Server-Code (Local API ohne Request-Header) sind nicht begrenzt.
  if (!ip && req.payloadAPI !== 'REST') return
  const now = requestNow(req)
  const result = await hit(bucket, ipHash(ip ?? 'unknown', { now: () => now }), now, req.payload)
  if (!result.allowed) {
    req.responseHeaders ??= new Headers()
    req.responseHeaders.set('Retry-After', String(retryAfterSeconds(result, now)))
    throw new APIError(RATE_LIMIT_MESSAGE, 429, null, true)
  }
}

/** Passwortregel auch beim Zurücksetzen (Payload umgeht dort die Feld-Hooks). */
const checkResetPassword: CollectionBeforeOperationHook = async ({ args, operation, req }) => {
  if (operation !== 'resetPassword') return
  const data = (args as { data?: { password?: unknown; token?: unknown } }).data
  if (typeof data?.password !== 'string') return
  let email: string | null = null
  if (typeof data.token === 'string') {
    const res = await req.payload.find({
      collection: 'users',
      where: { resetPasswordToken: { equals: data.token } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      showHiddenFields: true,
      req,
    })
    email = res.docs[0]?.email ?? null
  }
  const problem = checkPasswordRule(data.password, email)
  if (problem) throw passwordError(problem)
}

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

/** Payload ersetzt `req.context` durch den übergebenen Kontext – danach wiederherstellen. */
async function keepContext<T>(req: PayloadRequest, fn: () => Promise<T>): Promise<T> {
  const previous = req.context
  try {
    return await fn()
  } finally {
    req.context = previous
  }
}

export const Users: CollectionConfig = {
  slug: 'users',
  labels: { singular: 'Konto', plural: 'Konto' },
  admin: {
    useAsTitle: 'email',
    group: 'System',
    defaultColumns: ['email', 'name', 'lastLoginAt'],
    description: 'Dein Zugang zur Verwaltung. Es gibt genau ein Konto.',
  },
  auth: {
    maxLoginAttempts: USER_AUTH.maxLoginAttempts,
    lockTime: USER_AUTH.lockTime,
    tokenExpiration: USER_AUTH.tokenExpiration,
    useAPIKey: false,
    verify: false,
    cookies: {
      // Secure außer bei http://localhost (DATENMODELL §6.1)
      secure: getEnv().NEXT_PUBLIC_SITE_URL.startsWith('https://'),
      sameSite: 'Strict',
    },
    forgotPassword: {
      expiration: USER_AUTH.forgotPasswordExpiration,
      generateEmailSubject: () => renderAdminPasswordReset({ resetUrl: '' }).subject,
      generateEmailHTML: (args) => {
        const env = getEnv()
        const resetUrl = adminResetUrl(env.NEXT_PUBLIC_SITE_URL, env.ADMIN_ROUTE, args?.token ?? '')
        return renderAdminPasswordReset({ resetUrl }).html
      },
    },
  },
  access: {
    create: createOnlyFirst,
    read: ownAccount,
    update: ownAccount,
    delete: none,
    unlock: isAdmin,
    admin: ({ req }) => isAdminRequest(req),
  },
  fields: [
    // email und password ergänzt Payload (Auth)
    {
      name: 'name',
      type: 'text',
      label: 'Anzeigename',
      required: true,
      defaultValue: 'Jutta',
      minLength: 1,
      maxLength: 60,
    },
    {
      name: 'role',
      type: 'select',
      label: 'Rolle',
      required: true,
      defaultValue: 'admin',
      options: [{ label: 'Verwaltung', value: 'admin' }],
      saveToJWT: true,
      admin: { hidden: true },
    },
    {
      name: 'lastLoginAt',
      type: 'date',
      label: 'Zuletzt angemeldet',
      admin: { readOnly: true, position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } },
    },
  ],
  hooks: {
    beforeOperation: [rateLimitAuth, checkResetPassword],
    beforeValidate: [
      ({ data, originalDoc }) => {
        if (data && typeof data.password === 'string' && data.password !== '') {
          const email =
            (data.email as string | undefined) ?? (originalDoc?.email as string | undefined)
          const problem = checkPasswordRule(data.password, email)
          if (problem) throw passwordError(problem)
        }
        return data
      },
    ],
    beforeChange: [
      async ({ operation, req, data }) => {
        if (operation === 'create' && (await accountCount(req)) >= 1) {
          throw new APIError(ONE_ACCOUNT_MESSAGE, 403, null, true)
        }
        if (data && 'role' in data) data.role = 'admin'
        return data
      },
    ],
    afterLogin: [
      async ({ req, user }) => {
        const now = requestNow(req)
        await keepContext(req, () =>
          req.payload.update({
            collection: 'users',
            id: user.id,
            data: { lastLoginAt: now.toISOString() },
            overrideAccess: true,
            req,
            context: { ...req.context, skipAudit: true },
          }),
        )
        if (!getAppContext(req).skipAudit) {
          await writeAudit(req, {
            action: 'login_succeeded',
            actorType: 'admin',
            entityCollection: 'users',
            entityId: user.id,
            summary: 'Anmeldung in der Verwaltung',
          })
        }
      },
    ],
    afterForgotPassword: [
      async ({ args }) => {
        const req = args.req as PayloadRequest
        const email = String((args.data as { email?: unknown }).email ?? '')
          .toLowerCase()
          .trim()
        const res = await req.payload.find({
          collection: 'users',
          where: { email: { equals: email } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
          req,
        })
        const user = res.docs[0]
        if (!user) return
        const env = getEnv()
        const now = requestNow(req)
        const suppressed = isSuppressedRecipient(user.email)
        // Token nicht speichern: Prüfsumme über den Inhalt mit Platzhalter an der Token-Stelle.
        const rendered = renderAdminPasswordReset({
          resetUrl: adminResetUrl(
            env.NEXT_PUBLIC_SITE_URL,
            env.ADMIN_ROUTE,
            RESET_TOKEN_PLACEHOLDER,
          ),
        })
        if (!(args as { disableEmail?: boolean }).disableEmail) {
          await keepContext(req, () =>
            req.payload.create({
              collection: 'email-log',
              data: {
                template: 'admin_password_reset',
                to: user.email,
                locale: 'de',
                subject: rendered.subject,
                status: suppressed ? 'suppressed' : 'sent',
                transport: env.EMAIL_DRIVER,
                sentAt: suppressed ? undefined : now.toISOString(),
                attempts: 1,
                templateVersion: rendered.templateVersion,
                bodySha256: sha256(rendered.html),
              } as never,
              overrideAccess: true,
              req,
              context: { ...req.context, system: true, skipAudit: true },
            }),
          )
        }
        await writeAudit(req, {
          action: 'password_reset_requested',
          actorType: 'system',
          entityCollection: 'users',
          entityId: user.id,
          summary: '„Passwort vergessen“ angefordert – Link per Mail (1 Stunde gültig)',
        })
      },
    ],
  },
}
