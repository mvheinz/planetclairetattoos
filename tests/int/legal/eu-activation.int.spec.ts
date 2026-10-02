import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { initialAreaValues, type Obj } from '@/admin/views/settings/settingsAreas'
import { FOOD_CONTACT_BLOCKED_COUNTRIES, isOrderableInCountry } from '@/lib/commerce/orderable'
import { computeShipping, ShippingError } from '@/lib/commerce/shipping'
import { computeTotals } from '@/lib/commerce/totals'

import { resetAdmin } from '../helpers/admin'
import { getTestPayload } from '../helpers/payload'
import { rest } from '../helpers/rest'

// P5.22 – Versand mit EU-Sperre (R-202, R-060, DATENMODELL §7.1): ein EU-Land lässt sich nur mit allen fünf Häkchen
// der EU-Checkliste und „EU-Versand geprüft“ aktivieren (Datum in `euShippingAcknowledgedAt`); Keramik mit
// `foodContact = lebensmittelecht` ist für NL und LU nicht bestellbar (`isOrderableInCountry`, auch in den Summen der
// Kasse über `computeShipping`).

let payload: Payload
let token: string
let snapshot: Obj

const load = async (locale: 'de' | 'en') =>
  (await payload.findGlobal({
    slug: 'settings',
    depth: 0,
    locale,
    fallbackLocale: false,
    overrideAccess: true,
  })) as unknown as Obj

async function shippingValues() {
  return initialAreaValues(await load('de'), await load('en')).shipping
}

async function saveShipping(values: unknown) {
  const res = await rest(
    'POST',
    '/globals/settings/area',
    { area: 'shipping', values },
    { authorization: `JWT ${token}`, 'idempotency-key': crypto.randomUUID() },
  )
  return {
    status: res.status,
    json: (await res.json()) as { errors?: { path: string; message: string }[] },
  }
}

const ALL_CHECKED = {
  authorisedRepresentativeNamed: true,
  ossThresholdChecked: true,
  textileLanguageChecked: true,
  ratesMaintained: true,
  legalTextsAdapted: true,
}

beforeAll(async () => {
  payload = await getTestPayload()
  ;({ token } = await resetAdmin(payload, '198.51.100.66'))
  snapshot = await load('de')
})

afterAll(async () => {
  await payload.updateGlobal({
    slug: 'settings',
    data: { shipping: snapshot.shipping } as never,
    overrideAccess: true,
    context: { seed: true, skipAudit: true },
  })
})

describe('EU-Sperre (P5.22)', () => {
  it('R-202 EU-Land ohne alle fünf Häkchen abgelehnt, mit Häkchen gespeichert inkl. euShippingAcknowledgedAt', async () => {
    const base = await shippingValues()
    expect(base.enabledCountries).toEqual(['DE'])
    const euRates = (['brief', 'paket_klein', 'keramik'] as const).map((c) => ({
      zone: 'EU',
      shippingClass: c,
      price: '12,00',
    }))
    const withNl = {
      ...base,
      enabledCountries: ['DE', 'NL'],
      rates: [...base.rates, ...euRates],
    }

    // Ohne Häkchen und ohne „geprüft“
    let res = await saveShipping(withNl)
    expect(res.status).toBe(400)
    expect(res.json.errors?.map((e) => e.path)).toContain('shipping.enabledCountries')

    // Vier von fünf Häkchen + „geprüft“
    res = await saveShipping({
      ...withNl,
      euChecklist: { ...ALL_CHECKED, legalTextsAdapted: false },
      euShippingAcknowledged: true,
    })
    expect(res.status).toBe(400)
    expect(res.json.errors?.map((e) => e.path)).toContain('shipping.euShippingAcknowledged')
    expect(((await load('de')).shipping as Obj).enabledCountries).toEqual(['DE'])

    // Alle fünf + „geprüft“ → gespeichert mit Datum
    res = await saveShipping({ ...withNl, euChecklist: ALL_CHECKED, euShippingAcknowledged: true })
    expect(res.status).toBe(200)
    const saved = (await load('de')).shipping as Obj
    expect(saved.enabledCountries).toEqual(['DE', 'NL'])
    expect(saved.euShippingAcknowledged).toBe(true)
    expect(typeof saved.euShippingAcknowledgedAt).toBe('string')

    // Zurück auf nur DE: Häkchen weg → Datum leer
    res = await saveShipping({
      ...(await shippingValues()),
      enabledCountries: ['DE'],
      euShippingAcknowledged: false,
    })
    expect(res.status).toBe(200)
    expect(((await load('de')).shipping as Obj).euShippingAcknowledgedAt ?? null).toBeNull()
  })

  it('R-060 GB und US lassen sich nie aktivieren', async () => {
    const res = await saveShipping({
      ...(await shippingValues()),
      enabledCountries: ['DE', 'GB'],
      euChecklist: ALL_CHECKED,
      euShippingAcknowledged: true,
    })
    expect(res.status).toBe(400)
    expect(((await load('de')).shipping as Obj).enabledCountries).toEqual(['DE'])
  })

  it('R-202 Stück lebensmittelecht + Lieferland NL/LU → nicht bestellbar; DE und Deko bleiben bestellbar', () => {
    expect(FOOD_CONTACT_BLOCKED_COUNTRIES).toEqual(['NL', 'LU'])
    expect(isOrderableInCountry({ foodContact: 'lebensmittelecht' }, 'NL')).toBe(false)
    expect(isOrderableInCountry({ foodContact: 'lebensmittelecht' }, 'lu')).toBe(false)
    expect(isOrderableInCountry({ foodContact: 'lebensmittelecht' }, 'DE')).toBe(true)
    expect(isOrderableInCountry({ foodContact: 'deko' }, 'NL')).toBe(true)
    expect(isOrderableInCountry({}, 'NL')).toBe(true)

    const settings = {
      shipping: {
        enabledCountries: ['DE', 'NL'],
        rates: [
          { zone: 'DE' as const, shippingClass: 'keramik' as const, priceCents: 890 },
          { zone: 'EU' as const, shippingClass: 'keramik' as const, priceCents: 1890 },
        ],
      },
    }
    const item = { itemNumber: 987, shippingClass: 'keramik' as const }
    expect(computeShipping([item], 'shipping', settings, { country: 'NL' }).shippingCents).toBe(
      1890,
    )
    let err: unknown
    try {
      computeShipping([{ ...item, foodContact: 'lebensmittelecht' }], 'shipping', settings, {
        country: 'NL',
      })
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(ShippingError)
    expect((err as ShippingError).code).toBe('not_orderable_in_country')
    expect((err as ShippingError).message).toContain('987')
    // Abholung und DE gehen
    expect(
      computeShipping([{ ...item, foodContact: 'lebensmittelecht' }], 'shipping', settings, {
        country: 'DE',
      }).shippingCents,
    ).toBe(890)
    expect(
      computeShipping([{ ...item, foodContact: 'lebensmittelecht' }], 'pickup', settings)
        .shippingCents,
    ).toBe(0)
    // Summen der Kasse (computeTotals) prüfen dieselbe Sperre
    expect(() =>
      computeTotals(
        {
          items: [
            {
              ...item,
              priceCents: 4500,
              vatCategory: 'standard',
              foodContact: 'lebensmittelecht',
            },
          ],
          fulfillmentMethod: 'shipping',
          country: 'NL',
          at: new Date('2026-10-01T10:00:00Z'),
        },
        { ...settings, tax: { modes: [{ mode: 'kleinunternehmer', validFrom: '2026-01-01' }] } },
      ),
    ).toThrow(ShippingError)
  })
})
