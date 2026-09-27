import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import config from '@payload-config'
import { checkPasswordRule, USER_AUTH, Users } from '@/collections/Users'
import { getEnv } from '@/lib/env'

import { createAdminAccount, unlockAdminAccounts } from '../../../scripts/lib/admin'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P1.11: Konto `users` (DATENMODELL §6.1, ARCHITEKTUR §8.4/§8.5, KONZEPT A17).

const ADMIN = { email: 'admin@example.com', password: 'richtig-langes-passwort-2026' }
let payload: Payload
let ipCounter = 0
const freshIp = () => `203.0.113.${++ipCounter}`

type Db = { execute: (q: ReturnType<typeof sql>) => Promise<{ rows: Record<string, unknown>[] }> }
const db = () => (payload.db as unknown as { drizzle: Db }).drizzle

async function resetUsers(): Promise<void> {
  await payload.delete({
    collection: 'users',
    where: { id: { exists: true } },
    overrideAccess: true,
  })
  await db().execute(sql`DELETE FROM rate_limit_hits`)
}

async function createAdmin(email = ADMIN.email) {
  return payload.create({
    collection: 'users',
    data: { email, password: ADMIN.password, name: 'Jutta', role: 'admin' },
    overrideAccess: true,
  })
}

/** ValidationError trägt die Feldmeldung in `data.errors`. */
async function expectPasswordRejected(p: Promise<unknown>, re = /mindestens 12 Zeichen/) {
  const err = (await p.then(
    () => null,
    (e: unknown) => e,
  )) as { message?: string; data?: unknown } | null
  expect(err).toBeTruthy()
  expect(JSON.stringify({ message: err!.message, data: err!.data })).toMatch(re)
}

const loginRest = (password: string, ip: string, email = ADMIN.email) =>
  rest('POST', '/users/login', { email, password }, { 'x-forwarded-for': ip })

beforeAll(async () => {
  payload = await getTestPayload()
})

beforeEach(async () => {
  vi.useRealTimers()
  await resetUsers()
})

afterAll(async () => {
  vi.useRealTimers()
  await resetUsers()
})

describe('users – ein Konto (E-03)', () => {
  it('DM-USER-02 zweites Konto per Local API schlägt fehl', async () => {
    await createAdmin()
    await expect(createAdmin('zweites-konto@example.com')).rejects.toThrow(/genau ein Admin-Konto/)
    expect((await payload.count({ collection: 'users', overrideAccess: true })).totalDocs).toBe(1)
  })

  it('DM-USER-02 zweites Konto per REST schlägt fehl (anonym und angemeldet)', async () => {
    await createAdmin()
    const anon = await rest('POST', '/users', {
      email: 'zweites-konto@example.com',
      password: ADMIN.password,
    })
    expect(anon.status).toBeGreaterThanOrEqual(400)
    const login = await loginRest(ADMIN.password, freshIp())
    expect(login.status).toBe(200)
    const { token } = (await login.json()) as { token: string }
    const authed = await rest(
      'POST',
      '/users',
      { email: 'zweites-konto@example.com', password: ADMIN.password },
      { authorization: `JWT ${token}` },
    )
    expect(authed.status).toBeGreaterThanOrEqual(400)
    expect((await payload.count({ collection: 'users', overrideAccess: true })).totalDocs).toBe(1)
  })

  it('DM-USER-02 erstes Konto per REST nur, solange keins existiert; löschen ist verboten', async () => {
    const first = await rest('POST', '/users', { email: ADMIN.email, password: ADMIN.password })
    expect(first.status).toBe(201)
    const login = await loginRest(ADMIN.password, freshIp())
    const { token, user } = (await login.json()) as { token: string; user: { id: number } }
    const del = await rest('DELETE', `/users/${user.id}`, undefined, {
      authorization: `JWT ${token}`,
    })
    expect(del.status).toBeGreaterThanOrEqual(400)
    expect((await payload.count({ collection: 'users', overrideAccess: true })).totalDocs).toBe(1)
  })

  it('admin:create legt das Konto an und verweigert ein zweites', async () => {
    const user = await createAdminAccount(payload, {
      email: 'Admin@Example.com',
      password: ADMIN.password,
    })
    expect(user.email).toBe('admin@example.com')
    await expect(
      createAdminAccount(payload, { email: 'zwei@example.com', password: ADMIN.password }),
    ).rejects.toThrow(/genau ein Admin-Konto/)
  })
})

