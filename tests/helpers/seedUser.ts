import { getPayload, type Payload } from 'payload'

import config from '../../src/payload.config.js'
import { createAdminAccount, unlockAdminAccounts } from '../../scripts/lib/admin'

import { testUser } from './adminEnv'

export { testUser }

let payloadPromise: Promise<Payload> | undefined
const testPayload = () => (payloadPromise ??= getPayload({ config }))

/**
 * Stellt das eine Admin-Konto bereit (E-03) – angelegt wie mit `pnpm admin:create`, Zugangsdaten aus
 * SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD. Idempotent und sicher bei parallelen Test-Dateien: ein vorhandenes Konto mit
 * derselben Adresse wird nur entsperrt (Tests setzen das Passwort nie auf einen anderen Wert).
 */
export async function seedTestUser(): Promise<void> {
  const payload = await testPayload()
  const ensure = async () => {
    const existing = await payload.find({
      collection: 'users',
      depth: 0,
      pagination: false,
      overrideAccess: true,
    })
    const same = existing.docs.find((u) => u.email === testUser.email)
    if (same) {
      // Passwort nicht neu setzen: das würde laufende Reset-Links anderer Test-Dateien ungültig machen.
      await unlockAdminAccounts(payload)
      return
    }
    if (existing.docs.length > 0) {
      await payload.delete({
        collection: 'users',
        where: { id: { exists: true } },
        overrideAccess: true,
      })
    }
    await createAdminAccount(payload, testUser)
  }
  try {
    await ensure()
  } catch {
    // Parallel angelegt (nur ein Konto erlaubt) – noch einmal prüfen.
    await ensure()
  }
}

/** Token für den Passwort-Reset-Link (ohne Mail), z. B. um `ADMIN_ROUTE/reset/<token>` zu prüfen. */
export async function createResetToken(): Promise<string> {
  const payload = await testPayload()
  const token = await payload.forgotPassword({
    collection: 'users',
    data: { email: testUser.email },
    disableEmail: true,
  })
  if (!token) throw new Error('Kein Reset-Token erzeugt – Konto fehlt?')
  return token
}
