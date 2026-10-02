import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { sql } from '@payloadcms/db-postgres'
import { afterAll, describe, expect, it } from 'vitest'

import type { Order } from '@/payload-types'

import { createOrder, dbOf, orderData } from '../helpers/commerce'
import { rest } from '../helpers/rest'
import { shopHarness } from '../helpers/shop'

// P6.2 – Reklamationen (DATENMODELL §6.29, R-110, R-111, DM-CMP-01): Fristen `carrierClaimDueAt` und `warrantyEndsAt`
// per Hook, virtuelles Feld `orders.warrantyEndsAt`, Audit `complaint_changed`, Reklamationsfotos mit Reklamation.

const NOW = '2026-10-12T10:00:00.000Z'
const NUMBERS = [983, 984, 985, 986]
const h = shopHarness({ start: NOW, numbers: NUMBERS, tag: 'complaints' })
const PHOTO = path.resolve('tests/fixtures/images/gps-orientation-6.jpg')
const uploads: number[] = []
let seq = 0

afterAll(async () => {
  for (const id of uploads) {
    await h.payload
      .delete({ collection: 'private-uploads', id, overrideAccess: true, context: { seed: true } })
      .catch(() => undefined)
  }
})

/** Bezahlte Bestellung mit Übergabe (`deliveredAt` bzw. `pickedUpAt`, direkt gesetzt). */
async function handedOver(
  nr: number,
  ts: { deliveredAt?: string; pickedUpAt?: string },
): Promise<Order> {
  const id = await h.piece(nr)
  const order = (await createOrder(
    h.payload,
    orderData(99_800 + ++seq, [{ id, itemNumber: nr }], {
      timestamps: { placedAt: '2026-09-20T10:00:00.000Z', paidAt: '2026-09-20T10:05:00.000Z' },
    }),
  )) as Order
  const db = dbOf(h.payload)
  if (ts.deliveredAt) {
    await db.execute(
      sql`UPDATE orders SET timestamps_delivered_at = ${ts.deliveredAt} WHERE id = ${order.id}`,
    )
  }
  if (ts.pickedUpAt) {
    await db.execute(
      sql`UPDATE orders SET timestamps_picked_up_at = ${ts.pickedUpAt} WHERE id = ${order.id}`,
    )
  }
  return order
}

const complaint = (data: Record<string, unknown>) =>
  h.payload.create({
    collection: 'complaints',
    data: data as never,
    overrideAccess: true,
    context: { now: NOW },
  })

const orderWarranty = async (id: number) =>
  (
    (await h.payload.findByID({ collection: 'orders', id, depth: 0, overrideAccess: true })) as {
      warrantyEndsAt?: string | null
    }
  ).warrantyEndsAt ?? null

