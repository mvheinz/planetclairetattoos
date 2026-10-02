import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  buildPackagingReport,
  kgComma,
  packagingTotals,
  PACKAGING_REPORT_HEADER,
} from '@/lib/export/packagingReport'
import { resetEnvCache, seedPreviewModeActive } from '@/lib/env'
import { berlinYear } from '@/lib/time'
import type { Order, Setting } from '@/payload-types'

import { resetAdmin } from '../helpers/admin'
import { createOrder, orderData } from '../helpers/commerce'
import { rest } from '../helpers/rest'
import { shopHarness } from '../helpers/shop'

// P5.11 – Verpackungsmengen (E-47, R-201, DATENMODELL §6.8.8): Jahres-Export summiert kg je Material aller im Berliner
// Kalenderjahr versendeten Bestellungen; Abholungen zählen nicht, Beispieldaten nie (auch nicht mit SEED_PREVIEW_MODE,
// R-124); CSV ohne Kundendaten; eine später geänderte Standardvorlage wirkt nur auf neue Sendungen.

const NUMBERS = [980, 981, 982, 983, 984, 985, 986]
const h = shopHarness({ start: '2026-09-20T08:00:00.000Z', numbers: NUMBERS, tag: 'packaging' })
let token: string
let seq = 0

beforeAll(async () => {
  ;({ token } = await resetAdmin(h.payload, '198.51.100.73'))
})

const SEED_CTX = { seed: true }

/** Versendete Bestellung (Fixture) mit erfasster Verpackung und festem Versandzeitpunkt. */
async function shipped(
  nr: number,
  shippedAt: string,
  components: { material: string; grams: number }[],
  extra: Record<string, unknown> = {},
): Promise<Order> {
  const id = await h.piece(nr)
  return (await createOrder(
    h.payload,
    orderData(98_000 + ++seq, [{ id, itemNumber: nr }], {
      status: 'shipped',
      timestamps: { placedAt: '2025-01-02T10:00:00.000Z', shippedAt },
      packaging: {
        templateKey: 'keramik-doppelkarton',
        templateName: 'Karton in Karton mit Papierpolster',
        components,
        recordedAt: shippedAt,
      },
      ...extra,
    }),
    SEED_CTX,
  )) as Order
}

const auth = () => ({ authorization: `JWT ${token}` })
const csvText = (b: Buffer) => b.toString('utf8')

