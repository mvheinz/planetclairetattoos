import 'server-only'

import type { PayloadRequest } from 'payload'

import { writeAudit } from '@/lib/audit'
import {
  defaultCarrierFor,
  getCarrierAdapter,
  isCarrierCode,
  parseTrackingNumber,
  trackingTemplatesFromSettings,
  type CarrierCode,
} from '@/lib/carrier'
import { inTransaction } from '@/lib/payload/transaction'
import type { Order } from '@/payload-types'

import { loadSettings, packagingToRecord, type PackagingInput } from './packOrder'
import { packagingRecorded, shippingClassesOf } from './packing'
import { loadOrder, lockOrder, transitionOrder } from './transitionOrder'

// „Versendet melden“ (O7, DATENMODELL §6.8.5, KONZEPT §7.6): nur `paid`/`packed` mit Versand; Versanddienst
// (vorbelegt aus der Versandklasse), Sendungsnummer Pflicht bei `paket_klein`/`keramik`, bei `brief` optional;
// Verpackung erfasst (Pflicht, DM-ORD-07 – wird hier mit der übergebenen bzw. vorbelegten Vorlage erfasst, falls
// „Gepackt“ übersprungen wurde). Keramik ohne Packfoto: kein Zwang, aber Rückfrage „Ohne Packfoto versenden?“ – erst
// mit `confirmWithoutPackingPhoto: true` wird versendet und Audit `packing_photo_skipped` geschrieben (R-100).
// Die Versandmail M06 ergänzt P5.15 (über die Outbox in derselben Transaktion).

export const SHIP_WITHOUT_PHOTO_QUESTION = 'Ohne Packfoto versenden?'
export const SHIP_WITHOUT_PHOTO_CODE = 'packing_photo_missing'

export class ShipError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ShipError'
  }
}

export interface ShipInput {
  carrier?: unknown
  trackingNumber?: unknown
  confirmWithoutPackingPhoto?: unknown
  packaging?: PackagingInput | null
}

const TRACKING_REQUIRED = new Set(['paket_klein', 'keramik'])

export async function shipOrder(
  req: PayloadRequest,
  order: Order,
  input: ShipInput,
  now: Date,
): Promise<{ order: Order; unchanged: boolean }> {
  return inTransaction(req, async () => {
    const locked = await lockOrder(req, order.id)
    if (locked.status === 'shipped')
      return { order: await loadOrder(req, order.id), unchanged: true }
    if (order.fulfillmentMethod !== 'shipping') {
      throw new ShipError(409, '„Versendet melden“ gibt es nur bei Bestellungen mit Versand.')
    }
    if (locked.status !== 'paid' && locked.status !== 'packed') {
      throw new ShipError(
        409,
        locked.status === 'withdrawal_received'
          ? 'Nicht mehr versenden – Widerruf!'
          : 'Diese Bestellung lässt sich nicht (mehr) als versendet melden.',
      )
    }
    const carrier: CarrierCode = isCarrierCode(input.carrier)
      ? input.carrier
      : defaultCarrierFor(order.shippingClass)
    const rawTracking = typeof input.trackingNumber === 'string' ? input.trackingNumber.trim() : ''
    const trackingNumber = rawTracking ? parseTrackingNumber(rawTracking) : null
    if (rawTracking && !trackingNumber) {
      throw new ShipError(400, 'Sendungsnummer: 8–35 Buchstaben oder Ziffern, ohne Sonderzeichen.')
    }
    const classes = shippingClassesOf(order)
    if (!trackingNumber && classes.some((c) => TRACKING_REQUIRED.has(c))) {
      throw new ShipError(
        409,
        'Bitte die Sendungsnummer eingeben oder scannen (Pflicht bei Paketen).',
      )
    }

    const current = await loadOrder(req, order.id)
    const packaging = input.packaging
      ? await packagingToRecord(req, current, input.packaging)
      : null
    if (!packaging && !packagingRecorded(current.packaging)) {
      throw new ShipError(
        409,
        'Bitte zuerst die Verpackung erfassen (Vorlage und Gewicht) – sie ist Pflicht vor dem Versand.',
        'packaging_missing',
      )
    }
    const photos = Array.isArray(current.packingPhotos) ? current.packingPhotos.length : 0
    const skipPhoto = classes.includes('keramik') && photos === 0
    if (skipPhoto && input.confirmWithoutPackingPhoto !== true) {
      throw new ShipError(409, SHIP_WITHOUT_PHOTO_QUESTION, SHIP_WITHOUT_PHOTO_CODE)
    }

    const settings = await loadSettings(req)
    const adapter = getCarrierAdapter(trackingTemplatesFromSettings(settings))
    const trackingUrl = trackingNumber
      ? adapter.trackingUrl(carrier, trackingNumber, order.locale === 'en' ? 'en' : 'de')
      : null
    const res = await transitionOrder(req, order.id, 'shipped', {
      now,
      expectedFrom: ['paid', 'packed'],
      actorType: 'admin',
      data: {
        shipment: { ...(current.shipment ?? {}), carrier, trackingNumber, trackingUrl },
        ...(packaging ? { packaging } : {}),
      },
    })
    if (skipPhoto) {
      await writeAudit(req, {
        action: 'packing_photo_skipped',
        entityCollection: 'orders',
        entityId: order.id,
        summary: `Bestellung ${order.orderNumber}: Keramik ohne Packfoto versendet (Rückfrage bestätigt am ${now.toISOString()})`,
      })
    }
    return { order: res.order, unchanged: false }
  })
}
