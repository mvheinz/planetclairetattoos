import { createLocalReq, type Payload, type PayloadRequest } from 'payload'

import { rest } from './rest'

// Verwaltungskonto für Tests: Local-API-Request mit angemeldeter Verwaltung und JWT für REST.
export const ADMIN = { email: 'admin@example.com', password: 'richtig-langes-passwort-2026' }

export async function resetAdmin(
  payload: Payload,
  ip = '198.51.100.40',
): Promise<{ token: string; userId: number }> {
  await payload.delete({
    collection: 'users',
    where: { id: { exists: true } },
    overrideAccess: true,
  })
  const user = await payload.create({
    collection: 'users',
    data: { ...ADMIN, name: 'Jutta', role: 'admin' } as never,
    overrideAccess: true,
  })
  const login = await rest('POST', '/users/login', ADMIN, { 'x-forwarded-for': ip })
  const token = ((await login.json()) as { token: string }).token
  return { token, userId: user.id as number }
}

/** Local-API-Request als Verwaltung (für Services wie transitionProduct). */
export async function adminReq(payload: Payload, userId: number): Promise<PayloadRequest> {
  const user = await payload.findByID({ collection: 'users', id: userId, overrideAccess: true })
  return createLocalReq({ user: { ...user, collection: 'users' } as never }, payload)
}

/** Local-API-Request des Systems (Webhook, Job, Service). */
export function systemReq(payload: Payload, now?: string): Promise<PayloadRequest> {
  return createLocalReq({ context: { system: true, ...(now ? { now } : {}) } }, payload)
}
