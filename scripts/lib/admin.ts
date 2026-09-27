// Konto-Verwaltung für die Kommandozeile (ARCHITEKTUR §8.4, E-03): `pnpm admin:create`, `pnpm admin:unlock`.
import type { Payload } from 'payload'

import { checkPasswordRule, ONE_ACCOUNT_MESSAGE } from '../../src/collections/Users'

export class AdminCliError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdminCliError'
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Legt das eine Admin-Konto an; verweigert ein zweites Konto. */
export async function createAdminAccount(
  payload: Payload,
  input: { email: string; password: string; name?: string },
): Promise<{ id: number | string; email: string }> {
  const email = input.email.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) throw new AdminCliError('Bitte eine gültige E-Mail-Adresse eingeben.')
  const existing = await payload.count({ collection: 'users', overrideAccess: true })
  if (existing.totalDocs > 0) throw new AdminCliError(ONE_ACCOUNT_MESSAGE)
  const problem = checkPasswordRule(input.password, email)
  if (problem) throw new AdminCliError(problem)
  const user = await payload.create({
    collection: 'users',
    data: { email, password: input.password, name: input.name ?? 'Jutta', role: 'admin' },
    overrideAccess: true,
  })
  return { id: user.id, email: user.email }
}

/** Hebt die Login-Sperre auf (`loginAttempts = 0`, `lockUntil = null`). Gibt die Anzahl entsperrter Konten zurück. */
export async function unlockAdminAccounts(payload: Payload): Promise<number> {
  const res = await payload.find({
    collection: 'users',
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  for (const user of res.docs) {
    await payload.unlock({
      collection: 'users',
      data: { email: user.email } as { email: string; password: string },
      overrideAccess: true,
    })
  }
  return res.docs.length
}