describe('Verpackungsmengen (P5.11)', () => {
  it('Grund-Seed: drei Vorlagen und Standardzuordnung je Versandklasse (DATENMODELL §7.1, KA-29)', async () => {
    const settings = (await h.payload.findGlobal({ slug: 'settings', depth: 0 })) as Setting
    expect(settings.packaging?.templates?.map((t) => t.key)).toEqual([
      'brief-karton',
      'tasche-papier',
      'keramik-doppelkarton',
    ])
    expect(
      settings.packaging?.defaultsByShippingClass?.map((d) => [d.shippingClass, d.templateKey]),
    ).toEqual([
      ['brief', 'brief-karton'],
      ['paket_klein', 'tasche-papier'],
      ['keramik', 'keramik-doppelkarton'],
    ])
  })

  it('R-201 Jahres-Export: Standardvorlage + geänderte Vorlage summiert je Material; Abholung, Beispieldaten und Folgejahr zählen nicht; CSV ohne Kundendaten', async () => {
    await shipped(980, '2025-03-04T10:00:00.000Z', [{ material: 'paper_cardboard', grams: 900 }])
    await shipped(981, '2025-06-01T10:00:00.000Z', [
      { material: 'paper_cardboard', grams: 90 },
      { material: 'plastic', grams: 15 },
    ])
    // 31.12.2025 23:30 UTC = 01.01.2026 00:30 Berlin → zählt für 2026
    await shipped(982, '2025-12-31T23:30:00.000Z', [{ material: 'other', grams: 60 }])
    // Beispiel-Sendung (seed = true) → nie
    await shipped(983, '2025-05-05T10:00:00.000Z', [{ material: 'plastic', grams: 500 }], {
      seed: true,
    })
    // Abholung → zählt nicht
    const pickupId = await h.piece(984)
    await createOrder(
      h.payload,
      orderData(98_000 + ++seq, [{ id: pickupId, itemNumber: 984 }], {
        status: 'picked_up',
        fulfillmentMethod: 'pickup',
        shippingAddress: undefined,
        shippingZone: undefined,
        shippingClass: undefined,
        shippingCents: 0,
        totalCents: 4500,
        billingAddress: {
          name: 'Erika Beispiel',
          addressLine1: 'Musterstraße 1',
          postalCode: '10115',
          city: 'Berlin',
          country: 'DE',
        },
        timestamps: {
          placedAt: '2025-04-01T10:00:00.000Z',
          pickedUpAt: '2025-04-02T10:00:00.000Z',
        },
        packaging: { components: [{ material: 'plastic', grams: 999 }] },
      }),
      SEED_CTX,
    )

    const totals = await packagingTotals(h.payload, 2025)
    expect(totals.shipments).toBe(2)
    expect(totals.materials).toEqual([
      { material: 'paper_cardboard', grams: 990, shipments: 2 },
      { material: 'plastic', grams: 15, shipments: 1 },
      { material: 'other', grams: 0, shipments: 0 },
    ])
    expect(
      (await packagingTotals(h.payload, 2026)).materials.find((m) => m.material === 'other'),
    ).toMatchObject({ grams: 60, shipments: 1 })

    const { bytes, filename } = await buildPackagingReport(h.payload, 2025)
    expect(filename).toBe('planetclaire-verpackung-2025.csv')
    const text = csvText(bytes)
    expect(text.startsWith('﻿')).toBe(true)
    const lines = text.slice(1).trimEnd().split('\r\n')
    expect(lines[0]).toBe(PACKAGING_REPORT_HEADER.join(';'))
    expect(lines.slice(1)).toEqual([
      'Papier/Pappe/Karton;paper_cardboard;990;0,990;2',
      'Kunststoff;plastic;15;0,015;1',
      'Sonstiges;other;0;0,000;0',
      'Gesamt;;1005;1,005;2',
    ])
    expect(text).not.toContain('@')
    expect(text).not.toContain('Erika')
    expect(text).not.toContain('Musterstraße')

    // R-124: auch mit SEED_PREVIEW_MODE keine Beispiel-Sendung
    vi.stubEnv('SEED_PREVIEW_MODE', 'true')
    vi.stubEnv('APP_ENV', 'preview')
    resetEnvCache()
    try {
      expect(seedPreviewModeActive()).toBe(true)
      const preview = await packagingTotals(h.payload, 2025)
      expect(preview.shipments).toBe(2)
      expect(preview.materials.find((m) => m.material === 'plastic')?.grams).toBe(15)
    } finally {
      vi.unstubAllEnvs()
      resetEnvCache()
    }
  })

  it('R-201 geänderte Standardvorlage wirkt nur auf neue Sendungen', async () => {
    const settings = (await h.payload.findGlobal({ slug: 'settings', depth: 0 })) as Setting
    const before = settings.packaging
    const first = await createOrder(
      h.payload,
      orderData(98_000 + ++seq, [{ id: await h.piece(985), itemNumber: 985 }]),
    )
    const res1 = await rest('POST', `/orders/${first.id}/packed`, {}, auth())
    expect(res1.status).toBe(200)
    try {
      await h.payload.updateGlobal({
        slug: 'settings',
        data: {
          packaging: {
            ...before,
            templates: before?.templates?.map((t) =>
              t.key === 'keramik-doppelkarton'
                ? {
                    ...t,
                    id: undefined,
                    components: [{ material: 'paper_cardboard', grams: 1200 }],
                  }
                : { ...t, id: undefined },
            ),
          },
        } as never,
        overrideAccess: true,
        context: { seed: true, skipAudit: true },
      })
      const second = await createOrder(
        h.payload,
        orderData(98_000 + ++seq, [{ id: await h.piece(986), itemNumber: 986 }]),
      )
      expect((await rest('POST', `/orders/${second.id}/packed`, {}, auth())).status).toBe(200)
      expect((await h.order(first.id as number)).packaging?.components?.[0]?.grams).toBe(900)
      expect((await h.order(second.id as number)).packaging?.components?.[0]?.grams).toBe(1200)

      // beide versenden → Jahressumme aus den gespeicherten Werten
      for (const o of [first, second]) {
        const ship = await rest(
          'POST',
          `/orders/${o.id}/ship`,
          { trackingNumber: `003404343123456${o.id}`, confirmWithoutPackingPhoto: true },
          auth(),
        )
        expect(ship.status).toBe(200)
      }
      const shippedAt = (await h.order(first.id as number)).timestamps.shippedAt!
      const totals = await packagingTotals(h.payload, berlinYear(new Date(shippedAt)))
      expect(totals.materials.find((m) => m.material === 'paper_cardboard')).toMatchObject({
        grams: 2100,
        shipments: 2,
      })
    } finally {
      await h.payload.updateGlobal({
        slug: 'settings',
        data: { packaging: before } as never,
        overrideAccess: true,
        context: { seed: true, skipAudit: true },
      })
    }
  })

  it('GET /api/admin/packaging-report: nur Verwaltung, Jahr Pflicht, CSV als Download', async () => {
    expect((await rest('GET', '/admin/packaging-report?year=2025')).status).toBe(401)
    expect((await rest('GET', '/admin/packaging-report?year=25', undefined, auth())).status).toBe(
      400,
    )
    const res = await rest('GET', '/admin/packaging-report?year=2025', undefined, auth())
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')
    expect(res.headers.get('content-disposition')).toContain('planetclaire-verpackung-2025.csv')
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(kgComma(1005)).toBe('1,005')
  })
})