describe('users – Passwortregel', () => {
  it('DM-USER-03 Passwort mit 11 Zeichen wird abgelehnt', async () => {
    await expectPasswordRejected(
      payload.create({
        collection: 'users',
        data: { email: ADMIN.email, password: 'elf-zeichen', name: 'Jutta', role: 'admin' },
        overrideAccess: true,
      }),
      /mindestens 12 Zeichen/,
    )
    expect('elf-zeichen').toHaveLength(11)
  })

  it('DM-USER-03 nur Ziffern oder gleich der E-Mail werden abgelehnt', async () => {
    expect(checkPasswordRule('123456789012', 'a@example.com')).not.toBeNull()
    expect(checkPasswordRule('lang@example.com', 'lang@example.com')).not.toBeNull()
    expect(checkPasswordRule('zwoelf-zeich', 'a@example.com')).toBeNull()
    await expectPasswordRejected(
      payload.create({
        collection: 'users',
        data: { email: ADMIN.email, password: '123456789012345', name: 'Jutta', role: 'admin' },
        overrideAccess: true,
      }),
      /Passwort/,
    )
    const user = await createAdmin()
    await expectPasswordRejected(
      payload.update({
        collection: 'users',
        id: user.id,
        data: { password: 'kurz' },
        overrideAccess: true,
      }),
      /mindestens 12 Zeichen/,
    )
  })
})

describe('users – Login-Sperre (DATENMODELL §6.1)', () => {
  it('DM-USER-01 5 Fehlversuche sperren, nach 15 min klappt der Login', async () => {
    await createAdmin()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-27T10:01:00Z'))
    const ip = freshIp()
    for (let i = 0; i < 5; i++) {
      const res = await loginRest('falsches-passwort-123', ip)
      expect(res.status).toBe(401)
    }
    const locked = await loginRest(ADMIN.password, ip)
    expect(locked.status).toBe(401)
    const body = (await locked.json()) as { errors: { message: string }[] }
    expect(body.errors[0]!.message).toMatch(/gesperrt/i)

    vi.setSystemTime(new Date('2026-09-27T10:14:00Z'))
    expect((await loginRest(ADMIN.password, ip)).status).toBe(401)

    vi.setSystemTime(new Date('2026-09-27T10:16:30Z'))
    const ok = await loginRest(ADMIN.password, ip)
    expect(ok.status).toBe(200)
  })

  it('admin:unlock hebt die Sperre auf', async () => {
    await createAdmin()
    for (let i = 0; i < 5; i++) {
      await expect(
        payload.login({
          collection: 'users',
          data: { email: ADMIN.email, password: 'falsch-falsch-1' },
        }),
      ).rejects.toThrow()
    }
    await expect(payload.login({ collection: 'users', data: ADMIN })).rejects.toMatchObject({
      name: 'LockedAuth',
    })
    expect(await unlockAdminAccounts(payload)).toBe(1)
    const res = await payload.login({ collection: 'users', data: ADMIN })
    expect(res.token).toBeTruthy()
  })

  it('Passwort-Reset setzt Fehlversuche und Sperre zurück', async () => {
    await createAdmin()
    for (let i = 0; i < 5; i++) {
      await payload
        .login({ collection: 'users', data: { email: ADMIN.email, password: 'falsch-falsch-1' } })
        .catch(() => null)
    }
    const token = await payload.forgotPassword({
      collection: 'users',
      data: { email: ADMIN.email },
      disableEmail: true,
    })
    const newPassword = 'ganz-neues-passwort-2026'
    await payload.resetPassword({
      collection: 'users',
      data: { token, password: newPassword },
      overrideAccess: true,
    })
    const res = await payload.login({
      collection: 'users',
      data: { email: ADMIN.email, password: newPassword },
    })
    expect(res.token).toBeTruthy()
  })

  it('DM-USER-03 Passwortregel gilt auch beim Zurücksetzen', async () => {
    await createAdmin()
    const token = await payload.forgotPassword({
      collection: 'users',
      data: { email: ADMIN.email },
      disableEmail: true,
    })
    await expectPasswordRejected(
      payload.resetPassword({
        collection: 'users',
        data: { token, password: 'elf-zeichen' },
        overrideAccess: true,
      }),
      /mindestens 12 Zeichen/,
    )
  })

  it('afterLogin setzt lastLoginAt über die injizierte Uhr und schreibt login_succeeded', async () => {
    const user = await createAdmin()
    const now = '2026-09-27T08:15:00.000Z'
    await payload.login({ collection: 'users', data: ADMIN, context: { now } })
    const after = await payload.findByID({ collection: 'users', id: user.id, overrideAccess: true })
    expect(after.lastLoginAt).toBe(now)
    const audit = await payload.find({
      collection: 'audit-log',
      where: {
        and: [{ action: { equals: 'login_succeeded' } }, { entityId: { equals: String(user.id) } }],
      },
      overrideAccess: true,
    })
    expect(audit.totalDocs).toBe(1)
  })
})

