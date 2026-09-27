import { getPayload } from 'payload'
import config from '../../src/payload.config.js'

import { testUser } from './adminEnv'

export { testUser }

/**
 * Legt das Test-Admin-Konto an (Zugangsdaten aus SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD).
 */
export async function seedTestUser(): Promise<void> {
  const payload = await getPayload({ config })

  await payload.delete({
    collection: 'users',
    where: { email: { equals: testUser.email } },
  })

  await payload.create({
    collection: 'users',
    data: testUser,
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
  })
}
