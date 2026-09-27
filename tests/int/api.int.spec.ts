import { describe, expect, it } from 'vitest'

import { getTestPayload } from './helpers/payload'

describe('API', () => {
  it('fetches users', async () => {
    const payload = await getTestPayload()
    const users = await payload.find({ collection: 'users' })
    expect(users).toBeDefined()
  })
})
