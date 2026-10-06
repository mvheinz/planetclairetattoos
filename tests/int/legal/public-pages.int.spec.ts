import { createLocalReq, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { loadContactInfo, pickContactInfo } from '@/lib/data/contact'
import { loadLegalText } from '@/lib/data/legal'
import { loadPublicPage } from '@/lib/data/pages'
import { activateLegalText } from '@/lib/legal/activate'
import { fixedClock } from '@/lib/time'

import { deleteCommerce } from '../helpers/commerce'
import { deleteLegalTexts, lexical } from '../helpers/legal'
import { getTestPayload } from '../helpers/payload'

// P2.13/P2.14: Loader der öffentlichen Rechtsseiten (R21–R25) und der Kontaktseite (R20) – Leerzustand statt Fehler,
// Tokens ersetzt (R-012), Platzhalter-Kennzeichnung (R-002), deutscher Rückfall auf EN-Seiten (R-015), DM-PAGE-01.

const NOW = '2026-10-01T10:00:00.000Z'
const clock = fixedClock(NOW)
let payload: Payload

async function activeText(type: string, content: unknown, data: Record<string, unknown> = {}) {
  return payload.create({
    collection: 'legal-texts',
    locale: 'de',
    data: {
      type,
      status: 'active',
      validFrom: '2026-01-01T00:00:00.000Z',
      activatedAt: '2026-01-01T00:00:00.000Z',
      origin: 'placeholder',
      content,
      ...data,
    } as never,
    overrideAccess: true,
    context: { seed: true },
  })
}

const plain = (view: Awaited<ReturnType<typeof loadLegalText>>) =>
  view.state === 'ok' ? JSON.stringify(view.content) : ''

beforeAll(async () => {
  payload = await getTestPayload()
  await deleteCommerce(payload)
  await deleteLegalTexts(payload)
})

afterAll(async () => {
  await deleteCommerce(payload)
  await deleteLegalTexts(payload)
})

describe('Rechtsseiten-Loader (P2.13)', () => {
  it('ohne Fassung: Zustand „missing“ statt Fehler (neutraler Leerzustand)', async () => {
    expect(await loadLegalText('impressum', 'de', { clock })).toEqual({
      state: 'missing',
      type: 'impressum',
    })
  })

  it('R-012 R-002 Platzhalter-Fassung: Tokens ersetzt, kein `{{`, als Platzhalter gekennzeichnet', async () => {
    await activeText(
      'agb',
      lexical('Text folgt von der Kanzlei.', 'Website: {{siteUrl}}', 'Widerruf: {{withdrawalUrl}}'),
    )
    const de = await loadLegalText('agb', 'de', { clock })
    expect(de).toMatchObject({
      state: 'ok',
      type: 'agb',
      isPlaceholder: true,
      germanOnly: false,
      validFrom: '2026-01-01T00:00:00.000Z',
    })
    expect(plain(de)).not.toContain('{{')
    expect(plain(de)).toContain('/de/vertrag-widerrufen')
  })

  it('R-095 Widerrufsbelehrung mit {{returnCostsNote}}: der Baustein „Rücksendekosten“ wird eingesetzt, kein Render-Fehler (P12.11)', async () => {
    await activeText('widerrufsbelehrung', lexical('Rücksendung. {{returnCostsNote}}'))
    const de = await loadLegalText('widerrufsbelehrung', 'de', { clock })
    expect(de.state).toBe('ok')
    expect(plain(de)).toContain('Die unmittelbaren Kosten der Rücksendung der Waren trägst du.')
    expect(plain(de)).not.toContain('{{')
  })

  it('R-015 EN-Seite ohne EN-Fassung: deutscher Text mit Kennzeichen „germanOnly“', async () => {
    const en = await loadLegalText('agb', 'en', { clock })
    expect(en).toMatchObject({ state: 'ok', germanOnly: true })
    expect(plain(en)).toContain('Text folgt von der Kanzlei.')
    // Deutscher Text → deutscher Pfad der Widerrufsfunktion.
    expect(plain(en)).toContain('/de/vertrag-widerrufen')
  })

  it('R-002 Kanzleitext (`origin = lawyer`) ist kein Platzhalter; EN-Fassung wird genutzt', async () => {
    const doc = await payload.create({
      collection: 'legal-texts',
      locale: 'de',
      data: {
        type: 'datenschutz',
        validFrom: NOW,
        origin: 'lawyer',
        content: lexical('Deutscher Text.'),
      } as never,
      overrideAccess: true,
      context: { now: NOW },
    })
    await payload.update({
      collection: 'legal-texts',
      id: doc.id,
      locale: 'en',
      data: { content: lexical('English text.') } as never,
      overrideAccess: true,
      context: { now: NOW },
    })
    await activateLegalText(await createLocalReq({ context: { now: NOW } }, payload), doc.id)
    const en = await loadLegalText('datenschutz', 'en', { clock })
    expect(en).toMatchObject({ state: 'ok', isPlaceholder: false, germanOnly: false })
    expect(plain(en)).toContain('English text.')
  })

  it('R-012 nicht ersetzbares Token: Zustand „unavailable“ statt Fehler, nie ein rohes Token', async () => {
    await activeText('versand-zahlung', lexical('Kosten: {{unbekannt}}'))
    expect(await loadLegalText('versand-zahlung', 'de', { clock })).toEqual({
      state: 'unavailable',
      type: 'versand-zahlung',
    })
  })

  it('geplante Fassung (validFrom in der Zukunft) zählt noch nicht', async () => {
    await activeText('impressum', lexical('Später.'), { validFrom: '2027-01-01T00:00:00.000Z' })
    expect((await loadLegalText('impressum', 'de', { clock })).state).toBe('missing')
  })
})

describe('Kontaktseite (P2.14)', () => {
  it('DM-PAGE-01 fehlt `pages:contact`, liefert der Loader null statt eines Fehlers', async () => {
    await payload.delete({
      collection: 'pages',
      where: { key: { equals: 'contact' } },
      overrideAccess: true,
      context: { seed: true },
    })
    expect(await loadPublicPage('contact', 'de')).toBeNull()
  })

  it('Kontaktwege nur aus der Einstellungs-Whitelist; ungültige Werte fallen weg', async () => {
    expect(
      pickContactInfo({
        business: { email: 'jutta@planetclairetattoos.com' },
        social: { instagramHandle: 'planet.claire.tattoos', contactEmail: 'x@y.de' },
        tattoo: { studioDistrict: 'Neukölln' },
      }),
    ).toEqual({
      email: 'jutta@planetclairetattoos.com',
      instagramHandle: 'planet.claire.tattoos',
      studioDistrict: 'Neukölln',
    })
    expect(
      pickContactInfo({
        business: { email: 'keine-adresse' },
        social: { instagramHandle: 'Böse<script>' },
      }),
    ).toEqual({ email: null, instagramHandle: 'planet.claire.tattoos', studioDistrict: null })
    const info = await loadContactInfo()
    expect(info.instagramHandle).toMatch(/^[a-z0-9._]{1,30}$/)
  })
})
