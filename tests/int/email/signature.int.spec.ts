import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Order } from '@/payload-types'

import { readOutbox } from '../../helpers/outbox'
import { resetAdmin } from '../helpers/admin'
import { createOrder, orderData } from '../helpers/commerce'
import { rest } from '../helpers/rest'
import { shopHarness } from '../helpers/shop'

// P5.27 – Mail-Bausteine unter „Texte“ (KONZEPT §7.13, DATENMODELL §7.2): Signatur, Abhol-Vorlage und Antwortzeit-Satz
// DE/EN über den Bereich `mailTexts` (`POST /api/globals/settings/area`) speichern; eine geänderte Signatur erscheint
// in der nächsten M06 `order_shipped` (Snapshot der Grußzeilen).

const h = shopHarness({ start: '2026-10-01T08:00:00.000Z', numbers: [998], tag: 'signature' })
const EMAIL = 'signatur@planetclairetattoos.com'
let token: string
type Texts = { emails?: { signature?: string | null; inquiryResponseTime?: string | null } }
type Pickup = { pickup?: { instructions?: string | null } }
const before: Record<'de' | 'en', { texts: Texts; settings: Pickup }> = {
  de: { texts: {}, settings: {} },
  en: { texts: {}, settings: {} },
}

const load = async (locale: 'de' | 'en') => ({
  texts: (await h.payload.findGlobal({
    slug: 'site-texts',
    locale,
    fallbackLocale: false,
    depth: 0,
    overrideAccess: true,
  })) as Texts,
  settings: (await h.payload.findGlobal({
    slug: 'settings',
    locale,
    fallbackLocale: false,
    depth: 0,
    overrideAccess: true,
  })) as Pickup,
})

const saveArea = async (values: unknown) => {
  const res = await rest(
    'POST',
    '/globals/settings/area',
    { area: 'mailTexts', values },
    { authorization: `JWT ${token}` },
  )
  return { status: res.status, json: (await res.json()) as Record<string, unknown> }
}

const pair = (de?: string | null, en?: string | null) => ({ de: de ?? '', en: en ?? '' })

beforeAll(async () => {
  ;({ token } = await resetAdmin(h.payload, '198.51.100.79'))
  before.de = await load('de')
  before.en = await load('en')
})

afterAll(async () => {
  await saveArea({
    signature: pair(before.de.texts.emails?.signature, before.en.texts.emails?.signature),
    inquiryResponseTime: pair(
      before.de.texts.emails?.inquiryResponseTime,
      before.en.texts.emails?.inquiryResponseTime,
    ),
    pickupInstructions: pair(
      before.de.settings.pickup?.instructions,
      before.en.settings.pickup?.instructions,
    ),
  })
})

describe('Mail-Bausteine und Signatur (P5.27)', () => {
  it('Mail-Bausteine DE/EN speichern: Signatur und Antwortzeit in site-texts, Abhol-Vorlage in settings', async () => {
    const res = await saveArea({
      signature: {
        de: 'Alles Liebe\nJutta (Planet Claire)',
        en: 'All the best,\nJutta (Planet Claire)',
      },
      inquiryResponseTime: {
        de: 'Ich melde mich meist innerhalb von zwei Wochen.',
        en: 'I usually reply within two weeks.',
      },
      pickupInstructions: {
        de: 'Abholung in der Werkstatt, Termin per Mail.',
        en: 'Pick-up at the studio, appointment by email.',
      },
    })
    expect(res.status).toBe(200)
    const de = await load('de')
    const en = await load('en')
    expect(de.texts.emails?.signature).toBe('Alles Liebe\nJutta (Planet Claire)')
    expect(en.texts.emails?.signature).toBe('All the best,\nJutta (Planet Claire)')
    expect(de.texts.emails?.inquiryResponseTime).toBe(
      'Ich melde mich meist innerhalb von zwei Wochen.',
    )
    expect(en.settings.pickup?.instructions).toBe('Pick-up at the studio, appointment by email.')
  })

  it('zu langer Baustein → 400 mit Feldpfad samt Sprache, nichts gespeichert', async () => {
    const res = await saveArea({
      signature: { de: 'x'.repeat(601), en: '' },
      inquiryResponseTime: { de: '', en: '' },
      pickupInstructions: { de: '', en: '' },
    })
    expect(res.status).toBe(400)
    const paths = (res.json.errors as { path: string }[]).map((e) => e.path)
    expect(paths).toContain('emails.signature.de')
    expect((await load('de')).texts.emails?.signature).toBe('Alles Liebe\nJutta (Planet Claire)')
  })

  it('geänderte Signatur erscheint in der nächsten M06 (Snapshot)', async () => {
    const id = await h.piece(998)
    const order = (await createOrder(
      h.payload,
      orderData(99_800, [{ id, itemNumber: 998, shippingClass: 'brief' }], {
        shippingClass: 'brief',
        customer: { name: 'Erika Beispiel', email: EMAIL },
      }),
    )) as Order
    const post = async (action: string, body: unknown = {}) =>
      (
        await rest('POST', `/orders/${order.id}/${action}`, body, {
          authorization: `JWT ${token}`,
          'idempotency-key': crypto.randomUUID(),
        })
      ).status
    expect(await post('packed')).toBe(200)
    expect(await post('ship', { carrier: 'deutsche_post' })).toBe(200)
    const mails = (await readOutbox({ to: EMAIL, type: 'order_shipped' }, h.outboxDir)).filter(
      (m) => m.subject.includes(order.orderNumber),
    )
    expect(mails).toHaveLength(1)
    const text = mails[0]!.text ?? ''
    const start = text.indexOf('Alles Liebe')
    expect(start).toBeGreaterThan(-1)
    expect(text.slice(start, text.indexOf('\n\n', start))).toMatchInlineSnapshot(`
      "Alles Liebe
      Jutta (Planet Claire)"
    `)
    expect(mails[0]!.html).toContain('Jutta (Planet Claire)')
    expect(text).not.toContain('Liebe Grüße')
  })
})