describe('users – Rate-Limit (ARCHITEKTUR §8.5)', () => {
  it('AK-A-8-03 der 11. Login-Versuch derselben IP innerhalb von 15 min ergibt 429', async () => {
    await createAdmin()
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-09-27T12:00:30Z'))
    const ip = freshIp()
    for (let i = 0; i < 10; i++) {
      vi.setSystemTime(new Date(Date.parse('2026-09-27T12:00:30Z') + i * 60_000))
      const res = await loginRest('falsches-passwort-123', ip)
      expect(res.status).toBe(401)
    }
    const eleventh = await loginRest(ADMIN.password, ip)
    expect(eleventh.status).toBe(429)
    expect(Number(eleventh.headers.get('retry-after'))).toBeGreaterThan(0)
    // andere IP ist nicht betroffen (Konto ist allerdings gesperrt → 401, nicht 429)
    expect((await loginRest(ADMIN.password, freshIp())).status).toBe(401)
    // Gespeichert wird nur ein Hash, keine Klar-IP (R-134)
    const rows = await db().execute(sql`SELECT key_hash FROM rate_limit_hits`)
    expect(JSON.stringify(rows.rows)).not.toContain(ip)
  })

  it('forgot_password: 3 je Stunde, danach 429', async () => {
    await createAdmin()
    const ip = freshIp()
    for (let i = 0; i < 3; i++) {
      const res = await rest(
        'POST',
        '/users/forgot-password',
        { email: 'niemand@example.com' },
        { 'x-forwarded-for': ip },
      )
      expect(res.status).toBe(200)
    }
    const fourth = await rest(
      'POST',
      '/users/forgot-password',
      { email: 'niemand@example.com' },
      { 'x-forwarded-for': ip },
    )
    expect(fourth.status).toBe(429)
  })
})

