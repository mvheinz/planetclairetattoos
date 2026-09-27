import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

import { testUser } from './adminEnv'

export { testUser }

/**
 * Legt das eine Admin-Konto an (E-03; Zugangsdaten aus SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD). Ein vorhandenes Konto
 * wird vorher entfernt, weil es genau ein Konto geben darf.
 */
export async function seedTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  await payload.delete({
    collection: 'users',
    where: { id: { exists: true } },
    overrideAccess: true,
  })

  await payload.create({
    collection: 'users',
    data: { ...testUser, name: 'Jutta', role: 'admin' },
    overrideAccess: true,
  })
}

/**
 * Entfernt das Test-Admin-Konto nach den Tests.
 */
export async function cleanupTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  await payload.delete({
    collection: 'users',
    where: { email: { equals: testUser.email } },
    overrideAccess: true,
  })
}