describe('Reklamationen (DATENMODELL §6.29)', () => {
  it('DM-CMP-01 Transportschaden: carrierClaimDueAt = Zustellung + 7 Tage; warrantyEndsAt = Zustellung + 2 Jahre, mit Reparatur + 12 Monate', async () => {
    const order = await handedOver(983, { deliveredAt: '2026-10-01T10:00:00.000Z' })
    expect(await orderWarranty(order.id)).toBe('2028-10-01T10:00:00.000Z')

    const c = await complaint({
      order: order.id,
      kind: 'transport_damage',
      receivedAt: '2026-10-03T09:00:00.000Z',
      description: 'Schale mit Sprung angekommen',
    })
    expect(c.status).toBe('open')
    expect(c.carrierClaimDueAt).toBe('2026-10-08T10:00:00.000Z')
    expect(c.warrantyEndsAt).toBe('2028-10-01T10:00:00.000Z')

    const repaired = await h.payload.update({
      collection: 'complaints',
      id: c.id,
      data: {
        remedy: 'repair',
        customerChoice: 'repair',
        customerChoiceAt: '2026-10-05T12:00:00.000Z',
      },
      overrideAccess: true,
      context: { now: NOW },
    })
    expect(repaired.warrantyEndsAt).toBe('2029-10-01T10:00:00.000Z')
    // Bestellung rechnet die Reparatur-Verlängerung ein (§6.8.1)
    expect(await orderWarranty(order.id)).toBe('2029-10-01T10:00:00.000Z')

    // Bestellung bleibt unveränderlich; Wahl ohne Datum und „keine“ sind ungültig
    const other = await handedOver(984, { deliveredAt: '2026-10-01T10:00:00.000Z' })
    await expect(
      h.payload.update({
        collection: 'complaints',
        id: c.id,
        data: { order: other.id },
        overrideAccess: true,
        context: { now: NOW },
      }),
    ).rejects.toThrow()
    await expect(
      complaint({
        order: other.id,
        kind: 'defect',
        receivedAt: NOW,
        customerChoice: 'replacement',
      }),
    ).rejects.toThrow()

    // Audit `complaint_changed` je Anlage und Änderung, ohne Freitext
    const audits = await h.payload.find({
      collection: 'audit-log',
      where: {
        and: [{ action: { equals: 'complaint_changed' } }, { entityId: { equals: String(c.id) } }],
      },
      depth: 0,
      overrideAccess: true,
    })
    expect(audits.totalDocs).toBe(2)
    expect(JSON.stringify(audits.docs)).not.toContain('Sprung')
  })

  it('DM-CMP-01 Abholung: Gewährleistung ab Abholung; Mangel ohne DHL-Frist; ohne Zustellung zählt der Eingang', async () => {
    const order = await handedOver(985, { pickedUpAt: '2026-09-25T15:00:00.000Z' })
    const defect = await complaint({ order: order.id, kind: 'defect', receivedAt: NOW })
    expect(defect.carrierClaimDueAt).toBeNull()
    expect(defect.warrantyEndsAt).toBe('2028-09-25T15:00:00.000Z')
    const damage = await complaint({ order: order.id, kind: 'transport_damage', receivedAt: NOW })
    expect(damage.carrierClaimDueAt).toBe('2026-10-19T10:00:00.000Z')
    expect(await orderWarranty(order.id)).toBe('2028-09-25T15:00:00.000Z')
  })

  it('Reklamation nur zu bezahlten Bestellungen; anonym 403; Reklamationsfotos brauchen die Reklamation', async () => {
    const id = await h.piece(986)
    const unpaid = (await createOrder(
      h.payload,
      orderData(99_800 + ++seq, [{ id, itemNumber: 986 }], {
        status: 'awaiting_prepayment',
        paymentMethod: 'prepayment',
      }),
    )) as Order
    expect(unpaid.timestamps?.paidAt ?? null).toBeNull()
    const err = (await complaint({ order: unpaid.id, kind: 'defect', receivedAt: NOW }).catch(
      (e: unknown) => e,
    )) as { data?: { errors?: { message: string }[] } }
    expect(err.data?.errors?.[0]?.message).toMatch(/bezahlten Bestellungen/)
    expect((await rest('GET', '/complaints')).status).toBe(403)

    const order = await handedOver(983, { deliveredAt: '2026-10-01T10:00:00.000Z' })
    const c = await complaint({ order: order.id, kind: 'transport_damage', receivedAt: NOW })
    const data = await readFile(PHOTO)
    const file = { data, name: 'bruch.jpg', mimetype: 'image/jpeg', size: data.length }
    await expect(
      h.payload.create({
        collection: 'private-uploads',
        data: { purpose: 'complaint_photo' } as never,
        file,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
    const photo = await h.payload.create({
      collection: 'private-uploads',
      data: { purpose: 'complaint_photo', relatedComplaint: c.id } as never,
      file,
      overrideAccess: true,
    })
    uploads.push(photo.id)
    const rel = photo.relatedOrder as number | { id: number } | null | undefined
    expect(typeof rel === 'object' ? rel?.id : rel).toBe(order.id)
    const withPhoto = await h.payload.update({
      collection: 'complaints',
      id: c.id,
      data: { photos: [photo.id] },
      overrideAccess: true,
      context: { now: NOW },
    })
    expect(withPhoto.photos).toHaveLength(1)
  })

  it('LOESCHKONZEPT §5 Legal Hold und Einschränkung an der Bestellung: Zeitstempel und Audit ohne Begründungstext', async () => {
    const order = await handedOver(984, { deliveredAt: '2026-10-01T10:00:00.000Z' })
    const held = (await h.payload.update({
      collection: 'orders',
      id: order.id,
      data: {
        privacy: { legalHold: true, legalHoldReason: 'Offene Reklamation Bruch Schale' },
      } as never,
      overrideAccess: true,
      context: { now: NOW },
    })) as Order
    expect(held.privacy?.legalHoldSince).toBe(NOW)
    const restricted = (await h.payload.update({
      collection: 'orders',
      id: order.id,
      data: { privacy: { ...held.privacy, processingRestricted: true } } as never,
      overrideAccess: true,
      context: { now: NOW },
    })) as Order
    expect(restricted.privacy?.restrictedAt).toBe(NOW)
    const audits = await h.payload.find({
      collection: 'audit-log',
      where: { entityId: { equals: String(order.id) } },
      depth: 0,
      overrideAccess: true,
    })
    const actions = audits.docs.map((a) => a.action)
    expect(actions.filter((a) => a === 'legal_hold_changed')).toHaveLength(1)
    expect(actions.filter((a) => a === 'processing_restricted')).toHaveLength(1)
    expect(JSON.stringify(audits.docs)).not.toContain('Bruch Schale')
    // Legal Hold ohne Begründung ist ungültig
    await expect(
      h.payload.update({
        collection: 'orders',
        id: order.id,
        data: { privacy: { legalHold: true, legalHoldReason: '' } } as never,
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })
})
