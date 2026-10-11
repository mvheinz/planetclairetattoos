import 'server-only'

import type { PayloadRequest } from 'payload'

import { buildPickupReadyMailData } from '@/lib/email/fulfillmentMailData'
import { enqueueEmail } from '@/lib/email/outbox'
import type { Locale } from '@/lib/enums'
import { preservingReq } from '@/lib/payload/localReq'
import { inTransaction } from '@/lib/payload/transaction'
import type { Order, Setting } from '@/payload-types'

import { restDeliveryAllowed } from './orderTransitions'
import { loadOrder, lockOrder, transitionOrder } from './transitionOrder'
import { itemsUnassignedMessage, unassignedWithdrawalOf } from './withdrawalHold'

// Abholung (PLAN P5.17, KONZEPT §4.9/§7.9, E-29, R-083): „Bereit zur Abholung“ (O8) speichert den von Jutta
// bestätigten Text an der Bestellung (`pickup.messageText`, danach fest) und schickt M07 (`pickup_ready`, Schlüssel
// `pickup_ready:<id>:O8`); die Adresse des Privatstudios steht nur in dieser Mail. „Abgeholt“ (O9) setzt
// `timestamps.pickedUpAt` – Beginn von Widerrufsfrist und Gewährleistung. Nach einer Teil-Erstattung vor der Abholung
// gehen beide auch aus `partially_refunded` (Rest-Lieferung, `restDeliveryAllowed`); Widerruf des ganzen Vertrags
// (`withdrawal_received`) und ein Teil-Widerruf nur im Freitext (Stücke noch nicht zugeordnet) sperren beide.

const WITHDRAWN_MESSAGE = 'Nicht mehr übergeben – Widerruf!'

async function assertNoUnassignedWithdrawal(req: PayloadRequest, orderId: number) {
  const unassigned = await unassignedWithdrawalOf(req, orderId)
  if (unassigned) throw new PickupError(409, itemsUnassignedMessage(unassigned))
}

export const PICKUP_TEXT_MAX = 1500
/** Ab so vielen Wartetagen markiert die Ansicht „Abholung“ die Bestellung (KONZEPT §4.9). */
export const PICKUP_WAIT_WARN_DAYS = 14

export class PickupError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'PickupError'
  }
}

/** Vorlage des Abholtexts: `settings.pickup.instructions` (Sprache der Bestellung) plus Abholadresse. */
export async function pickupTemplateText(req: PayloadRequest, locale: Locale): Promise<string> {
  const settings = (await preservingReq(req, () =>
    req.payload.findGlobal({ slug: 'settings', locale, depth: 0, overrideAccess: true, req }),
  )) as Setting
  const b = settings.business ?? ({} as NonNullable<Setting['business']>)
  const address = [
    b.tradeName || b.legalName,
    b.street,
    [b.postalCode, b.city].filter(Boolean).join(' '),
  ].filter((x): x is string => !!x && x.trim() !== '')
  const intro = settings.pickup?.instructions?.trim() ?? ''
  return [intro, address.join('\n')].filter(Boolean).join('\n\n').slice(0, PICKUP_TEXT_MAX)
}

/** „Bereit zur Abholung“ (O8) mit M07. Schon abholbereit → `unchanged`, keine zweite Mail. */
export async function markReadyForPickup(
  req: PayloadRequest,
  order: Order,
  input: { messageText?: unknown },
  now: Date,
): Promise<{ order: Order; unchanged: boolean; mailJobId: number | string | null }> {
  return inTransaction(req, async () => {
    const locked = await lockOrder(req, order.id)
    if (locked.status === 'ready_for_pickup') {
      return { order: await loadOrder(req, order.id), unchanged: true, mailJobId: null }
    }
    if (order.fulfillmentMethod !== 'pickup') {
      throw new PickupError(409, '„Bereit zur Abholung“ gibt es nur bei Abholung.')
    }
    if (
      locked.status !== 'paid' &&
      !(locked.status === 'partially_refunded' && restDeliveryAllowed('ready_for_pickup', locked))
    ) {
      throw new PickupError(
        409,
        locked.status === 'withdrawal_received'
          ? WITHDRAWN_MESSAGE
          : 'Nur bezahlte Abholbestellungen können abholbereit sein.',
      )
    }
    await assertNoUnassignedWithdrawal(req, order.id)
    const text = typeof input.messageText === 'string' ? input.messageText.trim() : ''
    if (!text) throw new PickupError(400, 'Bitte den Abholtext ausfüllen (Ort, Zeiten, Kontakt).')
    if (text.length > PICKUP_TEXT_MAX) {
      throw new PickupError(400, `Der Abholtext darf höchstens ${PICKUP_TEXT_MAX} Zeichen haben.`)
    }
    const res = await transitionOrder(req, order.id, 'ready_for_pickup', {
      now,
      expectedFrom: ['paid', 'partially_refunded'],
      actorType: 'admin',
      data: { pickup: { messageText: text } },
    })
    const mail = await enqueueEmail(req, {
      template: 'pickup_ready',
      to: res.order.customer.email,
      locale: res.order.locale,
      data: buildPickupReadyMailData(res.order) as unknown as Record<string, unknown>,
      idempotencyKey: `pickup_ready:${order.id}:O8`,
      relations: { order: order.id },
    })
    return { order: res.order, unchanged: false, mailJobId: mail.jobId }
  })
}

/** „Abgeholt“ (O9): `timestamps.pickedUpAt`. Schon abgeholt → `unchanged`. */
export async function markPickedUp(
  req: PayloadRequest,
  order: Order,
  now: Date,
): Promise<{ order: Order; unchanged: boolean }> {
  return inTransaction(req, async () => {
    const locked = await lockOrder(req, order.id)
    if (locked.status === 'picked_up') {
      return { order: await loadOrder(req, order.id), unchanged: true }
    }
    if (
      locked.status !== 'ready_for_pickup' &&
      !(locked.status === 'partially_refunded' && restDeliveryAllowed('picked_up', locked))
    ) {
      throw new PickupError(
        409,
        locked.status === 'withdrawal_received'
          ? WITHDRAWN_MESSAGE
          : '„Abgeholt“ geht erst, wenn die Bestellung abholbereit ist.',
      )
    }
    await assertNoUnassignedWithdrawal(req, order.id)
    const res = await transitionOrder(req, order.id, 'picked_up', {
      now,
      expectedFrom: ['ready_for_pickup', 'partially_refunded'],
      actorType: 'admin',
    })
    return { order: res.order, unchanged: false }
  })
}
