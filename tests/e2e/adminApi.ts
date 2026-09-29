import { expect, type APIRequestContext } from '@playwright/test'

import { holdAdminSessions, withLoginLock, type ReleaseLock } from '../helpers/adminSessionLock'
import { serverURL, testUser } from '../helpers/adminEnv'
import { seedTestUser } from '../helpers/seedUser'
import { testPayload } from './fixtures'

// Änderungen „wie in der Verwaltung“ über die Admin-REST-API (P3.15, P4.3): Sie laufen im Server-Prozess, der die
// Cache-Tags erneuert – anders als die Local API im Testprozess. Anmeldung über die Local API (kein Formular-Login,
// Rate-Limit), Sitzung gegen parallele Passwort-Resets geschützt (`holdAdminSessions`).

export interface AdminSession {
  token: string
  release: ReleaseLock
}

export async function adminLogin(): Promise<AdminSession> {
  const release = await holdAdminSessions('shared')
  try {
    await seedTestUser()
    const payload = await testPayload()
    const { token } = await withLoginLock(() =>
      payload.login({ collection: 'users', data: testUser }),
    )
    if (!token) throw new Error('Anmeldung des Grund-Seed-Admins fehlgeschlagen.')
    return { token, release }
  } catch (err) {
    await release()
    throw err
  }
}

/** Admin-REST-Aufruf (`/api<path>`); erwartet 200. */
export async function adminCall(
  request: APIRequestContext,
  admin: AdminSession,
  method: 'post' | 'patch',
  path: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const res = await request[method](`${serverURL}/api${path}`, {
    headers: { Authorization: `JWT ${admin.token}` },
    data,
  })
  expect(res.status(), `${method.toUpperCase()} ${path}: ${await res.text()}`).toBe(200)
}

export interface ShippingRate {
  zone: string
  shippingClass: string
  priceCents: number
}

/** Aktuelle Versandtarife aus der Test-DB (für Erwartungswerte und zum Wiederherstellen). */
export async function currentShippingRates(): Promise<ShippingRate[]> {
  const payload = await testPayload()
  const settings = (await payload.findGlobal({ slug: 'settings', overrideAccess: true })) as {
    shipping?: { rates?: ShippingRate[] | null } | null
  }
  return (settings.shipping?.rates ?? []).map(({ zone, shippingClass, priceCents }) => ({
    zone,
    shippingClass,
    priceCents,
  }))
}
