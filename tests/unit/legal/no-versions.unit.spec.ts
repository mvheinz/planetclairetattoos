import { describe, expect, it } from 'vitest'

import configPromise from '@payload-config'

// P6.2 (R-154, DATENMODELL §1.6, LOESCHKONZEPT §1): Collections mit Personendaten bzw. Einwilligungen haben keine
// Payload-Versionen, keine Entwürfe und keinen Papierkorb – sonst blieben gelöschte oder anonymisierte Inhalte in
// `_<slug>_v` bzw. im Papierkorb erhalten.

const PERSONAL = [
  'orders',
  'checkouts',
  'withdrawals',
  'complaints',
  'inquiries',
  'privacy-requests',
  'email-log',
  'consent-log',
  'private-uploads',
  'tattoo-gallery',
] as const

const config = await configPromise
const bySlug = new Map(config.collections.map((c) => [c.slug, c]))

describe('R-154 keine Versionen, Entwürfe oder Papierkorb bei Personendaten', () => {
  it('R-154 alle zehn Collections sind in der Payload-Konfiguration registriert', () => {
    for (const slug of PERSONAL) expect(bySlug.has(slug), slug).toBe(true)
  })

  for (const slug of PERSONAL) {
    it(`R-154 ${slug}: ohne versions, drafts und trash`, () => {
      const c = bySlug.get(slug)!
      expect(c.versions ?? false, `${slug}.versions`).toBe(false)
      expect(c.trash ?? false, `${slug}.trash`).toBe(false)
    })
  }

  it('R-154 Gegenprobe: eine Inhalts-Collection mit Versionen wird erkannt', () => {
    expect(bySlug.get('pages')?.versions).toBeTruthy()
  })
})
