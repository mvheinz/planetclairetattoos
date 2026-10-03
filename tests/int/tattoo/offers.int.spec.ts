import { createTranslator } from 'next-intl'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import de from '@/i18n/messages/de.json'
import { loadOffers } from '@/lib/data/tattoo'
import {
  currentOrNextOffer,
  daysUntilStart,
  offerDateBadge,
  offerState,
  offerTimeParts,
} from '@/lib/tattoo/offers'
import { addBerlinDays, parseBerlinLocal } from '@/lib/time'

import { getTestPayload, withClock } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P7.3 – Angebote R13 (KONZEPT §5.6, §9.5, DATENMODELL §6.15): Fixtures analog TO1–TO3 (SEED-SPEC §12.2) bei fester Uhr:
// Beginn in 58 Tagen → „in 58 Tagen“, laufend → „läuft gerade“, abgelaufen → nicht ausgeliefert (R-171, DM-OFF-01).

const NOW = '2026-10-14T10:00:00.000Z' // Mi 14.10.2026, 12:00 Berlin
const now = new Date(NOW)
const at = (berlinLocal: string) => parseBerlinLocal(berlinLocal)!.toISOString()
const TAG = 'p7-offers-fixture'

let payload: Payload
const ids: number[] = []

beforeAll(async () => {
  payload = await getTestPayload()
  await payload.delete({
    collection: 'tattoo-offers',
    where: { locationNote: { equals: TAG } },
    overrideAccess: true,
    context: { seed: true },
  })
  const start58 = addBerlinDays(new Date(at('2026-10-14T12:00')), 58)
  const fixtures = [
    {
      type: 'flash_day',
      title: 'Flash-Day: kleine Motive ab 80 €',
      description: 'Ein Tag, vier kleine Motive, Kaffee und Coco.',
      startsAt: start58.toISOString(),
      endsAt: new Date(start58.getTime() + 7 * 3600_000).toISOString(),
    },
    {
      type: 'aktion',
      title: 'Spontane Lücken: winzige Planeten',
      description: 'Diese Woche habe ich ein paar freie Stunden.',
      startsAt: at('2026-10-11T00:00'),
      endsAt: at('2026-10-18T23:59'),
    },
    {
      type: 'flash_day',
      title: 'Flash-Day im Spätsommer',
      description: 'Kleine Motive, großer Spaß – danke an alle!',
      startsAt: at('2026-10-13T12:00'),
      endsAt: at('2026-10-13T19:00'),
    },
  ]
  for (const data of fixtures) {
    const doc = await payload.create({
      collection: 'tattoo-offers',
      data: { ...data, locationNote: TAG, published: true, seed: false } as never,
      overrideAccess: true,
      context: { seed: true, now: NOW },
    })
    ids.push(doc.id)
  }
})

afterAll(async () => {
  await payload.delete({
    collection: 'tattoo-offers',
    where: { id: { in: ids } },
    overrideAccess: true,
    context: { seed: true },
  })
})

describe('Angebote (P7.3)', () => {
  it('R-171 Angebot mit Ende gestern wird nicht ausgeliefert (Abfrage, REST, Loader)', async () => {
    await withClock(NOW, async () => {
      const list = (await loadOffers('de')).filter((o) => ids.includes(o.id))
      expect(list.map((o) => o.title)).toEqual([
        'Spontane Lücken: winzige Planeten',
        'Flash-Day: kleine Motive ab 80 €',
      ])
      const res = await rest('GET', `/tattoo-offers?limit=100&depth=0`)
      const body = (await res.json()) as { docs: { id: number }[] }
      const visible = body.docs.map((d) => d.id).filter((id) => ids.includes(id))
      expect(visible).toHaveLength(2)
      expect(visible).not.toContain(ids[2])
    })
  })

  it('R-171 Zustand aus der Uhr: „in 58 Tagen“, „läuft gerade“, abgelaufen unsichtbar; Teaser = laufendes', async () => {
    const t = createTranslator({ locale: 'de', messages: de, namespace: 'tattoo.offers' })
    const [to1, to2, to3] = await Promise.all(
      ids.map((id) => payload.findByID({ collection: 'tattoo-offers', id, overrideAccess: true })),
    )
    expect(offerState(to1!, now)).toBe('upcoming')
    expect(t('startsIn', { days: daysUntilStart(to1!, now) })).toBe('in 58 Tagen')
    expect(offerState(to2!, now)).toBe('running')
    expect(t('running')).toBe('läuft gerade')
    expect(offerState(to3!, now)).toBe('ended')
    expect(currentOrNextOffer([to1!, to2!, to3!], now)?.id).toBe(to2!.id)
    // Nach Ende von TO2 ist TO1 das nächste Angebot.
    expect(currentOrNextOffer([to1!, to2!, to3!], new Date(at('2026-10-19T00:00')))?.id).toBe(
      to1!.id,
    )
  })

  it('Datums-Badge und Uhrzeit (KONZEPT §9.5)', () => {
    const oneDay = { startsAt: at('2026-12-12T12:00'), endsAt: at('2026-12-12T19:00') }
    expect(offerDateBadge(oneDay, 'de')).toBe('Sa 12.12.')
    expect(offerDateBadge(oneDay, 'en')).toBe('Sat 12 Dec')
    expect(offerTimeParts(oneDay, 'de')).toEqual({ from: '12', to: '19' })
    expect(offerTimeParts(oneDay, 'en')).toEqual({ from: '12:00', to: '19:00' })
    const twoDays = { startsAt: at('2026-10-12T00:00'), endsAt: at('2026-10-13T23:59') }
    expect(offerDateBadge(twoDays, 'de')).toBe('12.–13.10.')
    expect(offerDateBadge(twoDays, 'en')).toBe('12–13 Oct')
    expect(offerTimeParts(twoDays, 'de')).toBeNull()
    const months = { startsAt: at('2026-10-30T10:00'), endsAt: at('2026-11-02T18:30') }
    expect(offerDateBadge(months, 'de')).toBe('30.10.–02.11.')
    expect(offerTimeParts(months, 'de')).toEqual({ from: '10:00', to: '18:30' })
  })
})
