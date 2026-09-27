import { describe, expect, it } from 'vitest'

import packageJson from '../../package.json' with { type: 'json' }

// P0-Rauchtest: stellt sicher, dass die Unit-Test-Pipeline läuft und die Grundannahmen stimmen.
describe('Projektgrundlage', () => {
  it('nutzt die festgelegten Kernpakete', () => {
    expect(packageJson.dependencies.payload).toMatch(/^3\./)
    expect(packageJson.dependencies['@payloadcms/db-postgres']).toBe(
      packageJson.dependencies.payload,
    )
    expect(packageJson.dependencies.next).toMatch(/^16\./)
  })
})