describe('users – A17 „Passwort vergessen“ (admin_password_reset)', () => {
  async function outboxFor(to: string) {
    const dir = path.resolve(process.cwd(), getEnv().EMAIL_FILE_DIR)
    const names = await readdir(dir).catch(() => [] as string[])
    const out: { subject: string; html?: string; to: string[] }[] = []
    for (const n of names.filter((f) => f.endsWith('.json'))) {
      const r = JSON.parse(await readFile(path.join(dir, n), 'utf8')) as {
        subject: string
        html?: string
        to: string[]
      }
      if (r.to.includes(to)) out.push(r)
    }
    return out
  }

  it('A17 deutsche Mail mit Reset-Link unter ADMIN_ROUTE, email-log ohne Token, Audit', async () => {
    const email = `konto-${Date.now()}@planetclairetattoos.com`
    const user = await createAdmin(email)
    const logs: string[] = []
    const capture = (...a: unknown[]) => void logs.push(a.map(String).join(' '))
    const spyLog = vi.spyOn(console, 'log').mockImplementation(capture)
    const spyErr = vi.spyOn(console, 'error').mockImplementation(capture)
    const spyInfo = vi.spyOn(console, 'info').mockImplementation(capture)
    const stdout = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      logs.push(String(chunk))
      return true
    })
    let res: Response
    try {
      res = await rest(
        'POST',
        '/users/forgot-password',
        { email },
        { 'x-forwarded-for': freshIp() },
      )
    } finally {
      spyLog.mockRestore()
      spyErr.mockRestore()
      spyInfo.mockRestore()
      stdout.mockRestore()
    }
    expect(res.status).toBe(200)

    const withToken = await payload.findByID({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
      showHiddenFields: true,
    })
    const token = (withToken as unknown as { resetPasswordToken: string }).resetPasswordToken
    expect(token).toBeTruthy()

    const mails = await outboxFor(email)
    expect(mails).toHaveLength(1)
    const mail = mails[0]!
    expect(mail.subject).toBe('Neues Passwort für deine Verwaltung')
    const env = getEnv()
    expect(mail.html).toContain(`${env.NEXT_PUBLIC_SITE_URL}${env.ADMIN_ROUTE}/reset/${token}`)
    expect(mail.html).toContain('1 Stunde gültig')
    expect(mail.html).not.toContain('/admin/')

    const log = await payload.find({
      collection: 'email-log',
      where: { and: [{ template: { equals: 'admin_password_reset' } }, { to: { equals: email } }] },
      overrideAccess: true,
    })
    expect(log.totalDocs).toBe(1)
    expect(log.docs[0]!.status).toBe('sent')
    expect(log.docs[0]!.bodySha256).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.stringify(log.docs[0])).not.toContain(token)
    expect(logs.join('\n')).not.toContain(token)

    const audit = await payload.find({
      collection: 'audit-log',
      where: {
        and: [
          { action: { equals: 'password_reset_requested' } },
          { entityId: { equals: String(user.id) } },
        ],
      },
      overrideAccess: true,
    })
    expect(audit.totalDocs).toBe(1)
  })

  it('A17 bei einer @example.com-Adresse wird die Mail unterdrückt und so protokolliert', async () => {
    await createAdmin()
    const res = await rest(
      'POST',
      '/users/forgot-password',
      { email: ADMIN.email },
      { 'x-forwarded-for': freshIp() },
    )
    expect(res.status).toBe(200)
    const log = await payload.find({
      collection: 'email-log',
      where: {
        and: [{ template: { equals: 'admin_password_reset' } }, { to: { equals: ADMIN.email } }],
      },
      sort: '-createdAt',
      overrideAccess: true,
    })
    expect(log.docs[0]!.status).toBe('suppressed')
    expect(await outboxFor(ADMIN.email)).toHaveLength(0)
  })
})

describe('users – R-136 Konfiguration', () => {
  it('R-136 Sperre 5 Versuche/15 min, Sitzung ≤ 7 Tage, Cookie SameSite=Strict, Reset 1 h', async () => {
    const auth = Users.auth as Exclude<typeof Users.auth, boolean | undefined>
    expect(auth.maxLoginAttempts).toBe(5)
    expect(auth.lockTime).toBe(15 * 60 * 1000)
    expect(auth.tokenExpiration).toBeLessThanOrEqual(7 * 24 * 60 * 60)
    expect(auth.cookies?.sameSite).toBe('Strict')
    expect(auth.cookies?.secure).toBe(getEnv().NEXT_PUBLIC_SITE_URL.startsWith('https://'))
    expect(auth.forgotPassword?.expiration).toBe(USER_AUTH.forgotPasswordExpiration)
    expect(auth.useAPIKey).toBe(false)
    const sanitized = (await config).collections.find((c) => c.slug === 'users')!
    expect(sanitized.access.delete).toBeDefined()
  })

  it('R-136 anonym: Konten weder lesbar noch änderbar', async () => {
    const user = await createAdmin()
    const list = await rest('GET', '/users')
    const body = (await list.json()) as { docs?: unknown[] }
    expect(list.status === 403 || (body.docs ?? []).length === 0).toBe(true)
    const patch = await rest('PATCH', `/users/${user.id}`, { name: 'X' })
    expect(patch.status).toBeGreaterThanOrEqual(400)
  })
})
